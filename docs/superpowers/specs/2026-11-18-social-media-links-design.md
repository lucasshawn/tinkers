# Weebles Storefront: Configurable Social Media Links & Brand Icons Specification

- **Date:** 2026-11-18
- **Status:** Approved
- **Target Platform:** Netlify (Vite + React + TypeScript)
- **Visual Design:** Hello Kitty inspired feminine pastel theme (`bg-weeble-pink`, `bg-weeble-pinkWash`, `border-pink-200`, `font-bubble`) paired with official/standard social media brand icons and brand badge colors

---

## 1. Overview & Objectives

Upgrade social media link management from three hardcoded URLs to a flexible, toggleable, multi-platform system with standard brand icons:

1. **Master & Per-Link On/Off Toggles:** Admins can turn off/on the entire social media presence with a master toggle and enable/disable individual social links. When the master toggle is off or zero valid links are enabled, the homepage social section and footer icon row automatically hide.
2. **Dynamic Platform Catalog with Standard Brand Icons:** Admins can add links for new social media platforms (TikTok, Instagram, Facebook, Facebook Marketplace, YouTube, Pinterest, Etsy, X / X.com, Threads, Bluesky, Snapchat, Discord, Twitch, LinkedIn, plus a generic Website/Other fallback), each rendered with its recognizable standard SVG brand mark and brand color tile.
3. **URL Auto-Detection & Customization:** Pasting a recognizable URL automatically selects the matching platform and icon; admins can customize each link's display label and subtitle/handle, reorder links up/down, and delete links.
4. **Storefront Placement:** Enabled social links appear both in the homepage [`SocialStrip`](file:///c:/Users/lucas/source/repos/tinkers/src/components/SocialStrip.tsx) (with an adaptive responsive grid for 1, 2, 3, or 4+ links) and as compact brand icon buttons in [`Footer`](file:///c:/Users/lucas/source/repos/tinkers/src/components/Footer.tsx).
5. **Backward Compatibility:** Existing `localStorage` (`weebles_settings_v1`) and Netlify Blobs settings using the legacy `socials: { tiktok, instagram, facebookMarketplace }` object automatically migrate into the structured `socialLinks` array without data loss.

---

## 2. Data Model & Migration

### 2.1 Types (`src/types/settings.ts`)

```typescript
export type SocialPlatformId =
  | 'tiktok'
  | 'instagram'
  | 'facebook'
  | 'facebookMarketplace'
  | 'youtube'
  | 'pinterest'
  | 'etsy'
  | 'x'
  | 'threads'
  | 'bluesky'
  | 'snapchat'
  | 'discord'
  | 'twitch'
  | 'linkedin'
  | 'website';

export interface SocialLink {
  id: string;
  platform: SocialPlatformId;
  url: string;
  enabled: boolean;
  label?: string;
  subtitle?: string;
}

export interface LegacySocials {
  tiktok: string;
  instagram: string;
  facebookMarketplace: string;
}

export interface AnnouncementBannerSettings {
  enabled: boolean;
  text: string;
}

export interface SiteSettings {
  contactEmail: string;
  customOrderEmail: string;
  socials?: LegacySocials;
  socialLinksEnabled?: boolean;
  socialLinks?: SocialLink[];
  announcementBanner?: AnnouncementBannerSettings;
  admins?: string[];
}
```

### 2.2 Default Settings (`src/data/settings.json`)

Update `src/data/settings.json` to include `socialLinksEnabled: true` and the three existing studio links as the initial `socialLinks` array (while keeping `socials` populated for backward compatibility):

```json
{
  "contactEmail": "weeblesclay@gmail.com",
  "customOrderEmail": "weeblesclay@gmail.com",
  "socials": {
    "tiktok": "https://tiktok.com/@weebles_clay",
    "instagram": "https://instagram.com/weebles_clay",
    "facebookMarketplace": "https://facebook.com/marketplace"
  },
  "socialLinksEnabled": true,
  "socialLinks": [
    {
      "id": "tiktok-default",
      "platform": "tiktok",
      "url": "https://tiktok.com/@weebles_clay",
      "enabled": true,
      "label": "TikTok",
      "subtitle": "@weebles_clay • ASMR & BTS"
    },
    {
      "id": "instagram-default",
      "platform": "instagram",
      "url": "https://instagram.com/weebles_clay",
      "enabled": true,
      "label": "Instagram",
      "subtitle": "@weebles_clay • Gallery & Drops"
    },
    {
      "id": "facebook-marketplace-default",
      "platform": "facebookMarketplace",
      "url": "https://facebook.com/marketplace",
      "enabled": true,
      "label": "Facebook Marketplace",
      "subtitle": "Local Listings & Events"
    }
  ],
  "announcementBanner": {
    "enabled": false,
    "text": ""
  },
  "admins": [
    "lucasshawn@gmail.com",
    "lucascierra24@gmail.com"
  ]
}
```

### 2.3 Normalization & Hydration (`src/utils/socialPlatforms.ts`, `src/context/SettingsContext.tsx`, `src/App.tsx`, `src/components/admin/AdminPortal.tsx`)

- **`normalizeSettings(raw: Partial<SiteSettings>, defaults: SiteSettings): SiteSettings`:**
  - If `Array.isArray(raw.socialLinks)`, sanitize each item (ensure string `id`, valid `SocialPlatformId` falling back to `'website'`, boolean `enabled` defaulting to `true`, trimmed string `url`, optional `label`/`subtitle`).
  - Otherwise, if `raw.socials` exists, migrate `tiktok`, `instagram`, and `facebookMarketplace` into the 3 default `SocialLink` items using their URLs and existing default subtitles.
  - Default `socialLinksEnabled` to `raw.socialLinksEnabled ?? true`.
- **`SettingsContext.tsx`:** Uses `normalizeSettings` when reading `DEFAULT_SETTINGS`, parsing `localStorage`, and updating settings. Exports `SETTINGS_STORAGE_KEY = 'weebles_settings_v1'` and exposes `hydrateSettings(remoteSettings: SiteSettings)` on `SettingsContextType`, which normalizes and applies remote settings to React state without writing to `localStorage`.
- **`App.tsx` & `AdminPortal.tsx`:** Extend the existing `adminApi.loadStoreData()` effect (skipped when `import.meta.env.MODE === 'test'`) so that when `data?.settings` is returned and `localStorage.getItem(SETTINGS_STORAGE_KEY)` is not set, `hydrateSettings(data.settings)` applies the persisted Netlify Blobs settings on load without writing to `localStorage`.

---

## 3. Platform Registry, Brand Icons & Storefront UI

### 3.1 Platform Registry (`src/utils/socialPlatforms.ts`)

Defines `SOCIAL_PLATFORMS` metadata for all 15 presets:

| Platform ID | Picker Label | Default Card Label | Brand Badge Classes | Placeholder URL |
|---|---|---|---|---|
| `tiktok` | `TikTok` | `TikTok` | `bg-black text-white` | `https://tiktok.com/@weebles_clay` |
| `instagram` | `Instagram` | `Instagram` | `bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white` | `https://instagram.com/weebles_clay` |
| `facebook` | `Facebook` | `Facebook` | `bg-[#1877F2] text-white` | `https://facebook.com/weeblesclay` |
| `facebookMarketplace` | `Facebook Marketplace` | `Facebook Marketplace` | `bg-[#1877F2] text-white` | `https://facebook.com/marketplace` |
| `youtube` | `YouTube` | `YouTube` | `bg-[#FF0000] text-white` | `https://youtube.com/@weebles_clay` |
| `pinterest` | `Pinterest` | `Pinterest` | `bg-[#E60023] text-white` | `https://pinterest.com/weebles_clay` |
| `etsy` | `Etsy` | `Etsy` | `bg-[#F1641E] text-white` | `https://etsy.com/shop/weeblesclay` |
| `x` | `X (X.com)` | `X` | `bg-black text-white` | `https://x.com/weebles_clay` |
| `threads` | `Threads` | `Threads` | `bg-neutral-900 text-white` | `https://threads.net/@weebles_clay` |
| `bluesky` | `Bluesky` | `Bluesky` | `bg-[#0085FF] text-white` | `https://bsky.app/profile/weebles.bsky.social` |
| `snapchat` | `Snapchat` | `Snapchat` | `bg-[#FFFC00] text-black` | `https://snapchat.com/add/weebles_clay` |
| `discord` | `Discord` | `Discord` | `bg-[#5865F2] text-white` | `https://discord.gg/weebles` |
| `twitch` | `Twitch` | `Twitch` | `bg-[#9146FF] text-white` | `https://twitch.tv/weebles_clay` |
| `linkedin` | `LinkedIn` | `LinkedIn` | `bg-[#0A66C2] text-white` | `https://linkedin.com/in/weebles` |
| `website` | `Website / Other` | `Website` | `bg-weeble-pink text-white` | `https://example.com` |

Helper functions in `src/utils/socialPlatforms.ts`:
- `isSafeHttpUrl(url: string): boolean` — Parses via `new URL(url.trim())` and returns `true` only when `protocol === 'http:' || protocol === 'https:'`.
- `detectSocialPlatformFromUrl(url: string): SocialPlatformId | null` — Inspects lowercase hostname and pathname (`facebook.com/marketplace` checked before `facebook.com`; `x.com` & `twitter.com` → `'x'`; `youtu.be` & `youtube.com` → `'youtube'`; `pin.it` & `pinterest.com` → `'pinterest'`; `threads.net` & `threads.com` → `'threads'`; `bsky.app` → `'bluesky'`; `discord.gg` & `discord.com` → `'discord'`; `fb.com` → `'facebook'`; etc.). Returns `null` if URL is invalid or unrecognized.
- `getFallbackSubtitle(link: SocialLink): string` — Extracts a clean `@handle` when the path begins with `/@handle` or `/handle` on handle-based platforms (TikTok, Instagram, X, YouTube, Threads, Pinterest, Twitch, Snapchat), or strips `www.` and trailing slash to return `hostname + pathname` (e.g., `etsy.com/shop/weebles`).
- `getSocialLinkLabel(link: SocialLink): string` — Returns `link.label?.trim()` if non-empty, otherwise the platform's default card display name.
- `getVisibleSocialLinks(settings: SiteSettings): SocialLink[]` — Returns `[]` if `settings.socialLinksEnabled === false`; otherwise resolves normalized `socialLinks` and returns entries where `link.enabled && isSafeHttpUrl(link.url)`.

### 3.2 Brand Icon Component (`src/components/SocialIcon.tsx`)

- `SocialIcon({ platform, className })`: Renders a clean, standard inline `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">` brand glyph for each of the 14 social platforms and a clean globe SVG (or Lucide `Globe`) for `'website'`.
- `SocialIconBadge({ platform, size })`: Renders the rounded brand-colored container (`md` for SocialStrip cards `w-12 h-12 rounded-xl`, `sm` for Footer buttons `w-9 h-9 rounded-xl`, `xs` for Admin previews `w-10 h-10 rounded-xl`) wrapping `SocialIcon`.

### 3.3 Homepage `SocialStrip` (`src/components/SocialStrip.tsx`)

- Reads `visibleLinks = getVisibleSocialLinks(settings)`.
- Returns `null` when `visibleLinks.length === 0`.
- Chooses adaptive grid classes:
  - `1` item: `grid grid-cols-1 max-w-md mx-auto gap-4`
  - `2` items: `grid grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto gap-4`
  - `3` items: `grid grid-cols-1 md:grid-cols-3 gap-4`
  - `4+` items: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`
- Renders each link as an `<a>` with `target="_blank" rel="noopener noreferrer"`, `SocialIconBadge`, display label, subtitle (`link.subtitle?.trim() || getFallbackSubtitle(link)`), and `ExternalLink`.

### 3.4 Storefront `Footer` (`src/components/Footer.tsx`)

- Reads `visibleLinks = getVisibleSocialLinks(settings)`.
- Under the **Get in Touch** column, when `visibleLinks.length > 0`, renders a labeled compact horizontal flex-wrap bar (`aria-label="Social media links"`) of `SocialIconBadge` anchors (`size="sm"`), each with `aria-label={`Visit us on ${label}`}`, `title={label}`, `target="_blank"`, `rel="noopener noreferrer"`, and hover lift styling.
- Renders nothing for the social bar when `visibleLinks.length === 0`.

---

## 4. Admin Portal Editor (`src/components/admin/SocialLinksEditor.tsx` & `ContentTab.tsx`)

### 4.1 `SocialLinksEditor` Component

Props:
```typescript
export interface SocialLinksEditorProps {
  enabled: boolean;
  links: SocialLink[];
  validationError?: string | null;
  onEnabledChange: (enabled: boolean) => void;
  onLinksChange: (links: SocialLink[]) => void;
}
```

Behavior:
1. **Master Toggle:** Checkbox (`id="socialLinksEnabled"`, `aria-label="Show Social Media Links on Storefront"`) controlling `socialLinksEnabled`. When unchecked, displays an informational note (`Social media links are currently hidden from the homepage and footer.`).
2. **Per-Link Editor Cards:** For each `SocialLink`:
   - Live `SocialIconBadge` preview reflecting the current `platform`.
   - Individual **Enabled** checkbox (`aria-label={`Enable ${displayName} link`}`) paired with an `Active` / `Hidden` pill.
   - **Move Up** and **Move Down** buttons (`aria-label="Move link up"` / `"Move link down"`), disabled at the list boundaries.
   - **Delete** button (`aria-label={`Remove ${displayName} link`}`).
   - **Platform `<select>`** listing all 15 presets (including `X (X.com)`).
   - **URL `<input type="url">`**: When the admin enters or pastes a URL, if `detectSocialPlatformFromUrl(newUrl)` detects a platform and the link's current platform is `'website'` (or matches the platform previously detected from its old URL), automatically updates `link.platform` to the detected platform so the dropdown and brand icon snap into place immediately.
   - **Display Label `<input type="text">`** (optional; placeholder = platform default name).
   - **Subtitle / Handle `<input type="text">`** (optional; placeholder = extracted handle/domain or platform example).
3. **Add Social Link Button:** Appends a new `SocialLink` with a unique ID (`social-${Date.now()}-${random}`), `platform: 'website'`, `url: ''`, `enabled: true`, `label: ''`, `subtitle: ''`.
4. **Empty State:** Displays a concise prompt when `links.length === 0`.

### 4.2 `ContentTab.tsx` Integration & Validation

- Manages `socialLinksEnabled` and `socialLinks` state initialized via `normalizeSettings(settings)`.
- On form submit:
  - Validates that every `enabled` link has a valid `http://` or `https://` URL (`isSafeHttpUrl`). If any enabled link fails, stops submission and displays a clear inline validation error message naming the offending link(s) (e.g., `"Please enter a valid http(s) URL for all enabled social links."`).
  - Trims `url`, `label`, and `subtitle`, omitting `label` and `subtitle` when blank (`label: link.label?.trim() || undefined`, `subtitle: link.subtitle?.trim() || undefined`).
  - Builds synced legacy `socials` fields from the first matching `tiktok`, `instagram`, and `facebookMarketplace` links (falling back to existing values or empty strings) so older tooling stays consistent.
  - Calls `onSave({ ...settings, contactEmail, customOrderEmail, announcementBanner, socialLinksEnabled, socialLinks, socials })`.

### 4.3 Legacy `SettingsTab.tsx` Compatibility

- Update `SettingsTab.tsx` to read `settings.socials?.tiktok ?? ''` safely so TypeScript compilation and `tests/SettingsTab.test.tsx` continue passing with optional `socials`.

---

## 5. Error Handling & Security

- **Protocol Safety:** `isSafeHttpUrl` strictly requires `http:` or `https:`, preventing `javascript:`, `data:`, or malformed URLs from ever being saved as enabled links or rendered on the storefront.
- **Unknown Platform Resilience:** Any unrecognized `platform` value loaded from storage safely falls back to `'website'` (Globe icon + pink badge) instead of throwing.
- **Graceful Degradation:** Malformed JSON in `localStorage` or partial objects from Netlify Blobs fall back cleanly through `normalizeSettings`.

---

## 6. Testing Strategy

1. **`tests/socialPlatforms.test.ts`:**
   - All 15 platform presets have valid metadata.
   - `detectSocialPlatformFromUrl` detects every supported platform (including `x.com`, `twitter.com`, `facebook.com/marketplace`, `facebook.com`, `youtu.be`, `youtube.com`, `threads.net`, `bsky.app`, `discord.gg`, etc.) and returns `null` for unknown or invalid URLs.
   - `isSafeHttpUrl` accepts `http://` and `https://` and rejects `javascript:`, empty strings, and malformed strings.
   - `getVisibleSocialLinks` returns `[]` when `socialLinksEnabled` is `false`, filters out disabled links and unsafe/empty URLs, and preserves order.
   - `normalizeSettings` migrates legacy `socials` objects into `socialLinks` and preserves existing `socialLinks` arrays.
2. **`tests/SocialStrip.test.tsx`:**
   - Renders default TikTok, Instagram, and Facebook Marketplace links with SVG icons and secure link attributes.
   - Renders added platforms (e.g., X, YouTube, Etsy) with custom labels/subtitles or fallback subtitles.
   - Omits individually disabled links.
   - Hides the entire section when `socialLinksEnabled` is `false` or all links are disabled.
   - Applies adaptive grid classes for 1, 2, 3, and 4+ visible links.
3. **`tests/Footer.test.tsx`:**
   - Renders compact social icon links in order with accessible `aria-label`s and `target="_blank" rel="noopener noreferrer"`.
   - Hides the social icon bar when `socialLinksEnabled` is `false` or all links are disabled.
4. **`tests/ContentTab.test.tsx`:**
   - Renders master toggle and existing social links.
   - Toggles master switch off/on and toggles individual links off/on.
   - Adds a new social link, pastes an `https://x.com/weebles_clay` URL, verifies platform auto-detects to `x`, edits label/subtitle, reorders up/down, and deletes a link.
   - Blocks save with an inline error if an enabled link has an empty or invalid URL; allows saving when a disabled link is empty.
   - Verifies `onSave` receives updated `socialLinksEnabled` and `socialLinks`.
5. **`tests/SettingsContext.test.tsx`:**
   - Verifies legacy `weebles_settings_v1` `localStorage` entries without `socialLinks` migrate automatically into `socialLinks` with `socialLinksEnabled: true`.
