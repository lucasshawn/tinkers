import { CartItem } from '../types';

export async function createCheckoutSession(
  items: CartItem[],
  giftNote?: string
): Promise<{ url: string }> {
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
