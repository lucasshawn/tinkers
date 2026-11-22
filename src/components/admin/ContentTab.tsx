import React, { useEffect, useRef, useState } from 'react';
import {
  Save,
  CheckCircle2,
  Mail,
  Sparkles,
  Megaphone,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { PageContentSettings, SiteSettings, SocialLink } from '../../types/settings';
import {
  DEFAULT_PAGE_CONTENT,
  PAGE_CONTENT_LABELS,
  resolvePageContent,
} from '../../utils/pageContentDefaults';
import { adminApi } from '../../services/adminApi';
import {
  isSafeHttpUrl,
  normalizeSocialLinks,
  syncLegacySocials,
} from '../../utils/socialPlatforms';
import { SocialLinksEditor } from './SocialLinksEditor';
import { MarkdownFieldEditor, MarkdownFieldEditorProps } from './MarkdownFieldEditor';

interface PageContentFieldConfig {
  key: keyof PageContentSettings;
  mode?: MarkdownFieldEditorProps['mode'];
  rows?: number;
  previewVariant: NonNullable<MarkdownFieldEditorProps['previewVariant']>;
}

const PAGE_CONTENT_SECTIONS: Array<{
  title: string;
  fields: PageContentFieldConfig[];
}> = [
  {
    title: 'Hero Section',
    fields: [
      { key: 'heroTagline', previewVariant: 'pill', rows: 1 },
      { key: 'heroTitle', previewVariant: 'heroTitle', rows: 2 },
      { key: 'heroSubtitle', previewVariant: 'subtitle', rows: 3 },
    ],
  },
  {
    title: 'Behind the Scenes & Restocks',
    fields: [
      { key: 'socialBadge', previewVariant: 'pill', rows: 1 },
      { key: 'socialTitle', previewVariant: 'heading', rows: 2 },
      { key: 'socialSubtitle', previewVariant: 'subtitle', rows: 2 },
    ],
  },
  {
    title: 'Catalog Header',
    fields: [
      { key: 'catalogTitle', previewVariant: 'heading', rows: 1 },
      { key: 'catalogSubtitle', previewVariant: 'subtitle', rows: 2 },
    ],
  },
  {
    title: 'Footer Clay Care',
    fields: [
      { key: 'footerCareTitle', previewVariant: 'heading', rows: 1 },
      { key: 'footerCareBody', mode: 'block', previewVariant: 'careList', rows: 4 },
    ],
  },
];

export interface ContentTabProps {
  settings: SiteSettings;
  onSave: (updated: SiteSettings) => Promise<void>;
}

export const ContentTab: React.FC<ContentTabProps> = ({ settings, onSave }) => {
  const [bannerEnabled, setBannerEnabled] = useState(settings.announcementBanner?.enabled ?? false);
  const [bannerText, setBannerText] = useState(settings.announcementBanner?.text ?? '');
  const [pageContent, setPageContent] = useState<PageContentSettings>(() =>
    resolvePageContent(settings.pageContent)
  );
  const [showGuide, setShowGuide] = useState(false);
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
  const hasEditedRef = useRef(false);

  useEffect(() => {
    if (hasEditedRef.current) return;
    setBannerEnabled(settings.announcementBanner?.enabled ?? false);
    setBannerText(settings.announcementBanner?.text ?? '');
    setPageContent(resolvePageContent(settings.pageContent));
    setContactEmail(settings.contactEmail);
    setCustomOrderEmail(settings.customOrderEmail);
    setSocialLinksEnabled(settings.socialLinksEnabled ?? true);
    setSocialLinks(normalizeSocialLinks(settings));
  }, [settings]);

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

  const handleLinksChange = (nextLinks: SocialLink[]) => {
    hasEditedRef.current = true;
    setSocialLinks(nextLinks);
    if (socialValidationError) {
      setSocialValidationError(null);
    }
  };

  const handleSocialLinksEnabledChange = (enabled: boolean) => {
    hasEditedRef.current = true;
    setSocialLinksEnabled(enabled);
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
        pageContent,
      });
      hasEditedRef.current = false;
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
              onChange={(e) => {
                hasEditedRef.current = true;
                setBannerEnabled(e.target.checked);
              }}
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
              onChange={(e) => {
                hasEditedRef.current = true;
                setBannerText(e.target.value);
              }}
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

      {/* Storefront Page Copy (Markdown) */}
      <div className="bg-white rounded-3xl border-2 border-pink-200 p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-pink-100 flex items-center justify-center text-weeble-pink shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bubble text-lg font-bold text-weeble-text">
                Storefront Page Copy (Markdown)
              </h3>
              <p className="text-xs text-weeble-textMuted">
                Customize homepage & footer copy with Markdown, colors, fonts, and inline PNG icons.
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-expanded={showGuide}
            onClick={() => setShowGuide((prev) => !prev)}
            className="self-start sm:self-auto px-3 py-1.5 rounded-full text-xs font-bold text-weeble-pink bg-pink-50 border border-pink-200 hover:border-weeble-pink flex items-center gap-1 cursor-pointer"
          >
            <span>Formatting Guide</span>
            {showGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {showGuide && (
          <div className="bg-weeble-pinkWash border border-pink-200 rounded-2xl p-4 text-xs text-weeble-text space-y-1.5">
            <div className="font-bold text-weeble-text">Supported Markdown & Styling Syntax</div>
            <ul className="space-y-1 font-mono text-[11px] text-weeble-textMuted">
              <li>**bold** &nbsp;•&nbsp; *italic* &nbsp;•&nbsp; ~~strikethrough~~</li>
              <li>[text]&#123;color=pink font=bubble wavy&#125;</li>
              <li>&lt;span style=&quot;color:#FF85A1&quot;&gt;text&lt;/span&gt;</li>
              <li>![alt](/images/content/icon.png =28)</li>
              <li>- bullet item (for list blocks like Clay Care)</li>
            </ul>
          </div>
        )}

        <div className="space-y-6">
          {PAGE_CONTENT_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-4 pt-4 border-t border-pink-100 first:pt-0 first:border-t-0">
              <h4 className="font-bubble text-sm font-bold text-weeble-pink uppercase tracking-wide">
                {section.title}
              </h4>
              <div className="space-y-4">
                {section.fields.map((field) => (
                  <MarkdownFieldEditor
                    key={field.key}
                    id={`pageContent-${field.key}`}
                    label={PAGE_CONTENT_LABELS[field.key]}
                    value={pageContent[field.key]}
                    defaultValue={DEFAULT_PAGE_CONTENT[field.key]}
                    mode={field.mode}
                    rows={field.rows}
                    previewVariant={field.previewVariant}
                    onChange={(nextValue) => updatePageField(field.key, nextValue)}
                    onUploadImage={handleUploadInlinePng}
                  />
                ))}
              </div>
            </div>
          ))}
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
              onChange={(e) => {
                hasEditedRef.current = true;
                setContactEmail(e.target.value);
              }}
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
              onChange={(e) => {
                hasEditedRef.current = true;
                setCustomOrderEmail(e.target.value);
              }}
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
        onEnabledChange={handleSocialLinksEnabledChange}
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
