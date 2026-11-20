# Weebles Storefront: Configurable Markdown Page Content Specification

- **Date:** 2026-11-19
- **Status:** Draft for Review
- **Target Platform:** Netlify (Vite + React + TypeScript)
- **Visual Design:** Hello Kitty inspired feminine pastel theme (`bg-weeble-pink`, `bg-weeble-pinkWash`, `border-pink-200`, `font-bubble`, `font-body`)

---

## 1. Overview & Objectives

Make the primary storefront text sections configurable through the Admin Portal (**Manage Site Content** tab) using a safe, rich Markdown format that supports inline fonts, colors, bold, italics, strikethrough, links, wavy highlights, bullet lists, and inline PNG images — while updating the initial default copy to remove inaccurate "UV resin" references (without naming specific clay brands) and preserving the storefront's exact current visual presentation.

### Configurable Sections
1. **Hero Section (`HeroBanner`):**
   - **Title Tag Line (`heroTagline`)** — Pill badge text between the Sparkles and Heart icons.
   - **Title (`heroTitle`)** — Main `<h1>` headline (default preserves the wavy pink underline + cute text shadow on "Fridge & Keys" and the trailing `✨`).
   - **Subtitle (`heroSubtitle`)** — Hero introductory paragraph.
2. **Behind the Scenes & Restocks (`SocialStrip`):**
   - **Badge (`socialBadge`)** — Pill badge text above the social heading.
   - **Title (`socialTitle`)** — Section `<h2>` heading.
   - **Subtitle (`socialSubtitle`)** — Section `<p>` subtitle.
3. **Catalog Header (`CatalogGrid`):**
   - **Title (`catalogTitle`)** — Section `<h2>` heading.
   - **Subtitle (`catalogSubtitle`)** — Section `<p>` subtitle.
4. **Footer Clay Care (`Footer`):**
   - **Title (`footerCareTitle`)** — Clay Care box `<h3>` heading.
   - **Body (`footerCareBody`)** — Clay Care bulleted instructions (Markdown bullet list).

---

## 2. Data Model, Default Copy & Persistence

### 2.1 Type Definitions (`src/types/settings.ts`)

```typescript
export interface PageContentSettings {
  heroTagline: string;
  heroTitle: string;
  heroSubtitle: string;
  socialBadge: string;
  socialTitle: string;
  socialSubtitle: string;
  catalogTitle: string;
  catalogSubtitle: string;
  footerCareTitle: string;
  footerCareBody: string;
}

export interface SiteSettings {
  contactEmail: string;
  customOrderEmail: string;
  socials?: LegacySocials;
  socialLinksEnabled?: boolean;
  socialLinks?: SocialLink[];
  announcementBanner?: AnnouncementBannerSettings;
  pageContent?: PageContentSettings;
  admins?: string[];
  categories?: CategoryOption[];
}
```

### 2.2 Default Markdown Copy (`src/data/settings.json` & `src/utils/pageContentDefaults.ts`)

`DEFAULT_PAGE_CONTENT` mirrors the `pageContent` object in `src/data/settings.json` so components always have safe defaults even when hydrating partial legacy settings:

| Field | Default Markdown |
|---|---|
| `heroTagline` | `Hand-Sculpted Polymer Clay with Love` |
| `heroTitle` | `Tiny Polymer Clay Friends for Your [Fridge & Keys]{color=pink wavy} ✨` |
| `heroSubtitle` | `Welcome to the Weeble sanctuary! Each little critter is uniquely sculpted from high-grade polymer clay, hand-painted with pastel details, and baked to a durable finish.` |
| `socialBadge` | `✨ Behind the Scenes & Restocks` |
| `socialTitle` | `Follow the Sculpting Journey!` |
| `socialSubtitle` | `Watch our clay ASMR sculpting clips, packaging videos with cute stickers, and catch live restock alerts!` |
| `catalogTitle` | `Available Creations 🍓` |
| `catalogSubtitle` | `Each piece is individually sculpted, baked, and detailed by hand.` |
| `footerCareTitle` | `✨ Clay Care Instructions` |
| `footerCareBody` | `- Durable baked polymer clay finish (do not soak or run through dishwasher).\n- Clean gently with a soft microfiber cloth or damp wipe.\n- Handle with love! Strong neodymium magnets are embedded securely.` |

