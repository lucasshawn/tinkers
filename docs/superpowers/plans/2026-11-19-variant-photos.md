# Per-Variant Photos & Storefront Photo Carousel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins to upload, replace, and delete an optional photo per product variant (Magnet / Keychain) alongside the representative base photo, and allow storefront shoppers to flip through all photos on a product card while jumping to a variant's photo when selecting that style.

**Architecture:** Extend `Product` with an optional `variantImages?: Partial<Record<VariantType, string>>` map mirroring `variantPrices`. Extract client-side image reading/compression into `src/utils/imageUtils.ts` and pure gallery/image helpers into `src/utils/productUtils.ts`. Generalize the admin save pipeline (`WeebleEditorModal` -> `InventoryTab` -> `AdminPortal` -> `adminApi` -> `netlify/functions/admin-save.ts`) from single `newImage` to batched `newImages?: UploadedImage[]` (preserving legacy `newImage` support on the backend), render a conditional carousel inside `ProductCard`, and use the variant thumbnail in `CartContext` and Stripe checkout.

**Tech Stack:** React 18, TypeScript 5.7, Vite 6, Tailwind CSS 3, Lucide React icons, Netlify Functions, Vitest 2 + React Testing Library.

## Global Constraints

- One optional photo per variant (`magnet`, `keychain`), stored in `Product.variantImages?: Partial<Record<VariantType, string>>`; `Product.images[0]` remains the representative base photo.
- Backwards-compatible: existing `products.json`, Netlify Blobs, and `localStorage` entries without `variantImages` require no migration; empty/whitespace strings in `variantImages` are treated as absent.
- `netlify/functions/admin-save.ts` must continue accepting legacy single `newImage` payloads alongside `newImages[]`.
- Deleting a variant photo removes its key from `product.variantImages` on save; image files in `public/images/products/` are not deleted.
- On `ProductCard`, products with only 1 photo render zero carousel controls (no arrows, dots, or view pill). Products with > 1 photo start on slide `0` (Base) on initial load, allow cyclic arrow/dot flipping without altering selected style/price, and jump to a variant's slide (or back to `0` if none) when clicking that variant's style button.
- Styling matches the existing pastel Hello Kitty theme (`bg-white`, `bg-weeble-pinkWash`, `border-pink-200`, `text-weeble-pink`, `rounded-full` / `rounded-xl`).
- All git commands run in this environment may require `-c safe.directory=C:/Users/lucas/source/repos/tinkers` if run inside a restricted shell. Only stage files touched by the current task — never stage unrelated modified files (e.g., `tests/AdminsTab.test.tsx`).

---

## File Structure

- **Modify `src/types/index.ts`**: Add `VariantImages`, `UploadedImage`, `ProductImageSlide`, and `Product.variantImages`.
- **Create `src/utils/imageUtils.ts`**: Pure `sanitizeImageFilename` and browser `readAndCompressImage` helper extracted from `WeebleEditorModal`.
- **Modify `src/utils/productUtils.ts`**: Add `getProductVariantImage`, `getProductGallery`, and `countProductVariantPhotos`.
- **Modify `netlify/functions/admin-save.ts`**: Upload an array `newImages[]` (with legacy `newImage` fallback) before saving `products.json` / Blobs.
- **Modify `src/services/adminApi.ts`**: Update `saveInventory` to send `newImages?: UploadedImage[]`.
- **Modify `src/utils/changeLogUtils.ts`**: Track Magnet Photo and Keychain Photo edits in `diffInventoryChanges`.
- **Modify `src/components/admin/AdminPortal.tsx`**: Accept `newImages?: UploadedImage[]` in `handleSaveInventory` and optimistically substitute base64 data URLs for both `images[0]` and `variantImages[v]`.
- **Modify `src/components/admin/WeebleEditorModal.tsx`**: Relabel Base Product Photo, add per-variant Upload / Change / Remove controls inside enabled variant rows, collect `newImages[]` on save.
- **Modify `src/components/admin/InventoryTab.tsx`**: Forward `newImages?: UploadedImage[]` to `onSave` and display a subtle variant photo count indicator in the inventory list.
- **Modify `src/components/ProductCard.tsx`**: Render conditional photo carousel (Prev/Next arrows, bottom-left view pill, bottom-right dot indicators) and jump slide on style click.
- **Modify `src/context/CartContext.tsx`**: Store `getProductVariantImage(product, effectiveVariant)` on `CartItem.image`.
- **Modify `netlify/functions/create-checkout.ts`**: Fall back to `product.variantImages?.[item.variant] || product.images?.[0]` if `item.image` is absent.
- **Create `tests/imageUtils.test.ts`** and **Modify `tests/productUtils.test.ts`, `tests/adminApi.test.ts`, `tests/AdminPortal.test.tsx`, `tests/InventoryTab.test.tsx`, `tests/ProductCard.test.tsx`, `tests/CartContext.test.tsx`**.

---

### Task 1: Types, Image Helper & Product Gallery Utilities

**Files:**
- Modify: `src/types/index.ts:4-23`
- Create: `src/utils/imageUtils.ts`
- Modify: `src/utils/productUtils.ts:1-68`
- Create: `tests/imageUtils.test.ts`
- Modify: `tests/productUtils.test.ts:1-199`

**Interfaces:**
- Consumes: `Product`, `VariantType` from `src/types/index.ts`.
- Produces:
  - `src/types/index.ts`:
    - `export type VariantImages = Partial<Record<VariantType, string>>;`
    - `export interface UploadedImage { filename: string; base64Data: string; }`
    - `export interface ProductImageSlide { src: string; label: string; variant?: VariantType; }`
    - `Product.variantImages?: VariantImages`
  - `src/utils/imageUtils.ts`:
    - `export function sanitizeImageFilename(rawFilename: string, prefix?: string): string`
    - `export function readAndCompressImage(file: File, options: { onImmediate: (img: UploadedImage) => void; onCompressed?: (img: UploadedImage) => void }): void`
  - `src/utils/productUtils.ts`:
    - `export function getProductVariantImage(product: Product, variant?: VariantType): string`
    - `export function getProductGallery(product: Product): ProductImageSlide[]`
    - `export function countProductVariantPhotos(product: Product): number`

- [ ] **Step 1: Write failing tests for `imageUtils` and gallery helpers in `productUtils`**

Create `tests/imageUtils.test.ts`:

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { sanitizeImageFilename, readAndCompressImage } from '../src/utils/imageUtils';

