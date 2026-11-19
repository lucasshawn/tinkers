# Weebles Storefront & Admin: Per-Variant Photos & Storefront Photo Carousel Specification

- **Date:** 2026-11-19
- **Status:** Draft (Pending Spec Review)
- **Target Platform:** Netlify (Vite + React + TypeScript + Netlify Functions)
- **Visual Design:** Hello Kitty inspired feminine pastel theme (`bg-white rounded-3xl border-2 border-pink-200`, matching existing Storefront and Admin Portal components)

---

## 1. Overview & Objectives

Catalog items currently display a single representative base photo (`product.images[0]`). While the base photo represents the Weeble itself, some items benefit from showing how specific style variants look (for example, the Refrigerator Magnet vs. Keychain attachment). This feature adds optional per-variant photos end-to-end:

1. **Optional Per-Variant Photos (`variantImages`):** Support up to one optional photo per enabled variant (`magnet`, `keychain`, designed to scale with `VariantType`) via `variantImages?: Partial<Record<VariantType, string>>` on [`Product`](file:///c:/Users/lucas/source/repos/tinkers/src/types/index.ts#L7-L21), while keeping `images[0]` as the representative base photo.
2. **Admin Upload, Edit (Replace) & Delete:** Allow admins inside [`WeebleEditorModal.tsx`](file:///c:/Users/lucas/source/repos/tinkers/src/components/admin/WeebleEditorModal.tsx) to upload a photo for any enabled variant, replace/change an existing variant photo, or remove/delete a variant photo — and persist multiple uploaded photos (base + variants) in a single atomic save action.
3. **Storefront Photo Flipping (`ProductCard`):**
   - Always display the representative **Base** photo on initial load.
   - When a product has one or more enabled variant photos, display carousel controls (previous/next arrows, dot indicators, and a compact view pill) so shoppers can flip through **all** photos (Base + every enabled variant photo).
   - When a product has only its base photo, render zero carousel chrome (identical to today).
   - Clicking a style button (**Magnet** / **Keychain**) selects that style (updating price as today) and automatically jumps to that variant's photo if one exists, or returns to the Base photo if that variant has no custom photo. Flipping manually with arrows or dots only changes the displayed photo without mutating the selected style or price.
4. **Cart & Checkout Alignment:** When adding a variant to the cart, use that variant's custom photo if present (falling back to the base photo) for [`CartItem.image`](file:///c:/Users/lucas/source/repos/tinkers/src/types/index.ts#L23-L32) and Stripe line items.

---

## 2. Data Model

### 2.1 Types (`src/types/index.ts`)

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

### 2.2 Backwards Compatibility

- `variantImages` is optional. Existing entries in [`src/data/products.json`](file:///c:/Users/lucas/source/repos/tinkers/src/data/products.json), Netlify Blobs, and `localStorage` require no migration.
- Empty or whitespace-only string values inside `variantImages` are treated as absent.

---

## 3. Core Utilities

### 3.1 Image Reading & Compression (`src/utils/imageUtils.ts`)

Extract the existing inline `FileReader` + HTML `<canvas>` compression logic out of [`WeebleEditorModal.tsx`](file:///c:/Users/lucas/source/repos/tinkers/src/components/admin/WeebleEditorModal.tsx#L75-L123) into a reusable module:

- `sanitizeImageFilename(rawFilename: string, prefix?: string): string`
  - Strips disallowed characters (`[^a-zA-Z0-9._-]`) from the basename.
  - When `prefix` is provided (e.g., `${productId}-${variant}`), prepends `${cleanPrefix}-` so uploading the same camera filename (such as `IMG_001.jpg`) for multiple variants or products never collides in `public/images/products/`.
- `readAndCompressImage(file: File, options: { onImmediate: (img: UploadedImage) => void; onCompressed?: (img: UploadedImage) => void }): void`
  - Reads `file` as a data URL via `FileReader` and immediately invokes `onImmediate({ filename: sanitizeImageFilename(file.name), base64Data })` so previews and synchronous tests update right away.
  - If `base64Data.length > 200_000` in a browser environment, scales down to max `800px` on the longest side and re-encodes as `image/jpeg` at quality `0.82`, then invokes `onCompressed` (defaulting to `onImmediate`).

### 3.2 Gallery & Variant Image Helpers (`src/utils/productUtils.ts`)

- `getProductVariantImage(product: Product, variant?: VariantType): string`
  - If `variant` is provided and `product.variantImages?.[variant]?.trim()` is non-empty, return that trimmed string.
  - Otherwise return `product.images?.[0] || ''`.
- `getProductGallery(product: Product): ProductImageSlide[]`
  - Builds the ordered slide list:
    1. Base slide: if `product.images?.[0]?.trim()` is non-empty, push `{ src: product.images[0].trim(), label: 'Base' }`.
    2. For each `variant` in `product.availableVariants`: if `product.variantImages?.[variant]?.trim()` is non-empty, push `{ src: product.variantImages[variant]!.trim(), label: variant === 'magnet' ? 'Magnet' : 'Keychain', variant }`.
  - Disabled variants (not in `product.availableVariants`) are excluded even if stale data remains in `variantImages`.
- `countProductVariantPhotos(product: Product): number`
  - Counts enabled variants in `product.availableVariants` that have a non-empty entry in `product.variantImages`. Used by [`InventoryTab.tsx`](file:///c:/Users/lucas/source/repos/tinkers/src/components/admin/InventoryTab.tsx) for the row summary badge.

---

## 4. Multi-Image Upload & Persistence Pipeline

### 4.1 Client API & Optimistic Preview (`src/services/adminApi.ts`, `src/components/admin/AdminPortal.tsx`)

- Update `adminApi.saveInventory(products: Product[], newImages?: UploadedImage[])` to POST `{ type: 'inventory', products, newImages }` when `newImages && newImages.length > 0`.
- Update [`InventoryTabProps.onSave`](file:///c:/Users/lucas/source/repos/tinkers/src/components/admin/InventoryTab.tsx#L7-L10) and [`AdminPortal.handleSaveInventory`](file:///c:/Users/lucas/source/repos/tinkers/src/components/admin/AdminPortal.tsx#L50-L78) to accept `newImages?: UploadedImage[]`.
- In `AdminPortal.handleSaveInventory`:
  - Build a lookup map `Map<string, string>` from `/images/products/${img.filename}` → `img.base64Data` for all entries in `newImages`.
  - Produce `localUpdated` by substituting matching paths in both `p.images[0]` and every entry of `p.variantImages` with their base64 data URLs so newly uploaded base and variant photos render immediately in the Admin Portal and Storefront (via `localStorage`) before Netlify finishes rebuilding.
  - Send the canonical `/images/products/<filename>` paths (`updated`) plus `newImages` to `adminApi.saveInventory`.

### 4.2 Serverless Persistence (`netlify/functions/admin-save.ts`)

- Parse both `newImages` and legacy `newImage` from the request body:
  ```typescript
  const imagesToUpload: Array<{ filename: string; base64Data: string }> = Array.isArray(newImages)
    ? newImages
    : newImage
    ? [newImage]
    : [];
  ```
- Loop through `imagesToUpload` sequentially:
  - Validate `img.filename` and `img.base64Data`, sanitize `cleanFilename = path.basename(img.filename).replace(/[^a-zA-Z0-9._-]/g, '')`, and strip the `data:image/...;base64,` prefix.
  - When `GITHUB_TOKEN` is set, call `commitToGitHub(\`public/images/products/${cleanFilename}\`, rawBase64, \`chore(admin): upload product image ${cleanFilename}\`)`.
  - In local dev mode (no `GITHUB_TOKEN`), write to `public/images/products/${cleanFilename}` with existing `/tmp` fallback.
- After all images succeed, persist `products` to Netlify Blobs and commit `src/data/products.json` to GitHub (or local disk).
- **Delete behavior:** Removing a variant photo in the editor omits its key from `product.variantImages` when `products.json` is saved. Existing image files in `public/images/products/` are left untouched (consistent with product deletion and safe against removing files shared across products).
- **Error handling:** If any image upload fails (e.g., GitHub API error), `admin-save` aborts before committing `products.json` and returns HTTP 500 with an error message, which `AdminPortal` displays in its sticky dismissible error alert.

---

## 5. Admin Portal UI

### 5.1 `WeebleEditorModal` (`src/components/admin/WeebleEditorModal.tsx`)

- **Props:** Update `onSave` signature to:
  ```typescript
  onSave: (product: Product, newImages?: UploadedImage[]) => void;
  ```
- **Modal Layout:** Add `max-h-[90vh] overflow-y-auto` to the modal dialog container so expanded per-variant photo controls remain comfortably scrollable on smaller screens.
- **Base Product Photo:** Relabel the top-level photo control from `"Product Photo"` to `"Base Product Photo"`. Keep the thumbnail preview and `<input id="weeble-photo" type="file" accept="image/*" />` for uploading or replacing the representative base image.
- **Per-Variant Photo Controls (Upload / Edit / Delete):** Inside the **Available Styles & Pricing** card, beneath each enabled variant's price row (`magnet` and `keychain`):
  - **When no photo is set for that variant:**
    - Render a subtle muted label `"Using base photo"` and an `"Upload Photo"` label/button tied to `<input id="weeble-magnet-photo" type="file" accept="image/*" className="sr-only" aria-label="Upload Magnet photo" />` (and analogously `weeble-keychain-photo` / `"Upload Keychain photo"`).
  - **When a photo is set for that variant (existing or newly uploaded):**
    - Render a `48×48` (`w-12 h-12 rounded-xl object-cover border border-pink-200 bg-weeble-pinkBg`) preview thumbnail with `alt="${variantLabel} preview"`.
    - Render a **"Change"** button/label wired to the variant's hidden file input (`aria-label="Change Magnet photo"` / `"Change Keychain photo"`) to replace/edit the photo.
    - Render a **"Remove"** button (`type="button"`, `aria-label="Remove Magnet photo"` / `"Remove Keychain photo"`, rose pastel styling) that immediately clears both `variantImageUrls[variant]` and `uploadedVariantImages[variant]`.
- **State & Submission Rules:**
  - `variantImageUrls: Partial<Record<VariantType, string>>` initialized from `product?.variantImages || {}` whenever the modal opens.
  - `uploadedVariantImages: Partial<Record<VariantType, UploadedImage>>` reset to `{}` whenever the modal opens.
  - After handling a file input `onChange`, reset `e.target.value = ''` so removing a photo and re-selecting the exact same file works reliably.
  - Toggling a variant checkbox off and back on during the same edit session preserves its in-memory photo state until Save.
  - On `handleSubmit`:
    - Compute the product `id` first.
    - Build `finalVariantImages: VariantImages = {}` and `newImages: UploadedImage[] = []`:
      - If `uploadedImage` exists, push `{ filename: uploadedImage.filename, base64Data: uploadedImage.base64Data }` to `newImages` (preserving existing base photo naming).
      - For each `v` in `variants` (only enabled variants):
        - If `uploadedVariantImages[v]` exists, compute `const variantFilename = sanitizeImageFilename(uploadedVariantImages[v]!.filename, \`${id}-${v}\`)`, set `finalVariantImages[v] = \`/images/products/${variantFilename}\``, and push `{ filename: variantFilename, base64Data: uploadedVariantImages[v]!.base64Data }` to `newImages`.
        - Else if `variantImageUrls[v]?.trim()` exists, set `finalVariantImages[v] = variantImageUrls[v]!.trim()`.
    - Attach `...(Object.keys(finalVariantImages).length > 0 ? { variantImages: finalVariantImages } : {})` to `savedProduct` (omitting `variantImages` when none exist keeps `products.json` tidy).
    - Call `onSave(savedProduct, newImages.length > 0 ? newImages : undefined)`.

### 5.2 `InventoryTab` (`src/components/admin/InventoryTab.tsx`)

- Forward `newImages?: UploadedImage[]` in `handleSaveModal` to `onSave(updated, newImages)`.
- In each product row's metadata strip (`price • category • Stock: N`), when `countProductVariantPhotos(item) > 0`, append:
  - `• 📷 +1 photo` (for 1 variant photo) or `• 📷 +2 photos` (for 2+ variant photos).

---

## 6. Storefront UI, Cart & Checkout

### 6.1 `ProductCard` (`src/components/ProductCard.tsx`)

- **Gallery Construction:** Compute `const gallery = getProductGallery(product);`.
- **Active Slide State:**
  - `const [activeSlideIndex, setActiveSlideIndex] = useState(0);` — always begins at `0` (representative Base photo) on initial load.
  - Sync via `useEffect`: if `activeSlideIndex >= gallery.length`, reset `activeSlideIndex` to `0`.
- **Style Button Click (`handleSelectVariant(variant: VariantType)`):**
  - Set `selectedVariant` to `variant`.
  - Search `const variantSlideIdx = gallery.findIndex((slide) => slide.variant === variant);`.
  - Set `activeSlideIndex(variantSlideIdx !== -1 ? variantSlideIdx : 0)`.
- **Single-Photo Products (`gallery.length <= 1`):**
  - Render the exact same `<img src={product.images[0]} alt={product.name} ... />` and top badges as today with no arrows, dots, or view pill.
- **Multi-Photo Products (`gallery.length > 1`):**
  - Render `<img src={activeSlide.src} alt={\`${product.name} - ${activeSlide.label}\`} ... />`.
  - **Prev / Next Buttons:** Circular pastel-white translucent buttons (`bg-white/85 hover:bg-white text-weeble-text rounded-full w-7 h-7 shadow-sm flex items-center justify-center`) vertically centered on the left (`left-2`) and right (`right-2`) edges of the image container using `ChevronLeft` and `ChevronRight` from `lucide-react`:
    - Prev: `setActiveSlideIndex((prev) => (prev - 1 + gallery.length) % gallery.length)` (`aria-label="Previous photo"`).
    - Next: `setActiveSlideIndex((prev) => (prev + 1) % gallery.length)` (`aria-label="Next photo"`).
  - **View Label Pill:** Positioned at `bottom-2 left-2` (clear of top-left Stock badge and top-right `NEW!` badge):
    - Displays `Base`, `🧲 Magnet`, or `🔑 Keychain` corresponding to `activeSlide`.
    - Styled softly (`bg-white/90 text-weeble-text text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm`).
  - **Dot Indicators:** Positioned at `bottom-2.5 right-2.5` (guaranteed zero overlap with the bottom-left view pill on all screen widths):
    - One button per slide with `aria-label={\`View ${slide.label} photo\`}` and `aria-current={idx === activeSlideIndex ? 'true' : undefined}`.
    - Active dot styled as a wider pink pill (`w-4 h-2 bg-weeble-pink rounded-full`), inactive dots as `w-2 h-2 bg-white/80 hover:bg-white rounded-full`.
  - **Manual Flipping Behavior:** Clicking arrows or dots only updates `activeSlideIndex` — it does not change `selectedVariant` or displayed price.

### 6.2 `CartContext` & `create-checkout`

- **[`src/context/CartContext.tsx`](file:///c:/Users/lucas/source/repos/tinkers/src/context/CartContext.tsx#L58-L67):** Set `image: getProductVariantImage(product, effectiveVariant)` when creating a new `CartItem`.
- **[`netlify/functions/create-checkout.ts`](file:///c:/Users/lucas/source/repos/tinkers/netlify/functions/create-checkout.ts#L81):** Prefer `item.image`, falling back to `product.variantImages?.[item.variant] || product.images?.[0]`.

---

## 7. Testing Strategy

1. **Image & Product Utilities (`tests/productUtils.test.ts`):**
   - `getProductVariantImage`: returns variant photo when present, falls back to `images[0]` when missing or whitespace-only, falls back when no variant is passed.
   - `getProductGallery`: returns `[Base]` when no variant photos exist; appends enabled variant photos in `availableVariants` order; excludes disabled variants and empty strings.
   - `countProductVariantPhotos`: counts only enabled variants with non-empty photos.
2. **Storefront Product Card (`tests/ProductCard.test.tsx`):**
   - Product without `variantImages`: renders no Previous/Next buttons, no dots, no view pill.
   - Product with variant photos: renders Base photo on initial load; displays Previous/Next buttons, dots, and `Base` pill.
   - Clicking Next cycles `Base → Magnet → Keychain → Base`; clicking Previous wraps `Base → Keychain`.
   - Clicking a dot jumps directly to that slide without changing selected style or displayed price.
   - Clicking **Keychain** style button jumps to the Keychain photo; clicking **Magnet** when Magnet has no photo returns to the Base photo.
3. **Cart (`tests/CartContext.test.tsx`):**
   - Adding a variant with a custom photo saves the variant photo in `CartItem.image`.
   - Adding a variant without a custom photo falls back to `product.images[0]`.
4. **Admin Editor & Inventory (`tests/InventoryTab.test.tsx`, `tests/AdminPortal.test.tsx`):**
   - Uploading a Magnet photo and Keychain photo shows previews, includes `variantImages` on saved `Product`, and passes all uploads in `newImages[]`.
   - Replacing ("Change") an existing variant photo updates its path and includes the replacement in `newImages[]`.
   - Deleting ("Remove") an existing variant photo clears the preview and omits it from `variantImages` on save.
   - Unchecking a variant removes its photo from saved `variantImages`.
   - Inventory row shows `📷 +1 photo` / `📷 +2 photos` when variant photos exist.
   - `AdminPortal` substitutes newly uploaded variant image paths with base64 previews in local state/storage while sending canonical paths to `adminApi.saveInventory`.
5. **Admin API & Serverless Function (`tests/adminApi.test.ts`):**
   - `adminApi.saveInventory` sends `newImages` array in the POST payload.
