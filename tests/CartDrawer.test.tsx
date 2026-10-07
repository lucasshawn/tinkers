import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { CartDrawer } from '../src/components/CartDrawer';
import { CartProvider, useCart } from '../src/context/CartContext';
import { Product } from '../src/types';

const testProduct1: Product = {
  id: 'cart-prod-1',
  name: 'Strawberry Bunny',
  description: 'Bunny magnet',
  price: 14.0,
  images: ['/img1.jpg'],
  category: 'animals',
  availableVariants: ['magnet'],
  inStock: true,
  stockCount: 5,
};

const testProduct2: Product = {
  id: 'cart-prod-2',
  name: 'Matcha Bear',
  description: 'Bear keychain',
  price: 16.5,
  images: ['/img2.jpg'],
  category: 'animals',
  availableVariants: ['keychain'],
  inStock: true,
  stockCount: 3,
};

interface TestHelperProps {
  onCheckout?: (giftNote: string) => void;
  isLoadingCheckout?: boolean;
}

const CartTestHelper: React.FC<TestHelperProps> = ({
  onCheckout = vi.fn(),
  isLoadingCheckout = false,
}) => {
  const { addToCart, setIsCartOpen } = useCart();

  return (
    <div>
      <button
        onClick={() => {
          addToCart(testProduct1, 'magnet');
          setIsCartOpen(true);
        }}
      >
        Add Test Item
      </button>
      <button
        onClick={() => {
          addToCart(testProduct2, 'keychain');
          setIsCartOpen(true);
        }}
      >
        Add Keychain Item
      </button>
      <button onClick={() => setIsCartOpen(true)}>Open Cart</button>
      <button onClick={() => setIsCartOpen(false)}>Close Cart</button>
      <CartDrawer onCheckout={onCheckout} isLoadingCheckout={isLoadingCheckout} />
    </div>
  );
};

