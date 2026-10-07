import React, { useState } from 'react';
import { X, Trash2, Plus, Minus, Lock } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../utils/productUtils';

export interface CartDrawerProps {
  onCheckout: (giftNote: string) => void;
  isLoadingCheckout: boolean;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ onCheckout, isLoadingCheckout }) => {
  const { items, isCartOpen, setIsCartOpen, removeFromCart, updateQuantity, subtotal, totalCount } =
    useCart();
  const [giftNote, setGiftNote] = useState('');

  if (!isCartOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        data-testid="cart-backdrop"
        onClick={() => setIsCartOpen(false)}
        className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity cursor-pointer"
      />

      {/* Drawer */}
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white border-l-4 border-pink-200 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-5 border-b border-pink-100 flex items-center justify-between bg-weeble-pinkBg">
            <div className="flex items-center gap-2">
              <span className="text-2xl" role="img" aria-label="Cart">🛒</span>
              <div>
                <h2 className="font-bubble text-2xl font-bold text-weeble-text">
                  Your Weeble Cart
                </h2>
                <span className="text-xs text-weeble-textMuted font-medium">
                  {totalCount} {totalCount === 1 ? 'item' : 'items'} ready for adoption
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsCartOpen(false)}
              aria-label="Close cart"
              className="w-9 h-9 rounded-full bg-white border border-pink-200 flex items-center justify-center text-weeble-text hover:bg-weeble-pinkWash hover:text-weeble-pink transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {items.length === 0 ? (
              <div className="text-center py-16">
                <span className="text-6xl block mb-3" role="img" aria-label="Empty basket">🧺</span>
                <p className="font-bubble text-xl font-bold text-weeble-text mb-1">
                  Your basket is empty!
                </p>
                <p className="text-xs text-weeble-textMuted mb-6">
                  Browse our cute figurine catalog to adopt your first weeble.
                </p>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="bg-weeble-pink text-white font-bubble text-sm font-bold px-6 py-2.5 rounded-full shadow-pillow hover:scale-105 transition-transform cursor-pointer"
                >
                  Start Exploring 🍓
                </button>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3.5 bg-weeble-pinkWash/50 p-3 rounded-2xl border border-pink-100"
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-16 h-16 rounded-xl object-cover border border-pink-200 bg-white"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bubble text-sm font-bold text-weeble-text truncate">
                      {item.name}
                    </h4>
                    <span className="inline-block text-[11px] font-bold text-pink-600 bg-pink-100 px-2 py-0.5 rounded-md capitalize my-0.5">
                      {item.variant === 'magnet' ? '🧲 Magnet' : '🔑 Keychain'}
                    </span>
                    <div className="text-xs font-bold text-weeble-text">
                      {formatPrice(item.price)}
                    </div>
                  </div>

                  {/* Quantity editor */}
                  <div className="flex items-center gap-1.5 bg-white border border-pink-200 rounded-full px-2 py-1">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      aria-label={`Decrease quantity of ${item.name}`}
                      className="text-weeble-textMuted hover:text-weeble-pink p-0.5 cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-bold w-4 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      aria-label={`Increase quantity of ${item.name}`}
                      className="text-weeble-textMuted hover:text-weeble-pink p-0.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => removeFromCart(item.id)}
                    aria-label={`Remove ${item.name} from cart`}
                    className="text-pink-300 hover:text-pink-600 p-1 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer & Checkout */}
          {items.length > 0 && (
            <div className="p-5 border-t border-pink-100 bg-white space-y-4">
              {/* Optional Gift Note */}
              <div>
                <label className="block text-xs font-bold text-weeble-textMuted mb-1">
                  Optional gift message / packing note 🎀
                </label>
                <input
                  type="text"
                  placeholder="e.g. Please pack with extra pink sparkles for Sarah!"
                  value={giftNote}
                  onChange={(e) => setGiftNote(e.target.value)}
                  className="w-full text-xs bg-weeble-pinkWash border border-pink-200 rounded-xl px-3 py-2 text-weeble-text focus:outline-none focus:border-weeble-pink"
                />
              </div>

              {/* Subtotal */}
              <div className="flex items-center justify-between text-base font-bold text-weeble-text">
                <span>Subtotal</span>
                <span className="font-bubble text-2xl text-weeble-pink">
                  {formatPrice(subtotal)}
                </span>
              </div>
              <p className="text-[11px] text-weeble-textMuted -mt-2">
                Taxes & flat-rate shipping calculated at Stripe checkout.
              </p>

              {/* Checkout CTA */}
              <button
                disabled={isLoadingCheckout}
                onClick={() => onCheckout(giftNote)}
                className="w-full bg-gradient-to-r from-weeble-pink to-pink-500 hover:from-pink-500 hover:to-pink-600 text-white font-bubble text-lg font-bold py-3.5 px-6 rounded-full shadow-pillow hover:shadow-pillow-hover active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                <Lock className="w-4 h-4" />
                <span>{isLoadingCheckout ? 'Connecting to Stripe...' : 'Checkout with Stripe 💖'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
