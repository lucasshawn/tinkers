import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import App from '../src/App';
import { OrderSuccess } from '../src/components/OrderSuccess';
import { CartProvider } from '../src/context/CartContext';

describe('App smoke test', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    // Restore window.location
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it('renders the store hero and catalog', () => {
    render(React.createElement(App));
    expect(screen.getByText('Weebles')).toBeInTheDocument();
    expect(screen.getByText(/Tiny Polymer Clay Friends/i)).toBeInTheDocument();
    expect(screen.getByText(/Available Creations/i)).toBeInTheDocument();
    expect(screen.getByText(/Clay Care Instructions/i)).toBeInTheDocument();
    const studioLink = screen.getByRole('link', { name: /Studio Login/i });
    expect(studioLink).toBeInTheDocument();
    expect(studioLink).toHaveAttribute('href', '/admin');
  });

  it('opens custom order modal from hero button', () => {
    render(React.createElement(App));
    const customBtn = screen.getByRole('button', { name: /Request Custom Order/i });
    fireEvent.click(customBtn);
    expect(screen.getByText(/Dream Up Your Custom Weeble/i)).toBeInTheDocument();
  });

  it('renders order success page when path is /order-success', () => {
    Object.defineProperty(window, 'location', {
      value: {
        ...originalLocation,
        pathname: '/order-success',
        search: '',
      },
      writable: true,
      configurable: true,
    });

    render(React.createElement(App));
    expect(screen.getByText(/Adoption Confirmed!/i)).toBeInTheDocument();
    expect(screen.getByText(/Thank You so Much!/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Return to Storefront/i })).toHaveAttribute('href', '/');
  });

  it('renders order success page when URL has session_id query param', () => {
    Object.defineProperty(window, 'location', {
      value: {
        ...originalLocation,
        pathname: '/',
        search: '?session_id=cs_test_123',
      },
      writable: true,
      configurable: true,
    });

    render(React.createElement(App));
    expect(screen.getByText(/Adoption Confirmed!/i)).toBeInTheDocument();
  });

  it('renders AdminPortal on /admin route', () => {
    Object.defineProperty(window, 'location', {
      value: {
        ...originalLocation,
        pathname: '/admin',
        search: '',
      },
      writable: true,
      configurable: true,
    });

    render(React.createElement(App));
    expect(screen.getByText(/Weebles Studio Manager/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Login as Shawn/i })).toBeInTheDocument();
  });

  it('renders OrderSuccess component and clears cart', () => {
    localStorage.setItem(
      'weebles_cart_v1',
      JSON.stringify([
        {
          product: {
            id: 'weeble-strawberry-cow',
            name: 'Strawberry Cow',
            price: 18,
            category: 'animals',
            description: 'Cute cow',
            image: '/images/products/strawberry-cow.png',
            inStock: true,
          },
          quantity: 2,
        },
      ])
    );

    render(
      React.createElement(CartProvider, null, React.createElement(OrderSuccess))
    );

    expect(screen.getByText(/Adoption Confirmed!/i)).toBeInTheDocument();
    expect(screen.getByText(/What happens next\?/i)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('weebles_cart_v1') || '[]')).toEqual([]);
  });

  it('triggers checkout in App sending items from CartContext', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ url: 'https://checkout.stripe.com/pay/test' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    localStorage.setItem(
      'weebles_cart_v1',
      JSON.stringify([
        {
          id: 'weeble-strawberry-bunny-magnet',
          productId: 'weeble-strawberry-bunny',
          name: 'Strawberry Bunny',
          variant: 'magnet',
          price: 14.0,
          image: '/img.jpg',
          quantity: 1,
        },
      ])
    );

    render(React.createElement(App));

    const cartBtn = screen.getByRole('button', { name: 'cart' });
    fireEvent.click(cartBtn);

    const checkoutBtn = screen.getByRole('button', { name: /Checkout with Stripe/i });
    await act(async () => {
      fireEvent.click(checkoutBtn);
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      '/.netlify/functions/create-checkout',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('weeble-strawberry-bunny'),
      })
    );
  });
});
