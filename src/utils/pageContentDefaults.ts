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
