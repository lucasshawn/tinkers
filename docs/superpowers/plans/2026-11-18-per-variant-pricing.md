# Per-Variant Pricing & Optional Styles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-variant pricing (`variantPrices` for magnet and keychain) to catalog items, hide magnet/keychain selection buttons when those options are unavailable on a catalog item, and seed all existing products with matching magnet and keychain prices.

**Architecture:** Extend `Product` with `variantPrices?: Partial<Record<VariantType, number>>` and make `CartItem.variant` optional (`VariantType | undefined`) so items can have both styles with distinct prices, a single style, or no styles (using base `product.price`). Centralize price resolution and formatting in `src/utils/productUtils.ts`, update `ProductCard`, `CartContext`, `CartDrawer`, `create-checkout.ts`, `WeebleEditorModal`, and `InventoryTab`, and populate `variantPrices` across `src/data/products.json`.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest, React Testing Library, Netlify Functions (Stripe Checkout)

## Global Constraints

- All 9 existing products in `src/data/products.json` must have `variantPrices: { keychain: <price>, magnet: <price> }` matching their existing `price`.
- On `ProductCard`, if `product.availableVariants` is empty (`[]`), do not render the `"Choose Style:"` label or any `"magnet"` / `"keychain"` buttons. If only one variant is in `availableVariants`, only render that variant's button.
- Displayed price on `ProductCard`, cart item price in `CartContext`, and Stripe `unit_amount` in `netlify/functions/create-checkout.ts` must reflect the selected variant's price (`getProductVariantPrice(product, variant)`), falling back to `product.price`.

---

### Task 1: Data Model, Existing Catalog Seed Data, and Pricing Utilities

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/data/products.json`
- Modify: `src/utils/productUtils.ts`
- Test: `tests/productUtils.test.ts`

**Interfaces:**
- Produces:
  - `VariantPrices = Partial<Record<VariantType, number>>` in `src/types/index.ts`
  - `Product.variantPrices?: VariantPrices` in `src/types/index.ts`
  - `CartItem.variant?: VariantType` in `src/types/index.ts`
  - `getProductVariantPrice(product: Product, variant?: VariantType): number` in `src/utils/productUtils.ts`
  - `formatProductPriceSummary(product: Product): string` in `src/utils/productUtils.ts`

- [ ] **Step 1: Write the failing tests in `tests/productUtils.test.ts`**

Add tests for `getProductVariantPrice`, `formatProductPriceSummary`, and `filterProducts` with `'under-15'` for per-variant pricing in `tests/productUtils.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/productUtils.test.ts`
Expected: FAIL with `getProductVariantPrice` / `formatProductPriceSummary` not exported from `../src/utils/productUtils`.

- [ ] **Step 3: Implement types, catalog seed data, and pricing helpers**

Update `src/types/index.ts`:
```typescript
export * from './settings';

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

Update `src/utils/productUtils.ts`:
```typescript
export function getProductVariantPrice(product: Product, variant?: VariantType): number {
  if (variant && typeof product.variantPrices?.[variant] === 'number' && !Number.isNaN(product.variantPrices[variant]!)) {
    return product.variantPrices[variant]!;
  }
  if (product.availableVariants.length > 0) {
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
```
And in `filterProducts` inside `src/utils/productUtils.ts`, update `category === 'under-15'`:
```typescript
    } else if (category === 'under-15') {
      if (product.availableVariants && product.availableVariants.length > 0) {
        matchesCategory = product.availableVariants.some(
          (v) => getProductVariantPrice(product, v) < 15.0
        );
      } else {
        matchesCategory = product.price < 15.0;
      }
    }
```

Update all 9 items in `src/data/products.json` to add `"variantPrices": { "keychain": <price>, "magnet": <price> }` matching each item's current `"price"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/productUtils.test.ts`
Expected: PASS

---

### Task 2: Storefront `ProductCard` Dynamic Variant Price & Optional Buttons

**Files:**
- Modify: `src/components/ProductCard.tsx`
- Test: `tests/ProductCard.test.tsx`

**Interfaces:**
- Consumes: `getProductVariantPrice` from `src/utils/productUtils.ts`, `Product` and `VariantType` from `src/types/index.ts`

- [ ] **Step 1: Write failing tests in `tests/ProductCard.test.tsx`**

Add tests to `tests/ProductCard.test.tsx`:
```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ProductCard.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `ProductCard.tsx` updates**

In `src/components/ProductCard.tsx`:
- Initialize `selectedVariant` as `useState<VariantType | undefined>(product.availableVariants[0])` and sync with `useEffect` when `product.availableVariants` changes.
- Compute `const activePrice = getProductVariantPrice(product, selectedVariant);` and display `{formatPrice(activePrice)}`.
- Compute `const compositeId = `${product.id}-${selectedVariant || 'standard'}`;` for `currentItem`.
- Wrap the `"Choose Style:"` block in `{product.availableVariants.length > 0 && ( ... )}` so no buttons or label render when there is no magnet or keychain option.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ProductCard.test.tsx`
Expected: PASS

---

