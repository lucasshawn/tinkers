# Configurable Social Media Links & Brand Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins to turn social media links on/off (globally and per-link) and add, reorder, customize, or remove links for popular social media platforms (including X.com) with standard brand SVG icons rendered on both the homepage `SocialStrip` and `Footer`.

**Architecture:** Extend `SiteSettings` with `socialLinksEnabled?: boolean` and `socialLinks?: SocialLink[]` alongside a backward-compatible `normalizeSettings()` migration helper in `src/utils/socialPlatforms.ts`. Centralize all 15 platform definitions, URL auto-detection, safe HTTP(S) URL checks, and fallback subtitle extraction in `src/utils/socialPlatforms.ts`, render crisp standard brand SVGs via `src/components/SocialIcon.tsx` across `SocialStrip`, `Footer`, and the Admin Portal's new `SocialLinksEditor` component inside `ContentTab`.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide React, Vitest, React Testing Library

## Global Constraints

- Supported preset `SocialPlatformId` values: `tiktok`, `instagram`, `facebook`, `facebookMarketplace`, `youtube`, `pinterest`, `etsy`, `x`, `threads`, `bluesky`, `snapchat`, `discord`, `twitch`, `linkedin`, `website`.
- Zero new runtime npm dependencies: all 14 social brand icons must be inline `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">` marks in `src/components/SocialIcon.tsx` (with Lucide `Globe` for `website`).
- Only `http://` and `https://` URLs are accepted as valid enabled links or rendered on the storefront (`isSafeHttpUrl`).
- When `socialLinksEnabled === false` OR zero valid enabled links exist, both `SocialStrip` and the `Footer` social icon bar must hide completely.
- Existing `localStorage` (`weebles_settings_v1`) and Netlify Blobs payloads containing only legacy `socials: { tiktok, instagram, facebookMarketplace }` must migrate automatically into `socialLinks` without data loss.
- Do not break `SettingsTab.tsx` or any existing tests; `SettingsContext` must not write to `localStorage` during initial load or remote hydration (`hydrateSettings`).

---

### Task 1: Social Link Types, Platform Registry, URL Helpers & Legacy Settings Migration

**Files:**
- Modify: `src/types/settings.ts:1-16`
- Modify: `src/data/settings.json:1-17`
- Create: `src/utils/socialPlatforms.ts`
- Modify: `src/context/SettingsContext.tsx:1-72`
- Modify: `src/components/admin/SettingsTab.tsx:10-40`
- Modify: `src/App.tsx:21-45`
- Modify: `src/components/admin/AdminPortal.tsx:42-61`
- Modify: `src/utils/changeLogUtils.ts:180-239`
- Create: `tests/socialPlatforms.test.ts`
- Modify: `tests/SettingsContext.test.tsx:1-87`
- Modify: `tests/changeLogUtils.test.ts`

**Interfaces:**
- Consumes: `SiteSettings` from `src/types/settings.ts`, `defaultSettingsData` from `src/data/settings.json`, `adminApi.loadStoreData()` from `src/services/adminApi.ts`
- Produces:
  - `SocialPlatformId`, `SocialLink`, `LegacySocials`, updated `SiteSettings` in `src/types/settings.ts`
  - `SOCIAL_PLATFORMS`, `SOCIAL_PLATFORM_LIST`, `getSocialPlatformMeta(platform)`, `isSafeHttpUrl(url)`, `detectSocialPlatformFromUrl(url)`, `getSocialLinkLabel(link)`, `getFallbackSubtitle(link)`, `normalizeSocialLinks(raw, defaults)`, `normalizeSettings(raw, defaults)`, `getVisibleSocialLinks(settings)`, `syncLegacySocials(links, existing)` in `src/utils/socialPlatforms.ts`
  - `SETTINGS_STORAGE_KEY`, `hydrateSettings(remoteSettings: SiteSettings)` on `SettingsContextType` in `src/context/SettingsContext.tsx`

- [ ] **Step 1: Write the failing unit tests in `tests/socialPlatforms.test.ts` and `tests/SettingsContext.test.tsx`**

Create `tests/socialPlatforms.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  SOCIAL_PLATFORM_LIST,
  getSocialPlatformMeta,
  isSafeHttpUrl,
  detectSocialPlatformFromUrl,
  getFallbackSubtitle,
  getSocialLinkLabel,
  normalizeSettings,
  getVisibleSocialLinks,
  syncLegacySocials,
} from '../src/utils/socialPlatforms';
import { SiteSettings, SocialLink } from '../src/types/settings';
import defaultSettingsData from '../src/data/settings.json';

const defaults = defaultSettingsData as SiteSettings;

describe('socialPlatforms utilities', () => {
  it('defines all 15 supported platform presets including X (X.com) and website fallback', () => {
    const ids = SOCIAL_PLATFORM_LIST.map((p) => p.id);
    expect(ids).toEqual([
      'tiktok',
      'instagram',
      'facebook',
      'facebookMarketplace',
      'youtube',
      'pinterest',
      'etsy',
      'x',
      'threads',
      'bluesky',
      'snapchat',
      'discord',
      'twitch',
      'linkedin',
      'website',
    ]);
    expect(getSocialPlatformMeta('x').pickerLabel).toBe('X (X.com)');
    expect(getSocialPlatformMeta('x').defaultLabel).toBe('X');
  });

  describe('isSafeHttpUrl', () => {
    it('accepts valid http and https URLs', () => {
      expect(isSafeHttpUrl('https://x.com/weebles_clay')).toBe(true);
      expect(isSafeHttpUrl('http://example.com/shop')).toBe(true);
      expect(isSafeHttpUrl('  https://tiktok.com/@weebles_clay  ')).toBe(true);
    });

    it('rejects empty, malformed, and non-http protocols', () => {
      expect(isSafeHttpUrl('')).toBe(false);
      expect(isSafeHttpUrl('   ')).toBe(false);
      expect(isSafeHttpUrl('not-a-url')).toBe(false);
      expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    });
  });

  describe('detectSocialPlatformFromUrl', () => {
    it('detects all standard social media domains including x.com, twitter.com, and facebook marketplace', () => {
      expect(detectSocialPlatformFromUrl('https://www.tiktok.com/@weebles_clay')).toBe('tiktok');
      expect(detectSocialPlatformFromUrl('https://instagram.com/weebles_clay')).toBe('instagram');
      expect(detectSocialPlatformFromUrl('https://www.facebook.com/marketplace/item/123')).toBe('facebookMarketplace');
      expect(detectSocialPlatformFromUrl('https://facebook.com/weeblesclay')).toBe('facebook');
      expect(detectSocialPlatformFromUrl('https://fb.com/weeblesclay')).toBe('facebook');
      expect(detectSocialPlatformFromUrl('https://youtube.com/@weebles_clay')).toBe('youtube');
      expect(detectSocialPlatformFromUrl('https://youtu.be/abc123')).toBe('youtube');
      expect(detectSocialPlatformFromUrl('https://pinterest.com/weebles_clay')).toBe('pinterest');
      expect(detectSocialPlatformFromUrl('https://pin.it/abc123')).toBe('pinterest');
      expect(detectSocialPlatformFromUrl('https://www.etsy.com/shop/weeblesclay')).toBe('etsy');
      expect(detectSocialPlatformFromUrl('https://x.com/weebles_clay')).toBe('x');
      expect(detectSocialPlatformFromUrl('https://twitter.com/weebles_clay')).toBe('x');
      expect(detectSocialPlatformFromUrl('https://threads.net/@weebles_clay')).toBe('threads');
      expect(detectSocialPlatformFromUrl('https://www.threads.com/@weebles_clay')).toBe('threads');
      expect(detectSocialPlatformFromUrl('https://bsky.app/profile/weebles.bsky.social')).toBe('bluesky');
      expect(detectSocialPlatformFromUrl('https://www.snapchat.com/add/weebles_clay')).toBe('snapchat');
      expect(detectSocialPlatformFromUrl('https://discord.gg/weebles')).toBe('discord');
      expect(detectSocialPlatformFromUrl('https://discord.com/invite/weebles')).toBe('discord');
      expect(detectSocialPlatformFromUrl('https://www.twitch.tv/weebles_clay')).toBe('twitch');
      expect(detectSocialPlatformFromUrl('https://www.linkedin.com/in/weebles')).toBe('linkedin');
    });

    it('returns null for unknown domains or invalid URLs', () => {
      expect(detectSocialPlatformFromUrl('https://weeblesclay.shop')).toBeNull();
      expect(detectSocialPlatformFromUrl('not-a-url')).toBeNull();
      expect(detectSocialPlatformFromUrl('')).toBeNull();
    });
  });

  describe('getFallbackSubtitle and getSocialLinkLabel', () => {
    it('extracts @handle for handle-based platforms and domain/path for others', () => {
      const xLink: SocialLink = {
        id: '1',
        platform: 'x',
        url: 'https://x.com/weebles_clay',
        enabled: true,
      };
      expect(getSocialLinkLabel(xLink)).toBe('X');
      expect(getFallbackSubtitle(xLink)).toBe('@weebles_clay');

      const etsyLink: SocialLink = {
        id: '2',
        platform: 'etsy',
        url: 'https://www.etsy.com/shop/weeblesclay/',
        enabled: true,
        label: 'Our Etsy Shop',
      };
      expect(getSocialLinkLabel(etsyLink)).toBe('Our Etsy Shop');
      expect(getFallbackSubtitle(etsyLink)).toBe('etsy.com/shop/weeblesclay');
    });
  });

  describe('normalizeSettings and getVisibleSocialLinks', () => {
    it('migrates legacy socials object into 3 default socialLinks with socialLinksEnabled=true', () => {
      const legacy: Partial<SiteSettings> = {
        contactEmail: 'old@weebles.com',
        customOrderEmail: 'old@weebles.com',
        socials: {
          tiktok: 'https://tiktok.com/@legacy',
          instagram: 'https://instagram.com/legacy',
          facebookMarketplace: 'https://facebook.com/marketplace/legacy',
        },
      };

      const normalized = normalizeSettings(legacy, defaults);
      expect(normalized.socialLinksEnabled).toBe(true);
      expect(normalized.socialLinks).toHaveLength(3);
      expect(normalized.socialLinks![0]).toMatchObject({
        platform: 'tiktok',
        url: 'https://tiktok.com/@legacy',
        enabled: true,
      });
      expect(normalized.socialLinks![1]).toMatchObject({
        platform: 'instagram',
        url: 'https://instagram.com/legacy',
        enabled: true,
      });
      expect(normalized.socialLinks![2]).toMatchObject({
        platform: 'facebookMarketplace',
        url: 'https://facebook.com/marketplace/legacy',
        enabled: true,
      });
    });

    it('falls back unknown platforms to website during normalization', () => {
      const normalized = normalizeSettings(
        {
          socialLinksEnabled: true,
          socialLinks: [
            {
              id: 'weird-1',
              platform: 'myspace' as any,
              url: 'https://myspace.com/weebles',
              enabled: true,
            },
          ],
        },
        defaults
      );
      expect(normalized.socialLinks![0].platform).toBe('website');
    });

    it('returns empty array from getVisibleSocialLinks when master toggle is false', () => {
      const hiddenSettings: SiteSettings = {
        ...defaults,
        socialLinksEnabled: false,
        socialLinks: [
          { id: '1', platform: 'x', url: 'https://x.com/weebles', enabled: true },
        ],
      };
      expect(getVisibleSocialLinks(hiddenSettings)).toEqual([]);
    });

    it('filters out disabled links and unsafe URLs while preserving order', () => {
      const mixedSettings: SiteSettings = {
        ...defaults,
        socialLinksEnabled: true,
        socialLinks: [
          { id: '1', platform: 'x', url: 'https://x.com/weebles', enabled: true },
          { id: '2', platform: 'tiktok', url: 'https://tiktok.com/@weebles', enabled: false },
          { id: '3', platform: 'youtube', url: 'javascript:alert(1)', enabled: true },
          { id: '4', platform: 'etsy', url: 'https://etsy.com/shop/weebles', enabled: true },
        ],
      };
      const visible = getVisibleSocialLinks(mixedSettings);
      expect(visible.map((l) => l.id)).toEqual(['1', '4']);
    });

    it('syncs legacy socials fields from matching socialLinks', () => {
      const synced = syncLegacySocials([
        { id: '1', platform: 'tiktok', url: 'https://tiktok.com/@new', enabled: true },
        { id: '2', platform: 'x', url: 'https://x.com/new', enabled: true },
      ]);
      expect(synced).toEqual({
        tiktok: 'https://tiktok.com/@new',
        instagram: '',
        facebookMarketplace: '',
      });
    });
  });
});
```

