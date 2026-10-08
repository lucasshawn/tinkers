import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCheckoutSession } from '../src/services/stripe';
import { handler } from '../netlify/functions/create-checkout';
import { CartItem } from '../src/types';

const mockCreateSession = vi.fn();

vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      checkout = {
        sessions: {
          create: mockCreateSession,
        },
      };
    },
  };
});

const mockCart: CartItem[] = [
  {
    id: 'weeble-strawberry-bunny-magnet',
    productId: 'weeble-strawberry-bunny',
    name: 'Strawberry Bunny',
    variant: 'magnet',
    price: 14.0,
    image: 'https://example.com/img.jpg',
    quantity: 2,
  },
  {
    id: 'weeble-matcha-frog-keychain',
    productId: 'weeble-matcha-frog',
    name: 'Matcha Boba Froggy',
    variant: 'keychain',
    price: 15.0,
    image: '',
    quantity: 1,
  },
];

describe('stripeService client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('posts cart items to create-checkout netlify function', async () => {
    const mockResponse = { url: 'https://checkout.stripe.com/pay/cs_test_123' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as any);

    const result = await createCheckoutSession(mockCart, 'Pack cute please');
    expect(global.fetch).toHaveBeenCalledWith('/.netlify/functions/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: mockCart, giftNote: 'Pack cute please' }),
    });
    expect(result.url).toBe(mockResponse.url);
  });

  it('works when giftNote is omitted', async () => {
    const mockResponse = { url: 'https://checkout.stripe.com/pay/cs_test_123' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as any);

    const result = await createCheckoutSession(mockCart);
    expect(global.fetch).toHaveBeenCalledWith('/.netlify/functions/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: mockCart, giftNote: undefined }),
    });
    expect(result.url).toBe(mockResponse.url);
  });

  it('throws error with message when server response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Cart is empty' }),
    } as any);

    await expect(createCheckoutSession(mockCart)).rejects.toThrow('Cart is empty');
  });

  it('throws fallback error when server response is not ok and json parse fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => {
        throw new Error('JSON error');
      },
    } as any);

    await expect(createCheckoutSession(mockCart)).rejects.toThrow(
      'Failed to create Stripe checkout session'
    );
  });
});

