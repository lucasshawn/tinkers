# Configurable Markdown Page Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all storefront hero, social strip, catalog header, and footer clay-care text sections configurable in the Admin Portal via a safe, rich Markdown format supporting inline fonts, colors, bold, italics, wavy highlights, bullet lists, and uploaded/linked inline PNGs, while removing inaccurate UV resin copy without naming specific clay brands.

**Architecture:** We add a `pageContent` schema to `SiteSettings` backed by `src/utils/pageContentDefaults.ts` and normalized via `normalizeSettings`, a zero-dependency pure-React AST Markdown engine (`src/utils/markdownParser.ts` + `src/components/RichMarkdown.tsx`) supporting standard Markdown, `[text]{color=... font=... wavy}` shorthand, and allowlisted `<span style="...">` spans, a `content-image` upload/serve pipeline in `netlify/functions/admin-save.ts` + `src/services/adminApi.ts` with instant preview caching, and a reusable `MarkdownFieldEditor` wired into `ContentTab`.

**Tech Stack:** React 18, TypeScript 5, Tailwind CSS 3, Vite 6, Vitest + React Testing Library, Netlify Functions + Netlify Blobs + GitHub Contents API.

## Global Constraints

- Zero new npm dependencies — implement Markdown parsing and rendering purely in TypeScript/React.
- Never use `dangerouslySetInnerHTML`; render all Markdown AST nodes as pure React elements.
- Remove all UV resin wording from default storefront copy (`HeroBanner` and `Footer` Clay Care) without naming specific clay brands (e.g., do not mention "Sculpey").
- Preserve exact existing storefront visual styling (including pink wavy underline + cute text shadow on `Fridge & Keys` and trailing `✨`).
- Allowlist only raster images (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`), max 2 MB, sanitized filenames, no `.svg` or script schemes.
- All Vitest commands use `npx vitest run --exclude ".worktrees/**"` so local git worktrees under `.worktrees/` do not load duplicate React instances.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/types/settings.ts` | Modify | Add `PageContentSettings` interface and `pageContent?: PageContentSettings` on `SiteSettings` |
| `src/utils/pageContentDefaults.ts` | Create | `DEFAULT_PAGE_CONTENT`, `PAGE_CONTENT_FIELD_META`, and `resolvePageContent()` |
| `src/data/settings.json` | Modify | Seed default `pageContent` with the 10 Markdown fields |
| `src/utils/socialPlatforms.ts` | Modify | Normalize `pageContent` in `normalizeSettings()` |
| `src/utils/changeLogUtils.ts` | Modify | Diff all 10 `pageContent` fields in `diffSettingsChanges()` |
| `src/utils/contentImageCache.ts` | Create | `localStorage` preview cache and Netlify fallback URL helper for `/images/content/*` |
| `src/utils/markdownParser.ts` | Create | Tokenizer/parser producing `MarkdownBlock[]` / `MarkdownInline[]` AST with safe CSS/URL/image validation |
| `src/components/RichMarkdown.tsx` | Create | Pure React renderer for `MarkdownBlock[]` / `MarkdownInline[]` (`mode="inline" \| "block"`) |
| `src/components/HeroBanner.tsx` | Modify | Render `heroTagline`, `heroTitle`, `heroSubtitle` via `<RichMarkdown />` |
| `src/components/SocialStrip.tsx` | Modify | Render `socialBadge`, `socialTitle`, `socialSubtitle` via `<RichMarkdown />` |
| `src/components/CatalogGrid.tsx` | Modify | Render `catalogTitle`, `catalogSubtitle` via `<RichMarkdown />` |
| `src/components/Footer.tsx` | Modify | Render `footerCareTitle` & `footerCareBody` via `<RichMarkdown />` |
| `netlify/functions/admin-save.ts` | Modify | Add `POST type: 'content-image'` upload, `GET ?action=content-image&name=...` serve, and preserve `pageContent` on partial settings save |
| `src/services/adminApi.ts` | Modify | Add `uploadContentImage(filename, base64Data)` with local preview caching |
| `src/components/admin/MarkdownFieldEditor.tsx` | Create | Reusable Markdown editor with formatting toolbar, color/font pickers, PNG upload, Reset to Default, and Live Preview |
| `src/components/admin/ContentTab.tsx` | Modify | Add Storefront Page Copy (Markdown) section with collapsible cheat sheet and 10 `MarkdownFieldEditor` inputs |
| `tests/SettingsContext.test.tsx` | Modify | Test `pageContent` defaults, partial legacy merge, and explicit empty-string preservation |
| `tests/changeLogUtils.test.ts` | Modify | Test field-level `pageContent` diffs |
| `tests/markdownParser.test.ts` | Create | Unit & rendering tests for Markdown parser, `<RichMarkdown />`, inline PNGs, styles, and XSS safety |
| `tests/HeroBanner.test.tsx` | Create | Test default hero Markdown (no UV resin, wavy pink `Fridge & Keys`) and custom overrides |
| `tests/SocialStrip.test.tsx` | Modify | Test custom Markdown overrides for social badge/title/subtitle |
| `tests/CatalogGrid.test.tsx` | Modify | Test custom Markdown overrides for catalog title/subtitle |
| `tests/Footer.test.tsx` | Modify | Test default clay care Markdown (no UV resin) and custom overrides |
| `tests/adminApi.test.ts` | Modify | Test `uploadContentImage`, `POST content-image`, and `GET content-image` |
| `tests/MarkdownFieldEditor.test.tsx` | Create | Test toolbar wrapping, color/font insertion, PNG upload, live preview, and reset to default |
| `tests/ContentTab.test.tsx` | Modify | Test rendering & saving `pageContent` alongside existing settings |

---

### Task 1: Page Content Data Model, Defaults, Normalization & Audit Diffing

**Files:**
- Modify: `src/types/settings.ts:33-53`
- Create: `src/utils/pageContentDefaults.ts`
- Modify: `src/data/settings.json:1-50`
- Modify: `src/utils/socialPlatforms.ts:1-2,355-383`
- Modify: `src/utils/changeLogUtils.ts:203-286`
- Test: `tests/SettingsContext.test.tsx`
- Test: `tests/changeLogUtils.test.ts`

**Interfaces:**
- Consumes: `SiteSettings` (`src/types/settings.ts`), `normalizeSettings` (`src/utils/socialPlatforms.ts`), `diffSettingsChanges` (`src/utils/changeLogUtils.ts`).
- Produces:
  - `export interface PageContentSettings` in `src/types/settings.ts`
  - `export const DEFAULT_PAGE_CONTENT: PageContentSettings` in `src/utils/pageContentDefaults.ts`
  - `export const PAGE_CONTENT_LABELS: Record<keyof PageContentSettings, string>` in `src/utils/pageContentDefaults.ts`
  - `export function resolvePageContent(pageContent?: Partial<PageContentSettings>, defaults?: PageContentSettings): PageContentSettings` in `src/utils/pageContentDefaults.ts`
  - Updated `normalizeSettings` always populating normalized `pageContent`.

- [ ] **Step 1: Write failing tests in `tests/SettingsContext.test.tsx` and `tests/changeLogUtils.test.ts`**

Append to `tests/SettingsContext.test.tsx` inside `describe('SettingsContext', ...)`:

```typescript
  it('provides default pageContent without UV resin mentions and merges partial legacy localStorage settings', () => {
    const { result: defaultResult } = renderHook(() => useSettings(), { wrapper });
    expect(defaultResult.current.settings.pageContent?.heroTagline).toBe(
      'Hand-Sculpted Polymer Clay with Love'
    );
    expect(defaultResult.current.settings.pageContent?.heroTitle).toBe(
      'Tiny Polymer Clay Friends for Your [Fridge & Keys]{color=pink wavy} ✨'
    );
    expect(defaultResult.current.settings.pageContent?.heroTagline).not.toMatch(/uv resin/i);
    expect(defaultResult.current.settings.pageContent?.footerCareBody).not.toMatch(/uv resin/i);

    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        contactEmail: 'legacy@weebles.com',
        customOrderEmail: 'legacy@weebles.com',
        pageContent: {
          heroTitle: '**Custom** Title',
          catalogSubtitle: '',
        },
      })
    );

    const { result: partialResult } = renderHook(() => useSettings(), { wrapper });
    expect(partialResult.current.settings.pageContent?.heroTitle).toBe('**Custom** Title');
    expect(partialResult.current.settings.pageContent?.catalogSubtitle).toBe('');
    expect(partialResult.current.settings.pageContent?.catalogTitle).toBe('Available Creations 🍓');
  });
```

Append to `tests/changeLogUtils.test.ts` inside `describe('diffSettingsChanges', ...)`:

```typescript
    it('logs field-level changes for pageContent Markdown fields', () => {
      const oldWithCopy: SiteSettings = {
        ...baseSettings,
        pageContent: {
          heroTagline: 'Hand-Sculpted Polymer Clay with Love',
          heroTitle: 'Tiny Polymer Clay Friends for Your [Fridge & Keys]{color=pink wavy} ✨',
          heroSubtitle: 'Original subtitle',
          socialBadge: '✨ Behind the Scenes & Restocks',
          socialTitle: 'Follow the Sculpting Journey!',
          socialSubtitle: 'Watch our clips',
          catalogTitle: 'Available Creations 🍓',
          catalogSubtitle: 'Sculpted by hand.',
          footerCareTitle: '✨ Clay Care Instructions',
          footerCareBody: '- Care line 1',
        },
      };
      const newWithCopy: SiteSettings = {
        ...oldWithCopy,
        pageContent: {
          ...oldWithCopy.pageContent!,
          heroTagline: '**Fresh** Polymer Clay Friends',
          catalogSubtitle: '',
        },
      };

      const entries = diffSettingsChanges(adminEmail, oldWithCopy, newWithCopy, fixedNow);
      expect(entries.map((e) => ({ change: e.change, comment: e.comment }))).toEqual([
        {
          change: 'Site Content - Hero Tagline',
          comment: 'Old: Hand-Sculpted Polymer Clay with Love -> New: **Fresh** Polymer Clay Friends',
        },
        {
          change: 'Site Content - Catalog Subtitle',
          comment: 'Old: Sculpted by hand. -> New: (empty)',
        },
      ]);
    });
```

- [ ] **Step 2: Run targeted tests to verify they fail**

Run: `npx vitest run --exclude ".worktrees/**" tests/SettingsContext.test.tsx tests/changeLogUtils.test.ts`
Expected: FAIL because `pageContent` is not defined on `SiteSettings` / `DEFAULT_SETTINGS` / `diffSettingsChanges`.

- [ ] **Step 3: Add `PageContentSettings` to `src/types/settings.ts` and create `src/utils/pageContentDefaults.ts`**

Update `src/types/settings.ts`:

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

Create `src/utils/pageContentDefaults.ts`:

```typescript
import { PageContentSettings } from '../types/settings';

export const DEFAULT_PAGE_CONTENT: PageContentSettings = {
  heroTagline: 'Hand-Sculpted Polymer Clay with Love',
  heroTitle: 'Tiny Polymer Clay Friends for Your [Fridge & Keys]{color=pink wavy} ✨',
  heroSubtitle:
    'Welcome to the Weeble sanctuary! Each little critter is uniquely sculpted from high-grade polymer clay, hand-painted with pastel details, and baked to a durable finish.',
  socialBadge: '✨ Behind the Scenes & Restocks',
  socialTitle: 'Follow the Sculpting Journey!',
  socialSubtitle:
    'Watch our clay ASMR sculpting clips, packaging videos with cute stickers, and catch live restock alerts!',
  catalogTitle: 'Available Creations 🍓',
  catalogSubtitle: 'Each piece is individually sculpted, baked, and detailed by hand.',
  footerCareTitle: '✨ Clay Care Instructions',
  footerCareBody: [
    '- Durable baked polymer clay finish (do not soak or run through dishwasher).',
    '- Clean gently with a soft microfiber cloth or damp wipe.',
    '- Handle with love! Strong neodymium magnets are embedded securely.',
  ].join('\n'),
};

export const PAGE_CONTENT_LABELS: Record<keyof PageContentSettings, string> = {
  heroTagline: 'Hero Tagline',
  heroTitle: 'Hero Title',
  heroSubtitle: 'Hero Subtitle',
  socialBadge: 'Behind the Scenes Badge',
  socialTitle: 'Behind the Scenes Title',
  socialSubtitle: 'Behind the Scenes Subtitle',
  catalogTitle: 'Catalog Title',
  catalogSubtitle: 'Catalog Subtitle',
  footerCareTitle: 'Footer Clay Care Title',
  footerCareBody: 'Footer Clay Care Instructions',
};

export const PAGE_CONTENT_KEYS = Object.keys(
  DEFAULT_PAGE_CONTENT
) as Array<keyof PageContentSettings>;

export function resolvePageContent(
  pageContent?: Partial<PageContentSettings> | null,
  defaults: PageContentSettings = DEFAULT_PAGE_CONTENT
): PageContentSettings {
  const pick = (key: keyof PageContentSettings): string => {
    const raw = pageContent?.[key];
    if (typeof raw === 'string') return raw;
    const def = defaults?.[key];
    return typeof def === 'string' ? def : DEFAULT_PAGE_CONTENT[key];
  };

  return {
    heroTagline: pick('heroTagline'),
    heroTitle: pick('heroTitle'),
    heroSubtitle: pick('heroSubtitle'),
    socialBadge: pick('socialBadge'),
    socialTitle: pick('socialTitle'),
    socialSubtitle: pick('socialSubtitle'),
    catalogTitle: pick('catalogTitle'),
    catalogSubtitle: pick('catalogSubtitle'),
    footerCareTitle: pick('footerCareTitle'),
    footerCareBody: pick('footerCareBody'),
  };
}
```

- [ ] **Step 4: Seed `pageContent` in `src/data/settings.json` and integrate into `normalizeSettings` & `diffSettingsChanges`**

Add `"pageContent"` to `src/data/settings.json`:

```json
  "pageContent": {
    "heroTagline": "Hand-Sculpted Polymer Clay with Love",
    "heroTitle": "Tiny Polymer Clay Friends for Your [Fridge & Keys]{color=pink wavy} ✨",
    "heroSubtitle": "Welcome to the Weeble sanctuary! Each little critter is uniquely sculpted from high-grade polymer clay, hand-painted with pastel details, and baked to a durable finish.",
    "socialBadge": "✨ Behind the Scenes & Restocks",
    "socialTitle": "Follow the Sculpting Journey!",
    "socialSubtitle": "Watch our clay ASMR sculpting clips, packaging videos with cute stickers, and catch live restock alerts!",
    "catalogTitle": "Available Creations 🍓",
    "catalogSubtitle": "Each piece is individually sculpted, baked, and detailed by hand.",
    "footerCareTitle": "✨ Clay Care Instructions",
    "footerCareBody": "- Durable baked polymer clay finish (do not soak or run through dishwasher).\n- Clean gently with a soft microfiber cloth or damp wipe.\n- Handle with love! Strong neodymium magnets are embedded securely."
  },
```

Update `src/utils/socialPlatforms.ts`:
- Import `DEFAULT_PAGE_CONTENT, resolvePageContent` from `./pageContentDefaults`.
- Inside `normalizeSettings`:

```typescript
  const defaultPageContent = resolvePageContent(defaults.pageContent, DEFAULT_PAGE_CONTENT);
  const pageContent = resolvePageContent(raw?.pageContent, defaultPageContent);

  return {
    ...defaults,
    ...raw,
    socials,
    socialLinksEnabled,
    socialLinks,
    pageContent,
    ...(Array.isArray(raw?.categories) ? { categories: raw.categories } : Array.isArray(defaults.categories) ? { categories: defaults.categories } : {}),
  };
```

Update `src/utils/changeLogUtils.ts`:
- Import `PAGE_CONTENT_KEYS, PAGE_CONTENT_LABELS, resolvePageContent` from `./pageContentDefaults`.
- Inside `diffSettingsChanges`, before the `for (const cmp of comparisons)` loop:

```typescript
  if (oldSettings.pageContent || newSettings.pageContent) {
    const oldContent = resolvePageContent(oldSettings.pageContent);
    const newContent = resolvePageContent(newSettings.pageContent);
    for (const key of PAGE_CONTENT_KEYS) {
      comparisons.push({
        label: `Site Content - ${PAGE_CONTENT_LABELS[key]}`,
        oldVal: oldContent[key] || '(empty)',
        newVal: newContent[key] || '(empty)',
      });
    }
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run --exclude ".worktrees/**" tests/SettingsContext.test.tsx tests/changeLogUtils.test.ts tests/socialPlatforms.test.ts`
Expected: PASS (all tests green).

- [ ] **Step 6: Commit**

```bash
git add src/types/settings.ts src/utils/pageContentDefaults.ts src/data/settings.json src/utils/socialPlatforms.ts src/utils/changeLogUtils.ts tests/SettingsContext.test.tsx tests/changeLogUtils.test.ts
git commit -m "feat(content): add PageContentSettings model, defaults, normalization, and audit diffs"
```

---

### Task 2: Safe Markdown Parser, Content Image Preview Cache & `<RichMarkdown />` Component

**Files:**
- Create: `src/utils/contentImageCache.ts`
- Create: `src/utils/markdownParser.ts`
- Create: `src/components/RichMarkdown.tsx`
- Test: `tests/markdownParser.test.ts`

**Interfaces:**
- Consumes: None (standalone pure utilities + React component).
- Produces:
  - `src/utils/contentImageCache.ts`:
    - `export const CONTENT_IMAGES_STORAGE_KEY = 'weebles_content_images_v1'`
    - `export function cacheContentImagePreview(url: string, dataUrl: string): void`
    - `export function resolveContentImageUrl(src: string): string`
    - `export function getContentImageFallbackUrl(src: string): string | null`
  - `src/utils/markdownParser.ts`:
    - `export const MARKDOWN_THEME_COLORS: Record<string, string>`
    - `export const MARKDOWN_FONT_PRESETS: Record<string, string>`
    - `export type MarkdownInline` & `export type MarkdownBlock`
    - `export function parseMarkdownInline(input: string): MarkdownInline[]`
    - `export function parseMarkdownBlocks(input: string): MarkdownBlock[]`
  - `src/components/RichMarkdown.tsx`:
    - `export interface RichMarkdownProps { content: string; mode?: 'inline' | 'block'; className?: string; }`
    - `export const RichMarkdown: React.FC<RichMarkdownProps>`

- [ ] **Step 1: Write failing tests in `tests/markdownParser.test.ts`**

Create `tests/markdownParser.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { parseMarkdownInline, parseMarkdownBlocks } from '../src/utils/markdownParser';
import { RichMarkdown } from '../src/components/RichMarkdown';
import {
  cacheContentImagePreview,
  CONTENT_IMAGES_STORAGE_KEY,
} from '../src/utils/contentImageCache';

describe('markdownParser & RichMarkdown', () => {
  beforeEach(() => {
    localStorage.removeItem(CONTENT_IMAGES_STORAGE_KEY);
  });

  it('renders bold, italic, bold-italic, and strikethrough inline Markdown', () => {
    const { container } = render(
      <RichMarkdown
        content="Hello **bold**, *italic*, ***both***, and ~~old~~!"
        mode="inline"
      />
    );
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelector('em')?.textContent).toBe('italic');
    expect(container.querySelector('strong em')?.textContent).toBe('both');
    expect(container.querySelector('del')?.textContent).toBe('old');
  });

  it('renders styled shorthand spans with theme colors, hex colors, fonts, sizes, and wavy underline', () => {
    const { container } = render(
      <RichMarkdown
        content="Tiny Friends for [Fridge & Keys]{color=pink wavy} and [**Custom**]{color=#123456 font=bubble size=1.5em}"
        mode="inline"
      />
    );

    const wavy = screen.getByText('Fridge & Keys');
    expect(wavy.tagName).toBe('SPAN');
    expect(wavy).toHaveStyle({ color: '#FF85A1' });
    expect(wavy.className).toContain('decoration-wavy');
    expect(wavy.className).toContain('text-shadow-cute');

    const customStrong = screen.getByText('Custom');
    expect(customStrong.tagName).toBe('STRONG');
    const customSpan = customStrong.parentElement!;
    expect(customSpan).toHaveStyle({
      color: '#123456',
      fontSize: '1.5em',
    });
    expect(customSpan.style.fontFamily).toContain('Fredoka');
    expect(container.textContent).toBe('Tiny Friends for Fridge & Keys and Custom');
  });

  it('renders allowlisted <span style="..."> HTML safely and escapes disallowed tags/styles', () => {
    const { container } = render(
      <RichMarkdown
        content={'<span style="color: #FF85A1; font-family: Georgia, serif; position: fixed">Cute</span> <script>alert(1)</script>'}
        mode="inline"
      />
    );

    const cute = screen.getByText('Cute');
    expect(cute.tagName).toBe('SPAN');
    expect(cute).toHaveStyle({ color: '#FF85A1', fontFamily: 'Georgia, serif' });
    expect(cute.style.position).toBe('');
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('<script>alert(1)</script>');
  });

  it('renders inline PNGs with default 1.2em height and optional =H / =WxH dimensions', () => {
    render(
      <RichMarkdown
        content="Look ![star](/images/content/star.png) and ![big](/images/content/big.png =28) and ![rect](https://example.com/a.png =32x24)"
        mode="inline"
      />
    );

    const star = screen.getByAltText('star') as HTMLImageElement;
    expect(star).toHaveAttribute('src', '/images/content/star.png');
    expect(star.style.height).toBe('1.2em');

    const big = screen.getByAltText('big') as HTMLImageElement;
    expect(big.style.height).toBe('28px');

    const rect = screen.getByAltText('rect') as HTMLImageElement;
    expect(rect.style.width).toBe('32px');
    expect(rect.style.height).toBe('24px');
  });

  it('uses local preview cache for /images/content/ PNGs and falls back to Netlify function on load error', () => {
    cacheContentImagePreview('/images/content/cached.png', 'data:image/png;base64,AAAA');
    render(
      <RichMarkdown
        content="![cached](/images/content/cached.png) ![remote](/images/content/remote.png)"
        mode="inline"
      />
    );

    expect(screen.getByAltText('cached')).toHaveAttribute('src', 'data:image/png;base64,AAAA');

    const remote = screen.getByAltText('remote') as HTMLImageElement;
    expect(remote).toHaveAttribute('src', '/images/content/remote.png');
    fireEvent.error(remote);
    expect(remote).toHaveAttribute(
      'src',
      '/.netlify/functions/admin-save?action=content-image&name=remote.png'
    );
  });

  it('blocks unsafe link protocols and SVG/javascript image sources', () => {
    const { container } = render(
      <RichMarkdown
        content="[bad](javascript:alert(1)) [ok](https://example.com) ![svg](data:image/svg+xml;base64,PHN2Zz4=)"
        mode="inline"
      />
    );

    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', 'https://example.com');
    expect(links[0]).toHaveAttribute('target', '_blank');
    expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer');
    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect(container.textContent).toContain('[bad](javascript:alert(1))');
  });

  it('renders bullet lists and paragraphs in block mode', () => {
    const { container } = render(
      <RichMarkdown
        content={'- First **tip**\n- Second *tip*\n- Third tip'}
        mode="block"
      />
    );

    const items = container.querySelectorAll('ul > li');
    expect(items).toHaveLength(3);
    expect(items[0].querySelector('strong')?.textContent).toBe('tip');
    expect(items[1].querySelector('em')?.textContent).toBe('tip');
  });

  it('degrades malformed and unclosed syntax cleanly without throwing', () => {
    const nodes = parseMarkdownInline('Unclosed **bold and [bracket{color=pink and <span style="color:red">no close');
    expect(nodes.length).toBeGreaterThan(0);

    const blocks = parseMarkdownBlocks('');
    expect(blocks).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --exclude ".worktrees/**" tests/markdownParser.test.ts`
Expected: FAIL because `markdownParser.ts`, `contentImageCache.ts`, and `RichMarkdown.tsx` do not exist.

- [ ] **Step 3: Create `src/utils/contentImageCache.ts`**

```typescript
export const CONTENT_IMAGES_STORAGE_KEY = 'weebles_content_images_v1';
const CONTENT_IMAGE_PREFIX = '/images/content/';
const SAFE_FILENAME_RE = /^[a-zA-Z0-9._-]+\.(png|jpe?g|webp|gif)$/i;

const memoryCache = new Map<string, string>();

function readStoredMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CONTENT_IMAGES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function cacheContentImagePreview(url: string, dataUrl: string): void {
  if (!url || !dataUrl) return;
  memoryCache.set(url, dataUrl);
  try {
    const existing = readStoredMap();
    existing[url] = dataUrl;
    localStorage.setItem(CONTENT_IMAGES_STORAGE_KEY, JSON.stringify(existing));
  } catch {
    // Ignore localStorage quota errors; memoryCache still provides instant preview
  }
}

export function resolveContentImageUrl(src: string): string {
  if (!src.startsWith(CONTENT_IMAGE_PREFIX)) return src;
  const fromMemory = memoryCache.get(src);
  if (fromMemory) return fromMemory;
  const stored = readStoredMap();
  if (typeof stored[src] === 'string' && stored[src].startsWith('data:image/')) {
    memoryCache.set(src, stored[src]);
    return stored[src];
  }
  return src;
}

export function getContentImageFallbackUrl(src: string): string | null {
  if (!src.startsWith(CONTENT_IMAGE_PREFIX)) return null;
  const filename = src.slice(CONTENT_IMAGE_PREFIX.length);
  if (!SAFE_FILENAME_RE.test(filename)) return null;
  return `/.netlify/functions/admin-save?action=content-image&name=${encodeURIComponent(filename)}`;
}
```

- [ ] **Step 4: Create `src/utils/markdownParser.ts`**

```typescript
export interface SpanStyleProps {
  color?: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
  wavy?: boolean;
  underline?: boolean;
}

export type MarkdownInline =
  | { type: 'text'; value: string }
  | { type: 'break' }
  | { type: 'strong'; children: MarkdownInline[] }
  | { type: 'em'; children: MarkdownInline[] }
  | { type: 'del'; children: MarkdownInline[] }
  | { type: 'link'; href: string; external: boolean; children: MarkdownInline[] }
  | { type: 'image'; alt: string; src: string; width?: number; height?: number }
  | { type: 'span'; style: SpanStyleProps; children: MarkdownInline[] };

export type MarkdownBlock =
  | { type: 'paragraph'; children: MarkdownInline[] }
  | { type: 'list'; items: MarkdownInline[][] };

export const MARKDOWN_THEME_COLORS: Record<string, string> = {
  pink: '#FF85A1',
  pinklight: '#FFB3C6',
  text: '#4A2E35',
  textmuted: '#7A5C61',
  blue: '#38BDF8',
  yellow: '#EAB308',
  mint: '#34D399',
  lilac: '#A78BFA',
  rose: '#F43F5E',
  white: '#FFFFFF',
};

export const MARKDOWN_FONT_PRESETS: Record<string, string> = {
  bubble: '"Fredoka", cursive, sans-serif',
  body: '"Quicksand", sans-serif',
  serif: 'Georgia, serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};

const SIZE_PRESETS: Record<string, string> = {
  xs: '0.75rem',
  sm: '0.875rem',
  base: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
};

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const RGB_COLOR_RE = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i;
const SAFE_FONT_RE = /^[a-zA-Z0-9\s,'"-]{1,60}$/;
const SAFE_SIZE_PX_RE = /^(\d{1,2}(?:\.\d+)?)px$/i;
const SAFE_SIZE_EM_RE = /^(\d(?:\.\d+)?)(em|rem)$/i;
const RASTER_DATA_URL_RE = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i;

function sanitizeColor(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const preset = MARKDOWN_THEME_COLORS[trimmed.toLowerCase()];
  if (preset) return preset;
  if (HEX_COLOR_RE.test(trimmed)) return trimmed;
  const rgbMatch = trimmed.match(RGB_COLOR_RE);
  if (rgbMatch) {
    const [r, g, b] = [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])];
    if (r <= 255 && g <= 255 && b <= 255) {
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  return undefined;
}

function sanitizeFont(raw: string): string | undefined {
  const trimmed = raw.trim().replace(/^['"]|['"]$/g, '').trim();
  if (!trimmed) return undefined;
  const preset = MARKDOWN_FONT_PRESETS[trimmed.toLowerCase()];
  if (preset) return preset;
  if (SAFE_FONT_RE.test(trimmed)) return trimmed;
  return undefined;
}

function sanitizeSize(raw: string): string | undefined {
  const trimmed = raw.trim().toLowerCase();
  if (SIZE_PRESETS[trimmed]) return SIZE_PRESETS[trimmed];
  const pxMatch = trimmed.match(SAFE_SIZE_PX_RE);
  if (pxMatch) {
    const val = Number(pxMatch[1]);
    if (val >= 8 && val <= 96) return `${val}px`;
  }
  const emMatch = trimmed.match(SAFE_SIZE_EM_RE);
  if (emMatch) {
    const val = Number(emMatch[1]);
    if (val >= 0.5 && val <= 4) return `${val}${emMatch[2]}`;
  }
  return undefined;
}

function sanitizeHref(raw: string): { href: string; external: boolean } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return { href: trimmed, external: false };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return { href: trimmed, external: true };
    }
    if (parsed.protocol === 'mailto:') {
      return { href: trimmed, external: false };
    }
  } catch {
    return null;
  }
  return null;
}

function sanitizeImageSrc(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }
  if (RASTER_DATA_URL_RE.test(trimmed)) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return trimmed;
    }
  } catch {
    return null;
  }
  return null;
}

function clampDim(val: number): number {
  return Math.max(8, Math.min(256, Math.round(val)));
}

function parseImageSpec(rawInsideParens: string): { src: string; width?: number; height?: number } | null {
  const trimmed = rawInsideParens.trim();
  if (!trimmed) return null;

  let srcPart = trimmed;
  let width: number | undefined;
  let height: number | undefined;

  const sizeMatch = trimmed.match(/\s+=(\d+)(?:x(\d+))?$/i);
  if (sizeMatch) {
    srcPart = trimmed.slice(0, sizeMatch.index).trim();
    if (sizeMatch[2]) {
      width = clampDim(Number(sizeMatch[1]));
      height = clampDim(Number(sizeMatch[2]));
    } else {
      height = clampDim(Number(sizeMatch[1]));
    }
  }

  const safeSrc = sanitizeImageSrc(srcPart);
  if (!safeSrc) return null;
  return { src: safeSrc, ...(width ? { width } : {}), ...(height ? { height } : {}) };
}

function parseShorthandAttrs(attrStr: string): SpanStyleProps {
  const style: SpanStyleProps = {};
  const tokenRe = /([a-zA-Z]+)=("[^"]*"|'[^']*'|\S+)|\b([a-zA-Z]+)\b/g;
  let match: RegExpExecArray | null;

  while ((match = tokenRe.exec(attrStr)) !== null) {
    if (match[1] && match[2]) {
      const key = match[1].toLowerCase();
      const rawVal = match[2].replace(/^['"]|['"]$/g, '');
      if (key === 'color') {
        const c = sanitizeColor(rawVal);
        if (c) style.color = c;
      } else if (key === 'font') {
        const f = sanitizeFont(rawVal);
        if (f) style.fontFamily = f;
      } else if (key === 'size') {
        const s = sanitizeSize(rawVal);
        if (s) style.fontSize = s;
      }
    } else if (match[3]) {
      const flag = match[3].toLowerCase();
      if (flag === 'wavy') style.wavy = true;
      if (flag === 'underline') style.underline = true;
    }
  }

  return style;
}

function parseInlineCssStyle(cssText: string): SpanStyleProps {
  const style: SpanStyleProps = {};
  const decls = cssText.split(';');
  for (const decl of decls) {
    const colonIdx = decl.indexOf(':');
    if (colonIdx === -1) continue;
    const prop = decl.slice(0, colonIdx).trim().toLowerCase();
    const val = decl.slice(colonIdx + 1).trim();
    if (!val) continue;

    if (prop === 'color') {
      const c = sanitizeColor(val);
      if (c) style.color = c;
    } else if (prop === 'font-family') {
      const f = sanitizeFont(val);
      if (f) style.fontFamily = f;
    } else if (prop === 'font-size') {
      const s = sanitizeSize(val);
      if (s) style.fontSize = s;
    } else if (prop === 'font-weight') {
      if (/^(normal|bold|[1-9]00)$/i.test(val)) style.fontWeight = val.toLowerCase();
    } else if (prop === 'font-style') {
      if (/^(normal|italic)$/i.test(val)) style.fontStyle = val.toLowerCase();
    } else if (prop === 'text-decoration') {
      if (/^(none|underline|line-through|underline wavy)$/i.test(val)) {
        style.textDecoration = val.toLowerCase();
      }
    }
  }
  return style;
}

function findMatchingBracket(input: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < input.length; i++) {
    if (input[i] === '\\' && i + 1 < input.length) {
      i++;
      continue;
    }
    if (input[i] === '[') depth++;
    else if (input[i] === ']') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findMatchingSpanClose(input: string, startIdx: number): number {
  let depth = 1;
  const tagRe = /<span(?:\s[^>]*)?>|<\/span>/gi;
  tagRe.lastIndex = startIdx;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(input)) !== null) {
    if (m[0].toLowerCase().startsWith('</span')) {
      depth--;
      if (depth === 0) return m.index;
    } else {
      depth++;
    }
  }
  return -1;
}

function pushText(nodes: MarkdownInline[], text: string) {
  if (!text) return;
  const last = nodes[nodes.length - 1];
  if (last && last.type === 'text') {
    last.value += text;
  } else {
    nodes.push({ type: 'text', value: text });
  }
}

export function parseMarkdownInline(input: string, depth: number = 0): MarkdownInline[] {
  if (!input) return [];
  if (depth > 8) return [{ type: 'text', value: input }];

  const nodes: MarkdownInline[] = [];
  let i = 0;

  while (i < input.length) {
    // Escaped character
    if (input[i] === '\\' && i + 1 < input.length && /[*~[\]{}()<>\\!]/.test(input[i + 1])) {
      pushText(nodes, input[i + 1]);
      i += 2;
      continue;
    }

    // Line break
    if (input[i] === '\n') {
      nodes.push({ type: 'break' });
      i += 1;
      continue;
    }

    // Inline image: ![alt](src [=size])
    if (input[i] === '!' && input[i + 1] === '[') {
      const closeBracket = input.indexOf(']', i + 2);
      if (closeBracket !== -1 && input[closeBracket + 1] === '(') {
        const closeParen = input.indexOf(')', closeBracket + 2);
        if (closeParen !== -1) {
          const alt = input.slice(i + 2, closeBracket);
          const rawSpec = input.slice(closeBracket + 2, closeParen);
          const parsedImg = parseImageSpec(rawSpec);
          if (parsedImg) {
            nodes.push({
              type: 'image',
              alt,
              src: parsedImg.src,
              ...(parsedImg.width ? { width: parsedImg.width } : {}),
              ...(parsedImg.height ? { height: parsedImg.height } : {}),
            });
            i = closeParen + 1;
            continue;
          }
          pushText(nodes, input.slice(i, closeParen + 1));
          i = closeParen + 1;
          continue;
        }
      }
    }

    // Styled shorthand [content]{attrs} OR link [content](href)
    if (input[i] === '[') {
      const closeBracket = findMatchingBracket(input, i);
      if (closeBracket !== -1) {
        const inner = input.slice(i + 1, closeBracket);
        const nextChar = input[closeBracket + 1];

        if (nextChar === '{') {
          const closeBrace = input.indexOf('}', closeBracket + 2);
          if (closeBrace !== -1) {
            const attrStr = input.slice(closeBracket + 2, closeBrace);
            const style = parseShorthandAttrs(attrStr);
            nodes.push({
              type: 'span',
              style,
              children: parseMarkdownInline(inner, depth + 1),
            });
            i = closeBrace + 1;
            continue;
          }
        } else if (nextChar === '(') {
          const closeParen = input.indexOf(')', closeBracket + 2);
          if (closeParen !== -1) {
            const rawHref = input.slice(closeBracket + 2, closeParen);
            const safeLink = sanitizeHref(rawHref);
            if (safeLink) {
              nodes.push({
                type: 'link',
                href: safeLink.href,
                external: safeLink.external,
                children: parseMarkdownInline(inner, depth + 1),
              });
            } else {
              pushText(nodes, input.slice(i, closeParen + 1));
            }
            i = closeParen + 1;
            continue;
          }
        }
      }
    }

    // Safe HTML <span style="...">...</span>
    if (input[i] === '<' && input.slice(i).toLowerCase().startsWith('<span')) {
      const openTagMatch = input.slice(i).match(/^<span(?:\s+style=(?:"([^"]*)"|'([^']*)'))?\s*>/i);
      if (openTagMatch) {
        const afterOpen = i + openTagMatch[0].length;
        const closeIdx = findMatchingSpanClose(input, afterOpen);
        if (closeIdx !== -1) {
          const cssText = openTagMatch[1] ?? openTagMatch[2] ?? '';
          const inner = input.slice(afterOpen, closeIdx);
          nodes.push({
            type: 'span',
            style: parseInlineCssStyle(cssText),
            children: parseMarkdownInline(inner, depth + 1),
          });
          i = closeIdx + '</span>'.length;
          continue;
        }
      }
    }

    // ***bold italic***
    if (input.startsWith('***', i)) {
      const closeIdx = input.indexOf('***', i + 3);
      if (closeIdx !== -1 && closeIdx > i + 3) {
        nodes.push({
          type: 'strong',
          children: [
            {
              type: 'em',
              children: parseMarkdownInline(input.slice(i + 3, closeIdx), depth + 1),
            },
          ],
        });
        i = closeIdx + 3;
        continue;
      }
    }

    // **bold**
    if (input.startsWith('**', i)) {
      const closeIdx = input.indexOf('**', i + 2);
      if (closeIdx !== -1 && closeIdx > i + 2) {
        nodes.push({
          type: 'strong',
          children: parseMarkdownInline(input.slice(i + 2, closeIdx), depth + 1),
        });
        i = closeIdx + 2;
        continue;
      }
    }

    // ~~strikethrough~~
    if (input.startsWith('~~', i)) {
      const closeIdx = input.indexOf('~~', i + 2);
      if (closeIdx !== -1 && closeIdx > i + 2) {
        nodes.push({
          type: 'del',
          children: parseMarkdownInline(input.slice(i + 2, closeIdx), depth + 1),
        });
        i = closeIdx + 2;
        continue;
      }
    }

    // *italic*
    if (input[i] === '*' && input[i + 1] !== '*') {
      const closeIdx = input.indexOf('*', i + 1);
      if (closeIdx !== -1 && closeIdx > i + 1) {
        nodes.push({
          type: 'em',
          children: parseMarkdownInline(input.slice(i + 1, closeIdx), depth + 1),
        });
        i = closeIdx + 1;
        continue;
      }
    }

    pushText(nodes, input[i]);
    i += 1;
  }

  return nodes;
}

export function parseMarkdownBlocks(input: string): MarkdownBlock[] {
  const normalized = input.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const lines = normalized.split('\n');
  const blocks: MarkdownBlock[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length > 0) {
      blocks.push({
        type: 'paragraph',
        children: parseMarkdownInline(paragraphLines.join('\n')),
      });
      paragraphLines = [];
    }
  };

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push({
        type: 'list',
        items: listItems.map((item) => parseMarkdownInline(item)),
      });
      listItems = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const bulletMatch = line.match(/^\s*[-*]\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      listItems.push(bulletMatch[1]);
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();

  return blocks;
}
```

- [ ] **Step 5: Create `src/components/RichMarkdown.tsx`**

```typescript
import React from 'react';
import {
  MarkdownInline,
  parseMarkdownBlocks,
  parseMarkdownInline,
} from '../utils/markdownParser';
import {
  getContentImageFallbackUrl,
  resolveContentImageUrl,
} from '../utils/contentImageCache';

export interface RichMarkdownProps {
  content: string;
  mode?: 'inline' | 'block';
  className?: string;
}

const InlineMarkdownImage: React.FC<{
  alt: string;
  src: string;
  width?: number;
  height?: number;
}> = ({ alt, src, width, height }) => {
  const resolvedSrc = resolveContentImageUrl(src);
  const fallbackUrl = getContentImageFallbackUrl(src);

  const imgStyle: React.CSSProperties =
    width && height
      ? { width: `${width}px`, height: `${height}px` }
      : height
        ? { height: `${height}px`, width: 'auto' }
        : { height: '1.2em', width: 'auto' };

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      style={imgStyle}
      className="inline-block align-middle object-contain mx-0.5"
      onError={(e) => {
        const target = e.currentTarget;
        if (fallbackUrl && target.dataset.fallbackApplied !== 'true') {
          target.dataset.fallbackApplied = 'true';
          target.src = fallbackUrl;
        }
      }}
    />
  );
};

function renderInlineNodes(nodes: MarkdownInline[], keyPrefix: string): React.ReactNode[] {
  return nodes.map((node, idx) => {
    const key = `${keyPrefix}-${idx}`;
    switch (node.type) {
      case 'text':
        return <React.Fragment key={key}>{node.value}</React.Fragment>;
      case 'break':
        return <br key={key} />;
      case 'strong':
        return <strong key={key}>{renderInlineNodes(node.children, key)}</strong>;
      case 'em':
        return <em key={key}>{renderInlineNodes(node.children, key)}</em>;
      case 'del':
        return <del key={key}>{renderInlineNodes(node.children, key)}</del>;
      case 'link':
        return (
          <a
            key={key}
            href={node.href}
            className="underline hover:opacity-80 transition-opacity"
            {...(node.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {renderInlineNodes(node.children, key)}
          </a>
        );
      case 'image':
        return (
          <InlineMarkdownImage
            key={key}
            alt={node.alt}
            src={node.src}
            width={node.width}
            height={node.height}
          />
        );
      case 'span': {
        const inlineStyle: React.CSSProperties = {};
        if (node.style.color) inlineStyle.color = node.style.color;
        if (node.style.fontFamily) inlineStyle.fontFamily = node.style.fontFamily;
        if (node.style.fontSize) inlineStyle.fontSize = node.style.fontSize;
        if (node.style.fontWeight) inlineStyle.fontWeight = node.style.fontWeight;
        if (node.style.fontStyle) inlineStyle.fontStyle = node.style.fontStyle;
        if (node.style.textDecoration) inlineStyle.textDecoration = node.style.textDecoration;

        const classes: string[] = [];
        if (node.style.wavy) {
          classes.push('underline', 'decoration-pink-300', 'decoration-wavy', 'text-shadow-cute');
        } else if (node.style.underline) {
          classes.push('underline');
        }

        return (
          <span
            key={key}
            style={Object.keys(inlineStyle).length > 0 ? inlineStyle : undefined}
            className={classes.length > 0 ? classes.join(' ') : undefined}
          >
            {renderInlineNodes(node.children, key)}
          </span>
        );
      }
    }
  });
}

export const RichMarkdown: React.FC<RichMarkdownProps> = ({
  content,
  mode = 'inline',
  className,
}) => {
  if (!content) return null;

  if (mode === 'inline') {
    const nodes = parseMarkdownInline(content.replace(/\r\n/g, '\n'));
    return className ? (
      <span className={className}>{renderInlineNodes(nodes, 'in')}</span>
    ) : (
      <>{renderInlineNodes(nodes, 'in')}</>
    );
  }

  const blocks = parseMarkdownBlocks(content);
  if (blocks.length === 0) return null;

  return (
    <div className={className}>
      {blocks.map((block, bIdx) => {
        if (block.type === 'list') {
          return (
            <ul key={`blk-${bIdx}`} className="space-y-1.5 list-none">
              {block.items.map((itemNodes, iIdx) => (
                <li key={`blk-${bIdx}-li-${iIdx}`}>
                  • {renderInlineNodes(itemNodes, `blk-${bIdx}-li-${iIdx}`)}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={`blk-${bIdx}`}>{renderInlineNodes(block.children, `blk-${bIdx}-p`)}</p>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run --exclude ".worktrees/**" tests/markdownParser.test.ts`
Expected: PASS (all 8 tests green).

- [ ] **Step 7: Commit**

```bash
git add src/utils/contentImageCache.ts src/utils/markdownParser.ts src/components/RichMarkdown.tsx tests/markdownParser.test.ts
git commit -m "feat(markdown): add zero-dependency safe Markdown parser and RichMarkdown renderer"
```

---

### Task 3: Wire Storefront Components (`HeroBanner`, `SocialStrip`, `CatalogGrid`, `Footer`)

**Files:**
- Modify: `src/components/HeroBanner.tsx:1-58`
- Modify: `src/components/SocialStrip.tsx:18-45`
- Modify: `src/components/CatalogGrid.tsx:31-70`
- Modify: `src/components/Footer.tsx:7-38`
- Create: `tests/HeroBanner.test.tsx`
- Modify: `tests/SocialStrip.test.tsx`
- Modify: `tests/CatalogGrid.test.tsx`
- Modify: `tests/Footer.test.tsx`

**Interfaces:**
- Consumes: `useSettings` (`src/context/SettingsContext.tsx`), `resolvePageContent` (`src/utils/pageContentDefaults.ts`), `RichMarkdown` (`src/components/RichMarkdown.tsx`).
- Produces: Storefront components reading `settings.pageContent` and rendering all 10 configurable Markdown fields.

- [ ] **Step 1: Write failing tests in `tests/HeroBanner.test.tsx`, `tests/SocialStrip.test.tsx`, `tests/CatalogGrid.test.tsx`, and `tests/Footer.test.tsx`**

Create `tests/HeroBanner.test.tsx`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeroBanner } from '../src/components/HeroBanner';
import {
  SettingsProvider,
  SETTINGS_STORAGE_KEY,
  DEFAULT_SETTINGS,
} from '../src/context/SettingsContext';
import { SiteSettings } from '../src/types/settings';

