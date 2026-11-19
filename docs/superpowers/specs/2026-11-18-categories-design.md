# Weebles Storefront & Admin: Dynamic & Multi-Select Categories Specification

- **Date:** 2026-11-18
- **Status:** Draft (Pending Spec Review)
- **Target Platform:** Netlify (Vite + React + TypeScript + Netlify Functions)
- **Visual Design:** Hello Kitty inspired feminine pastel theme (`bg-white rounded-3xl border-2 border-pink-200`, matching existing Storefront and Admin Portal components)

---

## 1. Overview & Objectives

Replace the hardcoded, single-select product category system with dynamic, admin-managed categories that support assigning multiple categories to each catalog item:

1. **Dynamic Category Management (Add & Remove):**
   - Store the shop's category options (`CategoryOption[]`) in `SiteSettings` (`src/data/settings.json`), seeded with the 4 existing categories (`Critters`, `Sweets`, `Fantasy`, `Mini-Friends`).
   - Admins can add new categories (with a required name and optional emoji) and remove existing categories directly inside the **Manage Catalog** tab via a **Manage Categories** modal.
2. **Automatic Cascade Cleanup on Category Removal:**
   - Removing a category from category options removes that category ID from **every** catalog item that belongs to it.
   - Both the updated category list (`settings.json`) and updated catalog items (`products.json`) are saved together in one atomic admin action (`type: 'categories'`).
3. **Multi-Select Categories per Catalog Item:**
   - Each `Product` stores `categories?: string[]` instead of a single hardcoded union string.
   - Admins can check 0, 1, or multiple categories when creating or editing a Weeble in `WeebleEditorModal`.
   - Legacy cached products with a single `category?: string` remain fully compatible via a normalization helper.
4. **Dynamic Storefront Filter Chips:**
   - `CatalogGrid` dynamically renders all configured categories alongside the built-in filters (`All Weebles`, `Fridge Magnets`, `Keychains`, `Under $15`).
   - Products assigned to multiple categories appear under every matching category filter chip.
   - Storefront hydrates persisted `settings` from `adminApi.loadStoreData()` alongside `products` so category changes appear immediately without waiting for a static rebuild.

---

## 2. Data Model & Seed Data

### 2.1 Types