In `tests/SettingsContext.test.tsx`, add two tests inside `describe('SettingsContext', ...)`:

```typescript
  it('migrates legacy localStorage settings without socialLinks into normalized socialLinks', () => {
    const legacyStored = {
      contactEmail: 'legacy@weebles.com',
      customOrderEmail: 'legacy@weebles.com',
      socials: {
        tiktok: 'https://tiktok.com/@legacy_user',
        instagram: 'https://instagram.com/legacy_user',
        facebookMarketplace: 'https://facebook.com/marketplace/legacy_user',
      },
    };
    localStorage.setItem('weebles_settings_v1', JSON.stringify(legacyStored));

    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.settings.socialLinksEnabled).toBe(true);
    expect(result.current.settings.socialLinks).toHaveLength(3);
    expect(result.current.settings.socialLinks?.[0].url).toBe('https://tiktok.com/@legacy_user');
    expect(result.current.settings.socialLinks?.[1].url).toBe('https://instagram.com/legacy_user');
    expect(result.current.settings.socialLinks?.[2].url).toBe('https://facebook.com/marketplace/legacy_user');
  });

  it('hydrates remote settings via hydrateSettings without writing to localStorage', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });

    act(() => {
      result.current.hydrateSettings({
        ...result.current.settings,
        socialLinksEnabled: false,
        socialLinks: [
          { id: 'x-1', platform: 'x', url: 'https://x.com/weebles_clay', enabled: true },
        ],
      });
    });

    expect(result.current.settings.socialLinksEnabled).toBe(false);
    expect(result.current.settings.socialLinks).toHaveLength(1);
    expect(localStorage.getItem('weebles_settings_v1')).toBeNull();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/socialPlatforms.test.ts tests/SettingsContext.test.tsx`
Expected: FAIL (`Cannot find module '../src/utils/socialPlatforms'` and `hydrateSettings is not a function`).

- [ ] **Step 3: Update `src/types/settings.ts` and `src/data/settings.json`**

Replace `src/types/settings.ts`:

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

Replace `src/data/settings.json`:

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

- [ ] **Step 4: Create `src/utils/socialPlatforms.ts`**

Create `src/utils/socialPlatforms.ts`:

