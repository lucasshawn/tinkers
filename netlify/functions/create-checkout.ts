import { Handler } from '@netlify/functions';
import Stripe from 'stripe';
import productsData from '../../src/data/products.json';

export const getStripe = (): Stripe | null => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
  return stripeSecretKey
    ? new Stripe(stripeSecretKey, { apiVersion: '2024-12-18.acacia' as any })
    : null;
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const { items, giftNote } = JSON.parse(event.body || '{}');

    if (!items || !Array.isArray(items) || items.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Cart is empty' }),
      };
    }

    // Authoritative catalog validation
    const rawProducts = (productsData as any)?.products || productsData;
    const catalog: any[] = Array.isArray(rawProducts) ? rawProducts : [];

    for (const item of items) {
      const product = catalog.find((p: any) => p.id === item.productId);
      if (!product || !product.inStock) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Product unavailable or sold out' }),
        };
      }
    }

    let origin = event.headers.origin;
    if (!origin) {
      const host = event.headers.host || 'localhost:8888';
      const proto = event.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
      origin = `${proto}://${host}`;
    }

    const stripe = getStripe();

    if (!stripe) {
      // Graceful sandbox fallback for local testing when Stripe key is not yet set in Netlify
      return {
        statusCode: 200,
        body: JSON.stringify({
          url: `${origin}/order-success?demo_mode=true`,
        }),
      };
    }

    const line_items = items.map((item: any) => {
      const product = catalog.find((p: any) => p.id === item.productId)!;
      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${product.name} (${item.variant === 'magnet' ? '🧲 Refrigerator Magnet' : '🔑 Keychain'})`,
            images: item.image ? [item.image] : (product.images?.[0] ? [product.images[0]] : []),
            metadata: {
              variant: item.variant,
              productId: item.productId,
            },
          },
          unit_amount: Math.round(product.price * 100),
        },
        quantity: item.quantity,
      };
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      shipping_address_collection: {
        allowed_countries: ['US', 'CA'],
      },
      metadata: {
        giftNote: giftNote || '',
      },
      success_url: `${origin}/order-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/`,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (error: any) {
    console.error('Stripe session error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal Server Error' }),
    };
  }
};