#### `src/types/settings.ts`
```typescript
export interface CategoryOption {
  id: string;     // unique slug, e.g. "animals", "holiday-specials"
  label: string;  // display label, e.g. "Critters", "Holiday Specials"
  emoji?: string; // optional leading emoji, e.g. "🐰"
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

#### `src/types/index.ts`
```typescript
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  variantPrices?: VariantPrices;
  images: string[];
  categories?: string[]; // array of CategoryOption.id values
  category?: string;     // legacy fallback for pre-migration cached payloads
  availableVariants: VariantType[];
  inStock: boolean;
  stockCount: number;
  featured?: boolean;
  isOneOfAKind?: boolean;
  createdAt?: string;
}
```

### 2.2 Seed Data

#### `src/data/settings.json`
Add the seeded `categories` array matching the existing store taxonomy:
```json
"categories": [
  { "id": "animals", "label": "Critters", "emoji": "🐰" },
  { "id": "sweets", "label": "Sweets", "emoji": "🍩" },
  { "id": "fantasy", "label": "Fantasy", "emoji": "✨" },
  { "id": "mini-friends", "label": "Mini-Friends", "emoji": "🌸" }
]
```

#### `src/data/products.json`
Migrate each product from `"category": "<id>"` to `"categories": ["<id>"]` (removing the legacy `"category"` key from seed entries):
- `weeble-bumblebee`, `weeble-strawberry-bunny`, `weeble-matcha-frog`: `"categories": ["animals"]`
- `weeble-blueberry-pancakes`, `weeble-croissant-chocolate`, `weeble-strawberry-macaron`, `weeble-pumpkin-spice`: `"categories": ["sweets"]`
- `weeble-friendly-ghost`, `weeble-lavender-ghost`: `"categories": ["fantasy"]`

---

## 3. Core Category & Filtering Utilities (`src/utils/productUtils.ts`)

### 3.1 `DEFAULT_CATEGORIES: CategoryOption[]`
Fallback array matching the 4 seeded categories above. Used only when `settings.categories === undefined` (nullish coalescing `settings.categories ?? DEFAULT_CATEGORIES`), so an intentional empty array `[]` is preserved.

### 3.2 `RESERVED_FILTER_IDS` & `slugifyCategoryId(label: string): string`
- `RESERVED_FILTER_IDS = new Set(['all', 'magnets', 'keychains', 'under-15', 'featured'])`
- `slugifyCategoryId(label)`:
  1. Lowercases and trims `label`.
  2. Replaces any run of non-`[a-z0-9]` characters with `-` and trims leading/trailing hyphens.
  3. If the resulting slug is empty (e.g., symbol-only input), returns `''`.
  4. If `RESERVED_FILTER_IDS.has(slug)`, appends `'-category'` (e.g., `'all'` -> `'all-category'`) so custom categories never collide with built-in filter logic.

### 3.3 `getProductCategories(product: Product): string[]`
- If `Array.isArray(product.categories)`: returns deduplicated non-empty string entries from `product.categories`.
- Otherwise, if `typeof product.category === 'string' && product.category.trim().length > 0`: returns `[product.category.trim()]`.
- Otherwise: returns `[]`.

### 3.4 `removeCategoryFromProducts(products: Product[], categoryId: string): Product[]`
- Returns a new `Product[]` where for each product:
  - Computes `nextCategories = getProductCategories(product).filter((id) => id !== categoryId)`.
  - Copies the product with `categories: nextCategories` and omits the legacy `category` property so cleaned records are normalized.
- Also provide `pruneRemovedCategories(products: Product[], validCategoryIds: Set<string>): Product[]` for server-side safeguard cleanup (keeps only IDs present in `validCategoryIds`).

### 3.5 `formatCategoryLabel(category: CategoryOption): string`
- If `category.emoji?.trim()`: returns `` `${category.emoji.trim()} ${category.label}` ``.
- Otherwise: returns `category.label`.

### 3.6 `filterProducts(products: Product[], category: string, searchQuery: string): Product[]`
- Built-in filters (`all`, `magnets`, `keychains`, `under-15`, `featured`) keep their exact existing behavior.
- For any other `category` ID: matches when `getProductCategories(product).includes(category)`.

---

## 4. Storefront UI & Live Hydration

### 4.1 `CatalogGrid` (`src/components/CatalogGrid.tsx`)
- Props:
  ```typescript
  interface CatalogGridProps {
    products: Product[];
    onOpenCustomModal: () => void;
    categories?: CategoryOption[]; // optional override; defaults to settings.categories ?? DEFAULT_CATEGORIES
  }
  ```
- Filter chip ordering:
  1. `{ id: 'all', label: '🌸 All Weebles' }`
  2. `{ id: 'magnets', label: '🧲 Fridge Magnets' }`
  3. `{ id: 'keychains', label: '🔑 Keychains' }`
  4. Dynamic custom categories: `activeCategories.map((cat) => ({ id: cat.id, label: formatCategoryLabel(cat) }))`
  5. `{ id: 'under-15', label: '🎀 Under $15' }`
- **Selected-category safety:** A `useEffect` watches `activeCategories` and `selectedCategory`; if `selectedCategory` is not a built-in chip ID and no longer exists in `activeCategories`, resets `selectedCategory` to `'all'`.

### 4.2 Settings Hydration (`src/App.tsx` & `src/context/SettingsContext.tsx`)
- In `SettingsContext.tsx`:
  - Export `SETTINGS_STORAGE_KEY = 'weebles_settings_v1'`.
  - Merge stored settings carefully so `categories` is preserved when present (including `[]`), and falls back to `DEFAULT_SETTINGS.categories` only when `parsed.categories === undefined`.
- In `App.tsx` and `AdminPortal.tsx`:
  - On mount (outside test mode), check whether `PRODUCTS_STORAGE_KEY` or `SETTINGS_STORAGE_KEY` is missing from `localStorage`.
  - If either is missing, call `adminApi.loadStoreData()` once:
    - If `PRODUCTS_STORAGE_KEY` was missing and `Array.isArray(data?.products)`, hydrate `products` and save to `localStorage`.
    - If `SETTINGS_STORAGE_KEY` was missing and `data?.settings` is an object, hydrate `updateSettings(data.settings)`.
  - This guarantees fresh visitors see the latest categories from Netlify Blobs immediately without overwriting an admin's optimistic local save.

---

## 5. Admin Portal UI

### 5.1 `CategoryManagerModal` (`src/components/admin/CategoryManagerModal.tsx`)
- Props:
  ```typescript
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
  ```
- **Accessibility:** Closes on `Escape`, backdrop click, or `X` button (`role="dialog"`, `aria-modal="true"`).
- **Add Category Form:**
  - Optional **Emoji** input (`id="new-category-emoji"`, `maxLength={8}`, placeholder `🏷️`).
  - Required **Category Name** input (`id="new-category-name"`, placeholder `e.g. Holiday Specials`).
  - Validation on submit:
    - Trimmed label must be non-empty (`"Please enter a category name."`).
    - Generated slug `slugifyCategoryId(label)` must be non-empty (`"Category name must include letters or numbers."`).
    - Duplicate check: neither `id` nor case-insensitive trimmed `label` may match an existing category (`"A category with this name already exists."`).
  - Calls `await onSaveCategories([...categories, newCategory])` and clears inputs on success. Displays inline error message and stays open on failure.
- **Category List & Cascade Delete:**
  - Lists each category with `formatCategoryLabel(cat)` and a usage badge showing how many products include `cat.id` (e.g., `3 items`, `1 item`, `0 items`).
  - If `categories.length === 0`, renders a friendly empty state (`"No categories yet. Add one above to organize your Weebles!"`).
  - Clicking the delete button (`aria-label={`Remove ${cat.label}`}`):
    - Counts affected products (`affectedCount`).
    - Prompts via `window.confirm`:
      - If `affectedCount > 0`: `` `Remove "${cat.label}"? This will also remove it from ${affectedCount} catalog ${affectedCount === 1 ? 'item' : 'items'}.` ``
      - If `affectedCount === 0`: `` `Remove category "${cat.label}"?` ``
    - If confirmed: computes `updatedCategories = categories.filter((c) => c.id !== cat.id)` and `updatedProducts = removeCategoryFromProducts(products, cat.id)`, then calls `await onSaveCategories(updatedCategories, updatedProducts)`.

### 5.2 `WeebleEditorModal` (`src/components/admin/WeebleEditorModal.tsx`)
- Add optional prop `categories?: CategoryOption[]` (defaults to `DEFAULT_CATEGORIES`).
- Replace single `category` state and `<select id="weeble-category">` with:
  - `selectedCategories: string[]`, initialized on open from `product ? getProductCategories(product).filter((id) => validIds.has(id)) : []`.
  - A **Categories** multi-select section rendering a checkbox pill for each option in `categories` (allowing 0, 1, or multiple selections).
  - If `categories.length === 0`, renders a helper note: `"No categories available yet. Use Manage Categories to add some."`
- On form submit: saves `categories: selectedCategories` on `savedProduct` (without setting legacy `category`).

### 5.3 `InventoryTab` (`src/components/admin/InventoryTab.tsx`)
- Add optional props (with safe defaults so existing tests remain smooth):
  - `categories?: CategoryOption[]` (defaults to `DEFAULT_CATEGORIES`)
  - `onSaveCategories?: (updatedCategories: CategoryOption[], updatedProducts?: Product[]) => Promise<void>`
- Action Header: add a **"Manage Categories"** button next to **"+ Add New Weeble"** that opens `CategoryManagerModal`.
- Inventory row metadata: map `getProductCategories(item)` through `categories` (falling back to the raw ID if unknown) and display comma-separated labels (e.g., `🐰 Critters, 🍩 Sweets`), or `Uncategorized` when empty.
- Pass `categories` down to `WeebleEditorModal` and render `CategoryManagerModal`.

### 5.4 `AdminPortal` (`src/components/admin/AdminPortal.tsx`)
- Derive `const categories = settings.categories ?? DEFAULT_CATEGORIES;`.
- Implement `handleSaveCategories(updatedCategories: CategoryOption[], updatedProducts?: Product[])`:
  1. Clear `errorMessage`.
  2. Optimistically update settings (`updateSettings({ ...settings, categories: updatedCategories })`).
  3. If `updatedProducts` is provided, optimistically update `products` (`setProducts(updatedProducts)` and `saveStoredProducts(updatedProducts)`).
  4. Call `await adminApi.saveCategories(updatedCategories, updatedProducts)`.
  5. Show success `notification` (auto-dismiss after 5s), or on failure set `errorMessage` and rethrow so `CategoryManagerModal` can display/retain context.
- Pass `categories` and `onSaveCategories={handleSaveCategories}` to `InventoryTab`.

---

## 6. Backend Persistence (`src/services/adminApi.ts` & `netlify/functions/admin-save.ts`)

### 6.1 `adminApi.saveCategories` (`src/services/adminApi.ts`)
```typescript
async saveCategories(
  categories: CategoryOption[],
  products?: Product[]
): Promise<{ success: boolean; message: string }>
```
- Requires active admin session (`Authorization: Bearer <token>`).
- POSTs `{ type: 'categories', categories, ...(products ? { products } : {}) }` to `/.netlify/functions/admin-save`.
- Throws descriptive `Error` on non-OK HTTP responses matching `saveInventory` and `saveSettings`.

### 6.2 `admin-save.ts` (`netlify/functions/admin-save.ts`)
- **`type === 'categories'` branch** (requires `Array.isArray(categories)`):
  1. Sanitize each category entry (`id`, `label`, optional trimmed `emoji`).
  2. Load `currentSettings = await loadPersistedSettings(event)`, set `currentSettings.categories = sanitizedCategories`, and persist `settings.json` to Netlify Blobs (`settings`) + GitHub (`src/data/settings.json`) or local/tmp fallback.
  3. Build `validIds = new Set(sanitizedCategories.map((c) => c.id))`.
  4. Resolve base product list: `Array.isArray(products) ? products : await loadPersistedProducts(event)`.
  5. Clean products so every product's `categories` contains only IDs in `validIds` (normalizing legacy `category` onto `categories` and removing the legacy `category` field when cleaned).
  6. If `Array.isArray(products)` was provided OR any product's categories changed, persist the cleaned `products.json` to Netlify Blobs (`products`) + GitHub (`src/data/products.json`) or local/tmp fallback.
  7. Return HTTP 200 `{ success: true, message: ... }`.
- **`type === 'settings'` branch update:**
  - Preserve `currentSettings.categories` when `mergedSettings.categories === undefined` (matching existing `admins` preservation) so saving from `ContentTab` or `SettingsTab` never accidentally drops categories.
- **Backward compatibility for `loadPersistedSettings`:**
  - Shallow spread `{ ...defaultSettingsData, ...blobSettings }` already preserves `blobSettings.categories` even when it is `[]` (since `[]` is a defined own property on `blobSettings`).

---

## 7. Testing Strategy

1. **Unit Tests (`tests/productUtils.test.ts`):**
   - `getProductCategories`: returns array when `categories` is set, wraps legacy `category`, returns `[]` when neither is set, deduplicates values.
   - `slugifyCategoryId`: normalizes spaces/case/punctuation, suffixes `-category` for reserved IDs (`all`, `magnets`, `keychains`, `under-15`, `featured`), returns `''` for symbol-only strings.
   - `removeCategoryFromProducts`: removes deleted category from single-category, multi-category, and legacy `category` items while preserving other assigned categories.
   - `formatCategoryLabel`: formats with and without optional emoji.
   - `filterProducts`: matches multi-category products under each assigned category and excludes items after category removal.
2. **Storefront Tests (`tests/CatalogGrid.test.tsx`):**
   - Renders built-in chips plus all dynamic categories (with and without emojis).
   - Filters multi-category items under each assigned category chip.
   - Respects explicit empty `categories: []` (shows only built-in chips).
   - Resets active filter to `'all'` if the selected category is removed.
3. **Admin Inventory & Category Management Tests (`tests/InventoryTab.test.tsx`):**
   - `WeebleEditorModal`: multi-select checkboxes allow choosing 0, 1, or multiple categories; editing an existing multi-category product pre-checks all its categories and saves updated `categories: string[]`.
   - `CategoryManagerModal`: adds a new category (with optional emoji), rejects empty or duplicate names, shows affected item count on delete confirmation, and passes both updated categories AND products stripped of the deleted category to `onSaveCategories`.
   - `InventoryTab`: displays multiple category labels (or `Uncategorized`) on product rows.
4. **API & Serverless Function Tests (`tests/adminApi.test.ts`):**
   - `adminApi.saveCategories` posts `{ type: 'categories', categories, products }` with Bearer token.
   - `admin-save` handler for `type: 'categories'` persists `settings` and strips removed categories from `products`.
   - `admin-save` handler for `type: 'settings'` preserves `categories` when omitted.
5. **AdminPortal & SettingsContext Integration Tests (`tests/AdminPortal.test.tsx`, `tests/SettingsContext.test.tsx`):**
   - Deleting a category in `AdminPortal` updates both `settings.categories` and the displayed products in `InventoryTab`.
   - `SettingsContext` preserves explicit `categories: []` from `localStorage`.