describe('imageUtils', () => {
  const originalFileReader = window.FileReader;

  afterEach(() => {
    window.FileReader = originalFileReader;
  });

  it('sanitizes filenames by removing spaces and disallowed characters', () => {
    expect(sanitizeImageFilename('sweet strawberry #1 (special).png')).toBe(
      'sweetstrawberry1special.png'
    );
  });

  it('prepends sanitized prefix when provided', () => {
    expect(sanitizeImageFilename('IMG 001.jpg', 'weeble-bee-magnet')).toBe(
      'weeble-bee-magnet-IMG001.jpg'
    );
    expect(sanitizeImageFilename('photo.png', 'weeble bee/keychain')).toBe(
      'weeblebeekeychain-photo.png'
    );
  });

  it('reads a file as data URL and invokes onImmediate with sanitized filename', () => {
    const mockResult = 'data:image/png;base64,ZHVtbXk=';
    class MockFileReader {
      onload: (() => void) | null = null;
      result: string | ArrayBuffer | null = null;
      readAsDataURL() {
        this.result = mockResult;
        if (this.onload) this.onload();
      }
    }
    // @ts-expect-error Mocking FileReader
    window.FileReader = MockFileReader;

    const file = new File(['dummy'], 'my bee!.png', { type: 'image/png' });
    let captured: { filename: string; base64Data: string } | null = null;

    readAndCompressImage(file, {
      onImmediate: (img) => {
        captured = img;
      },
    });

    expect(captured).toEqual({
      filename: 'mybee.png',
      base64Data: mockResult,
    });
  });
});
```

In `tests/productUtils.test.ts`, update the import at lines 2–9 to also import `getProductVariantImage`, `getProductGallery`, and `countProductVariantPhotos`, and add a new `describe` block before the closing `});` at line 199:

```typescript
  describe('variant image & gallery helpers', () => {
    const productWithVariantPhotos: Product = {
      ...mockProducts[0],
      images: ['/images/products/bunny-base.jpg'],
      availableVariants: ['magnet', 'keychain'],
      variantImages: {
        magnet: '/images/products/bunny-magnet.jpg',
        keychain: '/images/products/bunny-keychain.jpg',
      },
    };

    it('getProductVariantImage returns variant image when present and falls back to base image', () => {
      expect(getProductVariantImage(productWithVariantPhotos, 'magnet')).toBe(
        '/images/products/bunny-magnet.jpg'
      );
      expect(getProductVariantImage(productWithVariantPhotos, 'keychain')).toBe(
        '/images/products/bunny-keychain.jpg'
      );
      expect(getProductVariantImage(productWithVariantPhotos)).toBe(
        '/images/products/bunny-base.jpg'
      );

      const blankVariantProduct: Product = {
        ...productWithVariantPhotos,
        variantImages: { magnet: '   ' },
      };
      expect(getProductVariantImage(blankVariantProduct, 'magnet')).toBe(
        '/images/products/bunny-base.jpg'
      );
      expect(getProductVariantImage(blankVariantProduct, 'keychain')).toBe(
        '/images/products/bunny-base.jpg'
      );
    });

    it('getProductGallery returns base slide followed by enabled variant slides in availableVariants order', () => {
      expect(getProductGallery(productWithVariantPhotos)).toEqual([
        { src: '/images/products/bunny-base.jpg', label: 'Base' },
        { src: '/images/products/bunny-magnet.jpg', label: 'Magnet', variant: 'magnet' },
        { src: '/images/products/bunny-keychain.jpg', label: 'Keychain', variant: 'keychain' },
      ]);
    });

    it('getProductGallery returns only base slide when no variant photos exist and ignores disabled variants or blank entries', () => {
      expect(getProductGallery(mockProducts[0])).toEqual([
        { src: '/images/products/strawberry-bunny.jpg', label: 'Base' },
      ]);

      const magnetOnlyWithStaleKeychain: Product = {
        ...productWithVariantPhotos,
        availableVariants: ['magnet'],
        variantImages: {
          magnet: '  ',
          keychain: '/images/products/bunny-keychain.jpg',
        },
      };
      expect(getProductGallery(magnetOnlyWithStaleKeychain)).toEqual([
        { src: '/images/products/bunny-base.jpg', label: 'Base' },
      ]);
    });

    it('countProductVariantPhotos counts only enabled variants with non-empty photos', () => {
      expect(countProductVariantPhotos(mockProducts[0])).toBe(0);
      expect(countProductVariantPhotos(productWithVariantPhotos)).toBe(2);
      expect(
        countProductVariantPhotos({
          ...productWithVariantPhotos,
          availableVariants: ['magnet'],
        })
      ).toBe(1);
    });
  });
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx vitest run tests/imageUtils.test.ts tests/productUtils.test.ts`
Expected: FAIL — module `../src/utils/imageUtils` not found and exports `getProductVariantImage`, `getProductGallery`, `countProductVariantPhotos` undefined.

- [ ] **Step 3: Implement types, `src/utils/imageUtils.ts`, and `src/utils/productUtils.ts` helpers**

Update `src/types/index.ts` lines 4–23:

```typescript
export type VariantType = 'magnet' | 'keychain';

export type VariantPrices = Partial<Record<VariantType, number>>;

export type VariantImages = Partial<Record<VariantType, string>>;

export interface UploadedImage {
  filename: string;
  base64Data: string;
}

export interface ProductImageSlide {
  src: string;
  label: string;
  variant?: VariantType;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  variantPrices?: VariantPrices;
  images: string[];
  variantImages?: VariantImages;
  category: 'animals' | 'sweets' | 'fantasy' | 'mini-friends';
  availableVariants: VariantType[];
  inStock: boolean;
  stockCount: number;
  featured?: boolean;
  isOneOfAKind?: boolean;
  createdAt?: string;
}
```

Create `src/utils/imageUtils.ts`:

```typescript
import { UploadedImage } from '../types';

export function sanitizeImageFilename(rawFilename: string, prefix?: string): string {
  const baseName = rawFilename.split(/[/\\]/).pop() || rawFilename;
  const cleanName = baseName.replace(/[^a-zA-Z0-9._-]/g, '');
  if (!prefix) return cleanName;
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9._-]/g, '');
  return cleanPrefix ? `${cleanPrefix}-${cleanName}` : cleanName;
}

export interface ReadAndCompressOptions {
  onImmediate: (img: UploadedImage) => void;
  onCompressed?: (img: UploadedImage) => void;
}

export function readAndCompressImage(file: File, options: ReadAndCompressOptions): void {
  const cleanFilename = sanitizeImageFilename(file.name);
  const reader = new FileReader();
  reader.onload = () => {
    const base64 = reader.result as string;
    const immediateImg: UploadedImage = { filename: cleanFilename, base64Data: base64 };
    options.onImmediate(immediateImg);

    // Compress large photos (> 200KB) via canvas to stay well under serverless and localStorage limits.
    if (base64.length > 200_000 && typeof Image !== 'undefined' && typeof document !== 'undefined') {
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 800;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.82);
            if (compressed && compressed.startsWith('data:image/')) {
              const compressedImg: UploadedImage = {
                filename: cleanFilename,
                base64Data: compressed,
              };
              (options.onCompressed || options.onImmediate)(compressedImg);
            }
          }
        } catch {
          // Keep original base64 if canvas compression is unavailable
        }
      };
      img.src = base64;
    }
  };
  reader.readAsDataURL(file);
}
```

In `src/utils/productUtils.ts`, update line 1 to import `ProductImageSlide`:

```typescript
import { Product, ProductImageSlide, VariantType } from '../types';
```

And add these functions right after `formatProductPriceSummary` (after line 67):

```typescript
export function getProductVariantImage(product: Product, variant?: VariantType): string {
  if (variant) {
    const variantImg = product.variantImages?.[variant]?.trim();
    if (variantImg) return variantImg;
  }
  return product.images?.[0] || '';
}

