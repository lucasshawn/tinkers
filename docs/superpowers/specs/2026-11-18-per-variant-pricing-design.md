# Weebles Storefront & Admin: Per-Variant Pricing & Optional Styles Specification

- **Date:** 2026-11-18
- **Status:** Approved
- **Target Platform:** Netlify (Vite + React + TypeScript + Netlify Functions)
- **Visual Design:** Hello Kitty inspired feminine pastel theme (`bg-white rounded-3xl border-2 border-pink-200`, matching existing Storefront and Admin Portal components)

---

## 1. Overview & Objectives

Allow each catalog item to define independent prices for its enabled style variants (currently `magnet` and `keychain`, designed to scale cleanly to future variants such as a wine charm) and support items with only one variant or no variants at all:

1. **Per-Variant Pricing (`variantPrices`):** Store a dictionary of variant-specific prices (`variantPrices?: Partial<Record<VariantType, number>>`) on each [`Product`](file:///c:/Users/lucas/source/repos/tinkers/src/types/index.ts#L5-L18), while preserving top-level `price: number` as the base price (and fallback when an item has no variants or legacy data is loaded).
2. **Existing Catalog Seed Data:** Populate `variantPrices: { magnet: <price>, keychain: <price> }` on all 9 existing products in [`src/data/products.json`](file:///c:/Users/lucas/source/repos/tinkers/src/data/products.json) so both magnet and keychain start at the item's current price and can be adjusted individually via the Admin Portal.
3. **Conditional Storefront Variant Buttons:**
   - On [`ProductCard.tsx`](file:///c:/Users/lucas/source/repos/tinkers/src/components/ProductCard.tsx), only render buttons for the variants present in `product.availableVariants`.
   - If `product.availableVariants` is empty (`[]`), hide the `"Choose Style:"` label and variant buttons completely, and use the base `product.price`.
   - Display the price corresponding to the currently selected variant (or base `product.price` if no variants exist).
4. **Cart & Stripe Checkout Support:**
   - [`CartContext.tsx`](file:///c:/Users/lucas/source/repos/tinkers/src/context/CartContext.tsx) records the selected variant's price when adding an item to the cart, and supports items without a variant (`variant?: VariantType`).
   - [`CartDrawer.tsx`](file:///c:/Users/lucas/source/repos/tinkers/src/components/CartDrawer.tsx) displays the variant badge only when `item.variant` is present.
   - [`netlify/functions/create-checkout.ts`](file:///c:/Users/lucas/source/repos/tinkers/netlify/functions/create-checkout.ts) looks up the authoritative price for `item.variant` via `product.variantPrices?.[item.variant] ?? product.price` and omits the variant suffix from the Stripe product name when an item has no variant.
5. **Admin Editor & Inventory Display:**
   - [`WeebleEditorModal.tsx`](file:///c:/Users/lucas/source/repos/tinkers/src/components/admin/WeebleEditorModal.tsx) allows enabling/disabling each variant (`magnet`, `keychain`, or neither) and entering a price for each enabled variant (or a single base `Price ($ USD)` when no variant is checked).
   - [`InventoryTab.tsx`](file:///c:/Users/lucas/source/repos/tinkers/src/components/admin/InventoryTab.tsx) displays per-variant prices when they differ (e.g., `🧲 $14.00 / 🔑 $16.00`) or a single price when all enabled variants share the same price.

---

## 2. Data Model

### 2.1 Types (`src/types/index.ts`)

```typescript
export type VariantType = 'magnet' | 'keychain';

export type VariantPrices = Partial<Record<VariantType, number>>;

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  variantPrices?: VariantPrices;
  images: string[];
  category: 'animals' | 'sweets' | 'fantasy' | 'mini-friends';
  availableVariants: VariantType[];
  inStock: boolean;
  stockCount: number;
  featured?: boolean;
  isOneOfAKind?: boolean;
  createdAt?: string;
}

export interface CartItem {
  id: string; // composite key: `${productId}-${variant || 'standard'}`
  productId: string;
  name: string;
  variant?: VariantType;
  price: number;
  image: string;
  quantity: number;
  maxQuantity?: number;
}
```

### 2.2 Seed Data (`src/data/products.json`)

Every existing product in [`src/data/products.json`](file:///c:/Users/lucas/source/repos/tinkers/src/data/products.json) is updated with `variantPrices` matching its current `price` for both `keychain` and `magnet`:

```json
"price": 14.00,
"variantPrices": {
  "keychain": 14.00,
  "magnet": 14.00
},
```

---

## 3. Core Pricing & Filtering Utilities (`src/utils/productUtils.ts`)

### 3.1 `getProductVariantPrice(product: Product, variant?: VariantType): number`
- If `variant` is provided and `typeof product.variantPrices?.[variant] === 'number'` (and `!Number.isNaN(product.variantPrices[variant])`), return `product.variantPrices[variant]!`.
- Otherwise, if `product.availableVariants.length > 0`:
  - Check the first available variant `firstVar = product.availableVariants[0]`; if `typeof product.variantPrices?.[firstVar] === 'number'`, return `product.variantPrices[firstVar]!`.
- Fall back to `product.price`.

### 3.2 `formatProductPriceSummary(product: Product): string`
- Returns a human-readable summary for the Admin inventory list:
  - If `product.availableVariants.length === 0`: returns `formatPrice(product.price)`.
  - Map each `v` in `product.availableVariants` to its resolved price `getProductVariantPrice(product, v)`.
  - If all resolved prices are identical, returns `formatPrice(resolvedPrices[0])`.
  - If resolved prices differ across available variants, returns per-variant formatted prices joined by ` / `, e.g. `🧲 $14.00 / 🔑 $16.00`.

### 3.3 `filterProducts` (`under-15` Category Filter)
- For `category === 'under-15'`:
  - If `product.availableVariants.length > 0`, matches if **any** available variant `v` has `getProductVariantPrice(product, v) < 15.0`.
  - If `product.availableVariants.length === 0`, matches if `product.price < 15.0`.

---

## 4. Storefront UI & Cart Behavior

### 4.1 `ProductCard` (`src/components/ProductCard.tsx`)
- **Initial Selected Variant:**
  - `selectedVariant` state is `VariantType | undefined`, initialized to `product.availableVariants[0]`.
  - Sync `selectedVariant` via `useEffect` if `product.availableVariants` changes and no longer includes `selectedVariant`.
- **Displayed Price:**
  - `const activePrice = getProductVariantPrice(product, selectedVariant);`
  - Render `{formatPrice(activePrice)}` in the card header.
- **Conditional Style Buttons:**
  - When `product.availableVariants.length > 0`, render the `"Choose Style:"` block containing only the buttons in `product.availableVariants`.
  - When `product.availableVariants.length === 0`, do **not** render the `"Choose Style:"` label or any variant buttons.
- **Add to Cart:**
  - Calls `addToCart(product, selectedVariant)` where `selectedVariant` is `undefined` when `product.availableVariants.length === 0`.
  - Computes `currentItem` in cart using composite key `${product.id}-${selectedVariant || 'standard'}`.

### 4.2 `CartContext` & `CartDrawer` (`src/context/CartContext.tsx`, `src/components/CartDrawer.tsx`)
- `addToCart: (product: Product, variant?: VariantType) => void`
  - Uses `const effectiveVariant = variant ?? product.availableVariants[0];` (which is `undefined` when `product.availableVariants` is empty).
  - Composite key: ``const compositeId = `${product.id}-${effectiveVariant || 'standard'}`;``
  - Unit price: `const unitPrice = getProductVariantPrice(product, effectiveVariant);`
- In [`CartDrawer.tsx`](file:///c:/Users/lucas/source/repos/tinkers/src/components/CartDrawer.tsx):
  - Only render the variant badge (`🧲 Magnet` or `🔑 Keychain`) when `item.variant` is defined.

### 4.3 Stripe Checkout (`netlify/functions/create-checkout.ts`)
- Validate variant availability if `item.variant` is provided and `Array.isArray(product.availableVariants) && product.availableVariants.length > 0`:
  - If `item.variant` is not in `product.availableVariants`, return HTTP 400.
- Resolve unit price on the server:
  - `const unitPrice = (item.variant && typeof product.variantPrices?.[item.variant] === 'number') ? product.variantPrices[item.variant] : product.price;`
- Format Stripe line item product name:
  - If `item.variant === 'magnet'`: `${product.name} (🧲 Refrigerator Magnet)`
  - If `item.variant === 'keychain'`: `${product.name} (🔑 Keychain)`
  - Otherwise (no variant): `${product.name}`

---

## 5. Admin Portal UI

### 5.1 `WeebleEditorModal` (`src/components/admin/WeebleEditorModal.tsx`)
- **State:**
  - `variants`: `VariantType[]`, initialized from `product ? product.availableVariants : ['magnet', 'keychain']`.
  - `basePrice`: `string`, initialized from `product ? String(product.price) : '14.00'`.
  - `magnetPrice`: `string`, initialized from `product ? String(product.variantPrices?.magnet ?? product.price) : '14.00'`.
  - `keychainPrice`: `string`, initialized from `product ? String(product.variantPrices?.keychain ?? product.price) : '14.00'`.
- **Available Styles Checkboxes:**
  - `🧲 Refrigerator Magnet` checkbox toggles `'magnet'` in `variants`.
  - `🔑 Keychain` checkbox toggles `'keychain'` in `variants`.
  - Both can be unchecked (`variants = []`) for items that have neither magnet nor keychain options.
- **Price Inputs:**
  - When `'magnet'` is checked, show **Magnet Price ($ USD)** (`id="weeble-magnet-price"`, label `"Magnet Price ($ USD)"`).
  - When `'keychain'` is checked, show **Keychain Price ($ USD)** (`id="weeble-keychain-price"`, label `"Keychain Price ($ USD)"`).
  - When neither `'magnet'` nor `'keychain'` is checked (`variants.length === 0`), show **Price ($ USD)** (`id="weeble-price"`, label `"Price ($ USD)"`).
- **Saving (`handleSubmit`):**
  - Build `variantPrices: VariantPrices = {}`:
    - If `variants.includes('magnet')`, `variantPrices.magnet = parseFloat(magnetPrice) || 14.0`.
    - If `variants.includes('keychain')`, `variantPrices.keychain = parseFloat(keychainPrice) || 14.0`.
  - Compute top-level `price`:
    - If `variants.includes('magnet')`, `variantPrices.magnet!`.
    - Else if `variants.includes('keychain')`, `variantPrices.keychain!`.
    - Else `parseFloat(basePrice) || 14.0`.
  - Set `availableVariants: variants` (preserving `[]` when neither is selected).
  - Include `variantPrices` on `savedProduct` (or `{}` if no variants are selected).

### 5.2 `InventoryTab` (`src/components/admin/InventoryTab.tsx`)
- Replace `{formatPrice(item.price)}` in the product row summary with `{formatProductPriceSummary(item)}` so admins can see at a glance whether magnet and keychain prices match or differ.

---

## 6. Testing Strategy

1. **Unit Tests (`tests/productUtils.test.ts`):**
   - `getProductVariantPrice` returns variant-specific prices when defined, falls back to `product.price` when `variantPrices` is missing or no variant is passed.
   - `formatProductPriceSummary` returns a single price when variant prices match or no variants exist, and `🧲 $X.XX / 🔑 $Y.YY` when they differ.
   - `filterProducts` with `'under-15'` matches if any enabled variant is under \$15.
2. **Storefront Card Tests (`tests/ProductCard.test.tsx`):**
   - Displays the selected variant's price and updates the price when switching between Magnet and Keychain.
   - Renders only the Magnet button when `availableVariants: ['magnet']`, and only the Keychain button when `availableVariants: ['keychain']`.
   - Renders no `"Choose Style:"` label and no Magnet/Keychain buttons when `availableVariants: []`.
3. **Cart & Checkout Tests (`tests/CartContext.test.tsx`, `tests/CartDrawer.test.tsx`, `tests/stripeService.test.ts`):**
   - Adding Magnet vs Keychain with different prices stores each variant's distinct price in cart items and calculates `subtotal` accurately.
   - Adding an item with `availableVariants: []` adds to cart with base price and renders without a variant badge in `CartDrawer`.
   - `create-checkout` charges the specific variant's price from `variantPrices`.
4. **Admin Inventory & Editor Tests (`tests/InventoryTab.test.tsx`):**
   - Editing Magnet Price and Keychain Price independently saves `variantPrices: { magnet, keychain }`.
   - Unchecking both Magnet and Keychain reveals the single base `Price ($ USD)` field and saves `availableVariants: []`.
