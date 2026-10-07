import React from 'react';
import { Sparkles, Heart } from 'lucide-react';

interface HeroBannerProps {
  onExploreClick: () => void;
  onCustomClick: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ onExploreClick, onCustomClick }) => {
  return (
    <section className="relative overflow-hidden pt-8 pb-14 px-4 sm:px-6 lg:px-8">
      {/* Decorative background bubbles */}
      <div className="absolute top-10 left-10 w-28 h-28 bg-weeble-pinkLight/30 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute bottom-6 right-12 w-40 h-40 bg-weeble-blue/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-24 right-1/4 w-20 h-20 bg-weeble-yellow/40 rounded-full blur-xl pointer-events-none" />

      <div className="max-w-5xl mx-auto text-center relative z-10">
        {/* Sweet pill badge */}
        <div className="inline-flex items-center gap-2 bg-white/90 border-2 border-pink-200 text-weeble-text font-bold px-4 py-1.5 rounded-full shadow-sm text-xs sm:text-sm mb-6">
          <Sparkles className="w-4 h-4 text-weeble-pink fill-weeble-pink" />
          <span>Hand-Sculpted & Glazed with UV Resin Love</span>
          <Heart className="w-4 h-4 text-weeble-pink fill-weeble-pink" />
        </div>

        {/* Playful Headline */}
        <h1 className="font-bubble text-4xl sm:text-6xl lg:text-7xl font-bold text-weeble-text leading-tight mb-6">
          Tiny Polymer Clay Friends for Your{' '}
          <span className="text-weeble-pink underline decoration-pink-300 decoration-wavy text-shadow-cute">
            Fridge & Keys
          </span>{' '}
          ✨
        </h1>

        <p className="max-w-2xl mx-auto text-weeble-textMuted text-base sm:text-lg font-medium mb-8 leading-relaxed">
          Welcome to the Weeble sanctuary! Each little critter is uniquely sculpted from high-grade polymer clay, hand-painted with pastel details, and cured with a water-resistant protective shine.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={onExploreClick}
            className="bg-weeble-pink hover:bg-pink-500 text-white font-bubble text-lg font-bold px-7 py-3.5 rounded-full shadow-pillow hover:shadow-pillow-hover hover:scale-105 active:scale-95 transition-all duration-200 flex items-center gap-2"
          >
            <span>Adopt a Weeble</span>
            <span>🍓</span>
          </button>
          <button
            onClick={onCustomClick}
            className="bg-white hover:bg-weeble-pinkWash text-weeble-text border-2 border-pink-300 font-bubble text-lg font-bold px-7 py-3.5 rounded-full shadow-sm hover:scale-105 active:scale-95 transition-all duration-200 flex items-center gap-2"
          >
            <span>Request Custom Order</span>
            <span>💌</span>
          </button>
        </div>
      </div>
    </section>
  );
};