export function getProductGallery(product: Product): ProductImageSlide[] {
  const slides: ProductImageSlide[] = [];
  const baseImage = product.images?.[0]?.trim();
  if (baseImage) {
    slides.push({ src: baseImage, label: 'Base' });
  }
  for (const variant of product.availableVariants || []) {
    const variantImg = product.variantImages?.[variant]?.trim();
    if (variantImg) {
      slides.push({
        src: variantImg,
        label: variant === 'magnet' ? 'Magnet' : 'Keychain',
        variant,
      });
    }
  }
  return slides;
}

export function countProductVariantPhotos(product: Product): number {
  let count = 0;
  for (const variant of product.availableVariants || []) {
    if (product.variantImages?.[variant]?.trim()) {
      count += 1;
    }
  }
  return count;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/imageUtils.test.ts tests/productUtils.test.ts`
Expected: PASS (all tests in both files pass).

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/utils/imageUtils.ts src/utils/productUtils.ts tests/imageUtils.test.ts tests/productUtils.test.ts
git commit -m "feat(catalog): add variantImages types, imageUtils helper, and gallery utilities"
```

---

### Task 2: Multi-Image Persistence Pipeline (`admin-save`, `adminApi`, `AdminPortal`, `changeLogUtils`)

**Files:**
- Modify: `netlify/functions/admin-save.ts:312-336`
- Modify: `src/services/adminApi.ts:1-52`
- Modify: `src/utils/changeLogUtils.ts:179-186`
- Modify: `src/components/admin/AdminPortal.tsx:14,87-120`
- Modify: `tests/adminApi.test.ts:290-306,627-665`
- Modify: `tests/AdminPortal.test.tsx:145-173`

**Interfaces:**
- Consumes: `UploadedImage`, `Product`, `VariantType` from `src/types/index.ts`.
- Produces:
  - `adminApi.saveInventory(products: Product[], newImages?: UploadedImage[]): Promise<{ success: boolean; message: string }>`
  - `AdminPortal.handleSaveInventory(updated: Product[], newImages?: UploadedImage[]): Promise<void>`
  - `netlify/functions/admin-save.ts` accepts `{ type: 'inventory', products, newImages?: UploadedImage[], newImage?: UploadedImage }`

- [ ] **Step 1: Write failing tests for multi-image uploads in `tests/adminApi.test.ts` and `tests/AdminPortal.test.tsx`**

In `tests/adminApi.test.ts`, add a test right after `'commits inventory and uploaded image to GitHub when GITHUB_TOKEN is set'` (after line 305):

```typescript
  it('commits multiple uploaded images from newImages array to GitHub and in dev mode', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);

    const devEvent = {
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${validToken}` },
      body: JSON.stringify({
        type: 'inventory',
        products: [],
        newImages: [
          { filename: 'base.png', base64Data: 'data:image/png;base64,YmFzZQ==' },
          { filename: 'p1-magnet-m.png', base64Data: 'data:image/png;base64,bWFnbmV0' },
          { filename: 'p1-keychain-k.png', base64Data: 'data:image/png;base64,a2V5Y2hhaW4=' },
        ],
      }),
    };

    const devRes = (await handler(devEvent as any, {} as any)) as any;
    expect(devRes.statusCode).toBe(200);
    expect(fs.writeFileSync).toHaveBeenCalledWith(expect.stringContaining('base.png'), expect.any(Buffer));
    expect(fs.writeFileSync).toHaveBeenCalledWith(expect.stringContaining('p1-magnet-m.png'), expect.any(Buffer));
    expect(fs.writeFileSync).toHaveBeenCalledWith(expect.stringContaining('p1-keychain-k.png'), expect.any(Buffer));

    // Also verify GitHub commits for multiple images
    process.env.GITHUB_TOKEN = 'ghp_test_token_123';
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) }) // GET img 1
      .mockResolvedValueOnce({ ok: true, json: async () => ({ commit: { sha: 'img1-sha' } }) }) // PUT img 1
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) }) // GET img 2
      .mockResolvedValueOnce({ ok: true, json: async () => ({ commit: { sha: 'img2-sha' } }) }) // PUT img 2
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sha: 'products-sha' }) }) // GET products.json
      .mockResolvedValueOnce({ ok: true, json: async () => ({ commit: { sha: 'new-products-sha' } }) }); // PUT products.json
    globalThis.fetch = mockFetch;

    const ghEvent = {
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${validToken}` },
      body: JSON.stringify({
        type: 'inventory',
        products: [],
        newImages: [
          { filename: 'p1-magnet-m.jpg', base64Data: 'data:image/jpeg;base64,bWFnbmV0' },
          { filename: 'p1-keychain-k.jpg', base64Data: 'data:image/jpeg;base64,a2V5Y2hhaW4=' },
        ],
      }),
    };

    const ghRes = (await handler(ghEvent as any, {} as any)) as any;
    expect(ghRes.statusCode).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(6);
  });
```

And in `tests/adminApi.test.ts` lines 639–663, update the `adminApi.saveInventory` test to pass a `newImages` array and assert `newImages` in the JSON body:

```typescript
    const result = await adminApi.saveInventory(mockProducts, [
      {
        filename: 'cat-new.jpg',
        base64Data: 'data:image/jpeg;base64,1234',
      },
      {
        filename: 'cat-1-magnet-m.jpg',
        base64Data: 'data:image/jpeg;base64,5678',
      },
    ]);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Saved successfully');
    expect(mockFetch).toHaveBeenCalledWith(
      '/.netlify/functions/admin-save',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer client-test-token',
        },
        body: JSON.stringify({
          type: 'inventory',
          products: mockProducts,
          newImages: [
            {
              filename: 'cat-new.jpg',
              base64Data: 'data:image/jpeg;base64,1234',
            },
            {
              filename: 'cat-1-magnet-m.jpg',
              base64Data: 'data:image/jpeg;base64,5678',
            },
          ],
        }),
      })
    );
```

- [ ] **Step 2: Run `tests/adminApi.test.ts` to verify the new tests fail**

Run: `npx vitest run tests/adminApi.test.ts`
Expected: FAIL — `admin-save` ignores `newImages` and `adminApi.saveInventory` sends `newImage` instead of `newImages`.

- [ ] **Step 3: Implement multi-image handling in `netlify/functions/admin-save.ts`, `src/services/adminApi.ts`, `src/utils/changeLogUtils.ts`, and `src/components/admin/AdminPortal.tsx`**

In `netlify/functions/admin-save.ts` lines 312–336, replace single `newImage` handling with:

```typescript
    const { type, products, settings, admins, newImage, newImages, changes } = JSON.parse(rawBody);
    const githubToken = process.env.GITHUB_TOKEN || '';

    // 1. Handle image upload(s) if present (supports newImages[] and legacy single newImage)
    const imagesToUpload: Array<{ filename: string; base64Data: string }> = Array.isArray(newImages)
      ? newImages
      : newImage
      ? [newImage]
      : [];

    for (const img of imagesToUpload) {
      if (!img || !img.filename || !img.base64Data) continue;
      const cleanFilename = path.basename(img.filename).replace(/[^a-zA-Z0-9._-]/g, '');
      const imagePath = `public/images/products/${cleanFilename}`;
      const rawBase64 = img.base64Data.replace(/^data:image\/[\w+.-]+;base64,/, '');

      if (githubToken) {
        await commitToGitHub(imagePath, rawBase64, `chore(admin): upload product image ${cleanFilename}`);
      } else {
        const localDir = path.resolve(process.cwd(), 'public/images/products');
        try {
          if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
          fs.writeFileSync(path.join(localDir, cleanFilename), Buffer.from(rawBase64, 'base64'));
        } catch {
          try {
            const tmpImgPath = path.join(os.tmpdir(), `weebles-img-${cleanFilename}`);
            fs.writeFileSync(tmpImgPath, Buffer.from(rawBase64, 'base64'));
          } catch {}
        }
      }
    }
```

In `src/services/adminApi.ts`, import `UploadedImage` on line 1 and update `saveInventory` (lines 23–41):

```typescript
import { Product, ChangeLogEntry, UploadedImage } from '../types';
```

```typescript
  async saveInventory(
    products: Product[],
    newImages?: UploadedImage[]
  ): Promise<{ success: boolean; message: string }> {
    const session = adminAuth.getSession();
    if (!session) throw new Error('Not authenticated');

    const payload: Record<string, unknown> = {
      type: 'inventory',
      products,
    };
    if (newImages && newImages.length > 0) {
      payload.newImages = newImages;
    }

    const res = await fetch('/.netlify/functions/admin-save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify(payload),
    });
```

In `src/utils/changeLogUtils.ts`, right after the `Product Photo` comparison (line 183), add Magnet Photo and Keychain Photo comparisons:

```typescript
      {
        label: 'Product Photo',
        oldVal: summarizeImage(oldP.images?.[0]),
        newVal: summarizeImage(newP.images?.[0]),
      },
      {
        label: 'Magnet Photo',
        oldVal: summarizeImage(oldP.variantImages?.magnet),
        newVal: summarizeImage(newP.variantImages?.magnet),
      },
      {
        label: 'Keychain Photo',
        oldVal: summarizeImage(oldP.variantImages?.keychain),
        newVal: summarizeImage(newP.variantImages?.keychain),
      },
```

In `src/components/admin/AdminPortal.tsx`, import `UploadedImage` and `VariantImages` on line 14:

```typescript
import { Product, ChangeLogEntry, UploadedImage, VariantImages, VariantType } from '../../types';
```

And update `handleSaveInventory` (lines 87–120):

```typescript
  const handleSaveInventory = async (
    updated: Product[],
    newImages?: UploadedImage[]
  ) => {
    setErrorMessage(null);
    const previousProducts = products;
    const diffEntries = diffInventoryChanges(session.email, previousProducts, updated);

    // If new images were uploaded, embed their data URLs into the local catalog so they render immediately
    // even before a static site rebuild finishes.
    const imageMap = new Map<string, string>();
    if (newImages && newImages.length > 0) {
      for (const img of newImages) {
        if (img.filename && img.base64Data) {
          imageMap.set(`/images/products/${img.filename}`, img.base64Data);
        }
      }
    }

    const localUpdated =
      imageMap.size > 0
        ? updated.map((p) => {
            const nextBase = imageMap.get(p.images[0]) ?? p.images[0];
            let nextVariantImages = p.variantImages;
            if (p.variantImages) {
              const mapped: VariantImages = {};
              for (const key of Object.keys(p.variantImages) as VariantType[]) {
                const val = p.variantImages[key];
                if (val) {
                  mapped[key] = imageMap.get(val) ?? val;
                }
              }
              nextVariantImages = mapped;
            }
            return {
              ...p,
              images: [nextBase, ...p.images.slice(1)],
              ...(nextVariantImages ? { variantImages: nextVariantImages } : {}),
            };
          })
        : updated;

    // Optimistically update catalog and localStorage immediately so new/edited items appear right away
    setProducts(localUpdated);
    saveStoredProducts(localUpdated);

    try {
      const res = await adminApi.saveInventory(updated, newImages);
      recordChanges(diffEntries);
      setNotification(res.message);
      setTimeout(() => setNotification(null), 5000);
    } catch (err: any) {
      const errMsg = err.message || 'Failed to save inventory';
      setErrorMessage(errMsg);
      recordError('Save Inventory', describeInventoryAttempt(previousProducts, updated), err);
    }
  };
```

Note: `InventoryTabProps.onSave` will be updated to `newImages?: UploadedImage[]` in Task 3 (immediately after this task).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/adminApi.test.ts tests/AdminPortal.test.tsx`
Expected: PASS (all tests pass).

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/admin-save.ts src/services/adminApi.ts src/utils/changeLogUtils.ts src/components/admin/AdminPortal.tsx tests/adminApi.test.ts
git commit -m "feat(admin): support multi-image uploads across admin-save, adminApi, and AdminPortal"
```

---

### Task 3: Admin Variant Photo Upload / Edit / Delete UI (`WeebleEditorModal` & `InventoryTab`)

**Files:**
- Modify: `src/components/admin/WeebleEditorModal.tsx:1-450`
- Modify: `src/components/admin/InventoryTab.tsx:1-162`
- Modify: `tests/InventoryTab.test.tsx:241-328,454`
- Modify: `tests/AdminPortal.test.tsx:325`

**Interfaces:**
- Consumes:
  - `UploadedImage`, `VariantImages`, `VariantType`, `Product` from `src/types/index.ts`
  - `readAndCompressImage`, `sanitizeImageFilename` from `src/utils/imageUtils.ts`
  - `countProductVariantPhotos` from `src/utils/productUtils.ts`
- Produces:
  - `WeebleEditorModalProps.onSave: (product: Product, newImages?: UploadedImage[]) => void`
  - `InventoryTabProps.onSave: (updated: Product[], newImages?: UploadedImage[]) => Promise<void>`

- [ ] **Step 1: Write failing tests in `tests/InventoryTab.test.tsx` and `tests/AdminPortal.test.tsx`**

In `tests/InventoryTab.test.tsx`, first update the two existing image upload tests (lines 279–284 and lines 322–325) so they expect the `newImages` array (`[ { filename, base64Data } ]`):

```typescript
    const [savedProducts, newImages] = handleSave.mock.calls[0];
    expect(newImages).toEqual([
      {
        filename: 'rainbow.png',
        base64Data: mockResult,
      },
    ]);
    expect(savedProducts[0].images[0]).toBe('/images/products/rainbow.png');
```

and for the sanitization test:

```typescript
    const [savedProducts, newImages] = handleSave.mock.calls[0];
    expect(newImages).toEqual([
      {
        filename: 'sweetstrawberry1special.png',
        base64Data: mockResult,
      },
    ]);
    expect(savedProducts[0].images[0]).toBe('/images/products/sweetstrawberry1special.png');
```

Then add these new tests before the closing `});` of `describe('InventoryTab', ...)` in `tests/InventoryTab.test.tsx`:

```typescript
  it('uploads magnet and keychain variant photos alongside base photo and passes all in newImages', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(<InventoryTab products={mockProducts} onSave={handleSave} />);

    const editBtns = screen.getAllByRole('button', { name: /Edit/i });
    fireEvent.click(editBtns[0]); // Edit weeble-bee (magnet & keychain)

    const originalFileReader = window.FileReader;
    let callCount = 0;
    const mockResults = [
      'data:image/png;base64,bWFnbmV0',
      'data:image/png;base64,a2V5Y2hhaW4=',
    ];
    class MockFileReader {
      onload: (() => void) | null = null;
      result: string | ArrayBuffer | null = null;
      readAsDataURL() {
        this.result = mockResults[callCount++] || mockResults[0];
        if (this.onload) this.onload();
      }
    }
    // @ts-expect-error Mocking FileReader
    window.FileReader = MockFileReader;

    const magnetInput = screen.getByLabelText(/Upload Magnet photo/i);
    fireEvent.change(magnetInput, {
      target: { files: [new File(['m'], 'photo.png', { type: 'image/png' })] },
    });

    const keychainInput = screen.getByLabelText(/Upload Keychain photo/i);
    fireEvent.change(keychainInput, {
      target: { files: [new File(['k'], 'photo.png', { type: 'image/png' })] },
    });

    expect(screen.getByAltText('Magnet preview')).toHaveAttribute('src', mockResults[0]);
    expect(screen.getByAltText('Keychain preview')).toHaveAttribute('src', mockResults[1]);

    fireEvent.click(screen.getByRole('button', { name: /Save Weeble/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    const [savedProducts, newImages] = handleSave.mock.calls[0];
    const updatedBee: Product = savedProducts[0];
    expect(updatedBee.variantImages).toEqual({
      magnet: '/images/products/weeble-bee-magnet-photo.png',
      keychain: '/images/products/weeble-bee-keychain-photo.png',
    });
    expect(newImages).toEqual([
      { filename: 'weeble-bee-magnet-photo.png', base64Data: mockResults[0] },
      { filename: 'weeble-bee-keychain-photo.png', base64Data: mockResults[1] },
    ]);

    window.FileReader = originalFileReader;
  });

  it('allows replacing (editing) and removing (deleting) existing variant photos', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    const productsWithVariantPhotos: Product[] = [
      {
        ...mockProducts[0],
        variantImages: {
          magnet: '/images/products/bee-magnet-old.jpg',
          keychain: '/images/products/bee-keychain-old.jpg',
        },
      },
    ];

    render(<InventoryTab products={productsWithVariantPhotos} onSave={handleSave} />);

    // Inventory list displays variant photo count indicator
    expect(screen.getByText(/📷 \+2 photos/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Edit/i }));

    expect(screen.getByAltText('Magnet preview')).toHaveAttribute(
      'src',
      '/images/products/bee-magnet-old.jpg'
    );
    expect(screen.getByAltText('Keychain preview')).toHaveAttribute(
      'src',
      '/images/products/bee-keychain-old.jpg'
    );

    // Replace magnet photo
    const originalFileReader = window.FileReader;
    const replacementDataUrl = 'data:image/jpeg;base64,bmV3bWFnbmV0';
    class MockFileReader {
      onload: (() => void) | null = null;
      result: string | ArrayBuffer | null = null;
      readAsDataURL() {
        this.result = replacementDataUrl;
        if (this.onload) this.onload();
      }
    }
    // @ts-expect-error Mocking FileReader
    window.FileReader = MockFileReader;

    fireEvent.change(screen.getByLabelText(/Change Magnet photo/i), {
      target: { files: [new File(['new'], 'fresh.jpg', { type: 'image/jpeg' })] },
    });
    expect(screen.getByAltText('Magnet preview')).toHaveAttribute('src', replacementDataUrl);

    // Remove keychain photo
    fireEvent.click(screen.getByRole('button', { name: /Remove Keychain photo/i }));
    expect(screen.queryByAltText('Keychain preview')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Save Weeble/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    const [savedProducts, newImages] = handleSave.mock.calls[0];
    expect(savedProducts[0].variantImages).toEqual({
      magnet: '/images/products/weeble-bee-magnet-fresh.jpg',
    });
    expect(newImages).toEqual([
      { filename: 'weeble-bee-magnet-fresh.jpg', base64Data: replacementDataUrl },
    ]);

    window.FileReader = originalFileReader;
  });

  it('omits variantImages for unchecked variants on save', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    const productsWithVariantPhotos: Product[] = [
      {
        ...mockProducts[0],
        variantImages: {
          magnet: '/images/products/bee-magnet.jpg',
          keychain: '/images/products/bee-keychain.jpg',
        },
      },
    ];

    render(<InventoryTab products={productsWithVariantPhotos} onSave={handleSave} />);
    fireEvent.click(screen.getByRole('button', { name: /Edit/i }));

    // Uncheck keychain
    fireEvent.click(screen.getByRole('checkbox', { name: /Keychain/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save Weeble/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    const savedProduct: Product = handleSave.mock.calls[0][0][0];
    expect(savedProduct.variantImages).toEqual({
      magnet: '/images/products/bee-magnet.jpg',
    });
  });
```

And in `tests/AdminPortal.test.tsx`, add a test verifying optimistic local base64 preview substitution for uploaded variant photos before the closing `});`:

```typescript
  it('optimistically embeds uploaded variant photo base64 preview into localStorage while sending canonical path to adminApi', async () => {
    adminAuth.setSession({ token: 'valid-token', email: 'lucasshawn@gmail.com', name: 'Shawn' });
    const saveInventorySpy = vi.spyOn(adminApi, 'saveInventory').mockResolvedValue({
      success: true,
      message: 'Inventory saved!',
    });
    vi.spyOn(adminApi, 'saveChanges').mockResolvedValue({
      success: true,
      message: 'Changes saved.',
    });

    const originalFileReader = window.FileReader;
    const mockDataUrl = 'data:image/png;base64,dmFyaWFudHBob3Rv';
    class MockFileReader {
      onload: (() => void) | null = null;
      result: string | ArrayBuffer | null = null;
      readAsDataURL() {
        this.result = mockDataUrl;
        if (this.onload) this.onload();
      }
    }
    // @ts-expect-error Mocking FileReader
    window.FileReader = MockFileReader;

    render(
      <SettingsProvider>
        <AdminPortal />
      </SettingsProvider>
    );

    const editBtns = screen.getAllByRole('button', { name: /Edit/i });
    fireEvent.click(editBtns[0]); // Chubby Bumblebee (weeble-bumblebee)

    fireEvent.change(screen.getByLabelText(/Upload Magnet photo/i), {
      target: { files: [new File(['m'], 'mag.png', { type: 'image/png' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Weeble/i }));

    await waitFor(() => {
      expect(saveInventorySpy).toHaveBeenCalledTimes(1);
    });

    const [apiProducts, apiNewImages] = saveInventorySpy.mock.calls[0];
    expect(apiProducts[0].variantImages?.magnet).toBe(
      '/images/products/weeble-bumblebee-magnet-mag.png'
    );
    expect(apiNewImages).toEqual([
      { filename: 'weeble-bumblebee-magnet-mag.png', base64Data: mockDataUrl },
    ]);

    const stored = JSON.parse(localStorage.getItem('weebles_products_v1') || '[]');
    expect(stored[0].variantImages?.magnet).toBe(mockDataUrl);

    window.FileReader = originalFileReader;
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/InventoryTab.test.tsx tests/AdminPortal.test.tsx`
Expected: FAIL — `Upload Magnet photo`, `Change Magnet photo`, `Remove Keychain photo`, and `📷 +2 photos` elements do not exist yet.

- [ ] **Step 3: Implement `WeebleEditorModal.tsx` and `InventoryTab.tsx`**

Update `src/components/admin/WeebleEditorModal.tsx`:
- Import `Camera`, `Trash2`, `X` from `lucide-react`.
- Import `Product`, `UploadedImage`, `VariantImages`, `VariantType` from `../../types`.
- Import `readAndCompressImage`, `sanitizeImageFilename` from `../../utils/imageUtils`.
- Update `WeebleEditorModalProps.onSave` to `(product: Product, newImages?: UploadedImage[]) => void`.
- Add state:
  - `uploadedImage`: `UploadedImage | null`
  - `variantImageUrls`: `VariantImages` initialized from `product?.variantImages ? { ...product.variantImages } : {}`
  - `uploadedVariantImages`: `Partial<Record<VariantType, UploadedImage>>` initialized to `{}`
  - Sync all three inside the `useEffect([product, isOpen])`.
- Replace `handleFileChange` with `readAndCompressImage` (and clear `e.target.value = ''`):

```typescript
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    readAndCompressImage(file, {
      onImmediate: (img) => {
        setUploadedImage(img);
        setImageUrl(img.base64Data);
      },
    });
  };

  const handleVariantFileChange = (variant: VariantType, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    readAndCompressImage(file, {
      onImmediate: (img) => {
        setUploadedVariantImages((prev) => ({ ...prev, [variant]: img }));
        setVariantImageUrls((prev) => ({ ...prev, [variant]: img.base64Data }));
      },
    });
  };

  const handleRemoveVariantPhoto = (variant: VariantType) => {
    setVariantImageUrls((prev) => {
      const next = { ...prev };
      delete next[variant];
      return next;
    });
    setUploadedVariantImages((prev) => {
      const next = { ...prev };
      delete next[variant];
      return next;
    });
  };
```

- Update `handleSubmit`:

```typescript
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id =
      product?.id ||
      `weeble-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString().slice(-4)}`;
    const finalImagePath = uploadedImage ? `/images/products/${uploadedImage.filename}` : imageUrl;

    const parsedStock = Math.max(0, parseInt(String(stockCount), 10) || 0);
    const finalInStock = inStock && parsedStock > 0;
    const finalStockCount = finalInStock ? parsedStock : 0;
    const finalIsOneOfAKind = finalStockCount > 1 ? false : isOneOfAKind;

    const variantPrices: VariantPrices = {};
    if (variants.includes('magnet')) {
      variantPrices.magnet = parseFloat(magnetPrice) || 14.0;
    }
    if (variants.includes('keychain')) {
      variantPrices.keychain = parseFloat(keychainPrice) || 14.0;
    }

    const firstEnabledVariant = variants[0];
    const resolvedBasePrice = firstEnabledVariant
      ? variantPrices[firstEnabledVariant]!
      : parseFloat(price) || 14.0;

    const newImages: UploadedImage[] = [];
    if (uploadedImage) {
      newImages.push({
        filename: uploadedImage.filename,
        base64Data: uploadedImage.base64Data,
      });
    }

    const finalVariantImages: VariantImages = {};
    for (const v of variants) {
      const pending = uploadedVariantImages[v];
      if (pending) {
        const variantFilename = sanitizeImageFilename(pending.filename, `${id}-${v}`);
        finalVariantImages[v] = `/images/products/${variantFilename}`;
        newImages.push({
          filename: variantFilename,
          base64Data: pending.base64Data,
        });
      } else {
        const existingUrl = variantImageUrls[v]?.trim();
        if (existingUrl) {
          finalVariantImages[v] = existingUrl;
        }
      }
    }

    const savedProduct: Product = {
      id,
      name,
      description,
      price: resolvedBasePrice,
      variantPrices,
      images: [finalImagePath || '/images/products/placeholder.jpg'],
      ...(Object.keys(finalVariantImages).length > 0
        ? { variantImages: finalVariantImages }
        : {}),
      category,
      availableVariants: variants,
      inStock: finalInStock,
      stockCount: finalStockCount,
      isOneOfAKind: finalIsOneOfAKind,
      featured,
      ...(product
        ? product.createdAt
          ? { createdAt: product.createdAt }
          : {}
        : { createdAt: new Date().toISOString() }),
    };

    onSave(savedProduct, newImages.length > 0 ? newImages : undefined);
    onClose();
  };
```

