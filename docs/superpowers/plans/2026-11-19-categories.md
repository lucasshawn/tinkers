# Dynamic & Multi-Select Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable admins to add and remove store categories (automatically removing deleted categories from all catalog items), allow selecting multiple categories per catalog item, and render all configured categories dynamically as storefront filter chips.

**Architecture:** Store the shop's category taxonomy (`CategoryOption[]`) in `SiteSettings` (`src/data/settings.json`) and store assigned category IDs as `categories?: string[]` on each `Product` (`src/data/products.json`), with a normalization helper (`getProductCategories`) preserving backward compatibility with legacy single `category?: string` payloads. Persist category additions and deletion cascades atomically via a new `type: 'categories'` branch in `netlify/functions/admin-save.ts` that updates both `settings.json` and `products.json` in one admin request, and hydrate both `products` and `settings` on storefront/admin load.

**Tech Stack:** React 18, TypeScript 5.7, Vite 6, Tailwind CSS 3, Lucide React, Netlify Functions (`@netlify/functions`), Vitest 2 + React Testing Library.

## Global Constraints

- **Target Platform:** Netlify (Vite + React + TypeScript + Netlify Functions).
- **Visual Design:** Hello Kitty inspired feminine pastel theme (`bg-white rounded-3xl border-2 border-pink-200`, `bg-weeble-pink`, `bg-weeble-pinkWash`, `font-bubble`, matching existing Storefront and Admin Portal components).
- **Backward Compatibility:** Legacy cached `localStorage` or Netlify Blob products with a single `category?: string` (no `categories` array) must continue to filter, display, and edit cleanly via `getProductCategories(product)`.
- **Explicit Empty Array Preservation:** An empty `settings.categories = []` is valid and must be preserved (never silently replaced with `DEFAULT_CATEGORIES`); use nullish coalescing (`settings.categories ?? DEFAULT_CATEGORIES`) only when `undefined`.
- **Reserved Built-in Filter IDs:** `all`, `magnets`, `keychains`, `under-15`, and `featured` are reserved for built-in storefront filters; custom categories with matching slugs receive a `-category` suffix.
- **No Unrelated Edits:** Do not revert or commit unrelated working-tree changes (e.g., concurrent `ChangesTab` / `changeLogUtils` work). Stage only files touched by each task when committing.

---

## File Structure

- **Types & Seed Data:**
  - Modify `src/types/settings.ts`: add `CategoryOption` interface and `categories?: CategoryOption[]` on `SiteSettings`.
  - Modify `src/types/index.ts`: add `categories?: string[]` and widen `category?: string` on `Product`.
  - Modify `src/data/settings.json`: seed initial 4 categories (`animals`, `sweets`, `fantasy`, `mini-friends`).
  - Modify `src/data/products.json`: migrate all 9 products from `"category": "<id>"` to `"categories": ["<id>"]`.
- **Utilities:**
  - Modify `src/utils/productUtils.ts`: add `DEFAULT_CATEGORIES`, `RESERVED_FILTER_IDS`, `slugifyCategoryId`, `getProductCategories`, `removeCategoryFromProducts`, `pruneRemovedCategories`, `formatCategoryLabel`, and update `filterProducts` for multi-category matching.
  - Modify `src/utils/changeLogUtils.ts`: use `getProductCategories(p).join(', ') || '(none)'` in `diffInventoryChanges` so TypeScript compiles cleanly and multi-category edits are logged accurately.
- **Storefront Context, Hydration & Filter Chips:**
  - Modify `src/context/SettingsContext.tsx`: export `SETTINGS_STORAGE_KEY` and preserve `categories` (including `[]`) when reading from `localStorage`.
  - Modify `src/App.tsx`: hydrate `settings` alongside `products` from `adminApi.loadStoreData()` when missing from `localStorage`.
  - Modify `src/components/CatalogGrid.tsx`: render dynamic category filter chips alongside built-in filters (`All Weebles`, `Fridge Magnets`, `Keychains`, `Under $15`) and reset active filter to `'all'` if the selected category is removed.
- **Backend Persistence & Client API:**
  - Modify `src/services/adminApi.ts`: add `saveCategories(categories, products?)`.
  - Modify `netlify/functions/admin-save.ts`: add `type === 'categories'` handler (persists `settings.json` and cascades category removal onto `products.json`), and preserve `categories` during `type === 'settings'` updates.
- **Admin Portal UI:**
  - Create `src/components/admin/CategoryManagerModal.tsx`: modal for adding categories (optional emoji + required name), viewing item counts per category, and deleting categories with impact confirmation and cascade cleanup.
  - Modify `src/components/admin/WeebleEditorModal.tsx`: replace single `<select>` with multi-select category checkboxes populated from dynamic `categories`.
  - Modify `src/components/admin/InventoryTab.tsx`: add `"Manage Categories"` button, render `CategoryManagerModal`, display multiple category labels (or `Uncategorized`) per product row, and pass `categories` to `WeebleEditorModal`.
  - Modify `src/components/admin/AdminPortal.tsx`: wire `categories`, `handleSaveCategories`, and `settings` hydration from `adminApi.loadStoreData()`.
- **Tests:**
  - Modify `tests/productUtils.test.ts`
  - Modify `tests/SettingsContext.test.tsx`
  - Create `tests/CatalogGrid.test.tsx`
  - Modify `tests/adminApi.test.ts`
  - Create `tests/CategoryManagerModal.test.tsx`
  - Modify `tests/InventoryTab.test.tsx`
  - Modify `tests/AdminPortal.test.tsx`

---

### Task 1: Data Model, Seed Data, and Category Utilities

**Files:**
- Modify: `src/types/settings.ts:1-16`
- Modify: `src/types/index.ts:8-22`
- Modify: `src/data/settings.json:1-17`
- Modify: `src/data/products.json:1-155`
- Modify: `src/utils/productUtils.ts:1-115`
- Modify: `src/utils/changeLogUtils.ts:1-178` (only category field references)
- Test: `tests/productUtils.test.ts`

**Interfaces:**
- Consumes: existing `Product` (`src/types/index.ts`), `SiteSettings` (`src/types/settings.ts`).
- Produces:
  - `CategoryOption` (`{ id: string; label: string; emoji?: string }`) exported from `src/types/settings.ts` and re-exported from `src/types/index.ts`.
  - `SiteSettings.categories?: CategoryOption[]`.
  - `Product.categories?: string[]` and `Product.category?: string`.
  - From `src/utils/productUtils.ts`:
    - `DEFAULT_CATEGORIES: CategoryOption[]`
    - `RESERVED_FILTER_IDS: ReadonlySet<string>`
    - `slugifyCategoryId(label: string): string`
    - `getProductCategories(product: Product): string[]`
    - `removeCategoryFromProducts(products: Product[], categoryId: string): Product[]`
    - `pruneRemovedCategories(products: Product[], validCategoryIds: Set<string>): Product[]`
    - `formatCategoryLabel(category: CategoryOption): string`
    - Updated `filterProducts(products: Product[], category: string, searchQuery: string): Product[]`

- [ ] **Step 1: Write failing unit tests in `tests/productUtils.test.ts`**

Add tests at the bottom of the `describe('productUtils', ...)` block in `tests/productUtils.test.ts` (updating imports at top of file):

```typescript
import {
  filterProducts,
  formatPrice,
  isNewProduct,
  NEW_PRODUCT_WINDOW_MS,
  getProductVariantPrice,
  formatProductPriceSummary,
  DEFAULT_CATEGORIES,
  slugifyCategoryId,
  getProductCategories,
  removeCategoryFromProducts,
  pruneRemovedCategories,
  formatCategoryLabel,
} from '../src/utils/productUtils';
```

