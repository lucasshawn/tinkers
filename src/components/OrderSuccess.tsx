import React, { useEffect } from 'react';
import { Heart, Sparkles, ArrowLeft } from 'lucide-react';
import { useCart } from '../context/CartContext';

export const OrderSuccess: React.FC = () => {
  const { clearCart } = useCart();

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  return (
    <div className="min-h-screen bg-weeble-pinkBg flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl border-4 border-pink-200 p-8 shadow-2xl text-center">
        <div className="w-20 h-20 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl shadow-pillow">
          🍓
        </div>

        <span className="bg-weeble-mint text-emerald-800 text-xs font-bold px-3 py-1 rounded-full inline-flex items-center gap-1 mb-2">
          <Sparkles className="w-3.5 h-3.5" /> Adoption Confirmed!
        </span>

        <h1 className="font-bubble text-3xl font-bold text-weeble-text mb-2">
          Thank You so Much!
        </h1>

        <p className="text-sm text-weeble-textMuted mb-6 leading-relaxed">
          Your payment was successful! Your new little Weeble friend is getting lovingly packaged with custom stickers and care instructions. We will email tracking info as soon as it ships!
        </p>

        <div className="bg-weeble-pinkWash p-4 rounded-2xl border border-pink-100 text-xs text-weeble-text mb-6 text-left space-y-1">
          <div className="font-bold text-weeble-pink flex items-center gap-1">
            <Heart className="w-3.5 h-3.5 fill-weeble-pink" /> What happens next?
          </div>
          <div>• You will receive a receipt from Stripe via email.</div>
          <div>• Orders ship within 2-4 business days.</div>
        </div>

        <a
          href="/"
          className="inline-flex items-center gap-2 bg-weeble-pink text-white font-bubble text-base font-bold py-3 px-6 rounded-full shadow-pillow hover:scale-105 transition-transform"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Storefront</span>
        </a>
      </div>
    </div>
  );
};