- Add `max-h-[90vh] overflow-y-auto` to the dialog `<div>` (line 224).
- Inside the **Available Styles & Pricing** section, render a helper function `renderVariantPhotoRow(variant: VariantType, displayLabel: string)` directly below the Magnet price row (when `variants.includes('magnet')`) and below the Keychain price row (when `variants.includes('keychain')`):

```tsx
  const renderVariantPhotoRow = (variant: VariantType, displayLabel: string) => {
    const previewUrl = variantImageUrls[variant];
    const inputId = `weeble-${variant}-photo`;

    return (
      <div className="mt-2 pt-2 border-t border-pink-200/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={`${displayLabel} preview`}
              className="w-12 h-12 rounded-xl object-cover border border-pink-200 bg-weeble-pinkBg shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl border border-dashed border-pink-300 bg-white/70 flex items-center justify-center text-pink-300 shrink-0">
              <Camera className="w-4 h-4" />
            </div>
          )}
          <div className="text-[11px] text-weeble-textMuted truncate">
            {previewUrl ? (
              <span className="font-bold text-weeble-text">{displayLabel} photo set</span>
            ) : (
              <span>Using base photo</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <label
            htmlFor={inputId}
            className="text-[11px] font-bold px-3 py-1 rounded-full bg-white hover:bg-pink-50 text-weeble-pink border border-pink-200 cursor-pointer transition-colors"
          >
            {previewUrl ? 'Change' : 'Upload Photo'}
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/*"
            aria-label={previewUrl ? `Change ${displayLabel} photo` : `Upload ${displayLabel} photo`}
            onChange={(e) => handleVariantFileChange(variant, e)}
            className="sr-only"
          />
          {previewUrl && (
            <button
              type="button"
              onClick={() => handleRemoveVariantPhoto(variant)}
              aria-label={`Remove ${displayLabel} photo`}
              className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-500 border border-rose-200 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              <span>Remove</span>
            </button>
          )}
        </div>
      </div>
    );
  };
```

