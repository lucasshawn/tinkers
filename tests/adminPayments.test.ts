import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handler } from '../netlify/functions/admin-payments';
import { createSessionToken } from '../netlify/functions/admin-auth';
import { adminPayments } from '../src/services/adminPayments';
import { adminAuth } from '../src/services/adminAuth';

const mockList = vi.fn();
vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      checkout = {
        sessions: {
          list: mockList,
        },
      };
    },
  };
});

describe('admin-payments Netlify Function', () => {
  const originalEnv = { ...process.env };
  const validToken = createSessionToken('lucasshawn@gmail.com', Date.now() + 86400000);

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('rejects unauthenticated requests with 401', async () => {
    const event = {
      httpMethod: 'GET',
      headers: {},
    };

    const res = (await handler(event as any, {} as any)) as any;
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error).toMatch(/authentication required/i);
  });

  it('rejects invalid or forged session token with 403', async () => {
    const event = {
      httpMethod: 'GET',
      headers: { authorization: 'Bearer invalid.fake-signature' },
    };

    const res = (await handler(event as any, {} as any)) as any;
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).error).toMatch(/unauthorized/i);
  });

  it('returns demo mode mock data when STRIPE_SECRET_KEY is not set', async () => {
    delete process.env.STRIPE_SECRET_KEY;

    const event = {
      httpMethod: 'GET',
      headers: { authorization: `Bearer ${validToken}` },
    };

    const res = (await handler(event as any, {} as any)) as any;
    expect(res.statusCode).toBe(200);

    const data = JSON.parse(res.body);
    expect(data.connected).toBe(false);
    expect(data.mode).toBe('demo');
    expect(data.summary).toBeDefined();
    expect(data.summary.totalRevenue).toBeGreaterThan(0);
    expect(data.summary.orderCount).toBeGreaterThan(0);
    expect(data.summary.averageOrderValue).toBeGreaterThan(0);
    expect(Array.isArray(data.transactions)).toBe(true);
    expect(data.transactions.length).toBeGreaterThan(0);

    // Verify first demo transaction structure
    const firstTx = data.transactions[0];
    expect(firstTx.id).toBeDefined();
    expect(firstTx.customerEmail).toBeDefined();
    expect(firstTx.amount).toBeGreaterThan(0);
    expect(firstTx.currency).toBe('usd');
    expect(firstTx.status).toBe('paid');
    expect(Array.isArray(firstTx.items)).toBe(true);
  });

  it('fetches and maps Stripe sessions when STRIPE_SECRET_KEY is set', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock_12345';

    // Mock Stripe checkout sessions
    const mockSessions = {
      data: [
        {
          id: 'cs_test_001',
          customer_details: { email: 'buyer1@example.com' },
          amount_total: 2800, // $28.00 in cents
          currency: 'usd',
          payment_status: 'paid',
          created: 1773000000, // Unix timestamp in seconds
          livemode: false,
          metadata: { giftNote: 'For Sarah with love!' },
          line_items: {
            data: [
              {
                description: 'Chubby Bumblebee (Keychain)',
                quantity: 2,
                amount_total: 2800,
              },
            ],
          },
        },
        {
          id: 'cs_test_002',
          customer_details: { email: 'buyer2@example.com' },
          amount_total: 1600, // $16.00 in cents
          currency: 'usd',
          payment_status: 'paid',
          created: 1773050000,
          livemode: false,
          metadata: {},
          line_items: {
            data: [
              {
                description: 'Ghost Figurine (Magnet)',
                quantity: 1,
                amount_total: 1600,
              },
            ],
          },
        },
      ],
    };

    mockList.mockResolvedValueOnce(mockSessions);

    const event = {
      httpMethod: 'GET',
      headers: { authorization: `Bearer ${validToken}` },
    };

    const res = (await handler(event as any, {} as any)) as any;
    expect(res.statusCode).toBe(200);

    const data = JSON.parse(res.body);
    expect(data.connected).toBe(true);
    expect(data.mode).toBe('test');
    expect(data.summary.orderCount).toBe(2);
    expect(data.summary.totalRevenue).toBe(44.0);
    expect(data.summary.averageOrderValue).toBe(22.0);
    expect(data.transactions.length).toBe(2);
    expect(data.transactions[0].id).toBe('cs_test_001');
    expect(data.transactions[0].customerEmail).toBe('buyer1@example.com');
    expect(data.transactions[0].amount).toBe(28.0);
    expect(data.transactions[0].giftNote).toBe('For Sarah with love!');
    expect(data.transactions[0].items[0].name).toBe('Chubby Bumblebee (Keychain)');
  });

  it('authorizes session token for an admin persisted in Netlify Blobs', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const weeblesToken = createSessionToken('weeblesclay@gmail.com', Date.now() + 86400000);
    const blobsPayload = Buffer.from(
      JSON.stringify({ url: 'https://edge.netlify.com', token: 'blobs-token-123' })
    ).toString('base64');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        admins: ['lucasshawn@gmail.com', 'lucascierra24@gmail.com', 'weeblesclay@gmail.com'],
      }),
    }) as any;

    const event = {
      httpMethod: 'GET',
      headers: {
        authorization: `Bearer ${weeblesToken}`,
        'x-nf-site-id': 'site-abc',
      },
      blobs: blobsPayload,
    };

    const res = (await handler(event as any, {} as any)) as any;
    expect(res.statusCode).toBe(200);
  });
});

describe('adminPayments client service', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('fetchPayments throws error when not authenticated', async () => {
    await expect(adminPayments.fetchPayments()).rejects.toThrow(/not authenticated/i);
  });

  it('fetchPayments fetches payments with session Bearer token', async () => {
    adminAuth.setSession({
      token: 'session-token-abc',
      email: 'lucasshawn@gmail.com',
    });

    const mockResponse = {
      connected: true,
      mode: 'live',
      summary: {
        totalRevenue: 100,
        orderCount: 4,
        averageOrderValue: 25,
      },
      transactions: [],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as any);

    const result = await adminPayments.fetchPayments();
    expect(result.connected).toBe(true);
    expect(result.summary.totalRevenue).toBe(100);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/.netlify/functions/admin-payments',
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer session-token-abc',
        },
      })
    );
  });

  it('fetchPayments throws error when API returns failure', async () => {
    adminAuth.setSession({
      token: 'session-token-abc',
      email: 'lucasshawn@gmail.com',
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Stripe rate limit exceeded' }),
    } as any);

    await expect(adminPayments.fetchPayments()).rejects.toThrow('Stripe rate limit exceeded');
  });
});
