import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  beforeEach(() => {
    localStorage.clear();
  });

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

  it('updates displayed price when switching between magnet and keychain with different prices', () => {
    const diffPriceProduct: Product = {
      ...mockProduct,
      price: 14.0,
      availableVariants: ['magnet', 'keychain'],
      variantPrices: {
        magnet: 14.0,
        keychain: 16.5,
      },
    };

    render(
      <CartProvider>
        <ProductCard product={diffPriceProduct} />
      </CartProvider>
    );

    expect(screen.getByText('$14.00')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /keychain/i }));
    expect(screen.getByText('$16.50')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /magnet/i }));
    expect(screen.getByText('$14.00')).toBeInTheDocument();
  });

  it('hides Choose Style label and magnet/keychain buttons when availableVariants is empty', () => {
    const noVariantProduct: Product = {
      ...mockProduct,
      price: 15.0,
      availableVariants: [],
    };

    render(
      <CartProvider>
        <ProductCard product={noVariantProduct} />
      </CartProvider>
    );

    expect(screen.getByText('$15.00')).toBeInTheDocument();
    expect(screen.queryByText(/Choose Style/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /magnet/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /keychain/i })).not.toBeInTheDocument();
  });

  it('renders only the available variant button when only one option exists', () => {
    const magnetOnlyProduct: Product = {
      ...mockProduct,
      availableVariants: ['magnet'],
      variantPrices: { magnet: 13.0 },
    };

    render(
      <CartProvider>
        <ProductCard product={magnetOnlyProduct} />
      </CartProvider>
    );

    expect(screen.getByText('$13.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /magnet/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /keychain/i })).not.toBeInTheDocument();
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

  it('disables add to cart and displays 1-of-1 in cart when already added', () => {
    vi.useFakeTimers();
    const oneOfAKindProduct: Product = {
      ...mockProduct,
      isOneOfAKind: true,
      stockCount: 1,
    };

    render(
      <CartProvider>
        <ProductCard product={oneOfAKindProduct} />
      </CartProvider>
    );

    const adoptBtn = screen.getByRole('button', { name: /adopt me/i });
    fireEvent.click(adoptBtn);

    expect(screen.getByText(/Added to Cart!/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    const disabledBtn = screen.getByRole('button', { name: /1-of-1 in Cart/i });
    expect(disabledBtn).toBeDisabled();
    vi.useRealTimers();
  });

  it('renders NEW! badge when product was added within the last 30 days', () => {
    const recentProduct: Product = {
      ...mockProduct,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    };

    render(
      <CartProvider>
        <ProductCard product={recentProduct} />
      </CartProvider>
    );

    expect(screen.getByText('NEW!')).toBeInTheDocument();
  });

  it('does not render NEW! badge when product is older than 30 days or has no createdAt', () => {
    const expiredProduct: Product = {
      ...mockProduct,
      createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const { rerender } = render(
      <CartProvider>
        <ProductCard product={expiredProduct} />
      </CartProvider>
    );

    expect(screen.queryByText('NEW!')).not.toBeInTheDocument();

    rerender(
      <CartProvider>
        <ProductCard product={mockProduct} />
      </CartProvider>
    );

    expect(screen.queryByText('NEW!')).not.toBeInTheDocument();
  });

  describe('variant photo carousel', () => {
    const galleryProduct: Product = {
      ...mockProduct,
      images: ['/bunny-base.jpg'],
      availableVariants: ['magnet', 'keychain'],
      variantPrices: {
        magnet: 14.0,
        keychain: 16.5,
      },
      variantImages: {
        magnet: '/bunny-magnet.jpg',
        keychain: '/bunny-keychain.jpg',
      },
    };

    it('renders no carousel controls when product only has a base photo', () => {
      render(
        <CartProvider>
          <ProductCard product={mockProduct} />
        </CartProvider>
      );

      expect(screen.getByAltText('Strawberry Bunny')).toHaveAttribute('src', '/strawberry-bunny.jpg');
      expect(screen.queryByRole('button', { name: /Previous photo/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Next photo/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /View Base photo/i })).not.toBeInTheDocument();
    });

    it('starts on the base photo on initial load and cycles through all photos with arrows and dots without changing selected style or price', () => {
      render(
        <CartProvider>
          <ProductCard product={galleryProduct} />
        </CartProvider>
      );

      // Initial state: Base photo shown, Magnet selected ($14.00)
      expect(screen.getByAltText('Strawberry Bunny - Base')).toHaveAttribute('src', '/bunny-base.jpg');
      expect(screen.getByText('$14.00')).toBeInTheDocument();

      // Next -> Magnet photo
      fireEvent.click(screen.getByRole('button', { name: /Next photo/i }));
      expect(screen.getByAltText('Strawberry Bunny - Magnet')).toHaveAttribute(
        'src',
        '/bunny-magnet.jpg'
      );

      // Next -> Keychain photo (selected style stays Magnet at $14.00)
      fireEvent.click(screen.getByRole('button', { name: /Next photo/i }));
      expect(screen.getByAltText('Strawberry Bunny - Keychain')).toHaveAttribute(
        'src',
        '/bunny-keychain.jpg'
      );
      expect(screen.getByText('$14.00')).toBeInTheDocument();

      // Next wraps around to Base
      fireEvent.click(screen.getByRole('button', { name: /Next photo/i }));
      expect(screen.getByAltText('Strawberry Bunny - Base')).toHaveAttribute('src', '/bunny-base.jpg');

      // Previous wraps around to Keychain
      fireEvent.click(screen.getByRole('button', { name: /Previous photo/i }));
      expect(screen.getByAltText('Strawberry Bunny - Keychain')).toHaveAttribute(
        'src',
        '/bunny-keychain.jpg'
      );

      // Clicking Base dot jumps directly to Base
      fireEvent.click(screen.getByRole('button', { name: /View Base photo/i }));
      expect(screen.getByAltText('Strawberry Bunny - Base')).toHaveAttribute('src', '/bunny-base.jpg');
    });

    it('jumps to the clicked style variant photo, or back to base if that variant has no custom photo', () => {
      const keychainOnlyPhotoProduct: Product = {
        ...galleryProduct,
        variantImages: {
          keychain: '/bunny-keychain.jpg',
        },
      };

      render(
        <CartProvider>
          <ProductCard product={keychainOnlyPhotoProduct} />
        </CartProvider>
      );

      // Starts on Base
      expect(screen.getByAltText('Strawberry Bunny - Base')).toHaveAttribute('src', '/bunny-base.jpg');

      // Clicking Keychain jumps to Keychain photo and updates price
      fireEvent.click(screen.getByRole('button', { name: /^keychain$/i }));
      expect(screen.getByAltText('Strawberry Bunny - Keychain')).toHaveAttribute(
        'src',
        '/bunny-keychain.jpg'
      );
      expect(screen.getByText('$16.50')).toBeInTheDocument();

      // Clicking Magnet (which has no custom photo) returns to Base photo
      fireEvent.click(screen.getByRole('button', { name: /^magnet$/i }));
      expect(screen.getByAltText('Strawberry Bunny - Base')).toHaveAttribute('src', '/bunny-base.jpg');
      expect(screen.getByText('$14.00')).toBeInTheDocument();
    });
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