- Relabel the base image section from `Product Photo` to `Base Product Photo` (note: regex `/Product Photo/i` in existing tests still matches `Base Product Photo`!).

Update `src/components/admin/InventoryTab.tsx`:
- Import `UploadedImage` from `../../types` and `countProductVariantPhotos` from `../../utils/productUtils`.
- Update `InventoryTabProps.onSave` and `handleSaveModal` to accept `newImages?: UploadedImage[]`.
- Inside the metadata row (lines 122–128):

```tsx
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-weeble-textMuted">
                    <span className="font-bold text-weeble-pink">{formatProductPriceSummary(item)}</span>
                    <span>•</span>
                    <span className="capitalize">{item.category}</span>
                    <span>•</span>
                    <span>Stock: {item.stockCount}</span>
                    {countProductVariantPhotos(item) > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-weeble-text font-semibold">
                          📷 +{countProductVariantPhotos(item)}{' '}
                          {countProductVariantPhotos(item) === 1 ? 'photo' : 'photos'}
                        </span>
                      </>
                    )}
                  </div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/InventoryTab.test.tsx tests/AdminPortal.test.tsx`
Expected: PASS (all tests in both suites pass).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/WeebleEditorModal.tsx src/components/admin/InventoryTab.tsx tests/InventoryTab.test.tsx tests/AdminPortal.test.tsx
git commit -m "feat(admin): add upload, replace, and remove variant photo controls in WeebleEditorModal"
```

---

### Task 4: Storefront Photo Carousel & Style-Click Sync (`ProductCard`)

**Files:**
- Modify: `src/components/ProductCard.tsx:1-158`
- Modify: `tests/ProductCard.test.tsx:245-268`

**Interfaces:**
- Consumes: `getProductGallery`, `formatPrice`, `getProductVariantPrice`, `isNewProduct` from `src/utils/productUtils.ts`.
- Produces: `ProductCard` with conditional multi-photo carousel and variant-click slide sync.

- [ ] **Step 1: Write failing tests in `tests/ProductCard.test.tsx`**

Before the closing `});` of `describe('ProductCard', ...)` (line 267), add:

```typescript
  describe('variant photo carousel', () => {
    const galleryProduct: Product = {
      ...mockProduct,
      images: ['/bunny-base.jpg'],
      availableVariants: ['magnet', 'keychain'],
      variantPrices: {
        magnet: 14.0,
        keychain: 16.5,
      },
      variantImages: {
        magnet: '/bunny-magnet.jpg',
        keychain: '/bunny-keychain.jpg',
      },
    };

    it('renders no carousel controls when product only has a base photo', () => {
      render(
        <CartProvider>
          <ProductCard product={mockProduct} />
        </CartProvider>
      );

      expect(screen.getByAltText('Strawberry Bunny')).toHaveAttribute('src', '/strawberry-bunny.jpg');
      expect(screen.queryByRole('button', { name: /Previous photo/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Next photo/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /View Base photo/i })).not.toBeInTheDocument();
    });

    it('starts on the base photo on initial load and cycles through all photos with arrows and dots without changing selected style or price', () => {
      render(
        <CartProvider>
          <ProductCard product={galleryProduct} />
        </CartProvider>
      );

      // Initial state: Base photo shown, Magnet selected ($14.00)
      expect(screen.getByAltText('Strawberry Bunny - Base')).toHaveAttribute('src', '/bunny-base.jpg');
      expect(screen.getByText('$14.00')).toBeInTheDocument();

      // Next -> Magnet photo
      fireEvent.click(screen.getByRole('button', { name: /Next photo/i }));
      expect(screen.getByAltText('Strawberry Bunny - Magnet')).toHaveAttribute(
        'src',
        '/bunny-magnet.jpg'
      );

      // Next -> Keychain photo (selected style stays Magnet at $14.00)
      fireEvent.click(screen.getByRole('button', { name: /Next photo/i }));
      expect(screen.getByAltText('Strawberry Bunny - Keychain')).toHaveAttribute(
        'src',
        '/bunny-keychain.jpg'
      );
      expect(screen.getByText('$14.00')).toBeInTheDocument();

      // Next wraps around to Base
      fireEvent.click(screen.getByRole('button', { name: /Next photo/i }));
      expect(screen.getByAltText('Strawberry Bunny - Base')).toHaveAttribute('src', '/bunny-base.jpg');

      // Previous wraps around to Keychain
      fireEvent.click(screen.getByRole('button', { name: /Previous photo/i }));
      expect(screen.getByAltText('Strawberry Bunny - Keychain')).toHaveAttribute(
        'src',
        '/bunny-keychain.jpg'
      );

      // Clicking Base dot jumps directly to Base
      fireEvent.click(screen.getByRole('button', { name: /View Base photo/i }));
      expect(screen.getByAltText('Strawberry Bunny - Base')).toHaveAttribute('src', '/bunny-base.jpg');
    });

    it('jumps to the clicked style variant photo, or back to base if that variant has no custom photo', () => {
      const keychainOnlyPhotoProduct: Product = {
        ...galleryProduct,
        variantImages: {
          keychain: '/bunny-keychain.jpg',
        },
      };

      render(
        <CartProvider>
          <ProductCard product={keychainOnlyPhotoProduct} />
        </CartProvider>
      );

      // Starts on Base
      expect(screen.getByAltText('Strawberry Bunny - Base')).toHaveAttribute('src', '/bunny-base.jpg');

      // Clicking Keychain jumps to Keychain photo and updates price
      fireEvent.click(screen.getByRole('button', { name: /^keychain$/i }));
      expect(screen.getByAltText('Strawberry Bunny - Keychain')).toHaveAttribute(
        'src',
        '/bunny-keychain.jpg'
      );
      expect(screen.getByText('$16.50')).toBeInTheDocument();

      // Clicking Magnet (which has no custom photo) returns to Base photo
      fireEvent.click(screen.getByRole('button', { name: /^magnet$/i }));
      expect(screen.getByAltText('Strawberry Bunny - Base')).toHaveAttribute('src', '/bunny-base.jpg');
      expect(screen.getByText('$14.00')).toBeInTheDocument();
    });
  });