const renderHero = (override?: Partial<SiteSettings>) => {
  if (override) {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_SETTINGS, ...override })
    );
  }
  return render(
    <SettingsProvider>
      <HeroBanner onExploreClick={vi.fn()} onCustomClick={vi.fn()} />
    </SettingsProvider>
  );
};

describe('HeroBanner', () => {
  beforeEach(() => {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
  });

  it('renders default Markdown hero copy without UV resin and with pink wavy Fridge & Keys', () => {
    const { container } = renderHero();

    expect(screen.getByText(/Hand-Sculpted Polymer Clay with Love/i)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/uv resin/i);
    expect(container.textContent).not.toMatch(/sculpey|sculpty/i);

    const wavyPhrase = screen.getByText('Fridge & Keys');
    expect(wavyPhrase).toHaveStyle({ color: '#FF85A1' });
    expect(wavyPhrase.className).toContain('decoration-wavy');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('✨');
  });

  it('renders custom Markdown tagline, title, and subtitle with inline PNGs and styles', () => {
    renderHero({
      pageContent: {
        ...DEFAULT_SETTINGS.pageContent!,
        heroTagline: '**New** Studio Drop ![star](/images/content/star.png)',
        heroTitle: 'Meet Our [Mini Critters]{color=#7C3AED font=serif}',
        heroSubtitle: 'Handcrafted *daily* in small batches.',
      },
    });

    expect(screen.getByText('New').tagName).toBe('STRONG');
    expect(screen.getByAltText('star')).toHaveAttribute('src', '/images/content/star.png');
    expect(screen.getByText('Mini Critters')).toHaveStyle({ color: '#7C3AED' });
    expect(screen.getByText('daily').tagName).toBe('EM');
  });
});
```

Add to `tests/SocialStrip.test.tsx`:

```typescript
  it('renders custom Markdown badge, title, and subtitle from pageContent settings', () => {
    renderWithSettings({
      pageContent: {
        ...DEFAULT_SETTINGS.pageContent!,
        socialBadge: '**Live** Restocks ![sparkle](/images/content/sparkle.png)',
        socialTitle: 'Join Our [Clay Club]{color=pink}',
        socialSubtitle: 'Watch *weekly* drops!',
      },
    });

    expect(screen.getByText('Live').tagName).toBe('STRONG');
    expect(screen.getByAltText('sparkle')).toHaveAttribute('src', '/images/content/sparkle.png');
    expect(screen.getByText('Clay Club')).toHaveStyle({ color: '#FF85A1' });
    expect(screen.getByText('weekly').tagName).toBe('EM');
  });
