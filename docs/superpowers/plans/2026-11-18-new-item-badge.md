# 30-Day "NEW!" Catalog Badge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display a `NEW!` badge in the top-right corner of product cards on the main web store page for 30 days after a new item is added to the catalog.

**Architecture:** Extend `Product` with an optional ISO 8601 `createdAt` field, stamp `createdAt` when adding a new product in `WeebleEditorModal` (and preserve existing values when editing), evaluate the 30-day window via a pure `isNewProduct(product, now)` helper in `productUtils.ts`, and render the `NEW!` pill badge on `ProductCard`.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest, React Testing Library

## Global Constraints

- Badge text must be `NEW!` styled with `bg-weeble-pink text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm` positioned at `absolute top-2.5 right-2.5` inside the product image container in `ProductCard.tsx`.
- The 30-day window is `NEW_PRODUCT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000` milliseconds (`2592000000` ms).
- Legacy catalog products without `createdAt` must not display the `NEW!` badge, and editing an existing product must preserve its original `createdAt` value.

---

### Task 1: `createdAt` Data Model, 30-Day `isNewProduct` Helper, and Admin Creation Timestamping

**Files:**
- Modify: `src/types/index.ts:5-17`
- Modify: `src/utils/productUtils.ts:1-37`
- Modify: `src/components/admin/WeebleEditorModal.tsx:82-105`
- Test: `tests/productUtils.test.ts`
- Test: `tests/InventoryTab.test.tsx`

**Interfaces:**
- Consumes: `Product` from `src/types/index.ts`
- Produces:
  - `Product.createdAt?: string` in `src/types/index.ts`
  - `NEW_PRODUCT_WINDOW_MS: number` and `isNewProduct(product: Product, now?: number): boolean` in `src/utils/productUtils.ts`
  - `WeebleEditorModal` stamps `createdAt` on new products and preserves `product.createdAt` on edited products

- [ ] **Step 1: Write the failing unit tests in `tests/productUtils.test.ts` and `tests/InventoryTab.test.tsx`**

In `tests/productUtils.test.ts`, update the import on line 2 to import `isNewProduct` and `NEW_PRODUCT_WINDOW_MS`, and add a `describe('isNewProduct', ...)` suite at the end of the file:

```typescript
import { filterProducts, formatPrice, isNewProduct, NEW_PRODUCT_WINDOW_MS } from '../src/utils/productUtils';
```

```typescript
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
```

In `tests/InventoryTab.test.tsx`, add tests verifying `createdAt` is stamped when adding a new product and preserved when editing an existing product:

```typescript
  it('stamps a createdAt ISO timestamp when adding a new product and preserves createdAt when editing', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    const existingCreatedAt = '2026-11-01T10:00:00.000Z';
    const productsWithTimestamp: Product[] = [
      { ...mockProducts[0], createdAt: existingCreatedAt },
      mockProducts[1],
    ];

    render(<InventoryTab products={productsWithTimestamp} onSave={handleSave} />);

    // 1. Add a new product -> should stamp createdAt
    fireEvent.click(screen.getByRole('button', { name: /\+ Add New Weeble/i }));
    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Fresh Peach' } });
    fireEvent.change(screen.getByLabelText(/Description/i), { target: { value: 'Juicy peach charm' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Weeble/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    const addedProduct: Product = handleSave.mock.calls[0][0][0];
    expect(addedProduct.createdAt).toBeDefined();
    expect(Number.isNaN(Date.parse(addedProduct.createdAt!))).toBe(false);

    // 2. Edit product with existing createdAt -> should preserve original createdAt
    const editBtns = screen.getAllByRole('button', { name: /Edit/i });
    fireEvent.click(editBtns[0]);
    fireEvent.change(screen.getByDisplayValue('Chubby Bumblebee'), {
      target: { value: 'Updated Bumblebee' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Weeble/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(2);
    });

    const editedWithTimestamp: Product = handleSave.mock.calls[1][0][0];
    expect(editedWithTimestamp.createdAt).toBe(existingCreatedAt);

    // 3. Edit legacy product without createdAt -> should keep createdAt undefined
    fireEvent.click(editBtns[1]);
    fireEvent.change(screen.getByDisplayValue('Berry Sweetie'), {
      target: { value: 'Updated Berry Sweetie' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Weeble/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(3);
    });

    const editedLegacy: Product = handleSave.mock.calls[2][0][1];
    expect(editedLegacy.createdAt).toBeUndefined();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/productUtils.test.ts tests/InventoryTab.test.tsx`
