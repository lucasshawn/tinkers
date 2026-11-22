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

export interface CategoryOption {
  id: string;
  label: string;
  emoji?: string;
}

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