```

Add to `tests/CatalogGrid.test.tsx`:

```typescript
  it('renders custom Markdown catalog title and subtitle from SettingsContext', () => {
    localStorage.setItem(
      'weebles_settings_v1',
      JSON.stringify({
        contactEmail: 'weeblesclay@gmail.com',
        customOrderEmail: 'weeblesclay@gmail.com',
        pageContent: {
          catalogTitle: '[Fresh Drops]{color=pink} ![berry](/images/content/berry.png)',
          catalogSubtitle: 'Sculpted with **care**!',
        },
      })
    );

    renderCatalog(sampleProducts);
    expect(screen.getByText('Fresh Drops')).toHaveStyle({ color: '#FF85A1' });
    expect(screen.getByAltText('berry')).toHaveAttribute('src', '/images/content/berry.png');
    expect(screen.getByText('care').tagName).toBe('STRONG');
  });
```

Add to `tests/Footer.test.tsx`:

```typescript
  it('renders default Clay Care instructions without UV resin and supports custom Markdown overrides', () => {
    const { container, unmount } = renderFooter();
    expect(screen.getByText(/Clay Care Instructions/i)).toBeInTheDocument();
    expect(container.textContent).toContain('Durable baked polymer clay finish');
    expect(container.textContent).not.toMatch(/uv resin/i);
    unmount();

    renderFooter({
      pageContent: {
        ...DEFAULT_SETTINGS.pageContent!,
        footerCareTitle: '**Care** Guide ![heart](/images/content/heart.png)',
        footerCareBody: '- Keep *dry*\n- Wipe gently',
      },
    });

    expect(screen.getByText('Care').tagName).toBe('STRONG');
    expect(screen.getByAltText('heart')).toHaveAttribute('src', '/images/content/heart.png');
    expect(screen.getByText('dry').tagName).toBe('EM');
    expect(screen.getByText(/Wipe gently/i)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run targeted tests to verify they fail**

Run: `npx vitest run --exclude ".worktrees/**" tests/HeroBanner.test.tsx tests/SocialStrip.test.tsx tests/CatalogGrid.test.tsx tests/Footer.test.tsx`
Expected: FAIL because components still use hardcoded copy.

- [ ] **Step 3: Update `HeroBanner.tsx`, `SocialStrip.tsx`, `CatalogGrid.tsx`, and `Footer.tsx`**

In `src/components/HeroBanner.tsx`:
- Import `useSettings` from `../context/SettingsContext`, `resolvePageContent` from `../utils/pageContentDefaults`, and `RichMarkdown` from `./RichMarkdown`.
- Inside `HeroBanner`:
  ```tsx
  const { settings } = useSettings();
  const content = resolvePageContent(settings.pageContent);
  ```
- Replace pill badge `<span>`:
  ```tsx
  <span>
    <RichMarkdown content={content.heroTagline} mode="inline" />
  </span>
  ```
- Replace `<h1>`:
  ```tsx
  <h1 className="font-bubble text-4xl sm:text-6xl lg:text-7xl font-bold text-weeble-text leading-tight mb-6">
    <RichMarkdown content={content.heroTitle} mode="inline" />
  </h1>
  ```
- Replace `<p>` subtitle (rendered when `content.heroSubtitle.trim()`):
  ```tsx
  {content.heroSubtitle.trim() && (
    <p className="max-w-2xl mx-auto text-weeble-textMuted text-base sm:text-lg font-medium mb-8 leading-relaxed">
      <RichMarkdown content={content.heroSubtitle} mode="inline" />
    </p>
  )}
  ```

In `src/components/SocialStrip.tsx`:
- Import `resolvePageContent` from `../utils/pageContentDefaults` and `RichMarkdown` from `./RichMarkdown`.
- Inside `SocialStrip`: `const content = resolvePageContent(settings.pageContent);`
- Replace header block:
  ```tsx
  <div className="text-center max-w-2xl mx-auto mb-6">
    {content.socialBadge.trim() && (
      <span className="inline-block text-xs font-bold text-pink-600 bg-white px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
        <RichMarkdown content={content.socialBadge} mode="inline" />
      </span>
    )}
    <h2 className="font-bubble text-2xl sm:text-3xl font-bold text-weeble-text mt-2 mb-1">
      <RichMarkdown content={content.socialTitle} mode="inline" />
    </h2>
    {content.socialSubtitle.trim() && (
      <p className="text-xs sm:text-sm text-weeble-textMuted">
        <RichMarkdown content={content.socialSubtitle} mode="inline" />
      </p>
    )}
  </div>
  ```

In `src/components/CatalogGrid.tsx`:
- Import `resolvePageContent` from `../utils/pageContentDefaults` and `RichMarkdown` from `./RichMarkdown`.
- Inside `CatalogGrid`: `const content = resolvePageContent(settings.pageContent);`
- Replace catalog header block (normal inline flow on `<h2>` so bold/colored spans and PNGs wrap naturally):
  ```tsx
  <div>
    <h2 className="font-bubble text-3xl sm:text-4xl font-bold text-weeble-text mb-1">
      <RichMarkdown content={content.catalogTitle} mode="inline" />
    </h2>
    {content.catalogSubtitle.trim() && (
      <p className="text-sm text-weeble-textMuted">
        <RichMarkdown content={content.catalogSubtitle} mode="inline" />
      </p>
    )}
  </div>
  ```

In `src/components/Footer.tsx`:
- Import `resolvePageContent` from `../utils/pageContentDefaults` and `RichMarkdown` from `./RichMarkdown`.
- Inside `Footer`: `const content = resolvePageContent(settings?.pageContent);`
- Replace Clay Care block:
  ```tsx
  <div className="bg-weeble-pinkBg p-5 rounded-3xl border border-pink-100">
    <h3 className="font-bubble text-lg font-bold text-weeble-text mb-2">
      <RichMarkdown content={content.footerCareTitle} mode="inline" />
    </h3>
    <RichMarkdown
      content={content.footerCareBody}
      mode="block"
      className="text-xs text-weeble-textMuted space-y-1.5"
    />
  </div>
  ```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run --exclude ".worktrees/**" tests/HeroBanner.test.tsx tests/SocialStrip.test.tsx tests/CatalogGrid.test.tsx tests/Footer.test.tsx tests/smoke.test.ts`
Expected: PASS (all storefront + smoke tests green).

- [ ] **Step 5: Commit**

```bash
git add src/components/HeroBanner.tsx src/components/SocialStrip.tsx src/components/CatalogGrid.tsx src/components/Footer.tsx tests/HeroBanner.test.tsx tests/SocialStrip.test.tsx tests/CatalogGrid.test.tsx tests/Footer.test.tsx
git commit -m "feat(storefront): render hero, social strip, catalog, and footer care via configurable Markdown"
```

---

### Task 4: Backend & Client Inline PNG Upload/Serve Pipeline

**Files:**
- Modify: `netlify/functions/admin-save.ts:285-404`
- Modify: `src/services/adminApi.ts:1-162`
- Test: `tests/adminApi.test.ts`

**Interfaces:**
- Consumes: `cacheContentImagePreview` (`src/utils/contentImageCache.ts`), existing `saveToNetlifyBlobs`, `readFromNetlifyBlobs`, `commitToGitHub`, `verifyToken` in `netlify/functions/admin-save.ts`.
- Produces:
  - `POST /.netlify/functions/admin-save` with `{ type: 'content-image', contentImage: { filename, base64Data } }` returning `{ success: true, url: '/images/content/<cleanFilename>', filename: '<cleanFilename>', message: string }`.
  - `GET /.netlify/functions/admin-save?action=content-image&name=<cleanFilename>` returning binary base64 image with `Content-Type` and `Cache-Control`.
  - `adminApi.uploadContentImage(filename: string, base64Data: string): Promise<{ success: boolean; url: string; filename: string; message: string }>` in `src/services/adminApi.ts`.

- [ ] **Step 1: Write failing tests in `tests/adminApi.test.ts`**

Add tests covering:
1. `adminApi.uploadContentImage` sends `POST` with `type: 'content-image'`, returns `{ success, url, filename, message }`, and caches the preview in `localStorage`.
2. `admin-save` `POST type: 'content-image'` saves a valid PNG (with GitHub mock and in local dev mode), returning `/images/content/...`.
3. `admin-save` `POST type: 'content-image'` rejects `.svg` extension with HTTP `400` and rejects payloads exceeding 2 MB with HTTP `413`.
4. `admin-save` `GET ?action=content-image&name=...` serves stored image with `image/png` `Content-Type` and rejects invalid/traversal names (`../secret.png`, `evil.svg`) with HTTP `400`.
5. `admin-save` `POST type: 'settings'` preserves existing `pageContent` if omitted from payload.

```typescript
  it('adminApi.uploadContentImage posts content-image payload and caches local preview', async () => {
    adminAuth.saveSession({ email: 'lucasshawn@gmail.com', token: 'tok-123', expiresAt: Date.now() + 60000 });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          url: '/images/content/star.png',
          filename: 'star.png',
          message: 'Image uploaded!',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const res = await adminApi.uploadContentImage('star.png', 'data:image/png;base64,iVBORw0KGgo=');
    expect(res.url).toBe('/images/content/star.png');
    expect(fetchSpy).toHaveBeenCalledWith(
      '/.netlify/functions/admin-save',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"type":"content-image"'),
      })
    );
    expect(localStorage.getItem('weebles_content_images_v1')).toContain('/images/content/star.png');
  });
```

And in the `admin-save Netlify Function` describe block:

```typescript
  it('uploads valid PNG via type=content-image and rejects SVG or >2MB payloads', async () => {
    const tinyPngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

    const svgRes = await handler(
      {
        httpMethod: 'POST',
        headers: { authorization: `Bearer ${validToken}` },
        body: JSON.stringify({
          type: 'content-image',
          contentImage: { filename: 'bad.svg', base64Data: 'data:image/svg+xml;base64,PHN2Zz4=' },
        }),
      } as any,
      {} as any
    ) as any;
    expect(svgRes.statusCode).toBe(400);

    const bigBase64 = 'A'.repeat(3 * 1024 * 1024);
    const bigRes = await handler(
      {
        httpMethod: 'POST',
        headers: { authorization: `Bearer ${validToken}` },
        body: JSON.stringify({
          type: 'content-image',
          contentImage: { filename: 'huge.png', base64Data: `data:image/png;base64,${bigBase64}` },
        }),
      } as any,
      {} as any
    ) as any;
    expect(bigRes.statusCode).toBe(413);

    const okRes = await handler(
      {
        httpMethod: 'POST',
        headers: { authorization: `Bearer ${validToken}` },
        body: JSON.stringify({
          type: 'content-image',
          contentImage: { filename: 'tiny-star.png', base64Data: tinyPngBase64 },
        }),
      } as any,
      {} as any
    ) as any;
    expect(okRes.statusCode).toBe(200);
    const parsed = JSON.parse(okRes.body);
    expect(parsed.success).toBe(true);
    expect(parsed.url).toMatch(/^\/images\/content\/[a-zA-Z0-9._-]+\.png$/);
  });

  it('rejects invalid filenames on GET ?action=content-image', async () => {
    const res = await handler(
      {
        httpMethod: 'GET',
        queryStringParameters: { action: 'content-image', name: '../secret.png' },
        headers: {},
      } as any,
      {} as any
    );
    expect(res?.statusCode).toBe(400);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --exclude ".worktrees/**" tests/adminApi.test.ts`
Expected: FAIL because `uploadContentImage` and `content-image` handlers do not exist.

- [ ] **Step 3: Implement `content-image` upload & serve handlers in `netlify/functions/admin-save.ts`**

Add helper constants near top of `netlify/functions/admin-save.ts`:

```typescript
const MAX_CONTENT_IMAGE_BYTES = 2 * 1024 * 1024;
const CONTENT_IMAGE_MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};
const SAFE_CONTENT_IMAGE_NAME_RE = /^[a-zA-Z0-9._-]+\.(png|jpe?g|webp|gif)$/i;
```

Add `GET ?action=content-image` handler right after `action === 'load'` in `handler`:

```typescript
  if (event.httpMethod === 'GET' && event.queryStringParameters?.action === 'content-image') {
    const name = event.queryStringParameters?.name || '';
    if (!SAFE_CONTENT_IMAGE_NAME_RE.test(name) || name.includes('..')) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid image filename' }) };
    }
    const ext = path.extname(name).toLowerCase();
    const contentType = CONTENT_IMAGE_MIME_BY_EXT[ext] || 'application/octet-stream';

    const blobImg = await readFromNetlifyBlobs<{ contentType?: string; base64?: string }>(
      event,
      `content-image:${name}`
    );
    if (blobImg?.base64) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': blobImg.contentType || contentType,
          'Cache-Control': 'public, max-age=3600',
        },
        body: blobImg.base64,
        isBase64Encoded: true,
      };
    }

    const candidates = [
      path.resolve(process.cwd(), 'public/images/content', name),
      path.join(os.tmpdir(), `weebles-content-img-${name}`),
    ];
    for (const candidate of candidates) {
      try {
        if (fs.existsSync(candidate)) {
          const buf = fs.readFileSync(candidate);
          return {
            statusCode: 200,
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=3600',
            },
            body: buf.toString('base64'),
            isBase64Encoded: true,
          };
        }
      } catch {}
    }

    return { statusCode: 404, body: JSON.stringify({ error: 'Image not found' }) };
  }