```

- [ ] **Step 2: Run `tests/ProductCard.test.tsx` to verify the new tests fail**

Run: `npx vitest run tests/ProductCard.test.tsx`
Expected: FAIL — `ProductCard` has no carousel controls or variant-photo switching yet.

- [ ] **Step 3: Implement the carousel in `src/components/ProductCard.tsx`**

Update `src/components/ProductCard.tsx`:
- Import `getProductGallery` from `../utils/productUtils`, and `ChevronLeft`, `ChevronRight` from `lucide-react`.
- Compute `const gallery = getProductGallery(product);` and `const hasMultiplePhotos = gallery.length > 1;`.
- Add `const [activeSlideIndex, setActiveSlideIndex] = useState(0);` and guard via `useEffect`:

```typescript
  useEffect(() => {
    if (activeSlideIndex >= gallery.length) {
      setActiveSlideIndex(0);
    }
  }, [gallery.length, activeSlideIndex]);

  const activeSlide = gallery[activeSlideIndex] || gallery[0] || {
    src: product.images[0] || '',
    label: 'Base',
  };

  const handleSelectVariant = (variant: VariantType) => {
    setSelectedVariant(variant);
    if (hasMultiplePhotos) {
      const idx = gallery.findIndex((slide) => slide.variant === variant);
      setActiveSlideIndex(idx !== -1 ? idx : 0);
    }
  };

  const handlePrevPhoto = () => {
    setActiveSlideIndex((prev) => (prev - 1 + gallery.length) % gallery.length);
  };

  const handleNextPhoto = () => {
    setActiveSlideIndex((prev) => (prev + 1) % gallery.length);
  };