And append this `describe` block inside `describe('productUtils', ...)`:

```typescript
  describe('category helpers and multi-category filtering', () => {
    it('exports the 4 default categories matching seeded taxonomy', () => {
      expect(DEFAULT_CATEGORIES.map((c) => c.id)).toEqual([
        'animals',
        'sweets',
        'fantasy',
        'mini-friends',
      ]);
    });

    it('getProductCategories supports categories array, legacy category string, deduplication, and empty', () => {
      expect(
        getProductCategories({ ...mockProducts[0], categories: ['animals', 'sweets', 'animals'] })
      ).toEqual(['animals', 'sweets']);
      expect(getProductCategories({ ...mockProducts[0], categories: undefined, category: 'fantasy' })).toEqual([
        'fantasy',
      ]);
      expect(getProductCategories({ ...mockProducts[0], categories: [], category: 'animals' })).toEqual([]);
      expect(getProductCategories({ ...mockProducts[0], categories: undefined, category: undefined })).toEqual([]);
    });

    it('slugifyCategoryId normalizes labels and avoids collisions with reserved built-in filter IDs', () => {
      expect(slugifyCategoryId('  Holiday Specials!  ')).toBe('holiday-specials');
      expect(slugifyCategoryId('Mini---Friends')).toBe('mini-friends');
      expect(slugifyCategoryId('!!!')).toBe('');
      expect(slugifyCategoryId('All')).toBe('all-category');
      expect(slugifyCategoryId('Magnets')).toBe('magnets-category');
      expect(slugifyCategoryId('Keychains')).toBe('keychains-category');
      expect(slugifyCategoryId('Under 15')).toBe('under-15-category');
      expect(slugifyCategoryId('Featured')).toBe('featured-category');
    });

    it('formatCategoryLabel includes emoji when provided and omits when empty', () => {
      expect(formatCategoryLabel({ id: 'animals', label: 'Critters', emoji: '🐰' })).toBe('🐰 Critters');
      expect(formatCategoryLabel({ id: 'custom', label: 'Holiday' })).toBe('Holiday');
      expect(formatCategoryLabel({ id: 'custom', label: 'Holiday', emoji: '   ' })).toBe('Holiday');
    });

    it('removeCategoryFromProducts strips deleted category from single, multi, and legacy items', () => {
      const multiItem: Product = {
        ...mockProducts[0],
        id: 'multi-1',
        categories: ['animals', 'sweets'],
        category: undefined,
      };
      const singleItem: Product = {
        ...mockProducts[1],
        id: 'single-1',
        categories: ['sweets'],
        category: undefined,
      };
      const legacyItem: Product = {
        ...mockProducts[2],
        id: 'legacy-1',
        categories: undefined,
        category: 'sweets',
      };

      const cleaned = removeCategoryFromProducts([multiItem, singleItem, legacyItem], 'sweets');
      expect(cleaned[0].categories).toEqual(['animals']);
      expect(cleaned[0].category).toBeUndefined();
      expect(cleaned[1].categories).toEqual([]);
      expect(cleaned[2].categories).toEqual([]);
      expect(cleaned[2].category).toBeUndefined();
    });

    it('pruneRemovedCategories retains only IDs present in validCategoryIds', () => {
      const items: Product[] = [
        { ...mockProducts[0], categories: ['animals', 'deleted-cat'], category: undefined },
        { ...mockProducts[1], categories: undefined, category: 'deleted-cat' },
      ];
      const pruned = pruneRemovedCategories(items, new Set(['animals']));
      expect(pruned[0].categories).toEqual(['animals']);
      expect(pruned[1].categories).toEqual([]);
    });

    it('filterProducts matches multi-category items under each assigned category', () => {
      const hybrid: Product = {
        ...mockProducts[0],
        id: 'hybrid-1',
        name: 'Candy Bunny',
        categories: ['animals', 'sweets'],
        category: undefined,
      };
      const catalog = [hybrid, mockProducts[1]];

      expect(filterProducts(catalog, 'animals', '').map((p) => p.id)).toEqual(['hybrid-1', 'weeble-2']);
      expect(filterProducts(catalog, 'sweets', '').map((p) => p.id)).toEqual(['hybrid-1']);
      expect(filterProducts(catalog, 'fantasy', '')).toEqual([]);
    });
  });
```

- [ ] **Step 2: Run unit test to verify it fails**

Run: `npx vitest run tests/productUtils.test.ts`
Expected: FAIL because `DEFAULT_CATEGORIES`, `slugifyCategoryId`, `getProductCategories`, `removeCategoryFromProducts`, `pruneRemovedCategories`, and `formatCategoryLabel` are not yet exported.

- [ ] **Step 3: Update `src/types/settings.ts` and `src/types/index.ts`**

Update `src/types/settings.ts`:
```typescript
export interface AnnouncementBannerSettings {
  enabled: boolean;
  text: string;
}

export interface CategoryOption {
  id: string;
  label: string;
  emoji?: string;
}

export interface SiteSettings {
  contactEmail: string;
  customOrderEmail: string;
  socials: {
    tiktok: string;
    instagram: string;
    facebookMarketplace: string;
  };
  announcementBanner?: AnnouncementBannerSettings;
  admins?: string[];
  categories?: CategoryOption[];
}
```

Update `Product` in `src/types/index.ts`:
```typescript
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  variantPrices?: VariantPrices;
  images: string[];
  categories?: string[];
  category?: string;
  availableVariants: VariantType[];
  inStock: boolean;
  stockCount: number;
  featured?: boolean;
  isOneOfAKind?: boolean;
  createdAt?: string;
}
```

- [ ] **Step 4: Seed `src/data/settings.json` and migrate `src/data/products.json`**

Add `"categories"` to `src/data/settings.json`:
```json
{
  "contactEmail": "weeblesclay@gmail.com",
  "customOrderEmail": "weeblesclay@gmail.com",
  "socials": {
    "tiktok": "https://tiktok.com/@weebles_clay",
    "instagram": "https://instagram.com/weebles_clay",
    "facebookMarketplace": "https://facebook.com/marketplace"
  },
  "announcementBanner": {
    "enabled": false,
    "text": ""
  },
  "admins": [
    "lucasshawn@gmail.com",
    "lucascierra24@gmail.com"
  ],
  "categories": [
    { "id": "animals", "label": "Critters", "emoji": "🐰" },
    { "id": "sweets", "label": "Sweets", "emoji": "🍩" },
    { "id": "fantasy", "label": "Fantasy", "emoji": "✨" },
    { "id": "mini-friends", "label": "Mini-Friends", "emoji": "🌸" }
  ]
}
```

In `src/data/products.json`, replace each `"category": "<id>"` with `"categories": ["<id>"]` across all 9 products (`animals` -> `["animals"]`, `sweets` -> `["sweets"]`, `fantasy` -> `["fantasy"]`).

- [ ] **Step 5: Implement category helpers and multi-category `filterProducts` in `src/utils/productUtils.ts`**

Add imports and helpers in `src/utils/productUtils.ts`:
```typescript
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

export function removeCategoryFromProducts(products: Product[], categoryId: string): Product[] {
  return products.map((product) => {
    const nextCategories = getProductCategories(product).filter((id) => id !== categoryId);
    const { category: _legacyCategory, ...rest } = product;
    return {
      ...rest,
      categories: nextCategories,
    };
  });
}

export function pruneRemovedCategories(
  products: Product[],
  validCategoryIds: Set<string>
): Product[] {
  return products.map((product) => {
    const nextCategories = getProductCategories(product).filter((id) => validCategoryIds.has(id));
    const { category: _legacyCategory, ...rest } = product;
    return {
      ...rest,
      categories: nextCategories,
    };
  });
}

export function formatCategoryLabel(category: CategoryOption): string {
  const emoji = category.emoji?.trim();
  return emoji ? `${emoji} ${category.label}` : category.label;
}
```

