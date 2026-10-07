import React from 'react';
import { Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer id="about" className="bg-white border-t-2 border-pink-100 pt-12 pb-8 px-4 sm:px-6 lg:px-8 mt-16">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
        {/* Brand statement */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">🍓</span>
            <span className="font-bubble text-2xl font-bold text-weeble-pink">Weebles Clay</span>
          </div>
          <p className="text-sm text-weeble-textMuted leading-relaxed">
            Handcrafted with patience, pigment, and love. Bringing a dash of playful sweetness to everyday items like refrigerator doors, keyrings, and backpacks.
          </p>
        </div>

        {/* Clay Care instructions */}
        <div className="bg-weeble-pinkBg p-5 rounded-3xl border border-pink-100">
          <h3 className="font-bubble text-lg font-bold text-weeble-text mb-2 flex items-center gap-1.5">
            <span>✨</span> Clay Care Instructions
          </h3>
          <ul className="text-xs text-weeble-textMuted space-y-1.5">
            <li>• Water-resistant UV resin finish (do not soak or run through dishwasher).</li>
            <li>• Clean gently with a soft microfiber cloth or damp wipe.</li>
            <li>• Handle with love! Strong neodymium magnets are embedded securely.</li>
          </ul>
        </div>

        {/* Quick Links & Contact */}
        <div>
          <h3 className="font-bubble text-lg font-bold text-weeble-text mb-2">
            Get in Touch
          </h3>
          <p className="text-sm text-weeble-textMuted mb-2">
            Questions about restocks or wholesale?
          </p>
          <a
            href="mailto:weeblesclay@gmail.com"
            className="text-sm font-bold text-weeble-pink hover:underline"
          >
            weeblesclay@gmail.com
          </a>
          <p className="text-xs text-weeble-textMuted mt-3">
            📦 Ships safely bubble-wrapped with collectible stickers and surprise candy!
          </p>
        </div>
      </div>

      <div className="border-t border-pink-100 pt-6 text-center text-xs text-weeble-textMuted flex items-center justify-center gap-1">
        <span>© {new Date().getFullYear()} Weebles Studio. Handcrafted with</span>
        <Heart className="w-3.5 h-3.5 text-weeble-pink fill-weeble-pink" />
        <span>for clay lovers everywhere.</span>
      </div>
    </footer>
  );
};