Expected: FAIL (`isNewProduct is not a function` and `expected undefined to be defined` for `addedProduct.createdAt`).

- [ ] **Step 3: Implement `createdAt` in `src/types/index.ts`, `isNewProduct` in `src/utils/productUtils.ts`, and timestamping in `src/components/admin/WeebleEditorModal.tsx`**

In `src/types/index.ts`, add `createdAt?: string;` to `Product`:

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

In `src/utils/productUtils.ts`, add `NEW_PRODUCT_WINDOW_MS` and `isNewProduct`:

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

In `src/components/admin/WeebleEditorModal.tsx`, update `savedProduct` inside `handleSubmit`:

```typescript
    const createdAt = product ? product.createdAt : new Date().toISOString();

    const savedProduct: Product = {
      id,
      name,
      description,
      price: parseFloat(price) || 14.0,
      images: [finalImagePath || '/images/products/placeholder.jpg'],
      category,
      availableVariants: variants.length > 0 ? variants : ['magnet'],
      inStock,
      stockCount: isOneOfAKind ? 1 : Math.max(0, stockCount),
      isOneOfAKind,
      featured,
      ...(createdAt ? { createdAt } : {}),
    };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/productUtils.test.ts tests/InventoryTab.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/utils/productUtils.ts src/components/admin/WeebleEditorModal.tsx tests/productUtils.test.ts tests/InventoryTab.test.tsx
git commit -m "feat(catalog): track product createdAt and add 30-day isNewProduct helper"
```

---

### Task 2: Storefront `NEW!` Badge on `ProductCard`

**Files:**
- Modify: `src/components/ProductCard.tsx:1-65`
- Test: `tests/ProductCard.test.tsx`

**Interfaces:**
- Consumes: `isNewProduct(product: Product): boolean` from `src/utils/productUtils.ts`, `Product.createdAt?: string` from `src/types/index.ts`
- Produces: Top-right `NEW!` badge on `ProductCard` when `isNewProduct(product)` is `true`

- [ ] **Step 1: Write the failing component tests in `tests/ProductCard.test.tsx`**

In `tests/ProductCard.test.tsx`, add tests inside `describe('ProductCard', ...)` verifying the `NEW!` badge renders for products added within the last 30 days and does not render for older products or products without `createdAt`:

```typescript
  it('renders NEW! badge when product was added within the last 30 days', () => {
    const recentProduct: Product = {
      ...mockProduct,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    };

    render(
      <CartProvider>
        <ProductCard product={recentProduct} />
      </CartProvider>
    );

    expect(screen.getByText('NEW!')).toBeInTheDocument();
  });

  it('does not render NEW! badge when product is older than 30 days or has no createdAt', () => {
    const expiredProduct: Product = {
      ...mockProduct,
      createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const { rerender } = render(
      <CartProvider>
        <ProductCard product={expiredProduct} />
      </CartProvider>
    );

    expect(screen.queryByText('NEW!')).not.toBeInTheDocument();

    rerender(
      <CartProvider>
        <ProductCard product={mockProduct} />
      </CartProvider>
    );

    expect(screen.queryByText('NEW!')).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ProductCard.test.tsx`
Expected: FAIL (`Unable to find an element with the text: NEW!`)

- [ ] **Step 3: Render the `NEW!` badge in `src/components/ProductCard.tsx`**

In `src/components/ProductCard.tsx`, update line 4 to import `isNewProduct`:

```typescript
import { formatPrice, isNewProduct } from '../utils/productUtils';
```

Inside the image container (`<div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-weeble-pinkBg mb-3.5">`), right after the Stock Status Badge `div` (line 63), add the `NEW!` badge:

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

- [ ] **Step 4: Run tests to verify all tests pass**

Run: `npx vitest run`
Expected: PASS across entire test suite

- [ ] **Step 5: Commit**

```bash
git add src/components/ProductCard.tsx tests/ProductCard.test.tsx
git commit -m "feat(store): display NEW! badge on catalog items for 30 days"
```
