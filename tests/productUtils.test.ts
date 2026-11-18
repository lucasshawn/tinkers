import { describe, it, expect } from 'vitest';
import {
  filterProducts,
  formatPrice,
  isNewProduct,
  NEW_PRODUCT_WINDOW_MS,
  getProductVariantPrice,
  formatProductPriceSummary,
} from '../src/utils/productUtils';
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

  describe('isNewProduct', () => {
    const baseProduct: Product = mockProducts[0];
    const fixedNow = Date.parse('2026-11-18T12:00:00.000Z');

    it('returns false when createdAt is undefined', () => {
      expect(isNewProduct(baseProduct, fixedNow)).toBe(false);
    });

    it('returns false when createdAt is an invalid date string', () => {
      expect(isNewProduct({ ...baseProduct, createdAt: 'not-a-date' }, fixedNow)).toBe(false);
    });

    it('returns true when product was just created', () => {
      const createdAt = new Date(fixedNow).toISOString();
      expect(isNewProduct({ ...baseProduct, createdAt }, fixedNow)).toBe(true);
    });

    it('returns true when product is within 30 days (e.g. 29 days old)', () => {
      const createdAt = new Date(fixedNow - 29 * 24 * 60 * 60 * 1000).toISOString();
      expect(isNewProduct({ ...baseProduct, createdAt }, fixedNow)).toBe(true);
    });

    it('returns true at the exact 30-day boundary', () => {
      const createdAt = new Date(fixedNow - NEW_PRODUCT_WINDOW_MS).toISOString();
      expect(isNewProduct({ ...baseProduct, createdAt }, fixedNow)).toBe(true);
    });

    it('returns false when product is older than 30 days', () => {
      const createdAt = new Date(fixedNow - NEW_PRODUCT_WINDOW_MS - 1).toISOString();
      expect(isNewProduct({ ...baseProduct, createdAt }, fixedNow)).toBe(false);
    });

    it('returns false when createdAt is in the future', () => {
      const createdAt = new Date(fixedNow + 60_000).toISOString();
      expect(isNewProduct({ ...baseProduct, createdAt }, fixedNow)).toBe(false);
    });
  });

  describe('getProductVariantPrice and formatProductPriceSummary', () => {
    const variedProduct: Product = {
      ...mockProducts[0],
      price: 14.0,
      availableVariants: ['magnet', 'keychain'],
      variantPrices: {
        magnet: 14.0,
        keychain: 16.5,
      },
    };

    it('returns specific variant price when defined in variantPrices', () => {
      expect(getProductVariantPrice(variedProduct, 'magnet')).toBe(14.0);
      expect(getProductVariantPrice(variedProduct, 'keychain')).toBe(16.5);
    });

    it('falls back to first available variant price or base price when variant is omitted', () => {
      expect(getProductVariantPrice(variedProduct)).toBe(14.0);
      const noVariantsProduct: Product = {
        ...mockProducts[0],
        price: 18.0,
        availableVariants: [],
      };
      expect(getProductVariantPrice(noVariantsProduct)).toBe(18.0);
    });

    it('formats summary with single price when variant prices match or no variants exist', () => {
      const matchingProduct: Product = {
        ...mockProducts[0],
        price: 14.0,
        availableVariants: ['magnet', 'keychain'],
        variantPrices: { magnet: 14.0, keychain: 14.0 },
      };
      expect(formatProductPriceSummary(matchingProduct)).toBe('$14.00');

      const noVariantsProduct: Product = {
        ...mockProducts[0],
        price: 18.0,
        availableVariants: [],
      };
      expect(formatProductPriceSummary(noVariantsProduct)).toBe('$18.00');
    });

    it('formats summary with per-variant prices when magnet and keychain prices differ', () => {
      expect(formatProductPriceSummary(variedProduct)).toBe('🧲 $14.00 / 🔑 $16.50');
    });

    it('includes product in under-15 filter if any available variant is under $15', () => {
      const mixedPriceProduct: Product = {
        ...mockProducts[2],
        price: 16.0,
        availableVariants: ['magnet', 'keychain'],
        variantPrices: { magnet: 14.5, keychain: 16.0 },
      };
      const results = filterProducts([mixedPriceProduct], 'under-15', '');
      expect(results).toHaveLength(1);
    });
  });
});
