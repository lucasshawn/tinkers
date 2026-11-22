import React, { useState, useEffect } from 'react';
import { Product, VariantType } from '../types';
import { useCart } from '../context/CartContext';
import { formatPrice, getProductGallery, getProductVariantPrice, isNewProduct } from '../utils/productUtils';
import { Sparkles, Check, ChevronLeft, ChevronRight } from 'lucide-react';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { addToCart, items } = useCart();
  const [selectedVariant, setSelectedVariant] = useState<VariantType | undefined>(
    product.availableVariants[0]
  );
  const [justAdded, setJustAdded] = useState(false);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  const gallery = getProductGallery(product);
  const hasMultiplePhotos = gallery.length > 1;

  useEffect(() => {
    if (product.availableVariants.length === 0) {
      setSelectedVariant(undefined);
    } else if (!selectedVariant || !product.availableVariants.includes(selectedVariant)) {
      setSelectedVariant(product.availableVariants[0]);
    }
  }, [product.availableVariants, selectedVariant]);

  useEffect(() => {
    if (activeSlideIndex >= gallery.length) {
      setActiveSlideIndex(0);
    }
  }, [gallery.length, activeSlideIndex]);

  const activeSlide = gallery[activeSlideIndex] || gallery[0] || {
    src: product.images[0] || '',
    label: 'Base',
  };

  const compositeId = `${product.id}-${selectedVariant || 'standard'}`;
  const currentItem = items.find((item) => item.id === compositeId);
  const maxAllowed = product.isOneOfAKind ? 1 : (product.stockCount || 10);
  const isMaxReached = currentItem ? currentItem.quantity >= maxAllowed : false;
  const activePrice = getProductVariantPrice(product, selectedVariant);

  const handleSelectVariant = (variant: VariantType) => {
    setSelectedVariant(variant);
    if (hasMultiplePhotos) {
      const idx = gallery.findIndex((slide) => slide.variant === variant);
      setActiveSlideIndex(idx !== -1 ? idx : 0);
    }
  };

  const handlePrevPhoto = () => {
    setActiveSlideIndex((prev) => (prev - 1 + gallery.length) % gallery.length);
  };

  const handleNextPhoto = () => {
    setActiveSlideIndex((prev) => (prev + 1) % gallery.length);
  };

  const handleAddToCart = () => {
    if (!product.inStock || isMaxReached) return;
    addToCart(product, selectedVariant as VariantType);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  };

  return (
    <div className="group bg-white rounded-3xl border-3 border-pink-100 p-4 shadow-pillow hover:shadow-pillow-hover hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between">
      {/* Image Container with Badges */}
      <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-weeble-pinkBg mb-3.5">
        <img
          src={activeSlide.src}
          alt={hasMultiplePhotos ? `${product.name} - ${activeSlide.label}` : product.name}
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

        {/* New Item Badge */}
        {isNewProduct(product) && (
          <div className="absolute top-2.5 right-2.5">
            <span className="bg-weeble-pink text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm">
              NEW!
            </span>
          </div>
        )}

        {/* Carousel Controls (only shown when > 1 photo exists) */}
        {hasMultiplePhotos && (
          <>
            <button
              type="button"
              onClick={handlePrevPhoto}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/85 hover:bg-white text-weeble-text shadow-sm flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextPhoto}
              aria-label="Next photo"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/85 hover:bg-white text-weeble-text shadow-sm flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Active Photo Label Pill */}
            <div className="absolute bottom-2 left-2">
              <span className="bg-white/90 text-weeble-text text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                {activeSlide.variant === 'magnet'
                  ? '🧲 Magnet'
                  : activeSlide.variant === 'keychain'
                  ? '🔑 Keychain'
                  : 'Base'}
              </span>
            </div>

            {/* Dot Indicators */}
            <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1">
              {gallery.map((slide, idx) => {
                const isActive = idx === activeSlideIndex;
                return (
                  <button
                    key={`${slide.label}-${idx}`}
                    type="button"
                    onClick={() => setActiveSlideIndex(idx)}
                    aria-label={`View ${slide.label} photo`}
                    aria-current={isActive ? 'true' : undefined}
                    className={`h-2 rounded-full transition-all shadow-xs cursor-pointer ${
                      isActive ? 'w-4 bg-weeble-pink' : 'w-2 bg-white/80 hover:bg-white'
                    }`}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Info Section */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-bubble text-xl font-bold text-weeble-text group-hover:text-weeble-pink transition-colors">
            {product.name}
          </h3>
          <span className="font-bubble text-xl font-bold text-weeble-pink whitespace-nowrap">
            {formatPrice(activePrice)}
          </span>
        </div>

        <p className="text-xs text-weeble-textMuted line-clamp-2 mb-3.5 flex-1">
          {product.description}
        </p>

        {/* Variant Selector Pills */}
        {product.availableVariants.length > 0 && (
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
                    onClick={() => handleSelectVariant(variant)}
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
        )}

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