```

In `POST` handler:
1. Destructure `contentImage` alongside `{ type, products, settings, admins, categories, newImage, changes, contentImage }`.
2. In `type === 'settings'`, also preserve `currentSettings.pageContent` if `mergedSettings.pageContent === undefined`.
3. Add `type === 'content-image'` branch:

```typescript
    // 7. Handle inline content PNG/image upload
    if (type === 'content-image' && contentImage?.filename && contentImage?.base64Data) {
      const sanitized = path
        .basename(String(contentImage.filename))
        .replace(/[^a-zA-Z0-9._-]/g, '');
      const ext = path.extname(sanitized).toLowerCase();
      const contentType = CONTENT_IMAGE_MIME_BY_EXT[ext];
      if (!contentType || !SAFE_CONTENT_IMAGE_NAME_RE.test(sanitized)) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'Unsupported image format. Please upload a PNG, JPG, WEBP, or GIF file.',
          }),
        };
      }

      const rawBase64 = String(contentImage.base64Data).replace(
        /^data:image\/[\w+.-]+;base64,/,
        ''
      );
      const buffer = Buffer.from(rawBase64, 'base64');
      if (buffer.length === 0) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Image file is empty.' }),
        };
      }
      if (buffer.length > MAX_CONTENT_IMAGE_BYTES) {
        return {
          statusCode: 413,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Image exceeds 2 MB limit. Please use a smaller PNG.' }),
        };
      }

      const stem = sanitized.slice(0, sanitized.length - ext.length).slice(0, 48) || 'image';
      const cleanFilename = `${stem}-${Date.now()}${ext}`;
      const imagePath = `public/images/content/${cleanFilename}`;

      await saveToNetlifyBlobs(
        event,
        `content-image:${cleanFilename}`,
        JSON.stringify({ contentType, base64: rawBase64 })
      );

      if (githubToken) {
        await commitToGitHub(
          imagePath,
          rawBase64,
          `chore(admin): upload storefront content image ${cleanFilename}`
        );
      } else {
        const localDir = path.resolve(process.cwd(), 'public/images/content');
        try {
          if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
          fs.writeFileSync(path.join(localDir, cleanFilename), buffer);
        } catch {
          try {
            fs.writeFileSync(path.join(os.tmpdir(), `weebles-content-img-${cleanFilename}`), buffer);
          } catch {}
        }
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          url: `/images/content/${cleanFilename}`,
          filename: cleanFilename,
          message: githubToken
            ? 'Image uploaded and committed to GitHub!'
            : 'Image uploaded locally (Dev Mode).',
        }),
      };
    }
