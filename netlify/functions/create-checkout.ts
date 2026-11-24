import { Handler } from '@netlify/functions';
import Stripe from 'stripe';
import { loadPersistedProducts } from './admin-save';

const resolveStripeImageUrl = (rawImage: unknown, origin: string): string | null => {
  if (typeof rawImage !== 'string') return null;
  const trimmed = rawImage.trim();
  if (!trimmed || trimmed.startsWith('data:')) return null;

  const candidate = trimmed.startsWith('/') ? `${origin}${trimmed}` : trimmed;
  if (candidate.length > 2048) return null;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch {
    return null;
  }

  return null;
};

export const getStripe = (): Stripe | null => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
  return stripeSecretKey
    ? new Stripe(stripeSecretKey, { apiVersion: '2026-03-25.dahlia' as any })
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
    const catalog: any[] = await loadPersistedProducts(event);

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
    if (!origin || !/^https?:\/\//i.test(origin)) {
      const host = event.headers.host || 'localhost:8888';
      const proto = event.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
      origin = `${proto}://${host}`;
    }
    origin = origin.replace(/\/+$/, '');

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
      const unitPrice =
        item.variant &&
        typeof product.variantPrices?.[item.variant] === 'number' &&
        !Number.isNaN(product.variantPrices[item.variant])
          ? product.variantPrices[item.variant]
          : product.price;
      const variantLabel =
        item.variant === 'magnet'
          ? ' (🧲 Refrigerator Magnet)'
          : item.variant === 'keychain'
          ? ' (🔑 Keychain)'
          : '';
      const imageUrl =
        resolveStripeImageUrl(item.image, origin) ??
        resolveStripeImageUrl(
          item.variant ? product.variantImages?.[item.variant] : undefined,
          origin
        ) ??
        resolveStripeImageUrl(product.images?.[0], origin);
      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${product.name}${variantLabel}`,
            ...(imageUrl ? { images: [imageUrl] } : {}),
            metadata: {
              variant: item.variant || 'standard',
              productId: item.productId,
            },
          },
          unit_amount: Math.round(unitPrice * 100),
        },
        quantity: item.quantity,
      };
    });

    const session = await stripe.checkout.sessions.create({
      ui_mode: 'form',
      mode: 'payment',
      billing_address_collection: 'auto',
      phone_number_collection: {
        enabled: false,
      },
      automatic_tax: {
        enabled: false,
      },
      submit_type: 'auto',
      integration_identifier: 'custom_embedded_web_0001',
      line_items,
      metadata: {
        giftNote: giftNote || '',
      },
      return_url: `${origin}/order-success?session_id={CHECKOUT_SESSION_ID}`,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_secret: session.client_secret }),
    };
  } catch (error: any) {
    console.error('Stripe session error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal Server Error' }),
    };
  }
};
