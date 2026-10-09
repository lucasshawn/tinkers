import React from 'react';
import { Sparkles } from 'lucide-react';
import { AnnouncementBannerSettings } from '../types/settings';

interface AnnouncementBannerProps {
  banner?: AnnouncementBannerSettings;
}

export const AnnouncementBanner: React.FC<AnnouncementBannerProps> = ({ banner }) => {
  if (!banner || !banner.enabled || !banner.text || !banner.text.trim()) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-pink-400 via-rose-300 to-pink-400 text-white font-bubble text-xs sm:text-sm py-2 px-4 shadow-xs text-center flex items-center justify-center gap-2">
      <Sparkles className="w-4 h-4 shrink-0 animate-pulse text-amber-200" />
      <span>{banner.text.trim()}</span>
      <Sparkles className="w-4 h-4 shrink-0 animate-pulse text-amber-200 hidden sm:inline" />
    </div>
  );
};
