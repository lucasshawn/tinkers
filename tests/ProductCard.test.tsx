import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ProductCard } from '../src/components/ProductCard';
import { CatalogGrid } from '../src/components/CatalogGrid';
import { CartProvider } from '../src/context/CartContext';
import { Product } from '../src/types';

const mockProduct: Product = {
  id: 'test-1',
  name: 'Strawberry Bunny',
  description: 'Hand-sculpted baby bunny with strawberry beret.',
  price: 14.0,
  images: ['/strawberry-bunny.jpg'],
  category: 'animals',
  availableVariants: ['magnet', 'keychain'],
  inStock: true,
  stockCount: 3,
};

const mockProducts: Product[] = [
  mockProduct,
  {
    id: 'test-2',
    name: 'Matcha Frog',
    description: 'Chonky green frog holding a boba cup.',
    price: 16.5,
    images: ['/matcha-frog.jpg'],
    category: 'animals',
    availableVariants: ['magnet'],
    inStock: true,
    stockCount: 1,
    isOneOfAKind: true,
  },
  {
    id: 'test-3',
    name: 'Glazed Donut Bear',
    description: 'Bear shaped donut with sprinkles.',
    price: 12.0,
    images: ['/donut-bear.jpg'],
    category: 'sweets',
    availableVariants: ['keychain'],
    inStock: false,
    stockCount: 0,
  },
];

describe('ProductCard', () => {
  it('renders product details and variant options', () => {
    render(
      <CartProvider>
        <ProductCard product={mockProduct} />
      </CartProvider>
    );

    expect(screen.getByText('Strawberry Bunny')).toBeInTheDocument();
    expect(screen.getByText('$14.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /magnet/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /keychain/i })).toBeInTheDocument();
  });

  it('allows toggling variant selection', () => {
    render(
      <CartProvider>
        <ProductCard product={mockProduct} />
      </CartProvider>
    );

    const keychainBtn = screen.getByRole('button', { name: /keychain/i });
    fireEvent.click(keychainBtn);
    expect(keychainBtn.className).toContain('bg-weeble-pink');
  });

  it('adds item to cart and shows transient feedback', () => {
    vi.useFakeTimers();
    render(
      <CartProvider>
        <ProductCard product={mockProduct} />
      </CartProvider>
    );

    const adoptBtn = screen.getByRole('button', { name: /adopt me/i });
    fireEvent.click(adoptBtn);

    expect(screen.getByText(/Added to Cart!/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    expect(screen.getByRole('button', { name: /adopt me/i })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('renders 1-of-1 original badge when isOneOfAKind is true', () => {
    const oneOfAKindProduct: Product = {
      ...mockProduct,
      isOneOfAKind: true,
    };
    render(
      <CartProvider>
        <ProductCard product={oneOfAKindProduct} />
      </CartProvider>
    );

    expect(screen.getByText(/1-of-1 Original/i)).toBeInTheDocument();
  });

  it('renders low stock warning when stock is 2 or less', () => {
    const lowStockProduct: Product = {
      ...mockProduct,
      stockCount: 2,
    };
    render(
      <CartProvider>
        <ProductCard product={lowStockProduct} />
      </CartProvider>
    );

    expect(screen.getByText(/Only 2 left/i)).toBeInTheDocument();
  });

  it('disables add to cart when sold out', () => {
    const soldOutProduct = { ...mockProduct, inStock: false, stockCount: 0 };
    render(
      <CartProvider>
        <ProductCard product={soldOutProduct} />
      </CartProvider>
    );

    expect(screen.getAllByText(/Sold Out/i).length).toBeGreaterThan(0);
    const btn = screen.getByRole('button', { name: /Sold Out/i });
    expect(btn).toBeDisabled();
  });
});

describe('CatalogGrid', () => {
  it('renders catalog header and products', () => {
    const onOpenCustomModal = vi.fn();
    render(
      <CartProvider>
        <CatalogGrid products={mockProducts} onOpenCustomModal={onOpenCustomModal} />
      </CartProvider>
    );

    expect(screen.getByText(/Available Creations/i)).toBeInTheDocument();
    expect(screen.getByText('Strawberry Bunny')).toBeInTheDocument();
    expect(screen.getByText('Matcha Frog')).toBeInTheDocument();
    expect(screen.getByText('Glazed Donut Bear')).toBeInTheDocument();
  });

  it('filters products by search input', () => {
    const onOpenCustomModal = vi.fn();
    render(
      <CartProvider>
        <CatalogGrid products={mockProducts} onOpenCustomModal={onOpenCustomModal} />
      </CartProvider>
    );

    const searchInput = screen.getByPlaceholderText(/Search weebles.../i);
    fireEvent.change(searchInput, { target: { value: 'Frog' } });

    expect(screen.getByText('Matcha Frog')).toBeInTheDocument();
    expect(screen.queryByText('Strawberry Bunny')).not.toBeInTheDocument();
    expect(screen.queryByText('Glazed Donut Bear')).not.toBeInTheDocument();
  });

  it('filters products by category filter pill', () => {
    const onOpenCustomModal = vi.fn();
    render(
      <CartProvider>
        <CatalogGrid products={mockProducts} onOpenCustomModal={onOpenCustomModal} />
      </CartProvider>
    );

    const sweetsFilter = screen.getByRole('button', { name: /Sweets/i });
    fireEvent.click(sweetsFilter);

    expect(screen.getByText('Glazed Donut Bear')).toBeInTheDocument();
    expect(screen.queryByText('Strawberry Bunny')).not.toBeInTheDocument();
    expect(screen.queryByText('Matcha Frog')).not.toBeInTheDocument();
  });

  it('shows empty state when no products match and triggers custom request modal', () => {
    const onOpenCustomModal = vi.fn();
    render(
      <CartProvider>
        <CatalogGrid products={mockProducts} onOpenCustomModal={onOpenCustomModal} />
      </CartProvider>
    );

    const searchInput = screen.getByPlaceholderText(/Search weebles.../i);
    fireEvent.change(searchInput, { target: { value: 'NonexistentWeebleXYZ' } });

    expect(screen.getByText(/No Weebles found!/i)).toBeInTheDocument();
    const customBtn = screen.getByRole('button', { name: /Request Custom Weeble/i });
    fireEvent.click(customBtn);
    expect(onOpenCustomModal).toHaveBeenCalledTimes(1);
  });
});
