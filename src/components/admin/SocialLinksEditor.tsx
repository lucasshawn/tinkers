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