And update line 102 in `filterProducts`:
```typescript
    } else {
      matchesCategory = getProductCategories(product).includes(category);
    }
```

- [ ] **Step 6: Update `src/utils/changeLogUtils.ts` to use `getProductCategories`**

Import `getProductCategories` from `./productUtils` in `src/utils/changeLogUtils.ts`, and replace direct `p.category` / `oldP.category` / `newP.category` accesses in `diffInventoryChanges`:
```typescript
const formatCategories = (p: Product) => getProductCategories(p).join(', ') || '(none)';
```
- Added product comment: `Category: ${formatCategories(p)}`
- Deleted product comment: `Category: ${formatCategories(p)}`
- Field comparison: `{ label: 'Category', oldVal: formatCategories(oldP), newVal: formatCategories(newP) }`

- [ ] **Step 7: Run tests and TypeScript check**

Run: `npx vitest run tests/productUtils.test.ts`
Expected: PASS (all existing + 7 new category tests pass).

- [ ] **Step 8: Commit Task 1**

```bash
git add src/types/settings.ts src/types/index.ts src/data/settings.json src/data/products.json src/utils/productUtils.ts tests/productUtils.test.ts
git commit -m "feat(categories): add CategoryOption types, seeded data, and multi-category utilities"
```
(Note: Only stage `src/utils/changeLogUtils.ts` if no unrelated concurrent edits are mixed in, or keep its category fix cleanly isolated.)

---

### Task 2: SettingsContext Empty-Array Safety & Live Storefront Hydration

**Files:**
- Modify: `src/context/SettingsContext.tsx:1-72`
- Modify: `src/App.tsx:12-46`
- Test: `tests/SettingsContext.test.tsx`

**Interfaces:**
- Consumes: `SiteSettings` (`src/types/settings.ts`), `adminApi.loadStoreData` (`src/services/adminApi.ts`), `PRODUCTS_STORAGE_KEY` (`src/utils/productUtils.ts`).
- Produces: `SETTINGS_STORAGE_KEY = 'weebles_settings_v1'` exported from `src/context/SettingsContext.tsx`.

- [ ] **Step 1: Write failing tests in `tests/SettingsContext.test.tsx`**

Append to `describe('SettingsContext', ...)` in `tests/SettingsContext.test.tsx`:

```typescript
  it('provides seeded default categories and preserves an explicit empty categories array from localStorage', () => {
    const { result: defaultResult } = renderHook(() => useSettings(), { wrapper });
    expect(defaultResult.current.settings.categories?.map((c) => c.id)).toEqual([
      'animals',
      'sweets',
      'fantasy',
      'mini-friends',
    ]);

    localStorage.setItem(
      'weebles_settings_v1',
      JSON.stringify({
        contactEmail: 'stored@weebles.com',
        customOrderEmail: 'stored@weebles.com',
        socials: { tiktok: '', instagram: '', facebookMarketplace: '' },
        categories: [],
      })
    );

    const { result: emptyResult } = renderHook(() => useSettings(), { wrapper });
    expect(emptyResult.current.settings.categories).toEqual([]);
  });

  it('falls back to default categories when localStorage settings omit categories', () => {
    localStorage.setItem(
      'weebles_settings_v1',
      JSON.stringify({
        contactEmail: 'legacy@weebles.com',
        customOrderEmail: 'legacy@weebles.com',
        socials: { tiktok: '', instagram: '', facebookMarketplace: '' },
      })
    );

    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.settings.categories?.map((c) => c.id)).toEqual([
      'animals',
      'sweets',
      'fantasy',
      'mini-friends',
    ]);
  });
```

- [ ] **Step 2: Run test to verify current behavior**

Run: `npx vitest run tests/SettingsContext.test.tsx`
Expected: Check pass/fail and verify `SETTINGS_STORAGE_KEY` export is needed.

- [ ] **Step 3: Export `SETTINGS_STORAGE_KEY` and preserve `categories` cleanly in `src/context/SettingsContext.tsx`**

In `src/context/SettingsContext.tsx`:
```typescript
export const SETTINGS_STORAGE_KEY = 'weebles_settings_v1';
const SettingsContext = createContext<SettingsContextType | undefined>(undefined);
```
Update localStorage initialization to use `SETTINGS_STORAGE_KEY` and explicitly handle `categories`:
```typescript
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          socials: {
            ...DEFAULT_SETTINGS.socials,
            ...(parsed?.socials || {}),
          },
          categories: Array.isArray(parsed?.categories)
            ? parsed.categories
            : DEFAULT_SETTINGS.categories,
        };
      }
```
And replace the other `STORAGE_KEY` references in `updateSettings` and `resetSettings` with `SETTINGS_STORAGE_KEY`.

- [ ] **Step 4: Hydrate `settings` alongside `products` in `src/App.tsx`**

In `src/App.tsx`, import `SETTINGS_STORAGE_KEY` from `./context/SettingsContext` and destructure `updateSettings` from `useSettings()`:
```typescript
  const { settings, updateSettings } = useSettings();
```
Update the mount hydration `useEffect`:
```typescript
  useEffect(() => {
    if (import.meta.env.MODE === 'test') return;
    const hasLocalProducts = Boolean(localStorage.getItem(PRODUCTS_STORAGE_KEY));
    const hasLocalSettings = Boolean(localStorage.getItem(SETTINGS_STORAGE_KEY));
    if (hasLocalProducts && hasLocalSettings) return;
    adminApi.loadStoreData().then((data) => {
      if (!hasLocalProducts && data?.products && Array.isArray(data.products)) {
        setProducts(data.products);
        saveStoredProducts(data.products);
      }
      if (!hasLocalSettings && data?.settings && typeof data.settings === 'object') {
        updateSettings(data.settings);
      }
    });
  }, []);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/SettingsContext.test.tsx tests/smoke.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add src/context/SettingsContext.tsx src/App.tsx tests/SettingsContext.test.tsx
git commit -m "feat(categories): preserve empty categories in SettingsContext and hydrate settings on load"
```

---

### Task 3: Dynamic Storefront Filter Chips (`CatalogGrid`)

**Files:**
- Modify: `src/components/CatalogGrid.tsx:1-96`
- Create: `tests/CatalogGrid.test.tsx`

**Interfaces:**
- Consumes: `useSettings` (`src/context/SettingsContext.tsx`), `DEFAULT_CATEGORIES`, `formatCategoryLabel`, `filterProducts` (`src/utils/productUtils.ts`), `CategoryOption`, `Product` (`src/types`).
- Produces: Updated `CatalogGrid` supporting optional `categories?: CategoryOption[]` prop (defaulting to `settings.categories ?? DEFAULT_CATEGORIES`).

- [ ] **Step 1: Create failing tests in `tests/CatalogGrid.test.tsx`**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/CatalogGrid.test.tsx`
Expected: FAIL because `CatalogGrid` currently uses a hardcoded `CATEGORIES` array and ignores `categories` prop / `useSettings()`.

- [ ] **Step 3: Update `src/components/CatalogGrid.tsx`**

```typescript
import React, { useState, useEffect, useMemo } from 'react';
import { CategoryOption, Product } from '../types';
import { ProductCard } from './ProductCard';
import { DEFAULT_CATEGORIES, filterProducts, formatCategoryLabel } from '../utils/productUtils';
import { useSettings } from '../context/SettingsContext';
import { Search } from 'lucide-react';