### 2.3 Normalization, Storage & Hydration
- **`resolvePageContent(pageContent?: Partial<PageContentSettings>): PageContentSettings`** (`src/utils/pageContentDefaults.ts`):
  - Merges each field individually against `DEFAULT_PAGE_CONTENT`: if a field is `undefined` or `null`, falls back to the default. Explicit empty strings (`""`) are respected if an admin intentionally clears an optional subtitle, while `heroTitle` falls back to default only when `undefined`.
- **`normalizeSettings` (`src/utils/socialPlatforms.ts`) & `SettingsContext.tsx`:**
  - `normalizeSettings` deep-merges `pageContent` with `DEFAULT_PAGE_CONTENT` / `defaults.pageContent` via `resolvePageContent` so `DEFAULT_SETTINGS`, `localStorage` (`SETTINGS_STORAGE_KEY = 'weebles_settings_v1'`), `updateSettings`, `hydrateSettings`, and `netlify/functions/admin-save.ts` (`loadPersistedSettings`) all return normalized `pageContent` automatically.
  - Note: `App.tsx` and `AdminPortal.tsx` already call `hydrateSettings(data.settings)` from `adminApi.loadStoreData()`, so `pageContent` hydrates from Netlify Blobs automatically without extra wiring.
- **`src/utils/changeLogUtils.ts`:**
  - Extend `diffSettingsChanges` to compare all 10 `pageContent` fields (labeled e.g. `Site Content - Hero Title`, `Site Content - Catalog Subtitle`, etc.) so edits appear in the Admin **Changes** audit log.

---

## 3. Safe Markdown Engine

### 3.1 Architecture (`src/utils/markdownParser.ts` & `src/components/RichMarkdown.tsx`)
Zero external Markdown dependencies. `markdownParser.ts` tokenizes and parses input strings into a typed AST (`MarkdownBlock[]` / `MarkdownInline[]`), and `RichMarkdown.tsx` maps the AST directly to pure React elements. `dangerouslySetInnerHTML` is never used, making HTML/script injection impossible by construction.

### 3.2 Supported Inline Syntax (Nestable)
1. **Emphasis & Strike:**
   - `***bold italic***` → `<strong><em>...</em></strong>`
   - `**bold**` → `<strong>...</strong>`
   - `*italic*` → `<em>...</em>`
   - `~~strikethrough~~` → `<del>...</del>`
2. **Links:**
   - `[label](url)` → `<a href={url} className="underline hover:opacity-80" ...>` (external `http:`/`https:` links add `target="_blank" rel="noopener noreferrer"`).
   - Allowed protocols: `https:`, `http:`, `mailto:`, or root-relative `/...`. Disallowed protocols (e.g., `javascript:`, `vbscript:`) render as plain text.
3. **Inline PNGs / Images:**
   - `![alt](url)` — Renders inline `<img src={resolvedUrl} alt={alt} className="inline-block align-middle object-contain" />` with default style `{ height: '1.2em', width: 'auto' }` so inline PNG stickers/icons scale harmoniously with surrounding heading or body text.
   - Optional explicit sizing suffix inside parentheses:
     - `![star](/images/content/star.png =28)` → `{ height: '28px', width: 'auto' }`
     - `![star](/images/content/star.png =32x24)` → `{ width: '32px', height: '24px' }`
     - Dimensions are clamped to a safe range (`8` to `256` px) to avoid layout breakage.
   - Allowed image `src`: root-relative `/images/...`, `https://...`, `http://...`, or `data:image/(png|jpeg|jpg|webp|gif);base64,...`. SVG data URIs and non-image schemes are rejected and rendered as plain text.
   - **Instant Preview Resolution:** Before rendering an `/images/content/<file>` URL, `RichMarkdown` checks an in-memory/localStorage preview map (`weebles_content_images_v1`) and falls back via `onError` to `/.netlify/functions/admin-save?action=content-image&name=<file>` so newly uploaded PNGs display immediately even before a static Netlify deploy finishes.