```

- Update the image container (lines 42–81) to render `activeSlide`, Prev/Next buttons, bottom-left view pill, and bottom-right dot indicators when `hasMultiplePhotos`:

```tsx
      {/* Image Container with Badges */}
      <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-weeble-pinkBg mb-3.5">
        <img
          src={activeSlide.src}
          alt={hasMultiplePhotos ? `${product.name} - ${activeSlide.label}` : product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />

        {/* Stock Status Badge */}
        <div className="absolute top-2.5 left-2.5">
          {product.inStock ? (
            product.isOneOfAKind ? (
              <span className="bg-weeble-yellow text-weeble-text text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                <span>⭐</span> 1-of-1 Original
              </span>
            ) : product.stockCount <= 2 ? (
              <span className="bg-pink-100 text-pink-700 text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm">
                🔥 Only {product.stockCount} left
              </span>
            ) : (
              <span className="bg-weeble-mint text-emerald-800 text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> In Stock
              </span>
            )
          ) : (
            <span className="bg-gray-200 text-gray-700 text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm">
              💤 Sold Out
            </span>
          )}
        </div>

        {/* New Item Badge */}
        {isNewProduct(product) && (
          <div className="absolute top-2.5 right-2.5">
            <span className="bg-weeble-pink text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm">
              NEW!
            </span>
          </div>
        )}

        {/* Carousel Controls (only shown when > 1 photo exists) */}
        {hasMultiplePhotos && (
          <>
            <button
              type="button"
              onClick={handlePrevPhoto}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/85 hover:bg-white text-weeble-text shadow-sm flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextPhoto}
              aria-label="Next photo"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/85 hover:bg-white text-weeble-text shadow-sm flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Active Photo Label Pill */}
            <div className="absolute bottom-2 left-2">
              <span className="bg-white/90 text-weeble-text text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                {activeSlide.variant === 'magnet'
                  ? '🧲 Magnet'
                  : activeSlide.variant === 'keychain'
                  ? '🔑 Keychain'
                  : 'Base'}
              </span>
            </div>

            {/* Dot Indicators */}
            <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1">
              {gallery.map((slide, idx) => {
                const isActive = idx === activeSlideIndex;
                return (
                  <button
                    key={`${slide.label}-${idx}`}
                    type="button"
                    onClick={() => setActiveSlideIndex(idx)}
                    aria-label={`View ${slide.label} photo`}
                    aria-current={isActive ? 'true' : undefined}
                    className={`h-2 rounded-full transition-all shadow-xs cursor-pointer ${
                      isActive ? 'w-4 bg-weeble-pink' : 'w-2 bg-white/80 hover:bg-white'
                    }`}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>
```

- Wire the variant style buttons' `onClick` to `() => handleSelectVariant(variant)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/ProductCard.test.tsx`
Expected: PASS (all existing and new carousel tests pass).

- [ ] **Step 5: Commit**

```bash
git add src/components/ProductCard.tsx tests/ProductCard.test.tsx
git commit -m "feat(store): add multi-photo carousel and style-click photo sync to ProductCard"
```

---

### Task 5: Cart & Stripe Checkout Variant Thumbnail Alignment

**Files:**
- Modify: `src/context/CartContext.tsx:1-72`
- Modify: `netlify/functions/create-checkout.ts:80-83`
- Modify: `tests/CartContext.test.tsx:220-237`

**Interfaces:**
- Consumes: `getProductVariantImage` from `src/utils/productUtils.ts`.
- Produces: `CartItem.image` populated with the variant's photo when available, else base `product.images[0]`.

- [ ] **Step 1: Write failing test in `tests/CartContext.test.tsx`**

Before the closing `});` of `describe('CartContext', ...)` in `tests/CartContext.test.tsx`, add:

```typescript
  it('stores variant-specific photo on cart item when available and falls back to base photo otherwise', () => {
    const productWithVariantPhoto: Product = {
      ...testProduct,
      id: 'prod-variant-img',
      images: ['/base-bunny.jpg'],
      variantImages: {
        keychain: '/keychain-bunny.jpg',
      },
    };
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addToCart(productWithVariantPhoto, 'keychain');
      result.current.addToCart(productWithVariantPhoto, 'magnet');
    });

    expect(result.current.items[0].image).toBe('/keychain-bunny.jpg');
    expect(result.current.items[1].image).toBe('/base-bunny.jpg');
  });
