export interface AnnouncementBannerSettings {
  enabled: boolean;
  text: string;
}

export interface CategoryOption {
  id: string;
  label: string;
  emoji?: string;
}

export interface SiteSettings {
  contactEmail: string;
  customOrderEmail: string;
  socials: {
    tiktok: string;
    instagram: string;
    facebookMarketplace: string;
  };
  announcementBanner?: AnnouncementBannerSettings;
  admins?: string[];
  categories?: CategoryOption[];
}
