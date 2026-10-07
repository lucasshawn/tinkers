import { describe, it, expect } from 'vitest';
import { filterProducts, formatPrice } from '../src/utils/productUtils';
import { Product } from '../src/types';

const mockProducts: Product[] = [
  {
    id: 'weeble-1',
    name: 'Strawberry Bunny',
    description: 'Sweet bunny with strawberry hat',
    price: 14.0,
    images: ['/images/products/strawberry-bunny.jpg'],
    category: 'animals',
    availableVariants: ['magnet', 'keychain'],
    inStock: true,
    stockCount: 5,
    featured: true,
  },
  {
    id: 'weeble-2',
    name: 'Matcha Froggy',
    description: 'Chubby frog sipping matcha',
    price: 12.5,
    images: ['/images/products/matcha-frog.jpg'],
    category: 'animals',
    availableVariants: ['magnet'],
    inStock: false,
    stockCount: 0,
    featured: false,
  },
  {
    id: 'weeble-3',
    name: 'Glazed Donut Bear',
    description: 'Bear hugging a sprinkled donut',
    price: 16.0,
    images: ['/images/products/donut-bear.jpg'],
    category: 'sweets',
    availableVariants: ['keychain'],
    inStock: true,
    stockCount: 2,
    featured: true,
  }
];

describe('productUtils', () => {
  it('formats price correctly', () => {
    expect(formatPrice(14)).toBe('$14.00');
    expect(formatPrice(12.5)).toBe('$12.50');
  });

  it('filters products by category', () => {
    const sweets = filterProducts(mockProducts, 'sweets', '');
    expect(sweets.length).toBe(1);
    expect(sweets[0].id).toBe('weeble-3');
  });

  it('filters products by search keyword', () => {
    const results = filterProducts(mockProducts, 'all', 'matcha');
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('weeble-2');
  });

  it('filters by variant filter "magnets"', () => {
    const magnets = filterProducts(mockProducts, 'magnets', '');
    expect(magnets.length).toBe(2);
  });

  it('filters by variant filter "keychains"', () => {
    const keychains = filterProducts(mockProducts, 'keychains', '');
    expect(keychains.length).toBe(2);
    expect(keychains.map((p) => p.id)).toEqual(['weeble-1', 'weeble-3']);
  });

  it('filters by price "under-15"', () => {
    const affordable = filterProducts(mockProducts, 'under-15', '');
    expect(affordable.length).toBe(2);
    expect(affordable.map((p) => p.id)).toEqual(['weeble-1', 'weeble-2']);
  });

  it('filters by featured category', () => {
    const featured = filterProducts(mockProducts, 'featured', '');
    expect(featured.length).toBe(2);
    expect(featured.map((p) => p.id)).toEqual(['weeble-1', 'weeble-3']);
  });

  it('filters by keyword in description case-insensitively', () => {
    const results = filterProducts(mockProducts, 'all', 'SPRINKLED');
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('weeble-3');
  });

  it('returns all products when category is all and searchQuery is empty', () => {
    const results = filterProducts(mockProducts, 'all', '  ');
    expect(results.length).toBe(3);
  });
});