```

- [ ] **Step 2: Run `tests/CartContext.test.tsx` to verify the new test fails**

Run: `npx vitest run tests/CartContext.test.tsx`
Expected: FAIL — `result.current.items[0].image` is `'/base-bunny.jpg'` instead of `'/keychain-bunny.jpg'`.

- [ ] **Step 3: Update `src/context/CartContext.tsx` and `netlify/functions/create-checkout.ts`**

In `src/context/CartContext.tsx`:
- Update line 3:
  ```typescript
  import { getProductVariantImage, getProductVariantPrice } from '../utils/productUtils';
  ```
- Update line 64 inside `addToCart`:
  ```typescript
        image: getProductVariantImage(product, effectiveVariant),
  ```

In `netlify/functions/create-checkout.ts` line 81:

```typescript
      const resolvedImage =
        item.image ||
        (item.variant && product.variantImages?.[item.variant]) ||
        product.images?.[0];
```

and set `images: resolvedImage ? [resolvedImage] : [],` inside `product_data`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/CartContext.test.tsx tests/stripeService.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/context/CartContext.tsx netlify/functions/create-checkout.ts tests/CartContext.test.tsx
git commit -m "feat(cart): use variant-specific photo in cart items and Stripe checkout fallback"
```

---

### Task 6: Full Test Suite & TypeScript Production Build Verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run full Vitest suite**

Run: `npm test`
Expected: All test files pass with 0 failures.

- [ ] **Step 2: Run TypeScript type check and Vite production build**

Run: `npm run build`
Expected: `tsc && vite build` succeeds with 0 errors.
