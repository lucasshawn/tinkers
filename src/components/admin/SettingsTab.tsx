import React, { useState } from 'react';
import { Save, CheckCircle2, Mail, Share2 } from 'lucide-react';
import { SiteSettings } from '../../types/settings';

interface SettingsTabProps {
  settings: SiteSettings;
  onSave: (updated: SiteSettings) => Promise<void>;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ settings, onSave }) => {
  const [contactEmail, setContactEmail] = useState(settings.contactEmail);
  const [customOrderEmail, setCustomOrderEmail] = useState(settings.customOrderEmail);
  const [tiktok, setTiktok] = useState(settings.socials.tiktok);
  const [instagram, setInstagram] = useState(settings.socials.instagram);
  const [facebookMarketplace, setFacebookMarketplace] = useState(settings.socials.facebookMarketplace);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccess(false);

    try {
      await onSave({
        contactEmail,
        customOrderEmail,
        socials: {
          tiktok,
          instagram,
          facebookMarketplace,
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
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>Settings saved successfully and published!</span>
        </div>
      )}

      {/* Email Notifications */}
      <div className="bg-white rounded-3xl border-2 border-pink-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl bg-pink-100 flex items-center justify-center text-weeble-pink">
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

      {/* Social Media Links */}
      <div className="bg-white rounded-3xl border-2 border-pink-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl bg-pink-100 flex items-center justify-center text-weeble-pink">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bubble text-lg font-bold text-weeble-text">Social Media Exposure Links</h3>
            <p className="text-xs text-weeble-textMuted">Links displayed on the homepage social strip and footer</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="tiktok" className="block text-xs font-bold text-weeble-text mb-1">
              TikTok Profile URL
            </label>
            <input
              id="tiktok"
              type="url"
              value={tiktok}
              onChange={(e) => setTiktok(e.target.value)}
              placeholder="https://tiktok.com/@weebles_clay"
              className="w-full text-sm bg-weeble-pinkWash border border-pink-200 rounded-xl px-3.5 py-2.5 text-weeble-text focus:outline-none focus:border-weeble-pink"
            />
          </div>

          <div>
            <label htmlFor="instagram" className="block text-xs font-bold text-weeble-text mb-1">
              Instagram Profile URL
            </label>
            <input
              id="instagram"
              type="url"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="https://instagram.com/weebles_clay"
              className="w-full text-sm bg-weeble-pinkWash border border-pink-200 rounded-xl px-3.5 py-2.5 text-weeble-text focus:outline-none focus:border-weeble-pink"
            />
          </div>

          <div>
            <label htmlFor="facebookMarketplace" className="block text-xs font-bold text-weeble-text mb-1">
              Facebook Marketplace URL
            </label>
            <input
              id="facebookMarketplace"
              type="url"
              value={facebookMarketplace}
              onChange={(e) => setFacebookMarketplace(e.target.value)}
              placeholder="https://facebook.com/marketplace"
              className="w-full text-sm bg-weeble-pinkWash border border-pink-200 rounded-xl px-3.5 py-2.5 text-weeble-text focus:outline-none focus:border-weeble-pink"
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={isSaving}
        className="w-full bg-weeble-pink hover:bg-pink-500 text-white font-bubble text-base font-bold py-3.5 rounded-full shadow-pillow hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Save className="w-5 h-5" />
        <span>{isSaving ? 'Publishing Changes...' : 'Save & Publish Settings 💖'}</span>
      </button>
    </form>
  );
};