4. **Styled Spans — Shorthand Syntax:**
   - `[content]{attr1 attr2 ...}` — Nested inline Markdown is parsed inside `content`.
   - Supported attributes (space-separated):
     - `color=<val>`:
       - Named theme palette: `pink` (`#FF85A1`), `pinkLight` (`#FFB3C6`), `text` (`#4A2E35`), `textMuted` (`#7A5C61`), `blue` (`#38BDF8`), `yellow` (`#EAB308`), `mint` (`#34D399`), `lilac` (`#A78BFA`), `rose` (`#F43F5E`), `white` (`#FFFFFF`).
       - Hex color: `#RGB` or `#RRGGBB`.
       - Functional RGB: `rgb(r,g,b)` (validated numeric channels 0–255).
     - `font=<val>`:
       - Presets: `bubble` (`"Fredoka", cursive, sans-serif`), `body` (`"Quicksand", sans-serif`), `serif` (`Georgia, serif`), `mono` (`ui-monospace, SFMono-Regular, Menlo, monospace`).
       - Custom font family (quoted if containing spaces, e.g., `font="Comic Sans MS"` or `font=Georgia`): validated against `^[a-zA-Z0-9\s,'"-]{1,60}$`.
     - `size=<val>`:
       - Presets (`xs`, `sm`, `base`, `lg`, `xl`, `2xl`) or numeric CSS length in `px` (`8px`–`96px`), `em`/`rem` (`0.5em`–`4em`).
     - `wavy` (flag): Applies Tailwind classes `underline decoration-pink-300 decoration-wavy text-shadow-cute`.
     - `underline` (flag): Applies `underline`.
5. **Styled Spans — Safe HTML `<span>` Fallback:**
   - `<span style="...">content</span>` (nesting supported) is parsed into the same styled-span AST node.
   - Only allowlisted CSS declarations inside `style="..."` are accepted and validated: `color`, `font-family`, `font-size`, `font-weight` (`normal`, `bold`, `100`–`900`), `font-style` (`normal`, `italic`), `text-decoration` (`underline`, `line-through`, `underline wavy`, `none`).
   - Any other HTML tag (e.g., `<script>`, `<img onerror=...>`, `<iframe ...>`) is treated as literal escaped text.

### 3.3 Supported Block Syntax (`mode="block"`)
- **Bullet Lists:** Consecutive lines starting with `- ` or `* ` render as `<ul className="space-y-1.5 list-none"><li>• ...</li></ul>` (matching the existing Footer Clay Care visual style).
- **Paragraphs & Line Breaks:** Blank lines separate `<p>` blocks (rendered with spacing when multiple paragraphs exist, or directly inside a fragment for single-paragraph subtitles so existing `<p>` wrapper classes remain clean); single newlines inside a paragraph render `<br />`.
- **`mode="inline"`** (default for headlines, taglines, and badges): Parses inline elements only (single newlines render `<br />`) and renders a React fragment without block wrappers so it slots cleanly inside `<h1>`, `<h2>`, `<h3>`, or `<span>`.

### 3.4 Storefront Component Integration
- **`HeroBanner.tsx`:**
  - Pill badge (`<span>`): `<RichMarkdown content={content.heroTagline} mode="inline" />` between `<Sparkles />` and `<Heart />`.
  - Headline (`<h1>`): `<RichMarkdown content={content.heroTitle} mode="inline" />`. With default `"Tiny Polymer Clay Friends for Your [Fridge & Keys]{color=pink wavy} ✨"`, renders the exact pink wavy-underlined `Fridge & Keys` with cute text shadow and trailing `✨`.
  - Subtitle (`<p>`): `<RichMarkdown content={content.heroSubtitle} mode="inline" />` (rendered when non-empty).
- **`SocialStrip.tsx`:**
  - Pill badge (`<span>`): `<RichMarkdown content={content.socialBadge} mode="inline" />`.
  - Heading (`<h2>`): `<RichMarkdown content={content.socialTitle} mode="inline" />`.
  - Subtitle (`<p>`): `<RichMarkdown content={content.socialSubtitle} mode="inline" />` (rendered when non-empty).
- **`CatalogGrid.tsx`:**
  - Heading (`<h2>`): `<RichMarkdown content={content.catalogTitle} mode="inline" />` inside `font-bubble text-3xl sm:text-4xl font-bold text-weeble-text mb-1` (normal inline flow instead of `flex gap-2` so bold/colored spans and inline PNGs flow naturally).
  - Subtitle (`<p>`): `<RichMarkdown content={content.catalogSubtitle} mode="inline" />` (rendered when non-empty).