```typescript
import { LegacySocials, SiteSettings, SocialLink, SocialPlatformId } from '../types/settings';

export interface SocialPlatformMeta {
  id: SocialPlatformId;
  pickerLabel: string;
  defaultLabel: string;
  badgeClass: string;
  placeholderUrl: string;
  defaultSubtitle: string;
}

export const SOCIAL_PLATFORM_LIST: SocialPlatformMeta[] = [
  {
    id: 'tiktok',
    pickerLabel: 'TikTok',
    defaultLabel: 'TikTok',
    badgeClass: 'bg-black text-white',
    placeholderUrl: 'https://tiktok.com/@weebles_clay',
    defaultSubtitle: '@weebles_clay • ASMR & BTS',
  },
  {
    id: 'instagram',
    pickerLabel: 'Instagram',
    defaultLabel: 'Instagram',
    badgeClass: 'bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white',
    placeholderUrl: 'https://instagram.com/weebles_clay',
    defaultSubtitle: '@weebles_clay • Gallery & Drops',
  },
  {
    id: 'facebook',
    pickerLabel: 'Facebook',
    defaultLabel: 'Facebook',
    badgeClass: 'bg-[#1877F2] text-white',
    placeholderUrl: 'https://facebook.com/weeblesclay',
    defaultSubtitle: 'Updates & Community',
  },
  {
    id: 'facebookMarketplace',
    pickerLabel: 'Facebook Marketplace',
    defaultLabel: 'Facebook Marketplace',
    badgeClass: 'bg-[#1877F2] text-white',
    placeholderUrl: 'https://facebook.com/marketplace',
    defaultSubtitle: 'Local Listings & Events',
  },
  {
    id: 'youtube',
    pickerLabel: 'YouTube',
    defaultLabel: 'YouTube',
    badgeClass: 'bg-[#FF0000] text-white',
    placeholderUrl: 'https://youtube.com/@weebles_clay',
    defaultSubtitle: 'Sculpting Videos & Vlogs',
  },
  {
    id: 'pinterest',
    pickerLabel: 'Pinterest',
    defaultLabel: 'Pinterest',
    badgeClass: 'bg-[#E60023] text-white',
    placeholderUrl: 'https://pinterest.com/weebles_clay',
    defaultSubtitle: 'Clay Inspo & Boards',
  },
  {
    id: 'etsy',
    pickerLabel: 'Etsy',
    defaultLabel: 'Etsy',
    badgeClass: 'bg-[#F1641E] text-white',
    placeholderUrl: 'https://etsy.com/shop/weeblesclay',
    defaultSubtitle: 'Handmade Shop Listings',
  },
  {
    id: 'x',
    pickerLabel: 'X (X.com)',
    defaultLabel: 'X',
    badgeClass: 'bg-black text-white',
    placeholderUrl: 'https://x.com/weebles_clay',
    defaultSubtitle: 'Restock Alerts & News',
  },
  {
    id: 'threads',
    pickerLabel: 'Threads',
    defaultLabel: 'Threads',
    badgeClass: 'bg-neutral-900 text-white',
    placeholderUrl: 'https://threads.net/@weebles_clay',
    defaultSubtitle: 'Daily Studio Notes',
  },
  {
    id: 'bluesky',
    pickerLabel: 'Bluesky',
    defaultLabel: 'Bluesky',
    badgeClass: 'bg-[#0085FF] text-white',
    placeholderUrl: 'https://bsky.app/profile/weebles.bsky.social',
    defaultSubtitle: 'Studio Updates & Drops',
  },
  {
    id: 'snapchat',
    pickerLabel: 'Snapchat',
    defaultLabel: 'Snapchat',
    badgeClass: 'bg-[#FFFC00] text-black',
    placeholderUrl: 'https://snapchat.com/add/weebles_clay',
    defaultSubtitle: 'Behind-the-Scenes Snaps',
  },
  {
    id: 'discord',
    pickerLabel: 'Discord',
    defaultLabel: 'Discord',
    badgeClass: 'bg-[#5865F2] text-white',
    placeholderUrl: 'https://discord.gg/weebles',
    defaultSubtitle: 'Join the Clay Community',
  },
  {
    id: 'twitch',
    pickerLabel: 'Twitch',
    defaultLabel: 'Twitch',
    badgeClass: 'bg-[#9146FF] text-white',
    placeholderUrl: 'https://twitch.tv/weebles_clay',
    defaultSubtitle: 'Live Sculpting Streams',
  },
  {
    id: 'linkedin',
    pickerLabel: 'LinkedIn',
    defaultLabel: 'LinkedIn',
    badgeClass: 'bg-[#0A66C2] text-white',
    placeholderUrl: 'https://linkedin.com/in/weebles',
    defaultSubtitle: 'Studio & Wholesale',
  },
  {
    id: 'website',
    pickerLabel: 'Website / Other',
    defaultLabel: 'Website',
    badgeClass: 'bg-weeble-pink text-white',
    placeholderUrl: 'https://example.com',
    defaultSubtitle: 'Visit Our Link',
  },
];

export const SOCIAL_PLATFORMS: Record<SocialPlatformId, SocialPlatformMeta> =
  SOCIAL_PLATFORM_LIST.reduce((acc, meta) => {
    acc[meta.id] = meta;
    return acc;
  }, {} as Record<SocialPlatformId, SocialPlatformMeta>);

const VALID_PLATFORM_IDS = new Set<string>(SOCIAL_PLATFORM_LIST.map((p) => p.id));

export function isValidPlatformId(value: unknown): value is SocialPlatformId {
  return typeof value === 'string' && VALID_PLATFORM_IDS.has(value);
}

export function getSocialPlatformMeta(platform: string): SocialPlatformMeta {
  return isValidPlatformId(platform) ? SOCIAL_PLATFORMS[platform] : SOCIAL_PLATFORMS.website;
}

export function isSafeHttpUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function detectSocialPlatformFromUrl(url: string): SocialPlatformId | null {
  if (!isSafeHttpUrl(url)) return null;
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const pathname = parsed.pathname.toLowerCase();

    if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return 'tiktok';
    if (host === 'instagram.com' || host.endsWith('.instagram.com')) return 'instagram';
    if (
      host === 'facebook.com' ||
      host.endsWith('.facebook.com') ||
      host === 'fb.com' ||
      host.endsWith('.fb.com')
    ) {
      if (pathname.startsWith('/marketplace')) return 'facebookMarketplace';
      return 'facebook';
    }
    if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be') return 'youtube';
    if (host === 'pinterest.com' || host.endsWith('.pinterest.com') || host === 'pin.it') return 'pinterest';
    if (host === 'etsy.com' || host.endsWith('.etsy.com')) return 'etsy';
    if (
      host === 'x.com' ||
      host.endsWith('.x.com') ||
      host === 'twitter.com' ||
      host.endsWith('.twitter.com')
    ) {
      return 'x';
    }
    if (
      host === 'threads.net' ||
      host.endsWith('.threads.net') ||
      host === 'threads.com' ||
      host.endsWith('.threads.com')
    ) {
      return 'threads';
    }
    if (host === 'bsky.app' || host.endsWith('.bsky.app')) return 'bluesky';
    if (host === 'snapchat.com' || host.endsWith('.snapchat.com')) return 'snapchat';
    if (
      host === 'discord.gg' ||
      host === 'discord.com' ||
      host.endsWith('.discord.com')
    ) {
      return 'discord';
    }
    if (host === 'twitch.tv' || host.endsWith('.twitch.tv')) return 'twitch';
    if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) return 'linkedin';

    return null;
  } catch {
    return null;
  }
}

export function getSocialLinkLabel(link: SocialLink): string {
  const custom = link.label?.trim();
  if (custom) return custom;
  return getSocialPlatformMeta(link.platform).defaultLabel;
}

const HANDLE_PLATFORMS = new Set<SocialPlatformId>([
  'tiktok',
  'instagram',
  'x',
  'youtube',
  'threads',
  'pinterest',
  'twitch',
  'snapchat',
]);

export function getFallbackSubtitle(link: SocialLink): string {
  const meta = getSocialPlatformMeta(link.platform);
  if (!isSafeHttpUrl(link.url)) return meta.defaultSubtitle;

  try {
    const parsed = new URL(link.url.trim());
    const host = parsed.hostname.replace(/^www\./, '');
    const segments = parsed.pathname.split('/').filter(Boolean);

    if (HANDLE_PLATFORMS.has(link.platform) && segments.length > 0) {
      const candidate =
        link.platform === 'snapchat' && segments[0].toLowerCase() === 'add' && segments[1]
          ? segments[1]
          : segments[0];
      const cleaned = candidate.replace(/^@/, '');
      if (cleaned) return `@${cleaned}`;
    }

    const cleanPath = parsed.pathname.replace(/\/+$/, '');
    return cleanPath && cleanPath !== '/' ? `${host}${cleanPath}` : host;
  } catch {
    return meta.defaultSubtitle;
  }
}

export function normalizeSocialLinks(
  raw: Partial<SiteSettings> | undefined,
  defaults?: SiteSettings
): SocialLink[] {
  if (Array.isArray(raw?.socialLinks)) {
    return raw.socialLinks.map((item, idx) => {
      const platform: SocialPlatformId = isValidPlatformId(item?.platform)
        ? item.platform
        : 'website';
      const label = typeof item?.label === 'string' && item.label.trim() ? item.label.trim() : undefined;
      const subtitle =
        typeof item?.subtitle === 'string' && item.subtitle.trim() ? item.subtitle.trim() : undefined;

      return {
        id: typeof item?.id === 'string' && item.id.trim() ? item.id.trim() : `social-${platform}-${idx}`,
        platform,
        url: typeof item?.url === 'string' ? item.url.trim() : '',
        enabled: typeof item?.enabled === 'boolean' ? item.enabled : true,
        ...(label ? { label } : {}),
        ...(subtitle ? { subtitle } : {}),
      };
    });
  }

  const legacy = raw?.socials;
  if (legacy && typeof legacy === 'object') {
    const migrated: SocialLink[] = [];
    if (typeof legacy.tiktok === 'string') {
      migrated.push({
        id: 'tiktok-default',
        platform: 'tiktok',
        url: legacy.tiktok.trim(),
        enabled: true,
        label: 'TikTok',
        subtitle: '@weebles_clay • ASMR & BTS',
      });
    }
    if (typeof legacy.instagram === 'string') {
      migrated.push({
        id: 'instagram-default',
        platform: 'instagram',
        url: legacy.instagram.trim(),
        enabled: true,
        label: 'Instagram',
        subtitle: '@weebles_clay • Gallery & Drops',
      });
    }
    if (typeof legacy.facebookMarketplace === 'string') {
      migrated.push({
        id: 'facebook-marketplace-default',
        platform: 'facebookMarketplace',
        url: legacy.facebookMarketplace.trim(),
        enabled: true,
        label: 'Facebook Marketplace',
        subtitle: 'Local Listings & Events',
      });
    }
    if (migrated.length > 0) return migrated;
  }

  if (Array.isArray(defaults?.socialLinks)) {
    return defaults.socialLinks.map((link) => ({ ...link }));
  }

  return [];
}

export function syncLegacySocials(
  links: SocialLink[],
  fallback?: Partial<LegacySocials>
): LegacySocials {
  const findFirst = (platform: SocialPlatformId) =>
    links.find((l) => l.platform === platform)?.url?.trim();

  return {
    tiktok: findFirst('tiktok') ?? fallback?.tiktok ?? '',
    instagram: findFirst('instagram') ?? fallback?.instagram ?? '',
    facebookMarketplace: findFirst('facebookMarketplace') ?? fallback?.facebookMarketplace ?? '',
  };
}

export function normalizeSettings(
  raw: Partial<SiteSettings> | undefined,
  defaults: SiteSettings
): SiteSettings {
  const socialLinks = normalizeSocialLinks(raw, defaults);
  const socialLinksEnabled =
    typeof raw?.socialLinksEnabled === 'boolean'
      ? raw.socialLinksEnabled
      : typeof defaults.socialLinksEnabled === 'boolean'
        ? defaults.socialLinksEnabled
        : true;

  const socials: LegacySocials = {
    tiktok: raw?.socials?.tiktok ?? defaults.socials?.tiktok ?? '',
    instagram: raw?.socials?.instagram ?? defaults.socials?.instagram ?? '',
    facebookMarketplace:
      raw?.socials?.facebookMarketplace ?? defaults.socials?.facebookMarketplace ?? '',
  };

  return {
    ...defaults,
    ...raw,
    socials,
    socialLinksEnabled,
    socialLinks,
  };
}

export function getVisibleSocialLinks(settings: SiteSettings | undefined): SocialLink[] {
  if (!settings) return [];
  if (settings.socialLinksEnabled === false) return [];
  const links = normalizeSocialLinks(settings);
  return links.filter((link) => link.enabled && isSafeHttpUrl(link.url));
}
```

- [ ] **Step 5: Update `src/context/SettingsContext.tsx`, `src/components/admin/SettingsTab.tsx`, `src/App.tsx`, and `src/components/admin/AdminPortal.tsx`**

Replace `src/context/SettingsContext.tsx`:

```typescript
import React, { createContext, useCallback, useContext, useState } from 'react';
import { SiteSettings } from '../types/settings';
import defaultSettingsData from '../data/settings.json';
import { normalizeSettings } from '../utils/socialPlatforms';

export interface SettingsContextType {
  settings: SiteSettings;
  updateSettings: (newSettings: SiteSettings) => void;
  hydrateSettings: (remoteSettings: SiteSettings) => void;
  resetSettings: () => void;
}

export const SETTINGS_STORAGE_KEY = 'weebles_settings_v1';
const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const rawDefaults = defaultSettingsData as SiteSettings;
export const DEFAULT_SETTINGS: SiteSettings = normalizeSettings(rawDefaults, rawDefaults);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SiteSettings>(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return normalizeSettings(parsed, DEFAULT_SETTINGS);
      }
    } catch {
      // Fallback
    }
    return DEFAULT_SETTINGS;
  });

  const updateSettings = useCallback((newSettings: SiteSettings) => {
    const normalized = normalizeSettings(newSettings, DEFAULT_SETTINGS);
    setSettings(normalized);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Ignore
    }
  }, []);

  const hydrateSettings = useCallback((remoteSettings: SiteSettings) => {
    const normalized = normalizeSettings(remoteSettings, DEFAULT_SETTINGS);
    setSettings(normalized);
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, hydrateSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    return {
      settings: DEFAULT_SETTINGS,
      updateSettings: () => {},
      hydrateSettings: () => {},
      resetSettings: () => {},
    };
  }
  return context;
};
```

