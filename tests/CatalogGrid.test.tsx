import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CatalogGrid } from '../src/components/CatalogGrid';
import { CartProvider } from '../src/context/CartContext';
import { SettingsProvider } from '../src/context/SettingsContext';
import { CategoryOption, Product } from '../src/types';

const sampleProducts: Product[] = [
  {
    id: 'p-multi',
    name: 'Candy Bunny',
    description: 'Sweet bunny charm',
    price: 14.0,
    images: ['/images/products/bunny.jpg'],
    categories: ['animals', 'sweets'],
    availableVariants: ['magnet', 'keychain'],
    inStock: true,
    stockCount: 3,
  },
  {
    id: 'p-fantasy',
    name: 'Starlight Ghost',
    description: 'Glowing ghostie',
    price: 16.0,
    images: ['/images/products/ghost.jpg'],
    categories: ['fantasy'],
    availableVariants: ['magnet'],
    inStock: true,
    stockCount: 1,
  },
  {
    id: 'p-none',
    name: 'Mystery Charm',
    description: 'Uncategorized special',
    price: 12.0,
    images: ['/images/products/mystery.jpg'],
    categories: [],
    availableVariants: ['keychain'],
    inStock: true,
    stockCount: 2,
  },
];

const renderCatalog = (products: Product[], categories?: CategoryOption[]) =>
  render(
    <SettingsProvider>
      <CartProvider>
        <CatalogGrid
          products={products}
          categories={categories}
          onOpenCustomModal={vi.fn()}
        />
      </CartProvider>
    </SettingsProvider>
  );

describe('CatalogGrid dynamic categories', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders built-in filter chips alongside custom categories (with and without emojis)', () => {
    const customCategories: CategoryOption[] = [
      { id: 'animals', label: 'Critters', emoji: '🐰' },
      { id: 'sweets', label: 'Sweets', emoji: '🍩' },
      { id: 'holiday', label: 'Holiday Specials' },
    ];

    renderCatalog(sampleProducts, customCategories);

    expect(screen.getByRole('button', { name: '🌸 All Weebles' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '🧲 Fridge Magnets' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '🔑 Keychains' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '🐰 Critters' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '🍩 Sweets' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Holiday Specials' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '🎀 Under $15' })).toBeInTheDocument();
  });

  it('shows a multi-category product under each of its assigned category chips', () => {
    const customCategories: CategoryOption[] = [
      { id: 'animals', label: 'Critters', emoji: '🐰' },
      { id: 'sweets', label: 'Sweets', emoji: '🍩' },
      { id: 'fantasy', label: 'Fantasy', emoji: '✨' },
    ];

    renderCatalog(sampleProducts, customCategories);

    fireEvent.click(screen.getByRole('button', { name: '🐰 Critters' }));
    expect(screen.getByText('Candy Bunny')).toBeInTheDocument();
    expect(screen.queryByText('Starlight Ghost')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '🍩 Sweets' }));
    expect(screen.getByText('Candy Bunny')).toBeInTheDocument();
    expect(screen.queryByText('Starlight Ghost')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '✨ Fantasy' }));
    expect(screen.queryByText('Candy Bunny')).not.toBeInTheDocument();
    expect(screen.getByText('Starlight Ghost')).toBeInTheDocument();
  });

  it('respects an explicit empty categories list and shows only built-in filter chips', () => {
    renderCatalog(sampleProducts, []);

    expect(screen.getByRole('button', { name: '🌸 All Weebles' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '🎀 Under $15' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Critters/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sweets/i })).not.toBeInTheDocument();
    expect(screen.getByText('Mystery Charm')).toBeInTheDocument();
  });

  it('resets active filter back to all if the currently selected custom category is removed', () => {
    const initialCategories: CategoryOption[] = [
      { id: 'fantasy', label: 'Fantasy', emoji: '✨' },
    ];

    const { rerender } = render(
      <SettingsProvider>
        <CartProvider>
          <CatalogGrid
            products={sampleProducts}
            categories={initialCategories}
            onOpenCustomModal={vi.fn()}
          />
        </CartProvider>
      </SettingsProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: '✨ Fantasy' }));
    expect(screen.queryByText('Candy Bunny')).not.toBeInTheDocument();
    expect(screen.getByText('Starlight Ghost')).toBeInTheDocument();

    rerender(
      <SettingsProvider>
        <CartProvider>
          <CatalogGrid
            products={sampleProducts}
            categories={[]}
            onOpenCustomModal={vi.fn()}
          />
        </CartProvider>
      </SettingsProvider>
    );

    expect(screen.getByText('Candy Bunny')).toBeInTheDocument();
    expect(screen.getByText('Starlight Ghost')).toBeInTheDocument();
  });
});
