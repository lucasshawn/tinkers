import React, { useState } from 'react';
import { Product, VariantType } from '../types';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../utils/productUtils';
import { Sparkles, Check } from 'lucide-react';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { addToCart, items } = useCart();
  const [selectedVariant, setSelectedVariant] = useState<VariantType>(
    product.availableVariants[0] || 'magnet'
  );
  const [justAdded, setJustAdded] = useState(false);

  const currentItem = items.find(
    (item) => item.id === `${product.id}-${selectedVariant}`
  );
  const maxAllowed = product.isOneOfAKind ? 1 : (product.stockCount || 10);
  const isMaxReached = currentItem ? currentItem.quantity >= maxAllowed : false;

  const handleAddToCart = () => {
    if (!product.inStock || isMaxReached) return;
    addToCart(product, selectedVariant);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  };

  return (
    <div className="group bg-white rounded-3xl border-3 border-pink-100 p-4 shadow-pillow hover:shadow-pillow-hover hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between">
      {/* Image Container with Badges */}
      <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-weeble-pinkBg mb-3.5">
        <img
          src={product.images[0]}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />

        {/* Stock Status Badge */}
        <div className="absolute top-2.5 left-2.5">
          {product.inStock ? (
            product.isOneOfAKind ? (
              <span className="bg-weeble-yellow text-weeble-text text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                <span>⭐</span> 1-of-1 Original
              </span>
            ) : product.stockCount <= 2 ? (
              <span className="bg-pink-100 text-pink-700 text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm">
                🔥 Only {product.stockCount} left
              </span>
            ) : (
              <span className="bg-weeble-mint text-emerald-800 text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> In Stock
              </span>
            )
          ) : (
            <span className="bg-gray-200 text-gray-700 text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm">
              💤 Sold Out
            </span>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-bubble text-xl font-bold text-weeble-text group-hover:text-weeble-pink transition-colors">
            {product.name}
          </h3>
          <span className="font-bubble text-xl font-bold text-weeble-pink whitespace-nowrap">
            {formatPrice(product.price)}
          </span>
        </div>

        <p className="text-xs text-weeble-textMuted line-clamp-2 mb-3.5 flex-1">
          {product.description}
        </p>

        {/* Variant Selector Pills */}
        <div className="mb-3.5">
          <label className="block text-[11px] font-bold text-weeble-textMuted uppercase tracking-wider mb-1.5">
            Choose Style:
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {product.availableVariants.map((variant) => {
              const isSelected = selectedVariant === variant;
              return (
                <button
                  key={variant}
                  type="button"
                  onClick={() => setSelectedVariant(variant)}
                  aria-label={variant}
                  className={`text-xs font-bold py-1.5 px-2 rounded-xl transition-all border flex items-center justify-center gap-1 ${
                    isSelected
                      ? 'bg-weeble-pink text-white border-weeble-pink shadow-sm scale-[1.02]'
                      : 'bg-white text-weeble-text border-pink-200 hover:bg-weeble-pinkWash'
                  }`}
                >
                  <span>{variant === 'magnet' ? '🧲' : '🔑'}</span>
                  <span className="capitalize">{variant}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleAddToCart}
          disabled={!product.inStock || isMaxReached}
          className={`w-full py-2.5 px-4 rounded-full font-bubble text-sm font-bold transition-all duration-200 flex items-center justify-center gap-1.5 ${
            !product.inStock || isMaxReached
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
              : justAdded
              ? 'bg-emerald-500 text-white scale-95'
              : 'bg-weeble-pink hover:bg-pink-500 text-white shadow-pillow hover:shadow-pillow-hover active:scale-95'
          }`}
        >
          {justAdded ? (
            <>
              <Check className="w-4 h-4" /> Added to Cart!
            </>
          ) : !product.inStock ? (
            '💤 Sold Out'
          ) : isMaxReached ? (
            product.isOneOfAKind ? '⭐ 1-of-1 in Cart' : 'Max in Cart'
          ) : (
            <>
              <span>Adopt Me</span>
              <span>🛒</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