In `src/components/admin/SettingsTab.tsx`, safely read optional `settings.socials`:

```typescript
  const [tiktok, setTiktok] = useState(settings.socials?.tiktok ?? '');
  const [instagram, setInstagram] = useState(settings.socials?.instagram ?? '');
  const [facebookMarketplace, setFacebookMarketplace] = useState(settings.socials?.facebookMarketplace ?? '');
```

In `src/App.tsx`, update imports (`SETTINGS_STORAGE_KEY`) and hydrate remote `settings` when `SETTINGS_STORAGE_KEY` is not cached locally:

```typescript
import { SettingsProvider, useSettings, SETTINGS_STORAGE_KEY } from './context/SettingsContext';
```

And inside `AppContent`:

```typescript
  const { settings, hydrateSettings } = useSettings();
```

```typescript
  useEffect(() => {
    if (import.meta.env.MODE === 'test') return;
    const hasStoredProducts = Boolean(localStorage.getItem(PRODUCTS_STORAGE_KEY));
    const hasStoredSettings = Boolean(localStorage.getItem(SETTINGS_STORAGE_KEY));
    if (hasStoredProducts && hasStoredSettings) return;

    adminApi.loadStoreData().then((data) => {
      if (!hasStoredProducts && data?.products && Array.isArray(data.products)) {
        setProducts(data.products);
        saveStoredProducts(data.products);
      }
      if (!hasStoredSettings && data?.settings && typeof data.settings === 'object') {
        hydrateSettings(data.settings);
      }
    });
  }, [hydrateSettings]);
```

In `src/components/admin/AdminPortal.tsx`, import `SETTINGS_STORAGE_KEY` and hydrate remote `settings` inside the existing `adminApi.loadStoreData()` effect:

```typescript
import { useSettings, SETTINGS_STORAGE_KEY } from '../../context/SettingsContext';
```

```typescript
  const { settings, updateSettings, hydrateSettings } = useSettings();
```

```typescript
  useEffect(() => {
    if (import.meta.env.MODE === 'test') return;
    adminApi.loadStoreData().then((data) => {
      if (!localStorage.getItem(PRODUCTS_STORAGE_KEY) && data?.products && Array.isArray(data.products)) {
        setProducts(data.products);
        saveStoredProducts(data.products);
      }
      if (!localStorage.getItem(SETTINGS_STORAGE_KEY) && data?.settings && typeof data.settings === 'object') {
        hydrateSettings(data.settings);
      }
      if (data?.changes && Array.isArray(data.changes)) {
        setChanges((prev) => {
          const merged = mergeChanges(prev, data.changes!);
          saveStoredChanges(merged);
          return merged;
        });
      }
    });
  }, [hydrateSettings]);
```

In `src/utils/changeLogUtils.ts`, extend `diffSettingsChanges` to also record changes to `socialLinksEnabled` and `socialLinks` whenever either setting includes those fields (preserving all existing legacy comparisons unchanged):

```typescript
  if (
    typeof oldSettings.socialLinksEnabled === 'boolean' ||
    typeof newSettings.socialLinksEnabled === 'boolean'
  ) {
    comparisons.push({
      label: 'Site Content - Social Media Links Enabled',
      oldVal: String(oldSettings.socialLinksEnabled ?? true),
      newVal: String(newSettings.socialLinksEnabled ?? true),
    });
  }

  if (Array.isArray(oldSettings.socialLinks) || Array.isArray(newSettings.socialLinks)) {
    const summarizeLinks = (links?: SiteSettings['socialLinks']) =>
      (links || [])
        .map((l) => `${l.platform}:${l.url || '(empty)'} [${l.enabled ? 'on' : 'off'}]`)
        .join(', ') || '(none)';

    comparisons.push({
      label: 'Site Content - Social Media Links',
      oldVal: summarizeLinks(oldSettings.socialLinks),
      newVal: summarizeLinks(newSettings.socialLinks),
    });
  }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/socialPlatforms.test.ts tests/SettingsContext.test.tsx tests/SettingsTab.test.tsx tests/changeLogUtils.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/types/settings.ts src/data/settings.json src/utils/socialPlatforms.ts src/context/SettingsContext.tsx src/components/admin/SettingsTab.tsx src/App.tsx src/components/admin/AdminPortal.tsx src/utils/changeLogUtils.ts tests/socialPlatforms.test.ts tests/SettingsContext.test.tsx tests/changeLogUtils.test.ts
git commit -m "feat(socials): add social link data model, platform registry, and settings migration"
```

---

### Task 2: Standard Brand SVG Icons (`SocialIcon`), Dynamic `SocialStrip`, and Compact `Footer` Icons

**Files:**
- Create: `src/components/SocialIcon.tsx`
- Modify: `src/components/SocialStrip.tsx:1-94`
- Modify: `src/components/Footer.tsx:1-72`
- Modify: `tests/SocialStrip.test.tsx:1-43`
- Create: `tests/Footer.test.tsx`

**Interfaces:**
- Consumes:
  - `SocialPlatformId`, `SiteSettings` from `src/types/settings.ts`
  - `getSocialPlatformMeta`, `getSocialLinkLabel`, `getFallbackSubtitle`, `getVisibleSocialLinks` from `src/utils/socialPlatforms.ts`
  - `useSettings`, `SettingsProvider`, `SETTINGS_STORAGE_KEY` from `src/context/SettingsContext.tsx`
- Produces:
  - `SocialIcon({ platform, className })` and `SocialIconBadge({ platform, size })` in `src/components/SocialIcon.tsx`
  - Dynamic, toggleable `SocialStrip` in `src/components/SocialStrip.tsx`
  - Compact social icon row in `Footer` (`src/components/Footer.tsx`)

- [ ] **Step 1: Write the failing component tests in `tests/SocialStrip.test.tsx` and `tests/Footer.test.tsx`**

Update `tests/SocialStrip.test.tsx`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SocialStrip } from '../src/components/SocialStrip';
import { SettingsProvider, SETTINGS_STORAGE_KEY, DEFAULT_SETTINGS } from '../src/context/SettingsContext';
import { SiteSettings } from '../src/types/settings';

const renderWithSettings = (override?: Partial<SiteSettings>) => {
  if (override) {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_SETTINGS, ...override })
    );
  }
  return render(
    <SettingsProvider>
      <SocialStrip />
    </SettingsProvider>
  );
};

