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
    const legacyEntries: Array<{
      value: unknown;
      id: string;
      platform: SocialPlatformId;
      label: string;
      subtitle: string;
    }> = [
      {
        value: legacy.tiktok,
        id: 'tiktok-default',
        platform: 'tiktok',
        label: 'TikTok',
        subtitle: '@weebles_clay • ASMR & BTS',
      },
      {
        value: legacy.instagram,
        id: 'instagram-default',
        platform: 'instagram',
        label: 'Instagram',
        subtitle: '@weebles_clay • Gallery & Drops',
      },
      {
        value: legacy.facebookMarketplace,
        id: 'facebook-marketplace-default',
        platform: 'facebookMarketplace',
        label: 'Facebook Marketplace',
        subtitle: 'Local Listings & Events',
      },
    ];

    for (const entry of legacyEntries) {
      if (typeof entry.value === 'string') {
        const url = entry.value.trim();
        migrated.push({
          id: entry.id,
          platform: entry.platform,
          url,
          enabled: Boolean(url),
          label: entry.label,
          subtitle: entry.subtitle,
        });
      }
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
