import { CartItem } from '../types';

export interface CheckoutSessionResponse {
  client_secret?: string;
  url?: string;
}

export const STRIPE_APPEARANCE = {
  theme: 'stripe',
  labels: 'auto',
  inputs: 'spaced',
  variables: {
    borderRadius: '4px',
    colorBackground: '#ffffff',
    colorDanger: '#df1b41',
    colorPrimary: '#0570de',
    colorSuccess: '#00c853',
    colorText: '#30313d',
    fontFamily: 'default',
    fontSizeBase: '16px',
    spacingUnit: '4px',
  },
};

export async function createCheckoutSession(
  items: CartItem[],
  giftNote?: string
): Promise<CheckoutSessionResponse> {
  const response = await fetch('/.netlify/functions/create-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, giftNote }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to create Stripe checkout session');
  }

  return response.json();
}