### Task 3: Cart Context, Cart Drawer, and Stripe Checkout Variant Pricing

**Files:**
- Modify: `src/context/CartContext.tsx`
- Modify: `src/components/CartDrawer.tsx`
- Modify: `netlify/functions/create-checkout.ts`
- Test: `tests/CartContext.test.tsx`
- Test: `tests/CartDrawer.test.tsx`
- Test: `tests/stripeService.test.ts`

**Interfaces:**
- Consumes: `getProductVariantPrice` from `src/utils/productUtils.ts`
- Produces: `addToCart: (product: Product, variant?: VariantType) => void` in `src/context/CartContext.tsx`

- [ ] **Step 1: Write failing tests in `tests/CartContext.test.tsx`, `tests/CartDrawer.test.tsx`, and `tests/stripeService.test.ts`**

Add tests verifying:
1. `CartContext`: adding `magnet` vs `keychain` with different `variantPrices` records the respective price on each `CartItem` and sums `subtotal` properly; adding a product with `availableVariants: []` and `variant: undefined` uses id `${product.id}-standard` and `product.price`.
2. `CartDrawer`: an item with `variant: undefined` renders without the `🧲 Magnet` / `🔑 Keychain` badge.
3. `create-checkout.ts`: uses `product.variantPrices?.[item.variant] ?? product.price` for `unit_amount` and formats product name without variant suffix when `item.variant` is absent.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/CartContext.test.tsx tests/CartDrawer.test.tsx tests/stripeService.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `CartContext.tsx`, `CartDrawer.tsx`, and `create-checkout.ts` changes**

In `src/context/CartContext.tsx`:
- Update `addToCart: (product: Product, variant?: VariantType) => void`.
- Resolve `const effectiveVariant = variant ?? product.availableVariants[0];`
- Use `const compositeId = `${product.id}-${effectiveVariant || 'standard'}`;`
- Use `const unitPrice = getProductVariantPrice(product, effectiveVariant);` when creating `newItem`.

In `src/components/CartDrawer.tsx`:
- Wrap the variant pill `<span>` in `{item.variant && ( ... )}`.

In `netlify/functions/create-checkout.ts`:
- Compute `unitPrice`:
  ```typescript
  const unitPrice =
    item.variant && typeof product.variantPrices?.[item.variant] === 'number'
      ? product.variantPrices[item.variant]
      : product.price;
  ```
- Format the Stripe line item name:
  ```typescript
  const variantLabel =
    item.variant === 'magnet'
      ? ' (🧲 Refrigerator Magnet)'
      : item.variant === 'keychain'
      ? ' (🔑 Keychain)'
      : '';
  ```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/CartContext.test.tsx tests/CartDrawer.test.tsx tests/stripeService.test.ts`
Expected: PASS

---

### Task 4: Admin `WeebleEditorModal` and `InventoryTab` Per-Variant Price Controls

**Files:**
- Modify: `src/components/admin/WeebleEditorModal.tsx`
- Modify: `src/components/admin/InventoryTab.tsx`
- Test: `tests/InventoryTab.test.tsx`

**Interfaces:**
- Consumes: `formatProductPriceSummary` from `src/utils/productUtils.ts`, `VariantPrices` from `src/types/index.ts`

- [ ] **Step 1: Write failing tests in `tests/InventoryTab.test.tsx`**

Add tests to `tests/InventoryTab.test.tsx`:
- Setting distinct Magnet Price (`14.00`) and Keychain Price (`17.50`) saves `variantPrices: { magnet: 14, keychain: 17.5 }` and displays `🧲 $14.00 / 🔑 $17.50` in `InventoryTab`.
- Unchecking both `🧲 Refrigerator Magnet` and `🔑 Keychain` hides the variant price inputs, shows the single `Price ($ USD)` input, and saves `availableVariants: []` with `variantPrices: {}`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/InventoryTab.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `WeebleEditorModal.tsx` and `InventoryTab.tsx` changes**

In `src/components/admin/WeebleEditorModal.tsx`:
- Track `price` (base price when no variants are checked), `magnetPrice`, and `keychainPrice`.
- Initialize `variants` from `product ? product.availableVariants : ['magnet', 'keychain']` (do not force `['magnet']` when `product.availableVariants` is empty `[]`).
- Render `Magnet Price ($ USD)` (`id="weeble-magnet-price"`) when `variants.includes('magnet')`, `Keychain Price ($ USD)` (`id="weeble-keychain-price"`) when `variants.includes('keychain')`, and `Price ($ USD)` (`id="weeble-price"`) when `variants.length === 0`.
- On submit, build `variantPrices` for the enabled variants, set `availableVariants: variants`, and set `price` to the first enabled variant's price (or parsed `price` when `variants.length === 0`).

In `src/components/admin/InventoryTab.tsx`:
- Render `{formatProductPriceSummary(item)}` in place of `{formatPrice(item.price)}`.

- [ ] **Step 4: Run full test suite and build**

Run: `npx vitest run` and `npm run build`
Expected: All tests PASS and production build succeeds with zero errors.