```

- [ ] **Step 4: Add `uploadContentImage` to `src/services/adminApi.ts`**

Import `cacheContentImagePreview` from `../utils/contentImageCache`, and add method to `adminApi`:

```typescript
  async uploadContentImage(
    filename: string,
    base64Data: string
  ): Promise<{ success: boolean; url: string; filename: string; message: string }> {
    const session = adminAuth.getSession();
    if (!session) throw new Error('Not authenticated');

    const res = await fetch('/.netlify/functions/admin-save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({
        type: 'content-image',
        contentImage: { filename, base64Data },
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const err = new Error(data.error || 'Failed to upload image') as any;
      err.status = res.status;
      err.endpoint = 'POST /.netlify/functions/admin-save (type=content-image)';
      throw err;
    }

    const result = await res.json();
    if (result?.url && base64Data.startsWith('data:image/')) {
      cacheContentImagePreview(result.url, base64Data);
    }
    return result;
  },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run --exclude ".worktrees/**" tests/adminApi.test.ts`
Expected: PASS (all tests green).

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/admin-save.ts src/services/adminApi.ts tests/adminApi.test.ts
git commit -m "feat(admin): add inline PNG upload and serve pipeline for Markdown content"
```

---

### Task 5: Reusable `MarkdownFieldEditor` & `ContentTab` Integration