interface CatalogGridProps {
  products: Product[];
  onOpenCustomModal: () => void;
  categories?: CategoryOption[];
}

const LEADING_FILTERS = [
  { id: 'all', label: '🌸 All Weebles' },
  { id: 'magnets', label: '🧲 Fridge Magnets' },
  { id: 'keychains', label: '🔑 Keychains' },
];

const TRAILING_FILTERS = [{ id: 'under-15', label: '🎀 Under $15' }];

const BUILTIN_FILTER_IDS = new Set([
  ...LEADING_FILTERS.map((f) => f.id),
  ...TRAILING_FILTERS.map((f) => f.id),
]);

export const CatalogGrid: React.FC<CatalogGridProps> = ({
  products,
  onOpenCustomModal,
  categories,
}) => {
  const { settings } = useSettings();
  const activeCategories = categories ?? settings.categories ?? DEFAULT_CATEGORIES;
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (BUILTIN_FILTER_IDS.has(selectedCategory)) return;
    if (!activeCategories.some((c) => c.id === selectedCategory)) {
      setSelectedCategory('all');
    }
  }, [activeCategories, selectedCategory]);

  const filterChips = useMemo(
    () => [
      ...LEADING_FILTERS,
      ...activeCategories.map((cat) => ({
        id: cat.id,
        label: formatCategoryLabel(cat),
      })),
      ...TRAILING_FILTERS,
    ],
    [activeCategories]
  );

  const filtered = filterProducts(products, selectedCategory, searchQuery);
```
Replace `CATEGORIES.map` in the JSX with `filterChips.map`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/CatalogGrid.test.tsx tests/smoke.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add src/components/CatalogGrid.tsx tests/CatalogGrid.test.tsx
git commit -m "feat(storefront): render dynamic category filter chips in CatalogGrid"
```

---

### Task 4: Backend Category Persistence & Cascade Cleanup (`adminApi` + `admin-save`)

**Files:**
- Modify: `src/services/adminApi.ts:1-121`
- Modify: `netlify/functions/admin-save.ts:295-445`
- Test: `tests/adminApi.test.ts`

**Interfaces:**
- Consumes: `CategoryOption` (`src/types/settings.ts`), `Product` (`src/types/index.ts`), `pruneRemovedCategories` (`src/utils/productUtils.ts`).
- Produces:
  - `adminApi.saveCategories(categories: CategoryOption[], products?: Product[]): Promise<{ success: boolean; message: string }>`
  - `POST /.netlify/functions/admin-save` handler support for `{ type: 'categories', categories: CategoryOption[], products?: Product[] }` (persists `settings.json` and cascades category removal to `products.json`).
  - Preservation of `categories` during `{ type: 'settings', settings }` when `settings.categories === undefined`.

- [ ] **Step 1: Write failing tests in `tests/adminApi.test.ts`**

Add tests inside `describe('admin-save Netlify Function', ...)` in `tests/adminApi.test.ts`:

```typescript
  it('saves categories and cascades removal onto products when type is categories', async () => {
    const updatedCategories = [{ id: 'animals', label: 'Critters', emoji: '🐰' }];
    const productsWithRemovedCat: Product[] = [
      {
        id: 'p1',
        name: 'Sweet Bunny',
        description: 'Bunny holding donut',
        price: 14,
        images: ['/images/products/bunny.jpg'],
        categories: ['animals', 'sweets'],
        availableVariants: ['magnet'],
        inStock: true,
        stockCount: 2,
      },
      {
        id: 'p2',
        name: 'Donut Charm',
        description: 'Glazed donut',
        price: 13,
        images: ['/images/products/donut.jpg'],
        categories: ['sweets'],
        availableVariants: ['keychain'],
        inStock: true,
        stockCount: 1,
      },
    ];

    const event = {
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${validToken}` },
      body: JSON.stringify({
        type: 'categories',
        categories: updatedCategories,
        products: productsWithRemovedCat,
      }),
    };

    const res = (await handler(event as any, {} as any)) as any;
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);

    const writeCalls = (fs.writeFileSync as any).mock.calls;
    const settingsCall = writeCalls.find((c: any[]) => String(c[0]).includes('settings.json'));
    const productsCall = writeCalls.find((c: any[]) => String(c[0]).includes('products.json'));

    expect(settingsCall).toBeDefined();
    expect(JSON.parse(settingsCall[1]).categories).toEqual(updatedCategories);

    expect(productsCall).toBeDefined();
    const writtenProducts = JSON.parse(productsCall[1]);
    expect(writtenProducts[0].categories).toEqual(['animals']);
    expect(writtenProducts[1].categories).toEqual([]);
  });

  it('preserves existing categories when saving settings without a categories property', async () => {
    const existingSettings = {
      contactEmail: 'old@weebles.com',
      customOrderEmail: 'old@weebles.com',
      socials: { tiktok: '', instagram: '', facebookMarketplace: '' },
      admins: ['lucasshawn@gmail.com'],
      categories: [{ id: 'seasonal', label: 'Seasonal', emoji: '🎄' }],
    };
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(existingSettings));

    const event = {
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${validToken}` },
      body: JSON.stringify({
        type: 'settings',
        settings: {
          contactEmail: 'new@weebles.com',
          customOrderEmail: 'new@weebles.com',
          socials: { tiktok: '', instagram: '', facebookMarketplace: '' },
        },
      }),
    };

    const res = (await handler(event as any, {} as any)) as any;
    expect(res.statusCode).toBe(200);

    const writeCalls = (fs.writeFileSync as any).mock.calls;
    const settingsCall = writeCalls.find((c: any[]) => String(c[0]).includes('settings.json'));
    expect(JSON.parse(settingsCall[1]).categories).toEqual([
      { id: 'seasonal', label: 'Seasonal', emoji: '🎄' },
    ]);
  });
```

And add tests inside `describe('adminApi client service', ...)`:

```typescript
  it('saveCategories throws error when not authenticated', async () => {
    await expect(
      adminApi.saveCategories([{ id: 'animals', label: 'Critters', emoji: '🐰' }])
    ).rejects.toThrow(/not authenticated/i);
  });

  it('saveCategories posts categories and optional products with session Bearer token', async () => {
    adminAuth.setSession({
      token: 'cat-token',
      email: 'lucasshawn@gmail.com',
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, message: 'Categories saved!' }),
    });
    globalThis.fetch = mockFetch;

    const cats = [{ id: 'animals', label: 'Critters', emoji: '🐰' }];
    const result = await adminApi.saveCategories(cats, mockProducts);
    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      '/.netlify/functions/admin-save',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer cat-token',
        },
        body: JSON.stringify({
          type: 'categories',
          categories: cats,
          products: mockProducts,
        }),
      })
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/adminApi.test.ts`
Expected: FAIL (`adminApi.saveCategories` is not a function; `type: 'categories'` returns 400).

- [ ] **Step 3: Add `saveCategories` to `src/services/adminApi.ts`**

Import `CategoryOption` from `../types/settings` and add method to `adminApi`:
```typescript
  async saveCategories(
    categories: CategoryOption[],
    products?: Product[]
  ): Promise<{ success: boolean; message: string }> {
    const session = adminAuth.getSession();
    if (!session) throw new Error('Not authenticated');

    const res = await fetch('/.netlify/functions/admin-save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({
        type: 'categories',
        categories,
        ...(products ? { products } : {}),
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const statusDetail = res.status ? ` (HTTP ${res.status})` : '';
      throw new Error(data.error || `Failed to save categories${statusDetail}`);
    }

    return res.json();
  },
```

- [ ] **Step 4: Update `netlify/functions/admin-save.ts`**

1. Destructure `categories` from parsed body:
   `const { type, products, settings, admins, categories, newImage, changes } = JSON.parse(rawBody);`
2. In `type === 'settings'`:
   ```typescript
      const mergedSettings = { ...settings };
      if (!mergedSettings.admins || mergedSettings.categories === undefined) {
        const currentSettings = await loadPersistedSettings(event);
        if (!mergedSettings.admins && currentSettings.admins) {
          mergedSettings.admins = currentSettings.admins;
        }
        if (mergedSettings.categories === undefined && currentSettings.categories !== undefined) {
          mergedSettings.categories = currentSettings.categories;
        }
      }
   ```
3. Add `type === 'categories'` branch:
   ```typescript
    // 6. Handle categories update (with cascade cleanup on products)
    if (type === 'categories' && Array.isArray(categories)) {
      const sanitizedCategories = categories
        .filter((c: any) => c && typeof c.id === 'string' && typeof c.label === 'string')
        .map((c: any) => {
          const entry: { id: string; label: string; emoji?: string } = {
            id: c.id.trim(),
            label: c.label.trim(),
          };
          if (typeof c.emoji === 'string' && c.emoji.trim()) {
            entry.emoji = c.emoji.trim();
          }
          return entry;
        })
        .filter((c: any) => c.id && c.label);

      const currentSettings = await loadPersistedSettings(event);
      currentSettings.categories = sanitizedCategories;
      const settingsJson = JSON.stringify(currentSettings, null, 2) + '\n';
      const settingsBase64 = Buffer.from(settingsJson).toString('base64');

      await saveToNetlifyBlobs(event, 'settings', settingsJson);
      if (githubToken) {
        await commitToGitHub(
          'src/data/settings.json',
          settingsBase64,
          'chore(admin): update catalog categories from studio portal'
        );
      } else {
        writeJsonWithFallback('src/data/settings.json', TMP_SETTINGS_FILE, settingsJson);
      }

      const validIds = new Set(sanitizedCategories.map((c: any) => c.id));
      const baseProducts = Array.isArray(products) ? products : await loadPersistedProducts(event);
      let productsChanged = Array.isArray(products);
      const cleanedProducts = baseProducts.map((p: any) => {
        const currentCats: string[] = Array.isArray(p.categories)
          ? p.categories.filter((id: any) => typeof id === 'string' && id.trim().length > 0)
          : typeof p.category === 'string' && p.category.trim().length > 0
            ? [p.category.trim()]
            : [];
        const filteredCats = Array.from(new Set(currentCats.filter((id) => validIds.has(id))));
        if (
          filteredCats.length !== currentCats.length ||
          !Array.isArray(p.categories) ||
          'category' in p
        ) {
          productsChanged = true;
        }
        const { category: _legacy, ...rest } = p;
        return { ...rest, categories: filteredCats };
      });

      if (productsChanged) {
        const productsJson = JSON.stringify(cleanedProducts, null, 2) + '\n';
        const productsBase64 = Buffer.from(productsJson).toString('base64');
        await saveToNetlifyBlobs(event, 'products', productsJson);
        if (githubToken) {
          await commitToGitHub(
            'src/data/products.json',
            productsBase64,
            'chore(admin): remove deleted categories from catalog items'
          );
        } else {
          writeJsonWithFallback('src/data/products.json', TMP_PRODUCTS_FILE, productsJson);
        }
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: githubToken
            ? 'Categories saved and committed to GitHub. Netlify deploy triggered!'
            : 'Categories saved locally (Dev Mode).',
        }),
      };
    }
   ```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/adminApi.test.ts`
Expected: PASS (all existing + 4 new tests pass).

- [ ] **Step 6: Commit Task 4**

```bash
git add src/services/adminApi.ts netlify/functions/admin-save.ts tests/adminApi.test.ts
git commit -m "feat(api): add atomic categories persistence with product cascade cleanup"
```

---

### Task 5: Category Manager Modal (`CategoryManagerModal`)

**Files:**
- Create: `src/components/admin/CategoryManagerModal.tsx`
- Create: `tests/CategoryManagerModal.test.tsx`

**Interfaces:**
- Consumes: `CategoryOption`, `Product` (`src/types`), `slugifyCategoryId`, `getProductCategories`, `removeCategoryFromProducts`, `formatCategoryLabel` (`src/utils/productUtils.ts`).
- Produces: `CategoryManagerModal` and `CategoryManagerModalProps` exported from `src/components/admin/CategoryManagerModal.tsx`.

- [ ] **Step 1: Create failing tests in `tests/CategoryManagerModal.test.tsx`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CategoryManagerModal } from '../src/components/admin/CategoryManagerModal';
import { CategoryOption, Product } from '../src/types';

const categories: CategoryOption[] = [
  { id: 'animals', label: 'Critters', emoji: '🐰' },
  { id: 'sweets', label: 'Sweets', emoji: '🍩' },
  { id: 'mini-friends', label: 'Mini-Friends', emoji: '🌸' },
];

const products: Product[] = [
  {
    id: 'p1',
    name: 'Candy Bunny',
    description: 'Sweet bunny',
    price: 14,
    images: ['/images/products/bunny.jpg'],
    categories: ['animals', 'sweets'],
    availableVariants: ['magnet'],
    inStock: true,
    stockCount: 2,
  },
  {
    id: 'p2',
    name: 'Macaron',
    description: 'Pink macaron',
    price: 14.5,
    images: ['/images/products/macaron.jpg'],
    categories: ['sweets'],
    availableVariants: ['keychain'],
    inStock: true,
    stockCount: 3,
  },
];

describe('CategoryManagerModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders categories with item usage counts and adds a new category with optional emoji', async () => {
    const onSaveCategories = vi.fn().mockResolvedValue(undefined);
    render(
      <CategoryManagerModal
        isOpen={true}
        categories={categories}
        products={products}
        onClose={vi.fn()}
        onSaveCategories={onSaveCategories}
      />
    );

    expect(screen.getByText('🐰 Critters')).toBeInTheDocument();
    expect(screen.getByText('1 item')).toBeInTheDocument();
    expect(screen.getByText('🍩 Sweets')).toBeInTheDocument();
    expect(screen.getByText('2 items')).toBeInTheDocument();
    expect(screen.getByText('🌸 Mini-Friends')).toBeInTheDocument();
    expect(screen.getByText('0 items')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Emoji/i), { target: { value: '🎃' } });
    fireEvent.change(screen.getByLabelText(/Category Name/i), {
      target: { value: 'Spooky Season' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Add Category/i }));

    await waitFor(() => {
      expect(onSaveCategories).toHaveBeenCalledTimes(1);
    });

    expect(onSaveCategories).toHaveBeenCalledWith([
      ...categories,
      { id: 'spooky-season', label: 'Spooky Season', emoji: '🎃' },
    ]);
  });

  it('rejects empty names and duplicate category names/slugs inline', () => {
    const onSaveCategories = vi.fn().mockResolvedValue(undefined);
    render(
      <CategoryManagerModal
        isOpen={true}
        categories={categories}
        products={products}
        onClose={vi.fn()}
        onSaveCategories={onSaveCategories}
      />
    );

    // Empty name
    fireEvent.click(screen.getByRole('button', { name: /Add Category/i }));
    expect(screen.getByText(/Please enter a category name/i)).toBeInTheDocument();
    expect(onSaveCategories).not.toHaveBeenCalled();

    // Duplicate label (case-insensitive)
    fireEvent.change(screen.getByLabelText(/Category Name/i), { target: { value: 'sweets' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Category/i }));
    expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    expect(onSaveCategories).not.toHaveBeenCalled();
  });

  it('confirms affected item count and removes deleted category from both category list and products', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onSaveCategories = vi.fn().mockResolvedValue(undefined);

    render(
      <CategoryManagerModal
        isOpen={true}
        categories={categories}
        products={products}
        onClose={vi.fn()}
        onSaveCategories={onSaveCategories}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove Sweets' }));

    expect(confirmSpy).toHaveBeenCalledWith(
      'Remove "Sweets"? This will also remove it from 2 catalog items.'
    );

    await waitFor(() => {
      expect(onSaveCategories).toHaveBeenCalledTimes(1);
    });

    const [updatedCategories, updatedProducts] = onSaveCategories.mock.calls[0];
    expect(updatedCategories.map((c: CategoryOption) => c.id)).toEqual(['animals', 'mini-friends']);
    expect(updatedProducts[0].categories).toEqual(['animals']);
    expect(updatedProducts[1].categories).toEqual([]);
  });

  it('does not delete when confirmation is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onSaveCategories = vi.fn().mockResolvedValue(undefined);

    render(
      <CategoryManagerModal
        isOpen={true}
        categories={categories}
        products={products}
        onClose={vi.fn()}
        onSaveCategories={onSaveCategories}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove Sweets' }));
    expect(onSaveCategories).not.toHaveBeenCalled();
  });

  it('closes on Escape key and backdrop click', () => {
    const onClose = vi.fn();
    render(
      <CategoryManagerModal
        isOpen={true}
        categories={categories}
        products={products}
        onClose={onClose}
        onSaveCategories={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('category-modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/CategoryManagerModal.test.tsx`
Expected: FAIL (`CategoryManagerModal` file does not exist).

- [ ] **Step 3: Create `src/components/admin/CategoryManagerModal.tsx`**

```typescript
import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Tag, AlertCircle } from 'lucide-react';
import { CategoryOption, Product } from '../../types';
import {
  formatCategoryLabel,
  getProductCategories,
  removeCategoryFromProducts,
  slugifyCategoryId,
} from '../../utils/productUtils';

export interface CategoryManagerModalProps {
  isOpen: boolean;
  categories: CategoryOption[];
  products: Product[];
  onClose: () => void;
  onSaveCategories: (
    updatedCategories: CategoryOption[],
    updatedProducts?: Product[]
  ) => Promise<void>;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  categories,
  products,
  onClose,
  onSaveCategories,
}) => {
  const [label, setLabel] = useState('');
  const [emoji, setEmoji] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLabel('');
      setEmoji('');
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getUsageCount = (categoryId: string): number =>
    products.filter((p) => getProductCategories(p).includes(categoryId)).length;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setError('Please enter a category name.');
      return;
    }

    const id = slugifyCategoryId(trimmedLabel);
    if (!id) {
      setError('Category name must include letters or numbers.');
      return;
    }

    const duplicate = categories.some(
      (c) =>
        c.id.toLowerCase() === id.toLowerCase() ||
        c.label.trim().toLowerCase() === trimmedLabel.toLowerCase()
    );
    if (duplicate) {
      setError('A category with this name already exists.');
      return;
    }

    const trimmedEmoji = emoji.trim();
    const newCategory: CategoryOption = {
      id,
      label: trimmedLabel,
      ...(trimmedEmoji ? { emoji: trimmedEmoji } : {}),
    };

    setIsSaving(true);
    try {
      await onSaveCategories([...categories, newCategory]);
      setLabel('');
      setEmoji('');
    } catch (err: any) {
      setError(err?.message || 'Failed to add category.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async (cat: CategoryOption) => {
    setError(null);
    const affectedCount = getUsageCount(cat.id);
    const confirmMsg =
      affectedCount > 0
        ? `Remove "${cat.label}"? This will also remove it from ${affectedCount} catalog ${
            affectedCount === 1 ? 'item' : 'items'
          }.`
        : `Remove category "${cat.label}"?`;

    if (!window.confirm(confirmMsg)) return;

    const updatedCategories = categories.filter((c) => c.id !== cat.id);
    const updatedProducts = removeCategoryFromProducts(products, cat.id);

    setIsSaving(true);
    try {
      await onSaveCategories(updatedCategories, updatedProducts);
    } catch (err: any) {
      setError(err?.message || 'Failed to remove category.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      <div
        data-testid="category-modal-backdrop"
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-xs"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-manager-modal-title"
        className="relative bg-white rounded-3xl border-4 border-pink-200 max-w-lg w-full p-6 sm:p-8 shadow-2xl z-10"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-weeble-pinkWash text-weeble-text hover:text-weeble-pink flex items-center justify-center transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-xl bg-pink-100 flex items-center justify-center text-weeble-pink">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <h2
              id="category-manager-modal-title"
              className="font-bubble text-2xl font-bold text-weeble-text leading-tight"
            >
              Manage Categories
            </h2>
            <p className="text-xs text-weeble-textMuted">
              Add or remove storefront filter categories
            </p>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-2xl p-3 flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleAdd} noValidate className="mb-6">
          <div className="flex flex-col sm:flex-row gap-2.5 items-end">
            <div className="w-full sm:w-20">
              <label
                htmlFor="new-category-emoji"
                className="block text-xs font-bold text-weeble-text mb-1"
              >
                Emoji
              </label>
              <input
                id="new-category-emoji"
                type="text"
                maxLength={8}
                placeholder="🏷️"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                disabled={isSaving}
                className="w-full text-sm text-center bg-weeble-pinkWash border border-pink-200 rounded-xl px-2 py-2 text-weeble-text focus:outline-none focus:border-weeble-pink"
              />
            </div>

            <div className="flex-1 w-full">
              <label
                htmlFor="new-category-name"
                className="block text-xs font-bold text-weeble-text mb-1"
              >
                Category Name
              </label>
              <input
                id="new-category-name"
                type="text"
                placeholder="e.g. Holiday Specials"
                value={label}
                onChange={(e) => {
                  setLabel(e.target.value);
                  if (error) setError(null);
                }}
                disabled={isSaving}
                className="w-full text-sm bg-weeble-pinkWash border border-pink-200 rounded-xl px-3 py-2 text-weeble-text focus:outline-none focus:border-weeble-pink"
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full sm:w-auto bg-weeble-pink hover:bg-pink-500 text-white font-bubble text-sm font-bold px-4 py-2 rounded-xl shadow-sm flex items-center justify-center gap-1 transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Add Category</span>
            </button>
          </div>
        </form>

        <div className="border-t border-pink-100 pt-4">
          <h3 className="text-xs font-bold text-weeble-textMuted uppercase tracking-wider mb-3">
            Current Categories ({categories.length})
          </h3>

          {categories.length === 0 ? (
            <div className="text-center py-6 bg-weeble-pinkWash/40 rounded-2xl border border-pink-100 text-xs text-weeble-textMuted">
              No categories yet. Add one above to organize your Weebles!
            </div>
          ) : (
            <div className="divide-y divide-pink-100 max-h-64 overflow-y-auto pr-1">
              {categories.map((cat) => {
                const count = getUsageCount(cat.id);
                return (
                  <div
                    key={cat.id}
                    className="py-2.5 flex items-center justify-between gap-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-sm font-bold text-weeble-text truncate">
                        {formatCategoryLabel(cat)}
                      </span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-pink-50 text-weeble-textMuted border border-pink-100 whitespace-nowrap">
                        {count} {count === 1 ? 'item' : 'items'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemove(cat)}
                      disabled={isSaving}
                      aria-label={`Remove ${cat.label}`}
                      title={`Remove ${cat.label}`}
                      className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-500 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/CategoryManagerModal.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit Task 5**

```bash
git add src/components/admin/CategoryManagerModal.tsx tests/CategoryManagerModal.test.tsx
git commit -m "feat(admin): add CategoryManagerModal with add, validation, and cascade delete"
```

---

### Task 6: Multi-Select Categories in `WeebleEditorModal`, `InventoryTab`, and `AdminPortal`

**Files:**
- Modify: `src/components/admin/WeebleEditorModal.tsx:1-276`
- Modify: `src/components/admin/InventoryTab.tsx:1-162`
- Modify: `src/components/admin/AdminPortal.tsx:1-333`
- Test: `tests/InventoryTab.test.tsx`
- Test: `tests/AdminPortal.test.tsx`

**Interfaces:**
- Consumes: `CategoryManagerModal` (`src/components/admin/CategoryManagerModal.tsx`), `adminApi.saveCategories` (`src/services/adminApi.ts`), `SETTINGS_STORAGE_KEY` (`src/context/SettingsContext.tsx`), `DEFAULT_CATEGORIES`, `getProductCategories`, `formatCategoryLabel` (`src/utils/productUtils.ts`).
- Produces: Complete multi-select category editing, category management button in `InventoryTab`, and end-to-end persistence in `AdminPortal`.

- [ ] **Step 1: Update & add failing tests in `tests/InventoryTab.test.tsx` and `tests/AdminPortal.test.tsx`**

In `tests/InventoryTab.test.tsx`:
- Update the existing test `'handles category selection and stock toggles'` (lines 329-354) to toggle multiple category checkboxes (e.g. `Fantasy` and `Critters`) and expect `savedProducts[0].categories` to equal `['fantasy', 'animals']` (or checking `Fantasy` and `Sweets` -> `['fantasy', 'sweets']`):
```typescript
  it('handles multi-select category selection and stock toggles', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(<InventoryTab products={mockProducts} onSave={handleSave} />);

    const addBtn = screen.getByRole('button', { name: /\+ Add New Weeble/i });
    fireEvent.click(addBtn);

    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Sparkle Cat' } });
    fireEvent.change(screen.getByLabelText(/Description/i), { target: { value: 'Magical kitten' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Fantasy/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Critters/i }));

    // Toggle 1-of-1
    const oneOfAKindCheckbox = screen.getByLabelText(/1-of-1 Original/i);
    fireEvent.click(oneOfAKindCheckbox);

    fireEvent.click(screen.getByRole('button', { name: /Save Weeble/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    const savedProducts = handleSave.mock.calls[0][0];
    expect(savedProducts[0].categories).toEqual(['fantasy', 'animals']);
    expect(savedProducts[0].category).toBeUndefined();
    expect(savedProducts[0].isOneOfAKind).toBe(true);
    expect(savedProducts[0].stockCount).toBe(1);
  });
```
- Add new tests in `tests/InventoryTab.test.tsx`:
```typescript
  it('pre-checks existing categories when editing a multi-category item and displays multiple categories in inventory list', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    const multiProducts: Product[] = [
      {
        ...mockProducts[0],
        categories: ['animals', 'sweets'],
        category: undefined,
      },
      {
        ...mockProducts[1],
        categories: [],
        category: undefined,
      },
    ];

    render(<InventoryTab products={multiProducts} onSave={handleSave} />);

    expect(screen.getByText('🐰 Critters, 🍩 Sweets')).toBeInTheDocument();
    expect(screen.getByText('Uncategorized')).toBeInTheDocument();

    const editBtns = screen.getAllByRole('button', { name: /Edit/i });
    fireEvent.click(editBtns[0]);

    expect(screen.getByRole('checkbox', { name: /Critters/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Sweets/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Fantasy/i })).not.toBeChecked();

    // Uncheck both to verify 0 categories is allowed
    fireEvent.click(screen.getByRole('checkbox', { name: /Critters/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Sweets/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save Weeble/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    expect(handleSave.mock.calls[0][0][0].categories).toEqual([]);
  });

  it('opens Manage Categories modal and cascades deletion through onSaveCategories', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onSaveCategories = vi.fn().mockResolvedValue(undefined);

    render(
      <InventoryTab
        products={mockProducts}
        onSave={vi.fn()}
        onSaveCategories={onSaveCategories}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Manage Categories/i }));
    expect(screen.getByRole('heading', { name: /Manage Categories/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Critters' }));

    await waitFor(() => {
      expect(onSaveCategories).toHaveBeenCalledTimes(1);
    });

    const [updatedCategories, updatedProducts] = onSaveCategories.mock.calls[0];
    expect(updatedCategories.some((c: any) => c.id === 'animals')).toBe(false);
    expect(updatedProducts[0].categories).toEqual([]);
  });
```

And add an integration test in `tests/AdminPortal.test.tsx`:
```typescript
  it('adds and removes categories in Manage Catalog and removes deleted category from catalog items', async () => {
    adminAuth.setSession({ token: 'valid-token', email: 'lucasshawn@gmail.com', name: 'Shawn' });
    vi.spyOn(adminApi, 'saveCategories').mockResolvedValue({
      success: true,
      message: 'Categories saved locally (Dev Mode).',
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <SettingsProvider>
        <AdminPortal />
      </SettingsProvider>
    );

    // Open Manage Categories modal
    fireEvent.click(screen.getByRole('button', { name: /Manage Categories/i }));

    // Add a new category
    fireEvent.change(screen.getByLabelText(/Emoji/i), { target: { value: '🎀' } });
    fireEvent.change(screen.getByLabelText(/Category Name/i), { target: { value: 'Limited Drops' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Category/i }));

    await waitFor(() => {
      expect(adminApi.saveCategories).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText('🎀 Limited Drops')).toBeInTheDocument();

    // Remove 'Critters' (animals) -> should cascade cleanup to Bumblebee & other animals
    fireEvent.click(screen.getByRole('button', { name: 'Remove Critters' }));

    await waitFor(() => {
      expect(adminApi.saveCategories).toHaveBeenCalledTimes(2);
    });

    const [savedCategories, savedProducts] = (adminApi.saveCategories as any).mock.calls[1];
    expect(savedCategories.some((c: any) => c.id === 'animals')).toBe(false);
    expect(
      savedProducts.every((p: any) => !(p.categories || []).includes('animals'))
    ).toBe(true);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/InventoryTab.test.tsx tests/AdminPortal.test.tsx`
Expected: FAIL because `WeebleEditorModal` still renders `<select>`, `InventoryTab` lacks the `Manage Categories` button, and `AdminPortal` lacks `handleSaveCategories`.

- [ ] **Step 3: Update `src/components/admin/WeebleEditorModal.tsx`**

1. Import `CategoryOption` from `../../types` and `DEFAULT_CATEGORIES`, `formatCategoryLabel`, `getProductCategories` from `../../utils/productUtils`.
2. Add `categories?: CategoryOption[];` to `WeebleEditorModalProps` (default `categories = DEFAULT_CATEGORIES`).
3. Replace `category` state with `selectedCategories: string[]`:
   ```typescript
   const validCategoryIds = new Set(categories.map((c) => c.id));
   const resolveInitialCategories = (p: Product | null): string[] =>
     p ? getProductCategories(p).filter((id) => validCategoryIds.has(id)) : [];

   const [selectedCategories, setSelectedCategories] = useState<string[]>(() =>
     resolveInitialCategories(product)
   );
   ```
   Sync in `useEffect` when `[product, isOpen, categories]` changes:
   ```typescript
   setSelectedCategories(resolveInitialCategories(product));
   ```
   Add toggle handler:
   ```typescript
   const handleToggleCategory = (categoryId: string) => {
     setSelectedCategories((prev) =>
       prev.includes(categoryId)
         ? prev.filter((id) => id !== categoryId)
         : [...prev, categoryId]
     );
   };
   ```
4. In `handleSubmit`: set `categories: selectedCategories` on `savedProduct` (and do not include legacy `category`).
5. Replace the `<select id="weeble-category">` block with:
   - Full-width `Name` input
   - Dedicated **Categories** multi-select fieldset:
   ```tsx
          {/* Categories Multi-Select */}
          <fieldset>
            <legend className="block text-xs font-bold text-weeble-text mb-1.5">
              Categories (select one or more)
            </legend>
            {categories.length === 0 ? (
              <p className="text-xs text-weeble-textMuted bg-weeble-pinkWash/60 border border-pink-200 rounded-xl px-3 py-2">
                No categories available yet. Use Manage Categories to add some.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 bg-weeble-pinkWash/60 border border-pink-200 rounded-2xl p-3">
                {categories.map((cat) => {
                  const checked = selectedCategories.includes(cat.id);
                  return (
                    <label
                      key={cat.id}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer transition-all ${
                        checked
                          ? 'bg-weeble-pink text-white border-weeble-pink shadow-xs'
                          : 'bg-white text-weeble-text border-pink-200 hover:bg-pink-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleCategory(cat.id)}
                        className="sr-only"
                      />
                      <span>{formatCategoryLabel(cat)}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>
   ```

- [ ] **Step 4: Update `src/components/admin/InventoryTab.tsx`**

1. Import `Tag` from `lucide-react`, `CategoryOption` from `../../types`, `DEFAULT_CATEGORIES`, `formatCategoryLabel`, `getProductCategories` from `../../utils/productUtils`, and `CategoryManagerModal` from `./CategoryManagerModal`.
2. Update `InventoryTabProps`:
   ```typescript
   export interface InventoryTabProps {
     products: Product[];
     categories?: CategoryOption[];
     onSave: (updated: Product[], newImage?: { filename: string; base64Data: string }) => Promise<void>;
     onSaveCategories?: (
       updatedCategories: CategoryOption[],
       updatedProducts?: Product[]
     ) => Promise<void>;
   }
   ```
3. Default `categories = DEFAULT_CATEGORIES` and add `const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);`.
4. Add a helper inside `InventoryTab` to format a product's categories:
   ```typescript
   const categoryMap = new Map(categories.map((c) => [c.id, formatCategoryLabel(c)]));
   const formatItemCategories = (item: Product): string => {
     const ids = getProductCategories(item);
     if (ids.length === 0) return 'Uncategorized';
     return ids.map((id) => categoryMap.get(id) ?? id).join(', ');
   };
   ```
5. In the Action Header, wrap buttons in a flex container with `"Manage Categories"` and `"+ Add New Weeble"`:
   ```tsx
        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setIsCategoryModalOpen(true)}
            disabled={isSaving}
            className="w-full sm:w-auto bg-white hover:bg-weeble-pinkWash text-weeble-text border-2 border-pink-200 font-bubble text-sm font-bold px-4 py-2 rounded-full flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Tag className="w-4 h-4 text-weeble-pink" />
            <span>Manage Categories</span>
          </button>

          <button
            onClick={handleAddNew}
            disabled={isSaving}
            className="w-full sm:w-auto bg-weeble-pink hover:bg-pink-500 text-white font-bubble text-sm font-bold px-5 py-2.5 rounded-full shadow-pillow flex items-center justify-center gap-1.5 transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add New Weeble</span>
          </button>
        </div>
   ```
6. Replace `<span className="capitalize">{item.category}</span>` with `<span>{formatItemCategories(item)}</span>`.
7. Pass `categories={categories}` to `WeebleEditorModal` and render `CategoryManagerModal`:
   ```tsx
      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        categories={categories}
        products={products}
        onClose={() => setIsCategoryModalOpen(false)}
        onSaveCategories={async (updatedCategories, updatedProducts) => {
          if (onSaveCategories) {
            await onSaveCategories(updatedCategories, updatedProducts);
          }
        }}
      />
   ```

- [ ] **Step 5: Wire `AdminPortal.tsx`**

1. Import `SETTINGS_STORAGE_KEY` from `../../context/SettingsContext`, `CategoryOption` from `../../types/settings`, and `DEFAULT_CATEGORIES` from `../../utils/productUtils`.
2. In the mount `useEffect` in `AdminPortal.tsx`, hydrate `settings` if `!localStorage.getItem(SETTINGS_STORAGE_KEY) && data?.settings && typeof data.settings === 'object'`.
3. Add `handleSaveCategories`:
   ```typescript
   const categories = settings.categories ?? DEFAULT_CATEGORIES;

   const handleSaveCategories = async (
     updatedCategories: CategoryOption[],
     updatedProducts?: Product[]
   ) => {
     setErrorMessage(null);
     updateSettings({
       ...settings,
       categories: updatedCategories,
     });
     if (updatedProducts) {
       setProducts(updatedProducts);
       saveStoredProducts(updatedProducts);
     }
     try {
       const res = await adminApi.saveCategories(updatedCategories, updatedProducts);
       setNotification(res.message);
       setTimeout(() => setNotification(null), 5000);
     } catch (err: any) {
       const errMsg = err.message || 'Failed to save categories';
       setErrorMessage(errMsg);
       recordError('Save Categories', updatedCategories.map((c) => c.label).join(', '), errMsg);
       throw err;
     }
   };
   ```
4. Pass `categories={categories}` and `onSaveCategories={handleSaveCategories}` to `<InventoryTab />`.

- [ ] **Step 6: Run tests and TypeScript build**

Run: `npx vitest run tests/InventoryTab.test.tsx tests/AdminPortal.test.tsx tests/CatalogGrid.test.tsx tests/CategoryManagerModal.test.tsx tests/productUtils.test.ts tests/adminApi.test.ts tests/SettingsContext.test.tsx`
Run: `npm run build`
Expected: All tests PASS and `tsc && vite build` succeeds with zero TypeScript errors.

- [ ] **Step 7: Commit Task 6**

```bash
git add src/components/admin/WeebleEditorModal.tsx src/components/admin/InventoryTab.tsx src/components/admin/AdminPortal.tsx tests/InventoryTab.test.tsx tests/AdminPortal.test.tsx
git commit -m "feat(admin): support multi-select categories and category management in AdminPortal"
```

---

## Plan Self-Review Checklist
- **Spec Coverage:**
  - Types & Seed Data (Spec §2) -> Task 1
  - Core Category & Filtering Utilities (Spec §3) -> Task 1
  - Storefront UI & Live Hydration (Spec §4) -> Tasks 2 & 3
  - Admin Portal UI (`CategoryManagerModal`, `WeebleEditorModal`, `InventoryTab`, `AdminPortal`, Spec §5) -> Tasks 5 & 6
  - Backend Persistence (`adminApi.saveCategories`, `admin-save.ts`, Spec §6) -> Task 4
  - Testing Strategy (Spec §7) -> Distributed across Tasks 1–6
- **Placeholder Scan:** No TBDs, TODOs, or missing code blocks.
- **Type Consistency:** `CategoryOption` (`id`, `label`, `emoji?`), `Product.categories?: string[]`, `DEFAULT_CATEGORIES`, `slugifyCategoryId`, `getProductCategories`, `removeCategoryFromProducts`, `pruneRemovedCategories`, `formatCategoryLabel`, `SETTINGS_STORAGE_KEY`, `adminApi.saveCategories(categories, products?)` match identically across all 6 tasks.
