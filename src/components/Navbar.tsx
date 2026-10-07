import React from 'react';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '../context/CartContext';

interface NavbarProps {
  onOpenCustomModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenCustomModal }) => {
  const { totalCount, setIsCartOpen } = useCart();

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b-2 border-pink-100 shadow-sm transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <a href="#" className="flex items-center gap-2 group">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-weeble-pink to-weeble-pinkLight flex items-center justify-center shadow-pillow group-hover:scale-105 transition-transform duration-200">
            <span className="text-2xl select-none">🍓</span>
          </div>
          <div className="flex flex-col">
            <span className="font-bubble text-3xl font-bold tracking-wide text-weeble-pink text-shadow-cute group-hover:text-pink-600 transition-colors">
              Weebles
            </span>
            <span className="text-xs font-semibold text-weeble-textMuted tracking-wider uppercase -mt-1">
              Clay Studio
            </span>
          </div>
        </a>

        {/* Navigation & Actions */}
        <nav className="hidden md:flex items-center gap-6">
          <a
            href="#catalog"
            className="text-sm font-bold text-weeble-text hover:text-weeble-pink transition-colors px-3 py-1.5 rounded-full hover:bg-weeble-pinkBg"
          >
            🌸 Catalog
          </a>
          <button
            onClick={onOpenCustomModal}
            className="text-sm font-bold text-weeble-text hover:text-weeble-pink transition-colors px-3 py-1.5 rounded-full hover:bg-weeble-pinkBg flex items-center gap-1.5"
          >
            <span>💌</span> Custom Order
          </button>
          <a
            href="#about"
            className="text-sm font-bold text-weeble-text hover:text-weeble-pink transition-colors px-3 py-1.5 rounded-full hover:bg-weeble-pinkBg"
          >
            🎀 Care Guide
          </a>
        </nav>

        {/* Social Badges & Cart Trigger */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenCustomModal}
            className="md:hidden text-xs font-bold text-weeble-pink bg-weeble-pinkWash px-3 py-2 rounded-full border border-pink-200"
          >
            💌 Custom
          </button>

          <button
            aria-label="cart"
            onClick={() => setIsCartOpen(true)}
            className="relative flex items-center gap-2 bg-gradient-to-r from-weeble-pink to-pink-400 text-white font-bold px-4 py-2.5 rounded-full shadow-pillow hover:shadow-pillow-hover hover:scale-105 active:scale-95 transition-all duration-200"
          >
            <ShoppingBag className="w-5 h-5" />
            <span className="hidden sm:inline text-sm font-bubble">Cart</span>
            {totalCount > 0 && (
              <span className="bg-white text-weeble-pink text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shadow-sm animate-pulse">
                {totalCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