**Files:**
- Create: `src/components/admin/MarkdownFieldEditor.tsx`
- Modify: `src/components/admin/ContentTab.tsx:1-245`
- Create: `tests/MarkdownFieldEditor.test.tsx`
- Modify: `tests/ContentTab.test.tsx`

**Interfaces:**
- Consumes: `RichMarkdown` (`src/components/RichMarkdown.tsx`), `DEFAULT_PAGE_CONTENT`, `resolvePageContent` (`src/utils/pageContentDefaults.ts`), `PageContentSettings` (`src/types/settings.ts`), `adminApi.uploadContentImage` (`src/services/adminApi.ts`).
- Produces:
  - `export const MarkdownFieldEditor: React.FC<MarkdownFieldEditorProps>` in `src/components/admin/MarkdownFieldEditor.tsx`
  - Updated `ContentTab` rendering the Storefront Page Copy (Markdown) section and saving `pageContent`.

- [ ] **Step 1: Write failing tests in `tests/MarkdownFieldEditor.test.tsx` and `tests/ContentTab.test.tsx`**

Create `tests/MarkdownFieldEditor.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React, { useState } from 'react';
import { MarkdownFieldEditor } from '../src/components/admin/MarkdownFieldEditor';

const ControlledEditor: React.FC<{
  initialValue?: string;
  defaultValue?: string;
  onUploadImage?: (file: File) => Promise<{ url: string; alt: string }>;
}> = ({
  initialValue = 'Hello World',
  defaultValue = 'Default Copy',
  onUploadImage = vi.fn().mockResolvedValue({ url: '/images/content/star.png', alt: 'star' }),
}) => {
  const [val, setVal] = useState(initialValue);
  return (
    <MarkdownFieldEditor
      id="testField"
      label="Hero Title"
      value={val}
      defaultValue={defaultValue}
      previewVariant="heroTitle"
      onChange={setVal}
      onUploadImage={onUploadImage}
    />
  );
};

describe('MarkdownFieldEditor', () => {
  it('wraps selected text with bold, italic, wavy highlight, font, and color toolbar actions', () => {
    render(<ControlledEditor initialValue="Hello World" />);
    const textarea = screen.getByLabelText('Hero Title') as HTMLTextAreaElement;

    // Select "World"
    textarea.setSelectionRange(6, 11);
    fireEvent.click(screen.getByRole('button', { name: /Bold/i }));
    expect(textarea.value).toBe('Hello **World**');

    // Reset and test Wavy
    fireEvent.change(textarea, { target: { value: 'Fridge & Keys' } });
    textarea.setSelectionRange(0, 13);
    fireEvent.click(screen.getByRole('button', { name: /Wavy Highlight/i }));
    expect(textarea.value).toBe('[Fridge & Keys]{color=pink wavy}');

    // Test Font dropdown
    fireEvent.change(textarea, { target: { value: 'Cute' } });
    textarea.setSelectionRange(0, 4);
    fireEvent.change(screen.getByLabelText(/Insert font for Hero Title/i), {
      target: { value: 'serif' },
    });
    expect(textarea.value).toBe('[Cute]{font=serif}');
  });

  it('uploads an inline PNG and inserts Markdown image syntax into the field', async () => {
    const uploadMock = vi
      .fn()
      .mockResolvedValue({ url: '/images/content/sparkle-123.png', alt: 'sparkle' });
    render(<ControlledEditor initialValue="Hi " onUploadImage={uploadMock} />);

    const fileInput = screen.getByLabelText(/Upload inline PNG for Hero Title/i) as HTMLInputElement;
    const file = new File(['png-bytes'], 'sparkle.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(uploadMock).toHaveBeenCalledWith(file);
    });
    const textarea = screen.getByLabelText('Hero Title') as HTMLTextAreaElement;
    expect(textarea.value).toContain('![sparkle](/images/content/sparkle-123.png)');
  });

  it('renders live preview and resets value back to defaultValue', () => {
    render(<ControlledEditor initialValue="**Live** Preview" defaultValue="Default Copy" />);

    expect(screen.getByText('Live').tagName).toBe('STRONG');

    fireEvent.click(screen.getByRole('button', { name: /Reset to default/i }));
    expect((screen.getByLabelText('Hero Title') as HTMLTextAreaElement).value).toBe('Default Copy');
  });
});
```

