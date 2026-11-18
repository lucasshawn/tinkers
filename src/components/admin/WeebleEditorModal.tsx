import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Product, VariantPrices, VariantType } from '../../types';

export interface WeebleEditorModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Product, newImage?: { filename: string; base64Data: string }) => void;
}

export const WeebleEditorModal: React.FC<WeebleEditorModalProps> = ({
  product,
  isOpen,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(product?.name || '');
  const [description, setDescription] = useState(product?.description || '');
  const [price, setPrice] = useState(product ? String(product.price) : '14.00');
  const [magnetPrice, setMagnetPrice] = useState(
    product ? String(product.variantPrices?.magnet ?? product.price) : '14.00'
  );
  const [keychainPrice, setKeychainPrice] = useState(
    product ? String(product.variantPrices?.keychain ?? product.price) : '14.00'
  );
  const [category, setCategory] = useState<Product['category']>(product?.category || 'sweets');
  const [imageUrl, setImageUrl] = useState(product?.images[0] || '');
  const [variants, setVariants] = useState<VariantType[]>(
    product ? product.availableVariants : ['magnet', 'keychain']
  );
  const [inStock, setInStock] = useState(product ? product.inStock : true);
  const [stockCount, setStockCount] = useState(product ? String(product.stockCount) : '2');
  const [isOneOfAKind, setIsOneOfAKind] = useState(product?.isOneOfAKind || false);
  const [featured, setFeatured] = useState(product?.featured || false);
  const [uploadedImage, setUploadedImage] = useState<{ filename: string; base64Data: string } | null>(null);

  // Sync state whenever product or isOpen changes
  useEffect(() => {
    if (isOpen) {
      setName(product?.name || '');
      setDescription(product?.description || '');
      setPrice(product ? String(product.price) : '14.00');
      setMagnetPrice(
        product ? String(product.variantPrices?.magnet ?? product.price) : '14.00'
      );
      setKeychainPrice(
        product ? String(product.variantPrices?.keychain ?? product.price) : '14.00'
      );
      setCategory(product?.category || 'sweets');
      setImageUrl(product?.images[0] || '');
      setVariants(product ? product.availableVariants : ['magnet', 'keychain']);
      setInStock(product ? product.inStock : true);
      setStockCount(product ? String(product.stockCount) : '2');
      setIsOneOfAKind(product?.isOneOfAKind || false);
      setFeatured(product?.featured || false);
      setUploadedImage(null);
    }
  }, [product, isOpen]);

  // Accessibility: Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const cleanFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '');
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      // Immediately set raw data URL so preview and synchronous tests work right away
      setUploadedImage({ filename: cleanFilename, base64Data: base64 });
      setImageUrl(base64);

      // In browser environments with large photos (> 200KB), compress via canvas to avoid
      // serverless 6MB request limits and localStorage 5MB quota limits.
      if (base64.length > 200_000 && typeof Image !== 'undefined' && typeof document !== 'undefined') {
        const img = new Image();
        img.onload = () => {
          try {
            const maxDim = 800;
            let { width, height } = img;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const compressed = canvas.toDataURL('image/jpeg', 0.82);
              if (compressed && compressed.startsWith('data:image/')) {
                setUploadedImage({ filename: cleanFilename, base64Data: compressed });
                setImageUrl(compressed);
              }
            }
          } catch {
            // Keep original base64 if canvas compression is unavailable
          }
        };
        img.src = base64;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleToggleVariant = (v: VariantType) => {
    setVariants((prev) =>
      prev.includes(v) ? prev.filter((item) => item !== v) : [...prev, v]
    );
  };

  const handleInStockChange = (checked: boolean) => {
    setInStock(checked);
    if (!checked) {
      setStockCount('0');
    } else if ((parseInt(stockCount, 10) || 0) === 0) {
      setStockCount('1');
    }
  };

  const handleOneOfAKindChange = (checked: boolean) => {
    setIsOneOfAKind(checked);
    if (checked && inStock) {
      setStockCount('1');
    }
  };

  const handleStockCountChange = (val: string) => {
    setStockCount(val);
    if (val.trim() === '') return;
    const num = Math.max(0, parseInt(val, 10) || 0);
    if (num === 0) {
      setInStock(false);
    } else {
      setInStock(true);
      if (num > 1 && isOneOfAKind) {
        setIsOneOfAKind(false);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id =
      product?.id ||
      `weeble-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString().slice(-4)}`;
    const finalImagePath = uploadedImage ? `/images/products/${uploadedImage.filename}` : imageUrl;

    const parsedStock = Math.max(0, parseInt(String(stockCount), 10) || 0);
    const finalInStock = inStock && parsedStock > 0;
    const finalStockCount = finalInStock ? parsedStock : 0;
    const finalIsOneOfAKind = finalStockCount > 1 ? false : isOneOfAKind;

    const variantPrices: VariantPrices = {};
    if (variants.includes('magnet')) {
      variantPrices.magnet = parseFloat(magnetPrice) || 14.0;
    }
    if (variants.includes('keychain')) {
      variantPrices.keychain = parseFloat(keychainPrice) || 14.0;
    }

    const firstEnabledVariant = variants[0];
    const resolvedBasePrice = firstEnabledVariant
      ? variantPrices[firstEnabledVariant]!
      : parseFloat(price) || 14.0;

    const savedProduct: Product = {
      id,
      name,
      description,
      price: resolvedBasePrice,
      variantPrices,
      images: [finalImagePath || '/images/products/placeholder.jpg'],
      category,
      availableVariants: variants,
      inStock: finalInStock,
      stockCount: finalStockCount,
      isOneOfAKind: finalIsOneOfAKind,
      featured,
      ...(product
        ? product.createdAt
          ? { createdAt: product.createdAt }
          : {}
        : { createdAt: new Date().toISOString() }),
    };

    onSave(savedProduct, uploadedImage || undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        data-testid="modal-backdrop"
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-xs"
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="weeble-editor-modal-title"
        className="relative bg-white rounded-3xl border-4 border-pink-200 max-w-xl w-full p-6 sm:p-8 shadow-2xl z-10"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-weeble-pinkWash text-weeble-text hover:text-weeble-pink flex items-center justify-center transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2
          id="weeble-editor-modal-title"
          className="font-bubble text-2xl font-bold text-weeble-text mb-4"
        >
          {product ? 'Edit Weeble 🍓' : 'Add New Weeble 🎀'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="weeble-name" className="block text-xs font-bold text-weeble-text mb-1">
                Name
              </label>
              <input
                id="weeble-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-sm bg-weeble-pinkWash border border-pink-200 rounded-xl px-3 py-2 text-weeble-text focus:outline-none focus:border-weeble-pink"
              />
            </div>

            <div>
              <label htmlFor="weeble-category" className="block text-xs font-bold text-weeble-text mb-1">
                Category
              </label>
              <select
                id="weeble-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as Product['category'])}
                className="w-full text-sm bg-weeble-pinkWash border border-pink-200 rounded-xl px-3 py-2 text-weeble-text focus:outline-none focus:border-weeble-pink"
              >
                <option value="sweets">🍩 Sweets</option>
                <option value="animals">🐰 Animals</option>
                <option value="fantasy">✨ Fantasy</option>
                <option value="mini-friends">🌸 Mini-Friends</option>
              </select>
            </div>
          </div>

          {/* Variants & Per-Variant Pricing */}
          <div>
            <label className="block text-xs font-bold text-weeble-text mb-1.5">
              Available Styles & Pricing
            </label>
            <div className="space-y-2.5 bg-weeble-pinkWash/60 border border-pink-200 rounded-2xl p-3">
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs font-bold text-weeble-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={variants.includes('magnet')}
                    onChange={() => handleToggleVariant('magnet')}
                    className="accent-pink-500 w-4 h-4"
                  />
                  <span>🧲 Refrigerator Magnet</span>
                </label>
                {variants.includes('magnet') && (
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="weeble-magnet-price"
                      className="text-xs font-bold text-weeble-textMuted whitespace-nowrap"
                    >
                      Magnet Price ($ USD)
                    </label>
                    <input
                      id="weeble-magnet-price"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={magnetPrice}
                      onChange={(e) => setMagnetPrice(e.target.value)}
                      className="w-24 text-sm bg-white border border-pink-200 rounded-xl px-2.5 py-1.5 text-weeble-text font-bold focus:outline-none focus:border-weeble-pink"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs font-bold text-weeble-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={variants.includes('keychain')}
                    onChange={() => handleToggleVariant('keychain')}
                    className="accent-pink-500 w-4 h-4"
                  />
                  <span>🔑 Keychain</span>
                </label>
                {variants.includes('keychain') && (
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="weeble-keychain-price"
                      className="text-xs font-bold text-weeble-textMuted whitespace-nowrap"
                    >
                      Keychain Price ($ USD)
                    </label>
                    <input
                      id="weeble-keychain-price"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={keychainPrice}
                      onChange={(e) => setKeychainPrice(e.target.value)}
                      className="w-24 text-sm bg-white border border-pink-200 rounded-xl px-2.5 py-1.5 text-weeble-text font-bold focus:outline-none focus:border-weeble-pink"
                    />
                  </div>
                )}
              </div>

              {variants.length === 0 && (
                <div className="pt-2 border-t border-pink-200/60">
                  <label htmlFor="weeble-price" className="block text-xs font-bold text-weeble-text mb-1">
                    Price ($ USD)
                  </label>
                  <input
                    id="weeble-price"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full text-sm bg-white border border-pink-200 rounded-xl px-3 py-2 text-weeble-text focus:outline-none focus:border-weeble-pink"
                  />
                </div>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="weeble-description" className="block text-xs font-bold text-weeble-text mb-1">
              Description
            </label>
            <textarea
              id="weeble-description"
              rows={2}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-sm bg-weeble-pinkWash border border-pink-200 rounded-xl px-3 py-2 text-weeble-text focus:outline-none focus:border-weeble-pink"
            />
          </div>

          {/* Image Upload & Preview */}
          <div>
            <label htmlFor="weeble-photo" className="block text-xs font-bold text-weeble-text mb-1">
              Product Photo
            </label>
            <div className="flex items-center gap-3">
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="w-16 h-16 rounded-xl object-cover border border-pink-200 bg-weeble-pinkBg"
                />
              )}
              <div className="flex-1">
                <input
                  id="weeble-photo"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full text-xs text-weeble-textMuted file:mr-2 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-weeble-pink file:text-white cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Stock Toggles & Count */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-pink-100 items-center">
            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={inStock}
                onChange={(e) => handleInStockChange(e.target.checked)}
                className="accent-pink-500"
              />
              <span>In Stock</span>
            </label>
            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={isOneOfAKind}
                onChange={(e) => handleOneOfAKindChange(e.target.checked)}
                className="accent-pink-500"
              />
              <span>⭐ 1-of-1 Original</span>
            </label>
            <div className="col-span-2 sm:col-span-1">
              <label htmlFor="weeble-stock-count" className="block text-[10px] font-bold text-weeble-text mb-0.5">
                Stock Count
              </label>
              <input
                id="weeble-stock-count"
                type="number"
                min="0"
                value={stockCount}
                onChange={(e) => handleStockCountChange(e.target.value)}
                className="w-full text-xs bg-weeble-pinkWash border border-pink-200 rounded-lg px-2 py-1 text-weeble-text focus:outline-none focus:border-weeble-pink"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-weeble-pink hover:bg-pink-500 text-white font-bubble text-base font-bold py-3 rounded-full shadow-pillow hover:scale-105 active:scale-95 transition-all mt-4"
          >
            Save Weeble 💖
          </button>
        </form>
      </div>
    </div>
  );
};