describe('SocialStrip', () => {
  beforeEach(() => {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
  });

  it('renders TikTok, Instagram, and Facebook Marketplace links by default', () => {
    render(<SocialStrip />);

    expect(screen.getByText(/TikTok/i)).toBeInTheDocument();
    expect(screen.getByText(/Instagram/i)).toBeInTheDocument();
    expect(screen.getByText(/Facebook Marketplace/i)).toBeInTheDocument();
  });

  it('renders section title and creator spotlight description', () => {
    render(<SocialStrip />);

    expect(screen.getByText(/Behind the Scenes & Restocks/i)).toBeInTheDocument();
    expect(screen.getByText(/Follow the Sculpting Journey!/i)).toBeInTheDocument();
    expect(screen.getByText(/Watch our clay ASMR sculpting clips/i)).toBeInTheDocument();
  });

  it('contains correct external URLs with secure attributes and brand SVG icons', () => {
    const { container } = render(<SocialStrip />);

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(3);

    const tiktokLink = screen.getByRole('link', { name: /TikTok/i });
    expect(tiktokLink).toHaveAttribute('href', 'https://tiktok.com/@weebles_clay');
    expect(tiktokLink).toHaveAttribute('target', '_blank');
    expect(tiktokLink).toHaveAttribute('rel', 'noopener noreferrer');

    const instaLink = screen.getByRole('link', { name: /Instagram/i });
    expect(instaLink).toHaveAttribute('href', 'https://instagram.com/weebles_clay');

    const fbLink = screen.getByRole('link', { name: /Facebook Marketplace/i });
    expect(fbLink).toHaveAttribute('href', 'https://facebook.com/marketplace');

    expect(container.querySelector('[data-social-icon="tiktok"]')).toBeInTheDocument();
    expect(container.querySelector('[data-social-icon="instagram"]')).toBeInTheDocument();
    expect(container.querySelector('[data-social-icon="facebookMarketplace"]')).toBeInTheDocument();
  });

  it('hides the entire section when master socialLinksEnabled is false', () => {
    const { container } = renderWithSettings({ socialLinksEnabled: false });
    expect(container).toBeEmptyDOMElement();
  });

  it('hides individually disabled links and hides entire section when all links are disabled', () => {
    const { unmount } = renderWithSettings({
      socialLinksEnabled: true,
      socialLinks: [
        { id: '1', platform: 'x', url: 'https://x.com/weebles_clay', enabled: true },
        { id: '2', platform: 'tiktok', url: 'https://tiktok.com/@weebles_clay', enabled: false },
      ],
    });

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', 'https://x.com/weebles_clay');
    expect(screen.getByText('@weebles_clay')).toBeInTheDocument();
    expect(screen.queryByText(/TikTok/i)).not.toBeInTheDocument();
    unmount();

    const { container } = renderWithSettings({
      socialLinksEnabled: true,
      socialLinks: [
        { id: '1', platform: 'x', url: 'https://x.com/weebles_clay', enabled: false },
      ],
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('renders added platforms like X, YouTube, and Etsy with adaptive grid', () => {
    const { container } = renderWithSettings({
      socialLinksEnabled: true,
      socialLinks: [
        { id: '1', platform: 'x', url: 'https://x.com/weebles_clay', enabled: true, subtitle: 'Drops & News' },
        { id: '2', platform: 'youtube', url: 'https://youtube.com/@weebles_clay', enabled: true },
        { id: '3', platform: 'etsy', url: 'https://etsy.com/shop/weeblesclay', enabled: true },
        { id: '4', platform: 'pinterest', url: 'https://pinterest.com/weebles_clay', enabled: true },
      ],
    });

    expect(screen.getAllByRole('link')).toHaveLength(4);
    expect(screen.getByText('Drops & News')).toBeInTheDocument();
    expect(container.querySelector('[data-social-icon="x"]')).toBeInTheDocument();
    expect(container.querySelector('[data-social-icon="youtube"]')).toBeInTheDocument();
    expect(container.querySelector('[data-social-icon="etsy"]')).toBeInTheDocument();
    expect(container.querySelector('[data-social-icon="pinterest"]')).toBeInTheDocument();
  });
});
```

Create `tests/Footer.test.tsx`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from '../src/components/Footer';
import { SettingsProvider, SETTINGS_STORAGE_KEY, DEFAULT_SETTINGS } from '../src/context/SettingsContext';
import { SiteSettings } from '../src/types/settings';

const renderFooter = (override?: Partial<SiteSettings>) => {
  if (override) {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_SETTINGS, ...override })
    );
  }
  return render(
    <SettingsProvider>
      <Footer />
    </SettingsProvider>
  );
};

describe('Footer', () => {
  beforeEach(() => {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
  });

  it('renders compact social icon links in order with accessible labels and secure attributes', () => {
    const { container } = renderFooter({
      socialLinksEnabled: true,
      socialLinks: [
        { id: '1', platform: 'x', url: 'https://x.com/weebles_clay', enabled: true },
        { id: '2', platform: 'instagram', url: 'https://instagram.com/weebles_clay', enabled: true },
        { id: '3', platform: 'tiktok', url: 'https://tiktok.com/@weebles_clay', enabled: false },
      ],
    });

    const xLink = screen.getByRole('link', { name: /Visit us on X/i });
    const igLink = screen.getByRole('link', { name: /Visit us on Instagram/i });
    expect(xLink).toHaveAttribute('href', 'https://x.com/weebles_clay');
    expect(xLink).toHaveAttribute('target', '_blank');
    expect(xLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(igLink).toHaveAttribute('href', 'https://instagram.com/weebles_clay');
    expect(screen.queryByRole('link', { name: /Visit us on TikTok/i })).not.toBeInTheDocument();
    expect(container.querySelector('[data-social-icon="x"]')).toBeInTheDocument();
  });

  it('hides the social icon bar when socialLinksEnabled is false or no links are enabled', () => {
    const { unmount } = renderFooter({ socialLinksEnabled: false });
    expect(screen.queryByLabelText(/Social media links/i)).not.toBeInTheDocument();
    unmount();

    renderFooter({
      socialLinksEnabled: true,
      socialLinks: [
        { id: '1', platform: 'x', url: 'https://x.com/weebles_clay', enabled: false },
      ],
    });
    expect(screen.queryByLabelText(/Social media links/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/SocialStrip.test.tsx tests/Footer.test.tsx`
Expected: FAIL (`[data-social-icon="tiktok"]` not found, master toggle doesn't hide `SocialStrip`, `Footer` doesn't render social icons).

- [ ] **Step 3: Create `src/components/SocialIcon.tsx`**

Create `src/components/SocialIcon.tsx`:

```typescript
import React from 'react';
import { Globe } from 'lucide-react';
import { SocialPlatformId } from '../types/settings';
import { getSocialPlatformMeta } from '../utils/socialPlatforms';

const BRAND_SVG_PATHS: Partial<Record<SocialPlatformId, string>> = {
  tiktok:
    'M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z',
  instagram:
    'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z',
  facebook:
    'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
  facebookMarketplace:
    'M20 4H4l-1 5v2h1v9h10v-6h4v6h2v-9h1V9l-1-5zm-8 14H6v-4h6v4zm7-9H5l.6-3h12.8l.6 3z',
  youtube:
    'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
  pinterest:
    'M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z',
  etsy:
    'M8.56 3.51c0-.32.06-.49.55-.49h5.82c1.22 0 1.88.91 2.24 2.52l.37 1.46h.95c.18-2.25.43-4.53.52-5.22-1.92.12-3.41.18-5.08.18H8.31C6.88 1.96 5.21 1.9 3.63 1.84v.91l1.28.25c.91.18 1.16.46 1.22 1.37.06.79.09 2.46.09 5.05v4.86c0 2.59-.03 4.26-.09 5.05-.06.91-.31 1.19-1.22 1.37l-1.28.25v.91c1.58-.06 3.25-.12 4.68-.12h6.08c1.67 0 3.74.06 5.14.18.21-.94.79-4.13.94-5.41h-.91l-.82 1.82c-.7 1.55-1.52 2.22-3.04 2.22h-4.74c-1.82 0-2.4-.52-2.4-2.16v-5.74h3.59c1.52 0 2.1.49 2.37 1.7l.33 1.43h.94c0-1.12-.06-2.55-.06-3.77 0-1.22.06-2.62.06-3.68h-.94l-.33 1.34c-.27 1.19-.85 1.67-2.37 1.67H8.56V3.51z',
  x:
    'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  threads:
    'M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z',
  bluesky:
    'M5.202 2.857C7.954 4.922 10.913 9.11 12 11.358c1.087-2.247 4.046-6.436 6.798-8.501C20.783 1.366 24 .213 24 3.883c0 .732-.42 6.156-.667 7.037-.856 3.061-3.978 3.842-6.755 3.37 4.854.826 6.089 3.562 3.422 6.299-5.065 5.196-7.28-1.304-7.847-2.97-.104-.305-.152-.448-.153-.327 0-.121-.05.022-.153.327-.568 1.666-2.782 8.166-7.847 2.97-2.667-2.737-1.432-5.473 3.422-6.3-2.777.473-5.899-.308-6.755-3.369C.42 10.04 0 4.615 0 3.883c0-3.67 3.217-2.517 5.202-1.026z',
  snapchat:
    'M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288-.06 0-.119-.015-.18-.015h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.031-.063-.052-.15-.055-.225-.015-.243.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809-.121-.029-.24-.074-.346-.119-1.107-.435-1.257-.93-1.197-1.273.09-.479.674-.793 1.168-.793.146 0 .27.029.383.074.42.194.789.3 1.104.3.234 0 .384-.06.465-.105l-.046-.569c-.098-1.626-.225-3.651.307-4.837C7.392 1.077 10.739.807 11.727.807l.419-.015h.06z',
  discord:
    'M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z',
  twitch:
    'M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z',
  linkedin:
    'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
};

export interface SocialIconProps {
  platform: SocialPlatformId;
  className?: string;
}

export const SocialIcon: React.FC<SocialIconProps> = ({ platform, className = 'w-5 h-5' }) => {
  const path = BRAND_SVG_PATHS[platform];
  if (!path) {
    return <Globe className={className} aria-hidden="true" data-social-icon={platform} />;
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      data-social-icon={platform}
      className={className}
    >
      <path d={path} />
    </svg>
  );
};

export interface SocialIconBadgeProps {
  platform: SocialPlatformId;
  size?: 'sm' | 'md' | 'admin';
}

const SIZE_CLASSES: Record<'sm' | 'md' | 'admin', { box: string; icon: string }> = {
  sm: { box: 'w-9 h-9 rounded-xl', icon: 'w-4 h-4' },
  admin: { box: 'w-10 h-10 rounded-xl', icon: 'w-5 h-5' },
  md: { box: 'w-12 h-12 rounded-xl', icon: 'w-6 h-6' },
};

export const SocialIconBadge: React.FC<SocialIconBadgeProps> = ({ platform, size = 'md' }) => {
  const meta = getSocialPlatformMeta(platform);
  const dims = SIZE_CLASSES[size];

  return (
    <div
      className={`${dims.box} ${meta.badgeClass} flex items-center justify-center shrink-0 shadow-sm`}
    >
      <SocialIcon platform={meta.id} className={dims.icon} />
    </div>
  );
};
```

- [ ] **Step 4: Update `src/components/SocialStrip.tsx` and `src/components/Footer.tsx`**

Replace `src/components/SocialStrip.tsx`:

```typescript
import React from 'react';
import { ExternalLink } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import {
  getFallbackSubtitle,
  getSocialLinkLabel,
  getVisibleSocialLinks,
} from '../utils/socialPlatforms';
import { SocialIconBadge } from './SocialIcon';

function getGridClass(count: number): string {
  if (count === 1) return 'grid grid-cols-1 max-w-md mx-auto gap-4';
  if (count === 2) return 'grid grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto gap-4';
  if (count === 3) return 'grid grid-cols-1 md:grid-cols-3 gap-4';
  return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4';
}

export const SocialStrip: React.FC = () => {
  const { settings } = useSettings();
  const visibleLinks = getVisibleSocialLinks(settings);

  if (visibleLinks.length === 0) {
    return null;
  }

  return (
    <section
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
      aria-label="Social links and creator spotlight"
    >
      <div className="bg-gradient-to-r from-pink-100 via-weeble-pinkWash to-purple-100 rounded-3xl p-6 sm:p-8 border-2 border-pink-200 shadow-pillow">
        <div className="text-center max-w-2xl mx-auto mb-6">
          <span className="text-xs font-bold text-pink-600 bg-white px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
            ✨ Behind the Scenes & Restocks
          </span>
          <h2 className="font-bubble text-2xl sm:text-3xl font-bold text-weeble-text mt-2 mb-1">
            Follow the Sculpting Journey!
          </h2>
          <p className="text-xs sm:text-sm text-weeble-textMuted">
            Watch our clay ASMR sculpting clips, packaging videos with cute stickers, and catch live restock alerts!
          </p>
        </div>

        <div className={getGridClass(visibleLinks.length)}>
          {visibleLinks.map((link) => {
            const label = getSocialLinkLabel(link);
            const subtitle = link.subtitle?.trim() || getFallbackSubtitle(link);

            return (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-white p-5 rounded-2xl border-2 border-pink-200 hover:border-weeble-pink hover:-translate-y-1 transition-all shadow-sm flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <SocialIconBadge platform={link.platform} size="md" />
                  <div className="min-w-0">
                    <h3 className="font-bubble text-base font-bold text-weeble-text group-hover:text-weeble-pink transition-colors truncate">
                      {label}
                    </h3>
                    <p className="text-xs text-weeble-textMuted truncate">{subtitle}</p>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-pink-300 group-hover:text-weeble-pink transition-colors shrink-0" />
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
};
```

Update `src/components/Footer.tsx`:

```typescript
import React from 'react';
import { Heart } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { getSocialLinkLabel, getVisibleSocialLinks } from '../utils/socialPlatforms';
import { SocialIconBadge } from './SocialIcon';

export const Footer: React.FC = () => {
  const { settings } = useSettings();
  const contactEmail = settings?.contactEmail || 'weeblesclay@gmail.com';
  const visibleSocials = getVisibleSocialLinks(settings);

  return (
    <footer id="about" className="bg-white border-t-2 border-pink-100 pt-12 pb-8 px-4 sm:px-6 lg:px-8 mt-16">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
        {/* Brand statement */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">🍓</span>
            <span className="font-bubble text-2xl font-bold text-weeble-pink">Weebles Clay</span>
          </div>
          <p className="text-sm text-weeble-textMuted leading-relaxed">
            Handcrafted with patience, pigment, and love. Bringing a dash of playful sweetness to everyday items like refrigerator doors, keyrings, and backpacks.
          </p>
        </div>

        {/* Clay Care instructions */}
        <div className="bg-weeble-pinkBg p-5 rounded-3xl border border-pink-100">
          <h3 className="font-bubble text-lg font-bold text-weeble-text mb-2 flex items-center gap-1.5">
            <span>✨</span> Clay Care Instructions
          </h3>
          <ul className="text-xs text-weeble-textMuted space-y-1.5">
            <li>• Water-resistant UV resin finish (do not soak or run through dishwasher).</li>
            <li>• Clean gently with a soft microfiber cloth or damp wipe.</li>
            <li>• Handle with love! Strong neodymium magnets are embedded securely.</li>
          </ul>
        </div>

        {/* Quick Links & Contact */}
        <div>
          <h3 className="font-bubble text-lg font-bold text-weeble-text mb-2">
            Get in Touch
          </h3>
          <p className="text-sm text-weeble-textMuted mb-2">
            Questions about restocks or wholesale?
          </p>
          <a
            href={`mailto:${contactEmail}`}
            className="text-sm font-bold text-weeble-pink hover:underline"
          >
            {contactEmail}
          </a>
          <p className="text-xs text-weeble-textMuted mt-3">
            📦 Ships safely bubble-wrapped with collectible stickers and surprise candy!
          </p>

          {visibleSocials.length > 0 && (
            <div
              className="flex flex-wrap items-center gap-2 mt-4"
              aria-label="Social media links"
            >
              {visibleSocials.map((link) => {
                const label = getSocialLinkLabel(link);
                return (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Visit us on ${label}`}
                    title={label}
                    className="hover:-translate-y-0.5 hover:opacity-90 transition-all rounded-xl focus:outline-none focus:ring-2 focus:ring-weeble-pink"
                  >
                    <SocialIconBadge platform={link.platform} size="sm" />
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-pink-100 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-weeble-textMuted gap-2">
        <div className="flex items-center justify-center gap-1">
          <span>© {new Date().getFullYear()} Weebles Studio. Handcrafted with</span>
          <Heart className="w-3.5 h-3.5 text-weeble-pink fill-weeble-pink" />
          <span>for clay lovers everywhere.</span>
        </div>
        <div>
          <a
            href="/admin"
            className="text-xs text-pink-300 hover:text-weeble-pink transition-colors font-medium flex items-center gap-1"
          >
            Studio Login 🍓
          </a>
        </div>
      </div>
    </footer>
  );
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/SocialStrip.test.tsx tests/Footer.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/SocialIcon.tsx src/components/SocialStrip.tsx src/components/Footer.tsx tests/SocialStrip.test.tsx tests/Footer.test.tsx
git commit -m "feat(store): render standard social brand icons in SocialStrip and Footer with visibility toggles"
```

---

### Task 3: Admin Portal `SocialLinksEditor` & `ContentTab` Integration

**Files:**
- Create: `src/components/admin/SocialLinksEditor.tsx`
- Modify: `src/components/admin/ContentTab.tsx:1-223`
- Modify: `tests/ContentTab.test.tsx:1-94`

**Interfaces:**
- Consumes:
  - `SiteSettings`, `SocialLink`, `SocialPlatformId` from `src/types/settings.ts`
  - `SOCIAL_PLATFORM_LIST`, `getSocialPlatformMeta`, `getSocialLinkLabel`, `detectSocialPlatformFromUrl`, `isSafeHttpUrl`, `normalizeSettings`, `syncLegacySocials` from `src/utils/socialPlatforms.ts`
  - `SocialIconBadge` from `src/components/SocialIcon.tsx`
- Produces:
  - `SocialLinksEditor` component in `src/components/admin/SocialLinksEditor.tsx`
  - Updated `ContentTab` in `src/components/admin/ContentTab.tsx` saving `socialLinksEnabled`, sanitized `socialLinks`, and synced legacy `socials`

- [ ] **Step 1: Write the failing tests in `tests/ContentTab.test.tsx`**

Update `tests/ContentTab.test.tsx` to preserve existing banner/email/save coverage and add tests for master toggle, per-link toggle, adding a new social link with URL auto-detection (including `x.com`), editing label/subtitle, reordering up/down, deleting a link, and URL validation on save:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ContentTab } from '../src/components/admin/ContentTab';
import { SiteSettings } from '../src/types/settings';

const mockSettings: SiteSettings = {
  contactEmail: 'weeblesclay@gmail.com',
  customOrderEmail: 'customorders@weeblesclay.com',
  socials: {
    tiktok: 'https://tiktok.com/@weebles_clay',
    instagram: 'https://instagram.com/weebles_clay',
    facebookMarketplace: 'https://facebook.com/marketplace',
  },
  socialLinksEnabled: true,
  socialLinks: [
    {
      id: 'tiktok-1',
      platform: 'tiktok',
      url: 'https://tiktok.com/@weebles_clay',
      enabled: true,
      label: 'TikTok',
      subtitle: '@weebles_clay • ASMR & BTS',
    },
    {
      id: 'insta-1',
      platform: 'instagram',
      url: 'https://instagram.com/weebles_clay',
      enabled: true,
      label: 'Instagram',
      subtitle: '@weebles_clay • Gallery & Drops',
    },
    {
      id: 'fb-1',
      platform: 'facebookMarketplace',
      url: 'https://facebook.com/marketplace',
      enabled: true,
      label: 'Facebook Marketplace',
      subtitle: 'Local Listings & Events',
    },
  ],
  announcementBanner: {
    enabled: true,
    text: '🌸 Spring Collection is dropping this Saturday!',
  },
  admins: ['lucasshawn@gmail.com', 'lucascierra24@gmail.com'],
};

describe('ContentTab', () => {
  it('renders pre-filled fields for banner, emails, and socials', () => {
    render(<ContentTab settings={mockSettings} onSave={vi.fn()} />);

    expect(screen.getByDisplayValue('🌸 Spring Collection is dropping this Saturday!')).toBeInTheDocument();
    expect(screen.getByDisplayValue('weeblesclay@gmail.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('customorders@weeblesclay.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://tiktok.com/@weebles_clay')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://instagram.com/weebles_clay')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://facebook.com/marketplace')).toBeInTheDocument();

    expect(screen.getByRole('checkbox', { name: /Enable Announcement Banner/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Show Social Media Links on Storefront/i })).toBeChecked();
  });

  it('allows updating announcement banner and calls onSave with updated settings', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(<ContentTab settings={mockSettings} onSave={handleSave} />);

    const bannerInput = screen.getByLabelText(/Banner Text/i);
    fireEvent.change(bannerInput, { target: { value: '🍁 Fall Restock is now LIVE!' } });

    const saveBtn = screen.getByRole('button', { name: /Save & Publish Site Content/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith(
        expect.objectContaining({
          announcementBanner: {
            enabled: true,
            text: '🍁 Fall Restock is now LIVE!',
          },
          contactEmail: 'weeblesclay@gmail.com',
          admins: ['lucasshawn@gmail.com', 'lucascierra24@gmail.com'],
        })
      );
    });
  });

  it('allows toggling announcement banner off', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(<ContentTab settings={mockSettings} onSave={handleSave} />);

    const bannerToggle = screen.getByRole('checkbox', { name: /Enable Announcement Banner/i });
    fireEvent.click(bannerToggle);
    expect(bannerToggle).not.toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: /Save & Publish Site Content/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith(
        expect.objectContaining({
          announcementBanner: {
            enabled: false,
            text: '🌸 Spring Collection is dropping this Saturday!',
          },
        })
      );
    });
  });

  it('toggles master social media switch and individual social links off', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(<ContentTab settings={mockSettings} onSave={handleSave} />);

    const masterToggle = screen.getByRole('checkbox', { name: /Show Social Media Links on Storefront/i });
    fireEvent.click(masterToggle);
    expect(masterToggle).not.toBeChecked();
    expect(screen.getByText(/currently hidden from the homepage and footer/i)).toBeInTheDocument();

    const tiktokToggle = screen.getByRole('checkbox', { name: /Enable TikTok link/i });
    fireEvent.click(tiktokToggle);
    expect(tiktokToggle).not.toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: /Save & Publish Site Content/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith(
        expect.objectContaining({
          socialLinksEnabled: false,
          socialLinks: expect.arrayContaining([
            expect.objectContaining({ id: 'tiktok-1', enabled: false }),
          ]),
        })
      );
    });
  });

  it('adds a new social link, auto-detects X.com platform from URL, edits label/subtitle, reorders, and removes links', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(<ContentTab settings={mockSettings} onSave={handleSave} />);

    // Add a new link
    fireEvent.click(screen.getByRole('button', { name: /Add Social Link/i }));

    const urlInputs = screen.getAllByLabelText(/^Profile \/ Link URL$/i);
    expect(urlInputs).toHaveLength(4);

    // Paste X.com URL -> platform select should auto-detect to 'x'
    fireEvent.change(urlInputs[3], { target: { value: 'https://x.com/weebles_clay' } });
    const platformSelects = screen.getAllByLabelText(/^Platform$/i);
    expect((platformSelects[3] as HTMLSelectElement).value).toBe('x');

    // Customize label and subtitle
    const labelInputs = screen.getAllByLabelText(/^Display Label \(optional\)$/i);
    const subtitleInputs = screen.getAllByLabelText(/^Subtitle \/ Handle \(optional\)$/i);
    fireEvent.change(labelInputs[3], { target: { value: 'Weebles on X' } });
    fireEvent.change(subtitleInputs[3], { target: { value: 'Live Restock Alerts' } });

    // Move the new link up one slot (index 3 -> index 2)
    const moveUpButtons = screen.getAllByRole('button', { name: /Move link up/i });
    fireEvent.click(moveUpButtons[3]);

    // Remove Facebook Marketplace (now at index 3)
    fireEvent.click(screen.getByRole('button', { name: /Remove Facebook Marketplace link/i }));

    fireEvent.click(screen.getByRole('button', { name: /Save & Publish Site Content/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    const savedSettings: SiteSettings = handleSave.mock.calls[0][0];
    expect(savedSettings.socialLinks).toHaveLength(3);
    expect(savedSettings.socialLinks![2]).toMatchObject({
      platform: 'x',
      url: 'https://x.com/weebles_clay',
      enabled: true,
      label: 'Weebles on X',
      subtitle: 'Live Restock Alerts',
    });
  });

  it('blocks saving when an enabled social link has an invalid or empty URL, but allows saving an empty disabled link', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(<ContentTab settings={mockSettings} onSave={handleSave} />);

    // Add an empty enabled link and try to submit
    fireEvent.click(screen.getByRole('button', { name: /Add Social Link/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save & Publish Site Content/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/valid http\(s\) URL/i);
    expect(handleSave).not.toHaveBeenCalled();

    // Disable that incomplete draft link -> saving should now succeed
    const newLinkToggle = screen.getByRole('checkbox', { name: /Enable Website link/i });
    fireEvent.click(newLinkToggle);
    fireEvent.click(screen.getByRole('button', { name: /Save & Publish Site Content/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(1);
    });
  });

  it('shows success message after successful save', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(<ContentTab settings={mockSettings} onSave={handleSave} />);

    fireEvent.click(screen.getByRole('button', { name: /Save & Publish Site Content/i }));

    await waitFor(() => {
      expect(screen.getByText(/Site content saved successfully and published!/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ContentTab.test.tsx`
Expected: FAIL (`Unable to find a checkbox with accessible name /Show Social Media Links on Storefront/i`).

- [ ] **Step 3: Create `src/components/admin/SocialLinksEditor.tsx`**

Create `src/components/admin/SocialLinksEditor.tsx`:

```typescript
import React from 'react';
import { ArrowDown, ArrowUp, Plus, Share2, Trash2, AlertCircle } from 'lucide-react';
import { SocialLink, SocialPlatformId } from '../../types/settings';
import {
  SOCIAL_PLATFORM_LIST,
  detectSocialPlatformFromUrl,
  getSocialLinkLabel,
  getSocialPlatformMeta,
} from '../../utils/socialPlatforms';
import { SocialIconBadge } from '../SocialIcon';

export interface SocialLinksEditorProps {
  enabled: boolean;
  links: SocialLink[];
  validationError?: string | null;
  onEnabledChange: (enabled: boolean) => void;
  onLinksChange: (links: SocialLink[]) => void;
}

export const SocialLinksEditor: React.FC<SocialLinksEditorProps> = ({
  enabled,
  links,
  validationError,
  onEnabledChange,
  onLinksChange,
}) => {
  const handleAddLink = () => {
    const newLink: SocialLink = {
      id: `social-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      platform: 'website',
      url: '',
      enabled: true,
      label: '',
      subtitle: '',
    };
    onLinksChange([...links, newLink]);
  };

  const handleUpdateLink = (index: number, patch: Partial<SocialLink>) => {
    const next = links.map((item, idx) => (idx === index ? { ...item, ...patch } : item));
    onLinksChange(next);
  };

  const handleUrlChange = (index: number, newUrl: string) => {
    const current = links[index];
    const detected = detectSocialPlatformFromUrl(newUrl);
    const prevDetected = detectSocialPlatformFromUrl(current.url);

    let nextPlatform = current.platform;
    if (detected && (current.platform === 'website' || current.platform === prevDetected)) {
      nextPlatform = detected;
    }

    handleUpdateLink(index, { url: newUrl, platform: nextPlatform });
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= links.length) return;
    const next = [...links];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    onLinksChange(next);
  };

  const handleDelete = (index: number) => {
    onLinksChange(links.filter((_, idx) => idx !== index));
  };

  return (
    <div className="bg-white rounded-3xl border-2 border-pink-200 p-6 shadow-xs">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-2xl bg-pink-100 flex items-center justify-center text-weeble-pink shrink-0">
          <Share2 className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bubble text-lg font-bold text-weeble-text">Social Media Links</h3>
          <p className="text-xs text-weeble-textMuted">
            Toggle visibility and add links for any social platform shown on the homepage strip and footer.
          </p>
        </div>
      </div>

      {/* Master Toggle */}
      <div className="mb-5 pb-4 border-b border-pink-100 space-y-2">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            id="socialLinksEnabled"
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            aria-label="Show Social Media Links on Storefront"
            className="w-5 h-5 rounded-lg text-weeble-pink accent-weeble-pink focus:ring-pink-300 border-pink-300 transition-all cursor-pointer"
          />
          <span className="text-sm font-semibold text-neutral-800">
            Show Social Media Links on Storefront
          </span>
        </label>

        {!enabled && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            Social media links are currently hidden from the homepage and footer.
          </p>
        )}
      </div>

      {validationError && (
        <div
          role="alert"
          className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-2xl p-3.5 flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Links List */}
      {links.length === 0 ? (
        <div className="text-center py-6 px-4 bg-weeble-pinkWash/60 rounded-2xl border border-dashed border-pink-200 mb-4">
          <p className="text-xs font-semibold text-weeble-textMuted">
            No social links yet. Click &ldquo;Add Social Link&rdquo; below to add one!
          </p>
        </div>
      ) : (
        <div className="space-y-4 mb-4">
          {links.map((link, index) => {
            const meta = getSocialPlatformMeta(link.platform);
            const displayName = getSocialLinkLabel(link);

            return (
              <div
                key={link.id}
                className={`rounded-2xl border-2 p-4 transition-all ${
                  link.enabled
                    ? 'border-pink-200 bg-weeble-pinkWash/40'
                    : 'border-neutral-200 bg-neutral-50 opacity-80'
                }`}
              >
                {/* Row Header: Brand Icon Preview + Toggle + Reorder + Delete */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <SocialIconBadge platform={link.platform} size="admin" />
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={link.enabled}
                        onChange={(e) => handleUpdateLink(index, { enabled: e.target.checked })}
                        aria-label={`Enable ${displayName} link`}
                        className="w-4 h-4 rounded text-weeble-pink accent-weeble-pink cursor-pointer"
                      />
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          link.enabled
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-neutral-200 text-neutral-600'
                        }`}
                      >
                        {link.enabled ? 'Active' : 'Hidden'}
                      </span>
                    </label>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMove(index, -1)}
                      disabled={index === 0}
                      aria-label="Move link up"
                      title="Move up"
                      className="p-1.5 rounded-lg text-weeble-textMuted hover:text-weeble-pink hover:bg-pink-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(index, 1)}
                      disabled={index === links.length - 1}
                      aria-label="Move link down"
                      title="Move down"
                      className="p-1.5 rounded-lg text-weeble-textMuted hover:text-weeble-pink hover:bg-pink-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(index)}
                      aria-label={`Remove ${displayName} link`}
                      title="Remove link"
                      className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Fields Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor={`social-platform-${link.id}`}
                      className="block text-xs font-bold text-weeble-text mb-1"
                    >
                      Platform
                    </label>
                    <select
                      id={`social-platform-${link.id}`}
                      value={link.platform}
                      onChange={(e) =>
                        handleUpdateLink(index, {
                          platform: e.target.value as SocialPlatformId,
                        })
                      }
                      className="w-full text-sm bg-white border border-pink-200 rounded-xl px-3 py-2 text-weeble-text focus:outline-none focus:border-weeble-pink"
                    >
                      {SOCIAL_PLATFORM_LIST.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.pickerLabel}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor={`social-url-${link.id}`}
                      className="block text-xs font-bold text-weeble-text mb-1"
                    >
                      Profile / Link URL
                    </label>
                    <input
                      id={`social-url-${link.id}`}
                      type="text"
                      inputMode="url"
                      value={link.url}
                      onChange={(e) => handleUrlChange(index, e.target.value)}
                      placeholder={meta.placeholderUrl}
                      className="w-full text-sm bg-white border border-pink-200 rounded-xl px-3 py-2 text-weeble-text focus:outline-none focus:border-weeble-pink"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`social-label-${link.id}`}
                      className="block text-xs font-bold text-weeble-text mb-1"
                    >
                      Display Label (optional)
                    </label>
                    <input
                      id={`social-label-${link.id}`}
                      type="text"
                      value={link.label ?? ''}
                      onChange={(e) => handleUpdateLink(index, { label: e.target.value })}
                      placeholder={meta.defaultLabel}
                      className="w-full text-sm bg-white border border-pink-200 rounded-xl px-3 py-2 text-weeble-text focus:outline-none focus:border-weeble-pink"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`social-subtitle-${link.id}`}
                      className="block text-xs font-bold text-weeble-text mb-1"
                    >
                      Subtitle / Handle (optional)
                    </label>
                    <input
                      id={`social-subtitle-${link.id}`}
                      type="text"
                      value={link.subtitle ?? ''}
                      onChange={(e) => handleUpdateLink(index, { subtitle: e.target.value })}
                      placeholder={meta.defaultSubtitle}
                      className="w-full text-sm bg-white border border-pink-200 rounded-xl px-3 py-2 text-weeble-text focus:outline-none focus:border-weeble-pink"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={handleAddLink}
        className="w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-pink-300 text-weeble-pink hover:bg-weeble-pinkWash font-bubble text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        <span>Add Social Link</span>
      </button>
    </div>
  );
};
```

- [ ] **Step 4: Update `src/components/admin/ContentTab.tsx`**

Replace `src/components/admin/ContentTab.tsx`:

```typescript
import React, { useState } from 'react';
import { Save, CheckCircle2, Mail, Sparkles, Megaphone } from 'lucide-react';
import { SiteSettings, SocialLink } from '../../types/settings';
import {
  isSafeHttpUrl,
  normalizeSocialLinks,
  syncLegacySocials,
} from '../../utils/socialPlatforms';
import { SocialLinksEditor } from './SocialLinksEditor';

export interface ContentTabProps {
  settings: SiteSettings;
  onSave: (updated: SiteSettings) => Promise<void>;
}

export const ContentTab: React.FC<ContentTabProps> = ({ settings, onSave }) => {
  const [bannerEnabled, setBannerEnabled] = useState(settings.announcementBanner?.enabled ?? false);
  const [bannerText, setBannerText] = useState(settings.announcementBanner?.text ?? '');
  const [contactEmail, setContactEmail] = useState(settings.contactEmail);
  const [customOrderEmail, setCustomOrderEmail] = useState(settings.customOrderEmail);
  const [socialLinksEnabled, setSocialLinksEnabled] = useState(
    settings.socialLinksEnabled ?? true
  );
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(() =>
    normalizeSocialLinks(settings)
  );
  const [socialValidationError, setSocialValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleLinksChange = (nextLinks: SocialLink[]) => {
    setSocialLinks(nextLinks);
    if (socialValidationError) {
      setSocialValidationError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(false);

    const invalidEnabled = socialLinks.filter(
      (link) => link.enabled && !isSafeHttpUrl(link.url)
    );
    if (invalidEnabled.length > 0) {
      setSocialValidationError(
        'Please enter a valid http(s) URL for all enabled social links (or toggle incomplete links off).'
      );
      return;
    }

    setSocialValidationError(null);
    setIsSaving(true);

    const cleanedLinks: SocialLink[] = socialLinks.map((link) => {
      const label = link.label?.trim();
      const subtitle = link.subtitle?.trim();
      return {
        id: link.id,
        platform: link.platform,
        url: link.url.trim(),
        enabled: link.enabled,
        ...(label ? { label } : {}),
        ...(subtitle ? { subtitle } : {}),
      };
    });

    try {
      await onSave({
        ...settings,
        contactEmail,
        customOrderEmail,
        socialLinksEnabled,
        socialLinks: cleanedLinks,
        socials: syncLegacySocials(cleanedLinks, settings.socials),
        announcementBanner: {
          enabled: bannerEnabled,
          text: bannerText,
        },
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
      {savedSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl p-4 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Site content saved successfully and published!</span>
        </div>
      )}

      {/* Announcement Banner Section */}
      <div className="bg-white rounded-3xl border-2 border-pink-200 p-6 shadow-xs">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-pink-100 flex items-center justify-center text-weeble-pink shrink-0">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bubble text-lg font-bold text-weeble-text">Storefront Announcement Banner</h3>
            <p className="text-xs text-weeble-textMuted">
              Sticky alert bar shown at the very top of every page for sales, events, and restocks.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              id="bannerEnabled"
              type="checkbox"
              checked={bannerEnabled}
              onChange={(e) => setBannerEnabled(e.target.checked)}
              aria-label="Enable Announcement Banner"
              className="w-5 h-5 rounded-lg text-weeble-pink accent-weeble-pink focus:ring-pink-300 border-pink-300 transition-all cursor-pointer"
            />
            <span className="text-sm font-semibold text-neutral-800">
              Enable Announcement Banner
            </span>
          </label>

          <div>
            <label htmlFor="bannerText" className="block text-xs font-bold text-weeble-text mb-1">
              Banner Text
            </label>
            <input
              id="bannerText"
              type="text"
              value={bannerText}
              onChange={(e) => setBannerText(e.target.value)}
              placeholder="🌸 Fall Restock is now LIVE! Handmade charms, magnets & keychains"
              className="w-full text-sm bg-weeble-pinkWash border border-pink-200 rounded-xl px-3.5 py-2.5 text-weeble-text focus:outline-none focus:border-weeble-pink"
            />
          </div>

          {bannerEnabled && bannerText.trim() && (
            <div className="pt-2">
              <div className="text-[11px] font-semibold text-neutral-400 mb-1">Live Preview:</div>
              <div className="bg-gradient-to-r from-pink-400 via-rose-300 to-pink-400 text-white font-bubble text-xs py-2 px-4 rounded-xl shadow-xs text-center flex items-center justify-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                <span>{bannerText.trim()}</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-200" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Studio Notification Emails */}
      <div className="bg-white rounded-3xl border-2 border-pink-200 p-6 shadow-xs">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-pink-100 flex items-center justify-center text-weeble-pink shrink-0">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bubble text-lg font-bold text-weeble-text">Studio Emails</h3>
            <p className="text-xs text-weeble-textMuted">Contact and custom order notification recipients</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="contactEmail" className="block text-xs font-bold text-weeble-text mb-1">
              General Contact Email
            </label>
            <input
              id="contactEmail"
              type="email"
              required
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full text-sm bg-weeble-pinkWash border border-pink-200 rounded-xl px-3.5 py-2.5 text-weeble-text focus:outline-none focus:border-weeble-pink"
            />
          </div>

          <div>
            <label htmlFor="customOrderEmail" className="block text-xs font-bold text-weeble-text mb-1">
              Custom Order Request Notification Email
            </label>
            <input
              id="customOrderEmail"
              type="email"
              required
              value={customOrderEmail}
              onChange={(e) => setCustomOrderEmail(e.target.value)}
              className="w-full text-sm bg-weeble-pinkWash border border-pink-200 rounded-xl px-3.5 py-2.5 text-weeble-text focus:outline-none focus:border-weeble-pink"
            />
          </div>
        </div>
      </div>

      {/* Social Media Links Editor */}
      <SocialLinksEditor
        enabled={socialLinksEnabled}
        links={socialLinks}
        validationError={socialValidationError}
        onEnabledChange={setSocialLinksEnabled}
        onLinksChange={handleLinksChange}
      />

      <button
        type="submit"
        disabled={isSaving}
        className="w-full bg-weeble-pink hover:bg-pink-500 text-white font-bubble text-base font-bold py-3.5 rounded-full shadow-pillow hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
      >
        <Save className="w-5 h-5" />
        <span>{isSaving ? 'Publishing Changes...' : 'Save & Publish Site Content 💖'}</span>
      </button>
    </form>
  );
};
```

- [ ] **Step 5: Run full test suite and production build to verify everything passes cleanly**

Run: `npx vitest run`
Expected: PASS across all test files.

Run: `npm run build`
Expected: TypeScript compilation (`tsc`) and Vite production bundle (`vite build`) succeed with zero errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/SocialLinksEditor.tsx src/components/admin/ContentTab.tsx tests/ContentTab.test.tsx
git commit -m "feat(admin): add SocialLinksEditor with toggles, platform presets, and URL auto-detection"
```
