import { Handler } from '@netlify/functions';
import Stripe from 'stripe';
import { readFromNetlifyBlobs, saveToNetlifyBlobs } from './admin-save';
import {
  escapeHtml,
  resolveAdminNotificationRecipients,
  sendAdminEmail,
} from './_lib/email';

function formatMoney(amountInCents: number | null | undefined, currency = 'usd'): string {
  const amount = (amountInCents ?? 0) / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function formatAddress(address?: Stripe.Address | null): string {
  if (!address) return '';
  const parts = [
    address.line1,
    address.line2,
    [address.city, address.state, address.postal_code].filter(Boolean).join(', '),
    address.country,
  ].filter(Boolean);
  return parts.join('\n');
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  const stripeSecretKey = (process.env.STRIPE_SECRET_KEY || '').trim();
  const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();

  if (!stripeSecretKey || !webhookSecret) {
    console.error('Stripe webhook misconfigured: STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET missing.');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Stripe webhook is not configured on the server' }),
    };
  }

  const signature =
    event.headers['stripe-signature'] || event.headers['Stripe-Signature'] || '';

  if (!signature) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing Stripe signature header' }),
    };
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2026-03-25.dahlia' as any,
  });

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64')
    : event.body || '';

  let stripeEvent: Stripe.Event;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error('Stripe webhook signature verification failed:', err?.message || err);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid Stripe webhook signature' }),
    };
  }

  if (
    stripeEvent.type !== 'checkout.session.completed' &&
    stripeEvent.type !== 'checkout.session.async_payment_succeeded'
  ) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ received: true, ignored: true }),
    };
  }

  const session = stripeEvent.data.object as Stripe.Checkout.Session & {
    shipping_details?: { name?: string | null; address?: Stripe.Address | null } | null;
    collected_information?: {
      shipping_details?: { name?: string | null; address?: Stripe.Address | null } | null;
    } | null;
  };

  if (session.payment_status !== 'paid') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ received: true, skipped: 'unpaid' }),
    };
  }

  const dedupeKey = `notified-order:${session.id}`;
  try {
    const alreadyNotified = await readFromNetlifyBlobs<{ notifiedAt?: string }>(event, dedupeKey);
    if (alreadyNotified) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ received: true, duplicate: true }),
      };
    }
  } catch {
    // Non-fatal if Blobs is unavailable
  }

  let lineItems: Array<{ description: string; quantity: number; amountTotal: number }> = [];
  try {
    const listed = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
    lineItems = (listed.data || []).map((item) => ({
      description: item.description || 'Weebles Figurine',
      quantity: item.quantity || 1,
      amountTotal: item.amount_total ?? 0,
    }));
  } catch (err) {
    console.warn('Unable to expand Stripe checkout line items for email:', err);
  }

  const currency = session.currency || 'usd';
  const formattedTotal = formatMoney(session.amount_total, currency);
  const customerName =
    session.customer_details?.name ||
    session.collected_information?.shipping_details?.name ||
    session.shipping_details?.name ||
    '';
  const customerEmail = session.customer_details?.email || session.customer_email || '';
  const customerLabel = customerName || customerEmail || 'a customer';
  const giftNote = (session.metadata?.giftNote || '').trim();
  const addressText = formatAddress(
    session.collected_information?.shipping_details?.address ||
      session.shipping_details?.address ||
      session.customer_details?.address
  );
  const orderDate = new Date((session.created || Math.floor(Date.now() / 1000)) * 1000).toUTCString();

  const itemsText =
    lineItems.length > 0
      ? lineItems
          .map(
            (item) =>
              `- ${item.description} x${item.quantity} (${formatMoney(item.amountTotal, currency)})`
          )
          .join('\n')
      : '- (Line items unavailable; check Stripe Dashboard for full breakdown)';

  const textLines = [
    `New Weebles order received!`,
    '',
    `Total Paid: ${formattedTotal}`,
    `Customer: ${customerName || 'Not provided'}`,
    `Email: ${customerEmail || 'Not provided'}`,
    `Date: ${orderDate}`,
    `Stripe Session ID: ${session.id}`,
    '',
    'Items:',
    itemsText,
  ];
  if (giftNote) {
    textLines.push('', `Gift / Packing Note:`, giftNote);
  }
  if (addressText) {
    textLines.push('', `Address:`, addressText);
  }

  const itemsHtml =
    lineItems.length > 0
      ? lineItems
          .map(
            (item) =>
              `<tr>
                <td style="padding:8px 12px;border-bottom:1px solid #fce7f3;">${escapeHtml(item.description)}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #fce7f3;text-align:center;">${item.quantity}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #fce7f3;text-align:right;font-weight:bold;">${escapeHtml(formatMoney(item.amountTotal, currency))}</td>
              </tr>`
          )
          .join('')
      : `<tr><td colspan="3" style="padding:8px 12px;color:#6b7280;">Line items unavailable; check Stripe Dashboard for full breakdown.</td></tr>`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#3b2c35;">
      <div style="background:#fdf2f8;border:2px solid #fbcfe8;border-radius:16px;padding:24px;">
        <h2 style="margin:0 0 8px;color:#ec4899;">New Weebles Order!</h2>
        <p style="margin:0 0 16px;font-size:15px;">You received a paid order for <strong>${escapeHtml(formattedTotal)}</strong> from <strong>${escapeHtml(customerLabel)}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;background:#ffffff;border-radius:12px;overflow:hidden;margin-bottom:16px;">
          <thead>
            <tr style="background:#fce7f3;text-align:left;">
              <th style="padding:8px 12px;">Item</th>
              <th style="padding:8px 12px;text-align:center;">Qty</th>
              <th style="padding:8px 12px;text-align:right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <p style="margin:4px 0;font-size:14px;"><strong>Customer:</strong> ${escapeHtml(customerName || 'Not provided')}</p>
        <p style="margin:4px 0;font-size:14px;"><strong>Email:</strong> ${escapeHtml(customerEmail || 'Not provided')}</p>
        ${
          giftNote
            ? `<div style="margin:12px 0;padding:12px;background:#ffffff;border-left:4px solid #ec4899;border-radius:8px;font-size:14px;"><strong>Gift / Packing Note:</strong><br/>${escapeHtml(giftNote)}</div>`
            : ''
        }
        ${
          addressText
            ? `<p style="margin:12px 0 4px;font-size:14px;"><strong>Address:</strong><br/>${escapeHtml(addressText).replace(/\n/g, '<br/>')}</p>`
            : ''
        }
        <p style="margin:16px 0 0;font-size:12px;color:#6b7280;">Stripe Session: ${escapeHtml(session.id)} &bull; ${escapeHtml(orderDate)}</p>
      </div>
    </div>
  `;

  try {
    const recipients = await resolveAdminNotificationRecipients(event);
    const emailResult = await sendAdminEmail({
      to: recipients,
      subject: `New Weebles Order! ${formattedTotal} from ${customerLabel}`,
      text: textLines.join('\n'),
      html,
      replyTo: customerEmail || undefined,
    });

    if (emailResult.sent) {
      await saveToNetlifyBlobs(
        event,
        dedupeKey,
        JSON.stringify({ notifiedAt: new Date().toISOString(), sessionId: session.id })
      ).catch(() => {});
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ received: true, emailed: emailResult.sent }),
    };
  } catch (err: any) {
    console.error('Failed to send order notification email:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err?.message || 'Failed to send order notification email' }),
    };
  }
};
