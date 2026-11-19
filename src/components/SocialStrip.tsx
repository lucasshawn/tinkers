import React from 'react';
import { ExternalLink } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import {
  getFallbackSubtitle,
  getSocialLinkLabel,
  getVisibleSocialLinks,
} from '../utils/socialPlatforms';
import { SocialIconBadge } from './SocialIcon';

function getGridClass(count: number): string {
  if (count === 1) return 'grid grid-cols-1 max-w-md mx-auto gap-4';
  if (count === 2) return 'grid grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto gap-4';
  if (count === 3) return 'grid grid-cols-1 md:grid-cols-3 gap-4';
  return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4';
}

export const SocialStrip: React.FC = () => {
  const { settings } = useSettings();
  const visibleLinks = getVisibleSocialLinks(settings);

  if (visibleLinks.length === 0) {
    return null;
  }

  return (
    <section
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
      aria-label="Social links and creator spotlight"
    >
      <div className="bg-gradient-to-r from-pink-100 via-weeble-pinkWash to-purple-100 rounded-3xl p-6 sm:p-8 border-2 border-pink-200 shadow-pillow">
        <div className="text-center max-w-2xl mx-auto mb-6">
          <span className="text-xs font-bold text-pink-600 bg-white px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
            ✨ Behind the Scenes & Restocks
          </span>
          <h2 className="font-bubble text-2xl sm:text-3xl font-bold text-weeble-text mt-2 mb-1">
            Follow the Sculpting Journey!
          </h2>
          <p className="text-xs sm:text-sm text-weeble-textMuted">
            Watch our clay ASMR sculpting clips, packaging videos with cute stickers, and catch live restock alerts!
          </p>
        </div>

        <div className={getGridClass(visibleLinks.length)}>
          {visibleLinks.map((link) => {
            const label = getSocialLinkLabel(link);
            const subtitle = link.subtitle?.trim() || getFallbackSubtitle(link);

            return (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-white p-5 rounded-2xl border-2 border-pink-200 hover:border-weeble-pink hover:-translate-y-1 transition-all shadow-sm flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <SocialIconBadge platform={link.platform} size="md" />
                  <div className="min-w-0">
                    <h3 className="font-bubble text-base font-bold text-weeble-text group-hover:text-weeble-pink transition-colors truncate">
                      {label}
                    </h3>
                    <p className="text-xs text-weeble-textMuted truncate">{subtitle}</p>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-pink-300 group-hover:text-weeble-pink transition-colors shrink-0" />
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
};
