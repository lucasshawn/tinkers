import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Product, VariantType } from '../../types';

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
  const [category, setCategory] = useState<Product['category']>(product?.category || 'sweets');
  const [imageUrl, setImageUrl] = useState(product?.images[0] || '');
  const [variants, setVariants] = useState<VariantType[]>(
    product?.availableVariants || ['magnet', 'keychain']
  );
  const [inStock, setInStock] = useState(product ? product.inStock : true);
  const [stockCount, setStockCount] = useState(product ? product.stockCount : 2);
  const [isOneOfAKind, setIsOneOfAKind] = useState(product?.isOneOfAKind || false);
  const [featured, setFeatured] = useState(product?.featured || false);
  const [uploadedImage, setUploadedImage] = useState<{ filename: string; base64Data: string } | null>(null);

  // Sync state whenever product or isOpen changes
  useEffect(() => {
    if (isOpen) {
      setName(product?.name || '');
      setDescription(product?.description || '');
      setPrice(product ? String(product.price) : '14.00');
      setCategory(product?.category || 'sweets');
      setImageUrl(product?.images[0] || '');
      setVariants(product?.availableVariants || ['magnet', 'keychain']);
      setInStock(product ? product.inStock : true);
      setStockCount(product ? product.stockCount : 2);
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
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setUploadedImage({ filename: file.name, base64Data: base64 });
      setImageUrl(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleToggleVariant = (v: VariantType) => {
    setVariants((prev) =>
      prev.includes(v) ? prev.filter((item) => item !== v) : [...prev, v]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id =
      product?.id ||
      `weeble-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString().slice(-4)}`;
    const finalImagePath = uploadedImage ? `/images/products/${uploadedImage.filename}` : imageUrl;

    const savedProduct: Product = {
      id,
      name,
      description,
      price: parseFloat(price) || 14.0,
      images: [finalImagePath || '/images/products/placeholder.jpg'],
      category,
      availableVariants: variants.length > 0 ? variants : ['magnet'],
      inStock,
      stockCount: isOneOfAKind ? 1 : Math.max(0, stockCount),
      isOneOfAKind,
      featured,
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="weeble-price" className="block text-xs font-bold text-weeble-text mb-1">
                Price ($ USD)
              </label>
              <input
                id="weeble-price"
                type="number"
                step="0.50"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
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

          {/* Variants */}
          <div>
            <label className="block text-xs font-bold text-weeble-text mb-1">Available Styles</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={variants.includes('magnet')}
                  onChange={() => handleToggleVariant('magnet')}
                  className="accent-pink-500"
                />
                <span>🧲 Refrigerator Magnet</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={variants.includes('keychain')}
                  onChange={() => handleToggleVariant('keychain')}
                  className="accent-pink-500"
                />
                <span>🔑 Keychain</span>
              </label>
            </div>
          </div>

          {/* Stock Toggles & Count */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-pink-100 items-center">
            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={inStock}
                onChange={(e) => setInStock(e.target.checked)}
                className="accent-pink-500"
              />
              <span>In Stock</span>
            </label>
            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={isOneOfAKind}
                onChange={(e) => setIsOneOfAKind(e.target.checked)}
                className="accent-pink-500"
              />
              <span>⭐ 1-of-1 Original</span>
            </label>
            {!isOneOfAKind && (
              <div className="col-span-2 sm:col-span-1">
                <label htmlFor="weeble-stock-count" className="block text-[10px] font-bold text-weeble-text mb-0.5">
                  Stock Count
                </label>
                <input
                  id="weeble-stock-count"
                  type="number"
                  min="0"
                  value={stockCount}
                  onChange={(e) => setStockCount(parseInt(e.target.value, 10) || 0)}
                  className="w-full text-xs bg-weeble-pinkWash border border-pink-200 rounded-lg px-2 py-1 text-weeble-text focus:outline-none focus:border-weeble-pink"
                />
              </div>
            )}
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