Append to `tests/ContentTab.test.tsx`:

```typescript
  it('renders Markdown page copy fields and saves updated pageContent alongside existing settings', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(<ContentTab settings={mockSettings} onSave={handleSave} />);

    const heroTitleInput = screen.getByLabelText(/^Hero Title$/i);
    expect(heroTitleInput).toHaveValue(
      'Tiny Polymer Clay Friends for Your [Fridge & Keys]{color=pink wavy} ✨'
    );

    fireEvent.change(heroTitleInput, {
      target: { value: 'Tiny **Handcrafted** Friends ✨' },
    });

    const catalogSubtitleInput = screen.getByLabelText(/^Catalog Subtitle$/i);
    fireEvent.change(catalogSubtitleInput, {
      target: { value: 'Baked with *love*.' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Save & Publish Site Content/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith(
        expect.objectContaining({
          pageContent: expect.objectContaining({
            heroTitle: 'Tiny **Handcrafted** Friends ✨',
            catalogSubtitle: 'Baked with *love*.',
            heroTagline: 'Hand-Sculpted Polymer Clay with Love',
          }),
        })
      );
    });
  });
```

- [ ] **Step 2: Run targeted tests to verify they fail**

Run: `npx vitest run --exclude ".worktrees/**" tests/MarkdownFieldEditor.test.tsx tests/ContentTab.test.tsx`
Expected: FAIL because `MarkdownFieldEditor` does not exist and `ContentTab` does not render `pageContent` fields.

- [ ] **Step 3: Create `src/components/admin/MarkdownFieldEditor.tsx`**