- **`Footer.tsx`:**
  - Clay Care heading (`<h3>`): `<RichMarkdown content={content.footerCareTitle} mode="inline" />` inside `font-bubble text-lg font-bold text-weeble-text mb-2` (normal inline flow).
  - Clay Care body (`<div>`): `<RichMarkdown content={content.footerCareBody} mode="block" className="text-xs text-weeble-textMuted space-y-1.5" />`.

---

## 4. Admin Portal Editor & Inline PNG Upload Pipeline

### 4.1 Reusable `MarkdownFieldEditor` (`src/components/admin/MarkdownFieldEditor.tsx`)

Props:
```typescript
export interface MarkdownFieldEditorProps {
  id: string;
  label: string;
  value: string;
  defaultValue: string;
  mode?: 'inline' | 'block';
  rows?: number;
  previewVariant?: 'pill' | 'heroTitle' | 'heading' | 'subtitle' | 'careList';
  onChange: (nextValue: string) => void;
  onUploadImage: (file: File) => Promise<{ url: string; alt: string }>;
}
```

Features:
1. **Formatting Toolbar** (operates on current textarea selection or inserts template at cursor):
   - **Bold** (`**text**`), **Italic** (`*text*`), **Wavy Highlight** (`[text]{color=pink wavy}`).
   - **Color Picker Popover:** Clickable theme swatches (`pink`, `rose`, `lilac`, `blue`, `mint`, `yellow`, `text`, `textMuted`) plus native `<input type="color">` hex picker → wraps selection in `[text]{color=...}`.
   - **Font Selector:** Dropdown (`Fredoka (Bubble)`, `Quicksand (Body)`, `Serif`, `Monospace`) → wraps selection in `[text]{font=...}`.
   - **Insert PNG Button:** Opens a hidden `<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" />` (and displays an optional inline error if upload fails or exceeds 2 MB). On upload success, inserts `![alt](url)` at the cursor position.
   - **Reset to Default** button (shown when `value !== defaultValue`) restores `defaultValue` immediately.
2. **Live Preview Strip:** Renders `<RichMarkdown />` styled to match `previewVariant` (`pill`, `heroTitle`, `heading`, `subtitle`, `careList`) so admins see exact colors, fonts, wavy underlines, and inline PNGs as they type.

