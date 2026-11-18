import { Product, VariantType } from '../types';

export const PRODUCTS_STORAGE_KEY = 'weebles_products_v1';

export function getStoredProducts(fallbackProducts: Product[]): Product[] {
  try {
    const stored = localStorage.getItem(PRODUCTS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Fallback to provided default catalog
  }
  return fallbackProducts;
}

export function saveStoredProducts(products: Product[]): void {
  try {
    localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
  } catch {
    // Ignore storage quota errors
  }
}

export function formatPrice(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function getProductVariantPrice(product: Product, variant?: VariantType): number {
  if (
    variant &&
    typeof product.variantPrices?.[variant] === 'number' &&
    !Number.isNaN(product.variantPrices[variant]!)
  ) {
    return product.variantPrices[variant]!;
  }
  if (product.availableVariants && product.availableVariants.length > 0) {
    const firstVariant = product.availableVariants[0];
    if (
      typeof product.variantPrices?.[firstVariant] === 'number' &&
      !Number.isNaN(product.variantPrices[firstVariant]!)
    ) {
      return product.variantPrices[firstVariant]!;
    }
  }
  return product.price;
}

export function formatProductPriceSummary(product: Product): string {
  if (!product.availableVariants || product.availableVariants.length === 0) {
    return formatPrice(product.price);
  }
  const prices = product.availableVariants.map((v) => ({
    variant: v,
    price: getProductVariantPrice(product, v),
  }));
  const allSame = prices.every((p) => p.price === prices[0].price);
  if (allSame) {
    return formatPrice(prices[0].price);
  }
  return prices
    .map((p) => `${p.variant === 'magnet' ? '🧲' : '🔑'} ${formatPrice(p.price)}`)
    .join(' / ');
}

export const NEW_PRODUCT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export function isNewProduct(product: Product, now: number = Date.now()): boolean {
  if (!product.createdAt) return false;
  const createdMs = Date.parse(product.createdAt);
  if (Number.isNaN(createdMs)) return false;
  const ageMs = now - createdMs;
  return ageMs >= 0 && ageMs <= NEW_PRODUCT_WINDOW_MS;
}

export function filterProducts(products: Product[], category: string, searchQuery: string): Product[] {
  const query = searchQuery.trim().toLowerCase();

  return products.filter((product) => {
    // Category match
    let matchesCategory = true;
    if (category === 'all') {
      matchesCategory = true;
    } else if (category === 'magnets') {
      matchesCategory = product.availableVariants.includes('magnet');
    } else if (category === 'keychains') {
      matchesCategory = product.availableVariants.includes('keychain');
    } else if (category === 'under-15') {
      if (product.availableVariants && product.availableVariants.length > 0) {
        matchesCategory = product.availableVariants.some(
          (v) => getProductVariantPrice(product, v) < 15.0
        );
      } else {
        matchesCategory = product.price < 15.0;
      }
    } else if (category === 'featured') {
      matchesCategory = Boolean(product.featured);
    } else {
      matchesCategory = product.category === category;
    }

    // Search query match
    let matchesQuery = true;
    if (query) {
      matchesQuery =
        product.name.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query);
    }

    return matchesCategory && matchesQuery;
  });
}