```typescript
import React, { useRef, useState } from 'react';
import {
  Bold,
  Italic,
  ImagePlus,
  RotateCcw,
  Sparkles,
  Palette,
  Loader2,
} from 'lucide-react';
import { RichMarkdown } from '../RichMarkdown';

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

const COLOR_SWATCHES = [
  { name: 'pink', hex: '#FF85A1', label: 'Weeble Pink' },
  { name: 'rose', hex: '#F43F5E', label: 'Rose' },
  { name: 'lilac', hex: '#A78BFA', label: 'Lilac' },
  { name: 'blue', hex: '#38BDF8', label: 'Sky Blue' },
  { name: 'mint', hex: '#34D399', label: 'Mint' },
  { name: 'yellow', hex: '#EAB308', label: 'Honey Gold' },
  { name: 'text', hex: '#4A2E35', label: 'Cocoa' },
  { name: 'textMuted', hex: '#7A5C61', label: 'Muted' },
];

const MAX_CLIENT_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export const MarkdownFieldEditor: React.FC<MarkdownFieldEditorProps> = ({
  id,
  label,
  value,
  defaultValue,
  mode = 'inline',
  rows = 2,
  previewVariant = 'subtitle',
  onChange,
  onUploadImage,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [customHex, setCustomHex] = useState('#FF85A1');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const wrapSelection = (before: string, after: string, placeholder: string) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || placeholder;
    const nextValue = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(nextValue);

    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        const cursorStart = start + before.length;
        el.setSelectionRange(cursorStart, cursorStart + selected.length);
      }
    });
  };

  const insertAtCursor = (snippet: string) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const nextValue = value.slice(0, start) + snippet + value.slice(end);
    onChange(nextValue);
  };

  const handleApplyColor = (colorValue: string) => {
    wrapSelection('[', `]{color=${colorValue}}`, 'colored text');
    setShowColorMenu(false);
  };

  const handleFontSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const font = e.target.value;
    if (!font) return;
    wrapSelection('[', `]{font=${font}}`, 'styled text');
    e.target.value = '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadError(null);
    if (file.type && !ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
      setUploadError('Please choose a PNG, JPG, WEBP, or GIF image.');
      return;
    }
    if (file.size > MAX_CLIENT_IMAGE_BYTES) {
      setUploadError('Image must be 2 MB or smaller.');
      return;
    }

    setIsUploading(true);
    try {
      const { url, alt } = await onUploadImage(file);
      insertAtCursor(`![${alt}](${url})`);
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to upload image.');
    } finally {
      setIsUploading(false);
    }
  };

  const renderPreview = () => {
    if (!value.trim()) {
      return <span className="italic text-neutral-400 text-xs">(hidden when empty)</span>;
    }
    switch (previewVariant) {
      case 'pill':
        return (
          <div className="inline-flex items-center gap-1.5 bg-white border border-pink-200 text-weeble-text font-bold px-3 py-1 rounded-full text-xs">
            <Sparkles className="w-3.5 h-3.5 text-weeble-pink" />
            <span>
              <RichMarkdown content={value} mode="inline" />
            </span>
          </div>
        );
      case 'heroTitle':
        return (
          <div className="font-bubble text-xl sm:text-2xl font-bold text-weeble-text leading-tight">
            <RichMarkdown content={value} mode="inline" />
          </div>
        );
      case 'heading':
        return (
          <div className="font-bubble text-lg font-bold text-weeble-text">
            <RichMarkdown content={value} mode="inline" />
          </div>
        );
      case 'careList':
        return (
          <RichMarkdown
            content={value}
            mode="block"
            className="text-xs text-weeble-textMuted space-y-1.5"
          />
        );
      case 'subtitle':
      default:
        return (
          <div className="text-xs sm:text-sm text-weeble-textMuted leading-relaxed">
            <RichMarkdown content={value} mode={mode} />
          </div>
        );
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="block text-xs font-bold text-weeble-text">
          {label}
        </label>
        {value !== defaultValue && (
          <button
            type="button"
            onClick={() => onChange(defaultValue)}
            className="text-[11px] font-bold text-weeble-pink hover:text-pink-600 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset to default</span>
          </button>
        )}
      </div>

      {/* Formatting Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 bg-pink-50/70 border border-pink-200 rounded-xl px-2 py-1.5 relative">
        <button
          type="button"
          onClick={() => wrapSelection('**', '**', 'bold text')}
          aria-label={`Bold ${label}`}
          title="Bold (**text**)"
          className="px-2 py-1 rounded-lg text-xs font-bold text-weeble-text bg-white border border-pink-200 hover:border-weeble-pink flex items-center gap-1 cursor-pointer"
        >
          <Bold className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Bold</span>
        </button>

        <button
          type="button"
          onClick={() => wrapSelection('*', '*', 'italic text')}
          aria-label={`Italic ${label}`}
          title="Italic (*text*)"
          className="px-2 py-1 rounded-lg text-xs font-bold text-weeble-text bg-white border border-pink-200 hover:border-weeble-pink flex items-center gap-1 cursor-pointer"
        >
          <Italic className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Italic</span>
        </button>

        <button
          type="button"
          onClick={() => wrapSelection('[', ']{color=pink wavy}', 'highlight')}
          aria-label={`Wavy Highlight ${label}`}
          title="Pink wavy underline ([text]{color=pink wavy})"
          className="px-2 py-1 rounded-lg text-xs font-bold text-weeble-pink bg-white border border-pink-200 hover:border-weeble-pink flex items-center gap-1 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Wavy</span>
        </button>

        {/* Color Swatch Picker */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColorMenu((prev) => !prev)}
            aria-label={`Color ${label}`}
            title="Text color ([text]{color=...})"
            className="px-2 py-1 rounded-lg text-xs font-bold text-weeble-text bg-white border border-pink-200 hover:border-weeble-pink flex items-center gap-1 cursor-pointer"
          >
            <Palette className="w-3.5 h-3.5 text-weeble-pink" />
            <span>Color</span>
          </button>

          {showColorMenu && (
            <div className="absolute left-0 top-full mt-1 z-20 bg-white border-2 border-pink-200 rounded-2xl p-2.5 shadow-lg w-52 space-y-2">
              <div className="grid grid-cols-4 gap-1.5">
                {COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch.name}
                    type="button"
                    title={swatch.label}
                    aria-label={`Apply ${swatch.label} color`}
                    onClick={() => handleApplyColor(swatch.name)}
                    className="w-8 h-8 rounded-lg border border-pink-200 hover:scale-110 transition-transform cursor-pointer"
                    style={{ backgroundColor: swatch.hex }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1.5 pt-1 border-t border-pink-100">
                <input
                  type="color"
                  value={customHex}
                  onChange={(e) => setCustomHex(e.target.value)}
                  aria-label={`Custom color for ${label}`}
                  className="w-7 h-7 rounded cursor-pointer border border-pink-200"
                />
                <button
                  type="button"
                  onClick={() => handleApplyColor(customHex)}
                  className="flex-1 text-[11px] font-bold bg-weeble-pink text-white px-2 py-1 rounded-lg hover:bg-pink-500 cursor-pointer"
                >
                  Apply {customHex}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Font Picker */}
        <select
          aria-label={`Insert font for ${label}`}
          defaultValue=""
          onChange={handleFontSelect}
          className="text-xs font-semibold text-weeble-text bg-white border border-pink-200 rounded-lg px-2 py-1 focus:outline-none focus:border-weeble-pink cursor-pointer"
        >
          <option value="">Font…</option>
          <option value="bubble">Fredoka (Bubble)</option>
          <option value="body">Quicksand (Body)</option>
          <option value="serif">Serif (Georgia)</option>
          <option value="mono">Monospace</option>
        </select>

        {/* Upload Inline PNG */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          aria-label={`Upload inline PNG for ${label}`}
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          className="px-2 py-1 rounded-lg text-xs font-bold text-weeble-text bg-white border border-pink-200 hover:border-weeble-pink flex items-center gap-1 disabled:opacity-50 cursor-pointer"
        >
          {isUploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-weeble-pink" />
          ) : (
            <ImagePlus className="w-3.5 h-3.5 text-weeble-pink" />
          )}
          <span>{isUploading ? 'Uploading…' : 'Insert PNG'}</span>
        </button>
      </div>

      {uploadError && (
        <p role="alert" className="text-[11px] font-bold text-rose-600">
          {uploadError}
        </p>
      )}

      <textarea
        ref={textareaRef}
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm font-mono bg-weeble-pinkWash border border-pink-200 rounded-xl px-3.5 py-2.5 text-weeble-text focus:outline-none focus:border-weeble-pink"
      />

      <div className="bg-weeble-pinkBg/70 border border-pink-100 rounded-xl px-3.5 py-2.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
          Live Preview
        </div>
        {renderPreview()}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Wire `MarkdownFieldEditor` into `src/components/admin/ContentTab.tsx`**

Update `src/components/admin/ContentTab.tsx`:
- Import `FileText, ChevronDown, ChevronUp` from `lucide-react`.
- Import `PageContentSettings` from `../../types/settings`.
- Import `DEFAULT_PAGE_CONTENT, resolvePageContent` from `../../utils/pageContentDefaults`.
- Import `adminApi` from `../../services/adminApi`.
- Import `MarkdownFieldEditor` from `./MarkdownFieldEditor`.
- Add state:
  ```tsx
  const [pageContent, setPageContent] = useState<PageContentSettings>(() =>
    resolvePageContent(settings.pageContent)
  );
  const [showGuide, setShowGuide] = useState(false);
  ```
- Sync `setPageContent(resolvePageContent(settings.pageContent))` inside the `useEffect` (when `!hasEditedRef.current`).
- Add helper:
  ```tsx
  const updatePageField = (key: keyof PageContentSettings, nextValue: string) => {
    hasEditedRef.current = true;
    setPageContent((prev) => ({ ...prev, [key]: nextValue }));
  };

  const handleUploadInlinePng = async (file: File): Promise<{ url: string; alt: string }> => {
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });
    const res = await adminApi.uploadContentImage(file.name, base64Data);
    const alt = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'icon';
    return { url: res.url, alt };
  };
  ```
- Include `pageContent` in `onSave({ ...settings, contactEmail, customOrderEmail, socialLinksEnabled, socialLinks: cleanedLinks, socials: syncLegacySocials(cleanedLinks, settings.socials), announcementBanner: { enabled: bannerEnabled, text: bannerText }, pageContent })`.
- Render the **Storefront Page Copy (Markdown)** card directly below the Announcement Banner card with:
  - Collapsible Markdown Formatting Guide (`**bold**`, `*italic*`, `[text]{color=pink font=bubble wavy}`, `<span style="color:#FF85A1">text</span>`, `![alt](/images/content/icon.png =28)`, `- bullet item`).
  - Four clearly labeled subsections (`Hero Section`, `Behind the Scenes & Restocks`, `Catalog Header`, `Footer Clay Care`) using `<MarkdownFieldEditor />` for all 10 fields.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run --exclude ".worktrees/**" tests/MarkdownFieldEditor.test.tsx tests/ContentTab.test.tsx tests/AdminPortal.test.tsx`
Expected: PASS (all tests green).

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/MarkdownFieldEditor.tsx src/components/admin/ContentTab.tsx tests/MarkdownFieldEditor.test.tsx tests/ContentTab.test.tsx
git commit -m "feat(admin): add Markdown page copy editors with toolbar, live preview, and PNG upload"
```

---

### Task 6: Full Suite & Production Build Verification

**Files:**
- Verify all modified/created files together (no new source changes unless fixing a real failure).

- [ ] **Step 1: Run complete unit & integration test suite**

Run: `npx vitest run --exclude ".worktrees/**"`
Expected: 100% PASS across all test files.

- [ ] **Step 2: Run TypeScript typecheck and Vite production build**

Run: `npm run build`
Expected: Exit code 0 (`tsc && vite build` succeeds cleanly with zero TypeScript errors).

- [ ] **Step 3: Inspect `git status` and `git log --oneline -n 6`**

Run: `git status --short`
Expected: Clean working tree (aside from any unrelated pre-existing local change) and clean atomic commits for Tasks 1–5.
