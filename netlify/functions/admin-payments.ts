import { Handler } from '@netlify/functions';
import crypto from 'crypto';
import Stripe from 'stripe';
import { getAllowedAdmins } from './admin-auth';
import { PaymentItem, PaymentsResponse, TransactionRecord } from '../../src/types/payments';

function verifyToken(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '').trim();
  try {
    const [payloadBase64, signature] = token.split('.');
    if (!payloadBase64 || !signature) return null;
    const sessionSecret = process.env.ADMIN_SESSION_SECRET || 'weebles-studio-dev-secret-2026';
    const expectedSig = crypto.createHmac('sha256', sessionSecret).update(payloadBase64).digest('hex');
    if (signature !== expectedSig) return null;
    const decoded = Buffer.from(payloadBase64, 'base64').toString('utf-8');
    const [email, exp] = decoded.split(':');
    if (!email || !exp || isNaN(Number(exp))) return null;
    if (Number(exp) < Date.now()) return null;
    const allowedAdmins = getAllowedAdmins();
    if (!allowedAdmins.includes(email.toLowerCase())) return null;
    return email.toLowerCase();
  } catch {
    return null;
  }
}

const DEMO_TRANSACTIONS: TransactionRecord[] = [
  {
    id: 'cs_demo_98471',
    customerEmail: 'sarah.crochet@gmail.com',
    amount: 32.0,
    currency: 'usd',
    status: 'paid',
    created: Date.now() - 1000 * 60 * 45,
    giftNote: "Can't wait to give this to Lily! 🍓",
    items: [
      { name: 'Chubby Bumblebee (Keychain)', quantity: 1, amount: 16.0 },
      { name: 'Strawberry Bunny (Magnet)', quantity: 1, amount: 16.0 },
    ],
  },
  {
    id: 'cs_demo_98470',
    customerEmail: 'emily.p@outlook.com',
    amount: 16.0,
    currency: 'usd',
    status: 'paid',
    created: Date.now() - 1000 * 60 * 60 * 3,
    giftNote: 'Happy Halloween! 🎃',
    items: [{ name: 'Spooky Ghost (Magnet)', quantity: 1, amount: 16.0 }],
  },
  {
    id: 'cs_demo_98469',
    customerEmail: 'clayfan99@yahoo.com',
    amount: 48.0,
    currency: 'usd',
    status: 'paid',
    created: Date.now() - 1000 * 60 * 60 * 18,
    items: [
      { name: 'Pumpkin Spice Latte (Keychain)', quantity: 1, amount: 16.0 },
      { name: 'Fluffy Pancakes (Magnet)', quantity: 1, amount: 16.0 },
      { name: 'Chocolate Croissant (Charm)', quantity: 1, amount: 16.0 },
    ],
  },
  {
    id: 'cs_demo_98468',
    customerEmail: 'baker_babe@gmail.com',
    amount: 16.0,
    currency: 'usd',
    status: 'paid',
    created: Date.now() - 1000 * 60 * 60 * 36,
    giftNote: 'So cute! Thank you Cierra! ✨',
    items: [{ name: 'French Macaron (Keychain)', quantity: 1, amount: 16.0 }],
  },
];

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Authentication required' }),
    };
  }

  const verifiedAdmin = verifyToken(authHeader);
  if (!verifiedAdmin) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Unauthorized admin session' }),
    };
  }

  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      const paidOrders = DEMO_TRANSACTIONS.filter((t) => t.status === 'paid');
      const totalRevenue = paidOrders.reduce((sum, t) => sum + t.amount, 0);
      const orderCount = paidOrders.length;
      const averageOrderValue = orderCount > 0 ? parseFloat((totalRevenue / orderCount).toFixed(2)) : 0;

      const response: PaymentsResponse = {
        connected: false,
        mode: 'demo',
        summary: {
          totalRevenue,
          orderCount,
          averageOrderValue,
        },
        transactions: DEMO_TRANSACTIONS,
      };

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(response),
      };
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-12-18.acacia' as any,
    });

    const sessions = await stripe.checkout.sessions.list({
      limit: 25,
      expand: ['data.line_items'],
    });

    const transactions: TransactionRecord[] = sessions.data.map((session: any) => {
      const lineItems = session.line_items?.data || [];
      const items: PaymentItem[] = lineItems.map((item: any) => ({
        name: item.description || 'Weebles Figurine',
        quantity: item.quantity || 1,
        amount: (item.amount_total || 0) / 100,
      }));

      const isPaid = session.payment_status === 'paid';
      const isFailed = session.status === 'expired';
      const status: 'paid' | 'pending' | 'failed' = isPaid ? 'paid' : isFailed ? 'failed' : 'pending';

      return {
        id: session.id,
        customerEmail: session.customer_details?.email || session.customer_email || 'guest@checkout.stripe.com',
        amount: (session.amount_total || 0) / 100,
        currency: session.currency || 'usd',
        status,
        created: (session.created || Math.floor(Date.now() / 1000)) * 1000,
        giftNote: session.metadata?.giftNote || undefined,
        items,
      };
    });

    const isLive = sessions.data.some((s: any) => s.livemode) || stripeSecretKey.startsWith('sk_live_');
    const mode = isLive ? 'live' : 'test';

    const paidTransactions = transactions.filter((t) => t.status === 'paid');
    const totalRevenue = paidTransactions.reduce((acc, t) => acc + t.amount, 0);
    const orderCount = paidTransactions.length;
    const averageOrderValue = orderCount > 0 ? parseFloat((totalRevenue / orderCount).toFixed(2)) : 0;

    const response: PaymentsResponse = {
      connected: true,
      mode,
      summary: {
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        orderCount,
        averageOrderValue,
      },
      transactions,
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error('Stripe payments fetch error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal Server Error' }),
    };
  }
};
