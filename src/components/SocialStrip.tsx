import React from 'react';
import { ExternalLink, Video, Camera, Store } from 'lucide-react';

export const SocialStrip: React.FC = () => {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" aria-label="Social links and creator spotlight">
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

        {/* 3 Social Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* TikTok */}
          <a
            href="https://tiktok.com/@weebles_clay"
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-white p-5 rounded-2xl border-2 border-pink-200 hover:border-weeble-pink hover:-translate-y-1 transition-all shadow-sm flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-black text-white flex items-center justify-center font-bold text-lg shadow-sm">
                <Video className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bubble text-base font-bold text-weeble-text group-hover:text-weeble-pink transition-colors">
                  TikTok
                </h3>
                <p className="text-xs text-weeble-textMuted">@weebles_clay • ASMR & BTS</p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-pink-300 group-hover:text-weeble-pink transition-colors" />
          </a>

          {/* Instagram */}
          <a
            href="https://instagram.com/weebles_clay"
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-white p-5 rounded-2xl border-2 border-pink-200 hover:border-weeble-pink hover:-translate-y-1 transition-all shadow-sm flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                <Camera className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bubble text-base font-bold text-weeble-text group-hover:text-weeble-pink transition-colors">
                  Instagram
                </h3>
                <p className="text-xs text-weeble-textMuted">@weebles_clay • Gallery & Drops</p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-pink-300 group-hover:text-weeble-pink transition-colors" />
          </a>

          {/* Facebook Marketplace */}
          <a
            href="https://facebook.com/marketplace"
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-white p-5 rounded-2xl border-2 border-pink-200 hover:border-weeble-pink hover:-translate-y-1 transition-all shadow-sm flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                <Store className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bubble text-base font-bold text-weeble-text group-hover:text-weeble-pink transition-colors">
                  Facebook Marketplace
                </h3>
                <p className="text-xs text-weeble-textMuted">Local Listings & Events</p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-pink-300 group-hover:text-weeble-pink transition-colors" />
          </a>
        </div>
      </div>
    </section>
  );
};