describe('create-checkout Netlify Function handler', () => {
  const originalEnv = process.env.STRIPE_SECRET_KEY;

  afterEach(() => {
    process.env.STRIPE_SECRET_KEY = originalEnv;
    vi.restoreAllMocks();
  });

  it('returns 405 Method Not Allowed for non-POST requests', async () => {
    const response = (await handler(
      { httpMethod: 'GET', headers: {} } as any,
      {} as any,
      () => {}
    )) as any;

    expect(response.statusCode).toBe(405);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Method Not Allowed');
  });

  it('returns 400 when items array is missing or empty', async () => {
    const responseEmpty = (await handler(
      {
        httpMethod: 'POST',
        headers: {},
        body: JSON.stringify({ items: [] }),
      } as any,
      {} as any,
      () => {}
    )) as any;

    expect(responseEmpty.statusCode).toBe(400);
    expect(JSON.parse(responseEmpty.body).error).toBe('Cart is empty');

    const responseNull = (await handler(
      {
        httpMethod: 'POST',
        headers: {},
        body: JSON.stringify({}),
      } as any,
      {} as any,
      () => {}
    )) as any;

    expect(responseNull.statusCode).toBe(400);
    expect(JSON.parse(responseNull.body).error).toBe('Cart is empty');
  });

  it('returns fallback demo url when STRIPE_SECRET_KEY is not set', async () => {
    delete process.env.STRIPE_SECRET_KEY;

    const response = (await handler(
      {
        httpMethod: 'POST',
        headers: { origin: 'http://localhost:3000' },
        body: JSON.stringify({ items: mockCart, giftNote: 'Happy Birthday' }),
      } as any,
      {} as any,
      () => {}
    )) as any;

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.url).toBe('http://localhost:3000/order-success?demo_mode=true');
  });

  it('creates Stripe checkout session when STRIPE_SECRET_KEY is set', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_123';
    mockCreateSession.mockResolvedValue({
      url: 'https://checkout.stripe.com/pay/cs_test_mock',
    });

    const response = (await handler(
      {
        httpMethod: 'POST',
        headers: { origin: 'https://weebles.store' },
        body: JSON.stringify({ items: mockCart, giftNote: 'Wrap in pink ribbon' }),
      } as any,
      {} as any,
      () => {}
    )) as any;

    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_method_types: ['card'],
        mode: 'payment',
        shipping_address_collection: {
          allowed_countries: ['US', 'CA'],
        },
        metadata: {
          giftNote: 'Wrap in pink ribbon',
        },
        success_url: 'https://weebles.store/order-success?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'https://weebles.store/',
      })
    );

    const lineItems = mockCreateSession.mock.calls[0][0].line_items;
    expect(lineItems).toHaveLength(2);
    expect(lineItems[0].price_data.product_data.name).toContain('Strawberry Bunny');
    expect(lineItems[0].price_data.product_data.name).toContain('🧲 Refrigerator Magnet');
    expect(lineItems[0].price_data.unit_amount).toBe(1400);
    expect(lineItems[0].quantity).toBe(2);

    expect(lineItems[1].price_data.product_data.name).toContain('Matcha Boba Froggy');
    expect(lineItems[1].price_data.product_data.name).toContain('🔑 Keychain');
    expect(lineItems[1].price_data.unit_amount).toBe(1500);
    expect(lineItems[1].quantity).toBe(1);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).url).toBe('https://checkout.stripe.com/pay/cs_test_mock');
  });

  it('returns 400 when an item productId is not found in catalog', async () => {
    const response = (await handler(
      {
        httpMethod: 'POST',
        headers: {},
        body: JSON.stringify({
          items: [{ productId: 'non-existent-item', quantity: 1, variant: 'magnet' }],
        }),
      } as any,
      {} as any,
      () => {}
    )) as any;

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toBe('Product unavailable or sold out');
  });

  it('returns 400 when an item is out of stock in catalog', async () => {
    const response = (await handler(
      {
        httpMethod: 'POST',
        headers: {},
        body: JSON.stringify({
          items: [{ productId: 'weeble-lavender-ghost', quantity: 1, variant: 'magnet' }],
        }),
      } as any,
      {} as any,
      () => {}
    )) as any;

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toBe('Product unavailable or sold out');
  });

  it('ignores manipulated client price and uses authoritative catalog price', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_123';
    mockCreateSession.mockResolvedValue({
      url: 'https://checkout.stripe.com/pay/cs_test_mock',
    });

    const manipulatedCart = [
      {
        id: 'weeble-strawberry-bunny-magnet',
        productId: 'weeble-strawberry-bunny',
        name: 'Strawberry Bunny',
        variant: 'magnet',
        price: 0.01, // manipulated client price
        quantity: 1,
      },
    ];

    const response = (await handler(
      {
        httpMethod: 'POST',
        headers: { origin: 'https://weebles.store' },
        body: JSON.stringify({ items: manipulatedCart }),
      } as any,
      {} as any,
      () => {}
    )) as any;

    expect(response.statusCode).toBe(200);
    const lineItems = mockCreateSession.mock.calls[0][0].line_items;
    expect(lineItems[0].price_data.unit_amount).toBe(1400); // Uses catalog price $14.00, not $0.01
  });

  it('correctly constructs origin with protocol when event.headers.origin is missing', async () => {
    delete process.env.STRIPE_SECRET_KEY;

    const responseLocal = (await handler(
      {
        httpMethod: 'POST',
        headers: { host: 'localhost:8888' },
        body: JSON.stringify({ items: mockCart }),
      } as any,
      {} as any,
      () => {}
    )) as any;

    expect(responseLocal.statusCode).toBe(200);
    expect(JSON.parse(responseLocal.body).url).toBe(
      'http://localhost:8888/order-success?demo_mode=true'
    );

    const responseForwarded = (await handler(
      {
        httpMethod: 'POST',
        headers: { host: 'custom.domain.com', 'x-forwarded-proto': 'https' },
        body: JSON.stringify({ items: mockCart }),
      } as any,
      {} as any,
      () => {}
    )) as any;

    expect(responseForwarded.statusCode).toBe(200);
    expect(JSON.parse(responseForwarded.body).url).toBe(
      'https://custom.domain.com/order-success?demo_mode=true'
    );
  });

  it('returns 500 when Stripe API throws an error', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_123';
    mockCreateSession.mockRejectedValue(new Error('Stripe API error'));

    const response = (await handler(
      {
        httpMethod: 'POST',
        headers: {},
        body: JSON.stringify({ items: mockCart }),
      } as any,
      {} as any,
      () => {}
    )) as any;

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body).error).toBe('Stripe API error');
  });
});
