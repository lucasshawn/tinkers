# Weebles Storefront: 30-Day "NEW!" Catalog Badge Specification

- **Date:** 2026-11-18
- **Status:** Approved
- **Target Platform:** Netlify (Vite + React + TypeScript)
- **Visual Design:** Hello Kitty inspired feminine pastel theme (`bg-weeble-pink text-white`, pill badge in top-right image corner)

---

## 1. Overview & Objectives

When a new item is added to the catalog, display a `NEW!` badge on that item's card on the main web store page and keep it visible for 30 days from creation:

1. **Creation Timestamping:** Stamp newly added products in the Admin Portal with an ISO 8601 `createdAt` timestamp, and preserve existing `createdAt` values when editing products.
2. **Legacy Product Handling:** Existing catalog items without a `createdAt` field are treated as older than 30 days and do not display the `NEW!` badge.
3. **30-Day Expiration Window:** Evaluate whether an item was added within the last 30 days (`30 * 24 * 60 * 60 * 1000` milliseconds) dynamically on the storefront so the badge automatically disappears after 30 days without requiring a manual edit or redeploy.
4. **Storefront UI Placement:** Render the `NEW!` pill badge in the top-right corner of the product image container on [`ProductCard.tsx`](file:///c:/Users/lucas/source/repos/tinkers/src/components/ProductCard.tsx), opposite the top-left stock status badge.

---

## 2. Data Model Changes

### 2.1 Product Interface (`src/types/index.ts`)
Add an optional `createdAt` property to [`Product`](file:///c:/Users/lucas/source/repos/tinkers/src/types/index.ts#L5-L17):

```typescript
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  category: 'animals' | 'sweets' | 'fantasy' | 'mini-friends';
  availableVariants: VariantType[];
  inStock: boolean;
  stockCount: number;
  featured?: boolean;
  isOneOfAKind?: boolean;
  createdAt?: string;
}
```

---

## 3. Core Logic & Components

### 3.1 30-Day Evaluation Helper (`src/utils/productUtils.ts`)
Add a constant and pure helper function to [`src/utils/productUtils.ts`](file:///c:/Users/lucas/source/repos/tinkers/src/utils/productUtils.ts):

```typescript
export const NEW_PRODUCT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export function isNewProduct(product: Product, now: number = Date.now()): boolean {
  if (!product.createdAt) return false;
  const createdMs = Date.parse(product.createdAt);
  if (Number.isNaN(createdMs)) return false;
  const ageMs = now - createdMs;
  return ageMs >= 0 && ageMs <= NEW_PRODUCT_WINDOW_MS;
}
```

### 3.2 Stamping `createdAt` on Creation (`src/components/admin/WeebleEditorModal.tsx`)
In [`WeebleEditorModal.tsx`](file:///c:/Users/lucas/source/repos/tinkers/src/components/admin/WeebleEditorModal.tsx#L82-L105) (`handleSubmit`):
- When creating a new product (`product === null`), set `createdAt: new Date().toISOString()`.
- When editing an existing product (`product !== null`), preserve `product.createdAt` (if defined on `product`, retain it; if `undefined` on legacy items, leave it `undefined`).

### 3.3 Rendering the `NEW!` Badge (`src/components/ProductCard.tsx`)
In [`ProductCard.tsx`](file:///c:/Users/lucas/source/repos/tinkers/src/components/ProductCard.tsx#L34-L64), inside the `relative aspect-square` image container alongside the top-left stock status badge (`top-2.5 left-2.5`), render the `NEW!` badge in the top-right corner (`top-2.5 right-2.5`) when `isNewProduct(product)` returns `true`:

```tsx
{/* New Item Badge */}
{isNewProduct(product) && (
  <div className="absolute top-2.5 right-2.5">
    <span className="bg-weeble-pink text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm">
      NEW!
    </span>
  </div>
)}
```

---

## 4. Error Handling & Edge Cases

- **Missing `createdAt`:** Products in [`src/data/products.json`](file:///c:/Users/lucas/source/repos/tinkers/src/data/products.json) without `createdAt` return `false` from `isNewProduct`.
- **Malformed `createdAt`:** Invalid date strings cause `Date.parse` to return `NaN`, which safely returns `false`.
- **Future Timestamps:** If `ageMs < 0` (e.g., clock skew or future date), `isNewProduct` returns `false`.
- **Exact Boundary:** An item with `ageMs === 30 * 24 * 60 * 60 * 1000` (30 days) returns `true`; any millisecond after 30 days returns `false`.
- **Subsequent Admin Edits:** Editing price, stock count, description, or photo of an item in the Admin Portal preserves its original `createdAt` value so edits neither reset the 30-day timer nor add `NEW!` to legacy items.

---

## 5. Testing Strategy

1. **Unit Tests (`tests/productUtils.test.ts`):**
   - Returns `false` when `createdAt` is `undefined` or empty.
   - Returns `false` when `createdAt` is an invalid date string.
   - Returns `true` when `createdAt` is recent (e.g. 0 days, 15 days, or exactly 30 days ago).
   - Returns `false` when `createdAt` is older than 30 days (e.g. 30 days + 1 ms, or 31 days ago) or in the future.
2. **Component Tests (`tests/ProductCard.test.tsx`):**
   - Renders `NEW!` badge when `product.createdAt` is within the last 30 days.
   - Does not render `NEW!` badge when `product.createdAt` is omitted or older than 30 days.
3. **Admin Modal / Inventory Tests (`tests/InventoryTab.test.tsx`):**
   - Adding a new product stamps a valid ISO `createdAt` timestamp within the 30-day window.
   - Editing an existing product preserves its existing `createdAt` timestamp (or lack thereof).
