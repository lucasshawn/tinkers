import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Navbar } from '../src/components/Navbar';
import { HeroBanner } from '../src/components/HeroBanner';
import { Footer } from '../src/components/Footer';
import { CartProvider, useCart } from '../src/context/CartContext';
import { Product } from '../src/types';

const testProduct: Product = {
  id: 'test-item',
  name: 'Test Weeble',
  description: 'A test weeble',
  price: 15,
  images: ['/test.jpg'],
  category: 'animals',
  availableVariants: ['magnet'],
  inStock: true,
  stockCount: 5,
};

// Helper to seed items in cart
const AddToCartHelper: React.FC = () => {
  const { addToCart } = useCart();
  return (
    <button onClick={() => addToCart(testProduct, 'magnet')}>
      Add Test Item
    </button>
  );
};

describe('Navbar', () => {
  it('renders logo and cart button', () => {
    const handleOpenCustom = vi.fn();
    render(
      <CartProvider>
        <Navbar onOpenCustomModal={handleOpenCustom} />
      </CartProvider>
    );

    expect(screen.getByText('Weebles')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cart/i })).toBeInTheDocument();
  });

  it('triggers custom order modal callback when clicking link', () => {
    const handleOpenCustom = vi.fn();
    render(
      <CartProvider>
        <Navbar onOpenCustomModal={handleOpenCustom} />
      </CartProvider>
    );

    const customBtn = screen.getByText(/Custom Order/i);
    fireEvent.click(customBtn);
    expect(handleOpenCustom).toHaveBeenCalledTimes(1);
  });

  it('displays cart badge when totalCount is greater than 0', () => {
    const handleOpenCustom = vi.fn();
    render(
      <CartProvider>
        <Navbar onOpenCustomModal={handleOpenCustom} />
        <AddToCartHelper />
      </CartProvider>
    );

    expect(screen.queryByText('1')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Add Test Item'));
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});

describe('HeroBanner', () => {
  it('renders headline, badges, and triggers callbacks', () => {
    const handleExplore = vi.fn();
    const handleCustom = vi.fn();

    render(
      <HeroBanner
        onExploreClick={handleExplore}
        onCustomClick={handleCustom}
      />
    );

    expect(screen.getByText(/Tiny Polymer Clay Friends/i)).toBeInTheDocument();
    expect(screen.getByText(/Hand-Sculpted & Glazed with UV Resin Love/i)).toBeInTheDocument();

    const adoptBtn = screen.getByRole('button', { name: /Adopt a Weeble/i });
    fireEvent.click(adoptBtn);
    expect(handleExplore).toHaveBeenCalledTimes(1);

    const customBtn = screen.getByRole('button', { name: /Request Custom Order/i });
    fireEvent.click(customBtn);
    expect(handleCustom).toHaveBeenCalledTimes(1);
  });
});

describe('Footer', () => {
  it('renders clay care guide and contact information', () => {
    render(<Footer />);

    expect(screen.getByText(/Clay Care Instructions/i)).toBeInTheDocument();
    expect(screen.getByText(/weeblesclay@gmail.com/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Handcrafted with/i).length).toBeGreaterThan(0);
  });
});