### 4.2 `ContentTab.tsx` Integration
- Adds a **Storefront Page Copy (Markdown)** card in [`ContentTab`](file:///c:/Users/lucas/source/repos/tinkers/src/components/admin/ContentTab.tsx) directly below the Announcement Banner card, with a collapsible **Markdown Formatting Guide** banner summarizing `**bold**`, `*italic*`, `[text]{color=pink font=bubble wavy}`, `<span style="...">`, `![alt](url =28)`, and `- bullet`.
- Groups the 10 `MarkdownFieldEditor` fields into four clean sub-blocks:
  1. **Hero Section** (`heroTagline`, `heroTitle`, `heroSubtitle`)
  2. **Behind the Scenes & Restocks** (`socialBadge`, `socialTitle`, `socialSubtitle`)
  3. **Catalog Header** (`catalogTitle`, `catalogSubtitle`)
  4. **Footer Clay Care** (`footerCareTitle`, `footerCareBody`)
- Syncs state cleanly and submits `pageContent` alongside existing settings (`contactEmail`, `customOrderEmail`, `socials`, `announcementBanner`) via `onSave`.

### 4.3 Backend PNG Upload Endpoint (`netlify/functions/admin-save.ts` & `src/services/adminApi.ts`)
- **POST `type: 'content-image'`** (requires authenticated admin Bearer token):
  - Payload: `{ type: 'content-image', contentImage: { filename: string, base64Data: string } }`.
  - Validates filename extension is `.png`, `.jpg`, `.jpeg`, `.webp`, or `.gif` (rejects `.svg`, `.html`, `.js`, etc. with HTTP `400`).
  - Validates decoded payload size is ≤ 2 MB (rejects larger payloads with HTTP `413` / `400`).
  - Sanitizes filename via `path.basename` + regex (`[^a-zA-Z0-9._-]`) and prefixes a short timestamp if needed to avoid unintentional collisions while keeping readable names.
  - Persists to:
    1. Netlify Blobs (`content-image:<cleanFilename>`, JSON `{ contentType, base64 }` for immediate serving before static rebuild).
    2. GitHub (`public/images/content/<cleanFilename>`) when `GITHUB_TOKEN` is configured, OR local disk `public/images/content/<cleanFilename>` (with `os.tmpdir()` fallback) in dev mode.
  - Returns `{ success: true, url: '/images/content/<cleanFilename>', filename: '<cleanFilename>', message: '...' }`.
- **GET `?action=content-image&name=<cleanFilename>`** (public read):
  - Validates clean filename (alphanumeric + `._-`, allowed image extension, no path traversal).
  - Reads from Netlify Blobs (`content-image:<cleanFilename>`) or local/tmp fallback and returns binary image bytes (`isBase64Encoded: true`) with proper `Content-Type` (`image/png`, `image/jpeg`, `image/webp`, `image/gif`) and `Cache-Control: public, max-age=3600`.
- **Frontend Helper (`src/services/adminApi.ts` & `src/utils/contentImageCache.ts`):**
  - `adminApi.uploadContentImage(filename, base64Data)` sends the POST request, caches `{ [url]: base64Data }` in `localStorage` (`weebles_content_images_v1`) for instant zero-latency rendering in the admin browser, and returns `{ url, message }`.

---

## 5. Error Handling & Security

- **XSS Prevention:** Pure React AST rendering without `dangerouslySetInnerHTML`. Raw HTML tags other than allowlisted `<span style="...">` are rendered as literal escaped text. Links reject `javascript:`/`data:` URLs. Images reject `javascript:` and SVG data URIs.
- **Upload Safety:** Strict allowlist of raster image extensions (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`), filename sanitization preventing path traversal, and 2 MB size cap enforced both client-side and server-side.
- **Malformed Markdown Resilience:** Unclosed `**`, `*`, `[text]{...}`, `<span>`, or broken image syntax degrade gracefully into literal text without throwing exceptions or infinite loops.
- **Backward Compatibility:** Existing `settings.json`, `localStorage`, and Netlify Blobs data lacking `pageContent` seamlessly populate all 10 defaults via `resolvePageContent`.

---

## 6. Testing Strategy

1. **`tests/markdownParser.test.ts`:**
   - Parses plain text, `**bold**`, `*italic*`, `***bold italic***`, `~~strike~~`, links (valid and blocked `javascript:`), and nested combinations.
   - Parses `[text]{color=pink wavy}`, hex colors, `rgb(...)`, font presets (`bubble`, `body`, `serif`, `mono`), custom font names, and `size=...`.
   - Parses safe `<span style="color: #FF85A1; font-family: Fredoka">...</span>` and strips disallowed CSS properties / escapes `<script>` and unknown HTML tags.
   - Parses inline PNGs `![alt](/images/content/star.png)`, `=28`, `=32x24`, clamps out-of-range sizes, and blocks `data:image/svg+xml` / `javascript:`.
   - Parses block mode bullet lists (`- item`) and paragraphs/line breaks.
   - Gracefully handles malformed/unclosed syntax without throwing.
2. **Storefront Component Tests (`tests/HeroBanner.test.tsx`, `tests/SocialStrip.test.tsx`, `tests/CatalogGrid.test.tsx`, `tests/Footer.test.tsx`):**
   - Verify default copy renders accurately with zero UV resin references and with the pink wavy-underlined `Fridge & Keys` + `✨`.
   - Verify custom Markdown from `SettingsContext` (colors, fonts, bold, italics, inline PNGs, custom bullets) renders dynamically in each slot.
3. **Admin Editor Tests (`tests/MarkdownFieldEditor.test.tsx`, `tests/ContentTab.test.tsx`):**
   - Toolbar buttons wrap selection / insert bold, italic, color, font, wavy highlight, and uploaded PNG Markdown.
   - Live preview updates immediately as Markdown changes.
   - Reset to Default button restores default Markdown.
   - `ContentTab` submits updated `pageContent` in `onSave` alongside existing fields.
4. **Persistence & Audit Tests (`tests/SettingsContext.test.tsx`, `tests/changeLogUtils.test.ts`, `tests/adminApi.test.ts`):**
   - Legacy settings without `pageContent` merge cleanly with `DEFAULT_PAGE_CONTENT`.
   - `diffSettingsChanges` produces audit entries for `pageContent` edits.
   - `adminApi.uploadContentImage` sends the expected payload and caches preview data URLs.
