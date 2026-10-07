import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
});
