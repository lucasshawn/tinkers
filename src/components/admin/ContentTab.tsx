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
