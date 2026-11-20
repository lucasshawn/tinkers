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

    it('migrates blank legacy socials strings as disabled so they do not fail save validation', () => {
      const legacyWithBlank: Partial<SiteSettings> = {
        socials: {
          tiktok: 'https://tiktok.com/@legacy',
          instagram: '   ',
          facebookMarketplace: '',
        },
      };

      const normalized = normalizeSettings(legacyWithBlank, defaults);
      expect(normalized.socialLinks).toHaveLength(3);
      expect(normalized.socialLinks![0]).toMatchObject({
        platform: 'tiktok',
        url: 'https://tiktok.com/@legacy',
        enabled: true,
      });
      expect(normalized.socialLinks![1]).toMatchObject({
        platform: 'instagram',
        url: '',
        enabled: false,
      });
      expect(normalized.socialLinks![2]).toMatchObject({
        platform: 'facebookMarketplace',
        url: '',
        enabled: false,
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
