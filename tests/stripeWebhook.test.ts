import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handler } from '../netlify/functions/stripe-webhook';
import * as adminSave from '../netlify/functions/admin-save';
import * as emailLib from '../netlify/functions/_lib/email';

const mockConstructEvent = vi.fn();
const mockListLineItems = vi.fn();

vi.mock('stripe', () => ({
  default: class MockStripe {
    webhooks = {
      constructEvent: mockConstructEvent,
    };
    checkout = {
      sessions: {
        listLineItems: mockListLineItems,
      },
    };
  },
}));

describe('stripe-webhook Netlify Function', () => {
  const originalSecret = process.env.STRIPE_SECRET_KEY;
  const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123';
    vi.spyOn(adminSave, 'readFromNetlifyBlobs').mockResolvedValue(null);
    vi.spyOn(adminSave, 'saveToNetlifyBlobs').mockResolvedValue(true);
    vi.spyOn(emailLib, 'resolveAdminNotificationRecipients').mockResolvedValue([
      'lucasshawn@gmail.com',
      'lucascierra24@gmail.com',
    ]);
  });

  afterEach(() => {
    if (originalSecret !== undefined) process.env.STRIPE_SECRET_KEY = originalSecret;
    else delete process.env.STRIPE_SECRET_KEY;
    if (originalWebhookSecret !== undefined) {
      process.env.STRIPE_WEBHOOK_SECRET = originalWebhookSecret;
    } else {
      delete process.env.STRIPE_WEBHOOK_SECRET;
    }
    vi.restoreAllMocks();
  });

  it('returns 405 for non-POST requests', async () => {
    const res = (await handler({ httpMethod: 'GET', headers: {} } as any, {} as any, () => {})) as any;
    expect(res.statusCode).toBe(405);
  });

  it('returns 500 when STRIPE_WEBHOOK_SECRET is missing', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = (await handler(
      { httpMethod: 'POST', headers: { 'stripe-signature': 'sig' }, body: '{}' } as any,
      {} as any,
      () => {}
    )) as any;
    expect(res.statusCode).toBe(500);
    errorSpy.mockRestore();
  });

  it('returns 400 when stripe-signature header is missing', async () => {
    const res = (await handler(
      { httpMethod: 'POST', headers: {}, body: '{}' } as any,
      {} as any,
      () => {}
    )) as any;
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when webhook signature verification fails', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = (await handler(
      { httpMethod: 'POST', headers: { 'stripe-signature': 'bad_sig' }, body: '{}' } as any,
      {} as any,
      () => {}
    )) as any;

    expect(res.statusCode).toBe(400);
    errorSpy.mockRestore();
  });

  it('ignores unrelated Stripe event types', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'payment_intent.created',
      data: { object: {} },
    });
    const sendSpy = vi.spyOn(emailLib, 'sendAdminEmail');

    const res = (await handler(
      { httpMethod: 'POST', headers: { 'stripe-signature': 'sig' }, body: '{}' } as any,
      {} as any,
      () => {}
    )) as any;

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ received: true, ignored: true });
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('skips checkout.session.completed when payment_status is not paid', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_unpaid',
          payment_status: 'unpaid',
        },
      },
    });
    const sendSpy = vi.spyOn(emailLib, 'sendAdminEmail');

    const res = (await handler(
      { httpMethod: 'POST', headers: { 'stripe-signature': 'sig' }, body: '{}' } as any,
      {} as any,
      () => {}
    )) as any;

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ received: true, skipped: 'unpaid' });
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('emails all admins with items, gift note, and replyTo on paid checkout.session.completed', async () => {
    const rawPayload = JSON.stringify({ id: 'evt_1' });
    const base64Body = Buffer.from(rawPayload).toString('base64');

    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_paid_123',
          payment_status: 'paid',
          amount_total: 2950,
          currency: 'usd',
          created: 1764000000,
          customer_details: {
            name: 'Emily <3',
            email: 'emily@example.com',
            address: {
              line1: '123 Clay St',
              city: 'Seattle',
              state: 'WA',
              postal_code: '98101',
              country: 'US',
            },
          },
          metadata: {
            giftNote: 'Wrap with <sparkles>!',
          },
        },
      },
    });

    mockListLineItems.mockResolvedValue({
      data: [
        {
          description: 'Chubby Bumblebee (🔑 Keychain)',
          quantity: 2,
          amount_total: 2950,
        },
      ],
    });

    const sendSpy = vi
      .spyOn(emailLib, 'sendAdminEmail')
      .mockResolvedValue({ sent: true, messageId: '<ok@gmail.com>' });

    const res = (await handler(
      {
        httpMethod: 'POST',
        headers: { 'stripe-signature': 't=1,v1=abc' },
        body: base64Body,
        isBase64Encoded: true,
      } as any,
      {} as any,
      () => {}
    )) as any;

    expect(mockConstructEvent).toHaveBeenCalledWith(
      Buffer.from(rawPayload),
      't=1,v1=abc',
      'whsec_test_123'
    );
    expect(mockListLineItems).toHaveBeenCalledWith('cs_test_paid_123', { limit: 100 });
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['lucasshawn@gmail.com', 'lucascierra24@gmail.com'],
        subject: 'New Weebles Order! $29.50 from Emily <3',
        replyTo: 'emily@example.com',
      })
    );
    const callArg = sendSpy.mock.calls[0][0];
    expect(callArg.text).toContain('Chubby Bumblebee (🔑 Keychain) x2 ($29.50)');
    expect(callArg.text).toContain('Wrap with <sparkles>!');
    expect(callArg.text).toContain('123 Clay St');
    expect(callArg.html).toContain('Wrap with &lt;sparkles&gt;!');
    expect(callArg.html).not.toContain('<sparkles>');
    expect(adminSave.saveToNetlifyBlobs).toHaveBeenCalledWith(
      expect.anything(),
      'notified-order:cs_test_paid_123',
      expect.stringContaining('cs_test_paid_123')
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ received: true, emailed: true });
  });

  it('skips duplicate notifications already recorded in Netlify Blobs', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_dup',
          payment_status: 'paid',
        },
      },
    });
    vi.spyOn(adminSave, 'readFromNetlifyBlobs').mockResolvedValue({
      notifiedAt: '2026-11-24T20:00:00.000Z',
    });
    const sendSpy = vi.spyOn(emailLib, 'sendAdminEmail');

    const res = (await handler(
      { httpMethod: 'POST', headers: { 'stripe-signature': 'sig' }, body: '{}' } as any,
      {} as any,
      () => {}
    )) as any;

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ received: true, duplicate: true });
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('returns 500 when sending email throws so Stripe retries', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_fail',
          payment_status: 'paid',
          amount_total: 1400,
          currency: 'usd',
          customer_details: { email: 'buyer@example.com' },
        },
      },
    });
    mockListLineItems.mockResolvedValue({ data: [] });
    vi.spyOn(emailLib, 'sendAdminEmail').mockRejectedValue(new Error('SMTP timeout'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = (await handler(
      { httpMethod: 'POST', headers: { 'stripe-signature': 'sig' }, body: '{}' } as any,
      {} as any,
      () => {}
    )) as any;

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error).toBe('SMTP timeout');
    errorSpy.mockRestore();
  });
});
