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
