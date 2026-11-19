import { CategoryOption, Product, VariantType } from '../types';

export const DEFAULT_CATEGORIES: CategoryOption[] = [
  { id: 'animals', label: 'Critters', emoji: '🐰' },
  { id: 'sweets', label: 'Sweets', emoji: '🍩' },
  { id: 'fantasy', label: 'Fantasy', emoji: '✨' },
  { id: 'mini-friends', label: 'Mini-Friends', emoji: '🌸' },
];

export const RESERVED_FILTER_IDS: ReadonlySet<string> = new Set([
  'all',
  'magnets',
  'keychains',
  'under-15',
  'featured',
]);

/** Normalize a category label into a URL/filter-safe slug, avoiding reserved filter IDs. */
export function slugifyCategoryId(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!base) return '';
  if (RESERVED_FILTER_IDS.has(base)) {
    return `${base}-category`;
  }
  return base;
}

/** Resolve deduplicated category IDs for a product, falling back to legacy `category`. */
export function getProductCategories(product: Product): string[] {
  if (Array.isArray(product.categories)) {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const raw of product.categories) {
      if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed && !seen.has(trimmed)) {
          seen.add(trimmed);
          result.push(trimmed);
        }
      }
    }
    return result;
  }
  if (typeof product.category === 'string' && product.category.trim().length > 0) {
    return [product.category.trim()];
  }
  return [];
}

function filterProductCategories(
  products: Product[],
  predicate: (id: string) => boolean
): Product[] {
  return products.map((product) => {
    const nextCategories = getProductCategories(product).filter(predicate);
    const { category: _legacyCategory, ...rest } = product;
    return {
      ...rest,
      categories: nextCategories,
    };
  });
}

/** Remove a deleted category ID from all products and clear legacy `category`. */
export function removeCategoryFromProducts(products: Product[], categoryId: string): Product[] {
  return filterProductCategories(products, (id) => id !== categoryId);
}

/** Retain only category IDs present in `validCategoryIds` across all products. */
export function pruneRemovedCategories(
  products: Product[],
  validCategoryIds: Set<string>
): Product[] {
  return filterProductCategories(products, (id) => validCategoryIds.has(id));
}

/** Format a category option for display with its optional leading emoji. */
export function formatCategoryLabel(category: CategoryOption): string {
  const emoji = category.emoji?.trim();
  return emoji ? `${emoji} ${category.label}` : category.label;
}

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
      matchesCategory = getProductCategories(product).includes(category);
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