describe('CartDrawer', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders cart drawer and displays items', () => {
    render(
      <CartProvider>
        <CartTestHelper />
      </CartProvider>
    );

    const addBtn = screen.getByText('Add Test Item');
    fireEvent.click(addBtn);

    expect(screen.getByText('Your Weeble Cart')).toBeInTheDocument();
    expect(screen.getByText('Strawberry Bunny')).toBeInTheDocument();
    expect(screen.getByText(/🧲 magnet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Checkout with Stripe/i })).toBeInTheDocument();
  });

  it('does not render when isCartOpen is false', () => {
    render(
      <CartProvider>
        <CartTestHelper />
      </CartProvider>
    );

    expect(screen.queryByText('Your Weeble Cart')).not.toBeInTheDocument();
  });

  it('displays empty cart state when open and cart is empty', () => {
    render(
      <CartProvider>
        <CartTestHelper />
      </CartProvider>
    );

    fireEvent.click(screen.getByText('Open Cart'));

    expect(screen.getByText('Your Weeble Cart')).toBeInTheDocument();
    expect(screen.getByText('Your basket is empty!')).toBeInTheDocument();
    expect(
      screen.getByText('Browse our cute figurine catalog to adopt your first weeble.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start Exploring/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Checkout with Stripe/i })).not.toBeInTheDocument();
  });

  it('closes cart when close button or empty state explore button is clicked', () => {
    render(
      <CartProvider>
        <CartTestHelper />
      </CartProvider>
    );

    fireEvent.click(screen.getByText('Open Cart'));
    expect(screen.getByText('Your Weeble Cart')).toBeInTheDocument();

    const startExploringBtn = screen.getByRole('button', { name: /Start Exploring/i });
    fireEvent.click(startExploringBtn);
    expect(screen.queryByText('Your Weeble Cart')).not.toBeInTheDocument();
  });

  it('closes cart when backdrop is clicked', () => {
    render(
      <CartProvider>
        <CartTestHelper />
      </CartProvider>
    );

    fireEvent.click(screen.getByText('Open Cart'));
    expect(screen.getByText('Your Weeble Cart')).toBeInTheDocument();

    const backdrop = screen.getByTestId('cart-backdrop');
    fireEvent.click(backdrop);
    expect(screen.queryByText('Your Weeble Cart')).not.toBeInTheDocument();
  });

  it('closes cart when X button is clicked', () => {
    render(
      <CartProvider>
        <CartTestHelper />
      </CartProvider>
    );

    fireEvent.click(screen.getByText('Add Test Item'));
    expect(screen.getByText('Your Weeble Cart')).toBeInTheDocument();

    // The header close button with X icon
    const closeButtons = screen.getAllByRole('button');
    // Header X button is the circular button next to title
    const xButton = closeButtons.find((btn) => btn.querySelector('svg.lucide-x') !== null);
    expect(xButton).toBeDefined();
    if (xButton) {
      fireEvent.click(xButton);
    }

    expect(screen.queryByText('Your Weeble Cart')).not.toBeInTheDocument();
  });

  it('displays correct variant badges for magnet and keychain', () => {
    render(
      <CartProvider>
        <CartTestHelper />
      </CartProvider>
    );

    fireEvent.click(screen.getByText('Add Test Item'));
    fireEvent.click(screen.getByText('Add Keychain Item'));

    expect(screen.getByText(/🧲 Magnet/i)).toBeInTheDocument();
    expect(screen.getByText(/🔑 Keychain/i)).toBeInTheDocument();
  });

  it('increments, decrements, and removes items', () => {
    render(
      <CartProvider>
        <CartTestHelper />
      </CartProvider>
    );

    fireEvent.click(screen.getByText('Add Test Item'));

    expect(screen.getByText('1 item ready for adoption')).toBeInTheDocument();

    // Increment
    const plusButtons = screen.getAllByRole('button').filter((b) => b.querySelector('svg.lucide-plus'));
    expect(plusButtons.length).toBeGreaterThan(0);
    fireEvent.click(plusButtons[0]);

    expect(screen.getByText('2 items ready for adoption')).toBeInTheDocument();
    expect(screen.getByText('$28.00')).toBeInTheDocument();

    // Decrement
    const minusButtons = screen.getAllByRole('button').filter((b) => b.querySelector('svg.lucide-minus'));
    expect(minusButtons.length).toBeGreaterThan(0);
    fireEvent.click(minusButtons[0]);

    expect(screen.getByText('1 item ready for adoption')).toBeInTheDocument();
    expect(screen.getAllByText('$14.00').length).toBe(2);

    // Remove
    const trashBtn = screen.getByLabelText(/Remove Strawberry Bunny/i);
    fireEvent.click(trashBtn);

    expect(screen.getByText('Your basket is empty!')).toBeInTheDocument();
  });

  it('allows entering a gift note and submits it on checkout', () => {
    const handleCheckout = vi.fn();
    render(
      <CartProvider>
        <CartTestHelper onCheckout={handleCheckout} />
      </CartProvider>
    );

    fireEvent.click(screen.getByText('Add Test Item'));

    const input = screen.getByPlaceholderText(/Please pack with extra pink sparkles/i);
    fireEvent.change(input, { target: { value: 'Happy Birthday Chloe!' } });

    const checkoutBtn = screen.getByRole('button', { name: /Checkout with Stripe/i });
    fireEvent.click(checkoutBtn);

    expect(handleCheckout).toHaveBeenCalledWith('Happy Birthday Chloe!');
  });

  it('shows loading state and disables checkout button when isLoadingCheckout is true', () => {
    const handleCheckout = vi.fn();
    render(
      <CartProvider>
        <CartTestHelper onCheckout={handleCheckout} isLoadingCheckout={true} />
      </CartProvider>
    );

    fireEvent.click(screen.getByText('Add Test Item'));

    const checkoutBtn = screen.getByRole('button', { name: /Connecting to Stripe.../i });
    expect(checkoutBtn).toBeDisabled();

    fireEvent.click(checkoutBtn);
    expect(handleCheckout).not.toHaveBeenCalled();
  });
});
