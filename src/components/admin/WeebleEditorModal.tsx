import React, { useState, useEffect } from 'react';
import { Camera, Trash2, X } from 'lucide-react';
import {
  CategoryOption,
  Product,
  UploadedImage,
  VariantImages,
  VariantPrices,
  VariantType,
} from '../../types';
import { readAndCompressImage, sanitizeImageFilename } from '../../utils/imageUtils';
import { DEFAULT_CATEGORIES, formatCategoryLabel, getProductCategories } from '../../utils/productUtils';

export interface WeebleEditorModalProps {
  product: Product | null;
  categories?: CategoryOption[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Product, newImages?: UploadedImage[]) => void;
}

function resolveInitialCategories(product: Product | null, categories: CategoryOption[]): string[] {
  if (!product) return [];
  const validIds = new Set(categories.map((c) => c.id));
  return getProductCategories(product).filter((id) => validIds.has(id));
}

export const WeebleEditorModal: React.FC<WeebleEditorModalProps> = ({
  product,
  categories = DEFAULT_CATEGORIES,
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
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() =>
    resolveInitialCategories(product, categories)
  );
  const [imageUrl, setImageUrl] = useState(product?.images[0] || '');
  const [variants, setVariants] = useState<VariantType[]>(
    product ? product.availableVariants : ['magnet', 'keychain']
  );
  const [inStock, setInStock] = useState(product ? product.inStock : true);
  const [stockCount, setStockCount] = useState(product ? String(product.stockCount) : '2');
  const [isOneOfAKind, setIsOneOfAKind] = useState(product?.isOneOfAKind || false);
  const [featured, setFeatured] = useState(product?.featured || false);
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null);
  const [variantImageUrls, setVariantImageUrls] = useState<VariantImages>(
    product?.variantImages ? { ...product.variantImages } : {}
  );
  const [uploadedVariantImages, setUploadedVariantImages] = useState<
    Partial<Record<VariantType, UploadedImage>>
  >({});

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
      setSelectedCategories(resolveInitialCategories(product, categories));
      setImageUrl(product?.images[0] || '');
      setVariants(product ? product.availableVariants : ['magnet', 'keychain']);
      setInStock(product ? product.inStock : true);
      setStockCount(product ? String(product.stockCount) : '2');
      setIsOneOfAKind(product?.isOneOfAKind || false);
      setFeatured(product?.featured || false);
      setUploadedImage(null);
      setVariantImageUrls(product?.variantImages ? { ...product.variantImages } : {});
      setUploadedVariantImages({});
    }
  }, [product, isOpen]);

  // Prune removed category IDs without discarding unsaved toggles when available categories change
  useEffect(() => {
    if (isOpen) {
      const validIds = new Set(categories.map((c) => c.id));
      setSelectedCategories((prev) => {
        const next = prev.filter((id) => validIds.has(id));
        return next.length === prev.length ? prev : next;
      });
    }
  }, [categories, isOpen]);

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
    e.target.value = '';
    if (!file) return;
    readAndCompressImage(file, {
      onImmediate: (img) => {
        setUploadedImage(img);
        setImageUrl(img.base64Data);
      },
    });
  };

  const handleVariantFileChange = (variant: VariantType, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    readAndCompressImage(file, {
      onImmediate: (img) => {
        setUploadedVariantImages((prev) => ({ ...prev, [variant]: img }));
        setVariantImageUrls((prev) => ({ ...prev, [variant]: img.base64Data }));
      },
    });
  };

  const handleRemoveVariantPhoto = (variant: VariantType) => {
    setVariantImageUrls((prev) => {
      const next = { ...prev };
      delete next[variant];
      return next;
    });
    setUploadedVariantImages((prev) => {
      const next = { ...prev };
      delete next[variant];
      return next;
    });
  };

  const handleToggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
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

    const newImages: UploadedImage[] = [];
    if (uploadedImage) {
      newImages.push({
        filename: uploadedImage.filename,
        base64Data: uploadedImage.base64Data,
      });
    }

    const finalVariantImages: VariantImages = {};
    for (const v of variants) {
      const uploadedVariant = uploadedVariantImages[v];
      if (uploadedVariant) {
        const variantFilename = sanitizeImageFilename(uploadedVariant.filename, `${id}-${v}`);
        finalVariantImages[v] = `/images/products/${variantFilename}`;
        newImages.push({
          filename: variantFilename,
          base64Data: uploadedVariant.base64Data,
        });
      } else if (variantImageUrls[v]?.trim()) {
        finalVariantImages[v] = variantImageUrls[v]!.trim();
      }
    }

    const savedProduct: Product = {
      id,
      name,
      description,
      price: resolvedBasePrice,
      variantPrices,
      images: [finalImagePath || '/images/products/placeholder.jpg'],
      ...(Object.keys(finalVariantImages).length > 0 ? { variantImages: finalVariantImages } : {}),
      categories: selectedCategories,
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

    onSave(savedProduct, newImages.length > 0 ? newImages : undefined);
    onClose();
  };

  const renderVariantPhotoRow = (variant: VariantType, displayLabel: string) => {
    const previewUrl = variantImageUrls[variant]?.trim();
    const inputId = `weeble-${variant}-photo`;

    return (
      <div className="mt-2 pt-2 border-t border-pink-200/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={`${displayLabel} preview`}
              className="w-12 h-12 rounded-xl object-cover border border-pink-200 bg-weeble-pinkBg shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl border border-dashed border-pink-300 bg-white/70 flex items-center justify-center text-pink-300 shrink-0">
              <Camera className="w-4 h-4" />
            </div>
          )}
          <div className="text-[11px] text-weeble-textMuted truncate">
            {previewUrl ? (
              <span className="font-bold text-weeble-text">{displayLabel} photo set</span>
            ) : (
              <span>Using base photo</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <label
            htmlFor={inputId}
            className="text-[11px] font-bold px-3 py-1 rounded-full bg-white hover:bg-pink-50 text-weeble-pink border border-pink-200 cursor-pointer transition-colors"
          >
            {previewUrl ? 'Change' : 'Upload Photo'}
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/*"
            aria-label={previewUrl ? `Change ${displayLabel} photo` : `Upload ${displayLabel} photo`}
            onChange={(e) => handleVariantFileChange(variant, e)}
            className="sr-only"
          />
          {previewUrl && (
            <button
              type="button"
              onClick={() => handleRemoveVariantPhoto(variant)}
              aria-label={`Remove ${displayLabel} photo`}
              className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-500 border border-rose-200 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              <span>Remove</span>
            </button>
          )}
        </div>
      </div>
    );
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
        className="relative bg-white rounded-3xl border-4 border-pink-200 max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl z-10"
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

          {/* Categories Multi-Select */}
          <fieldset>
            <legend className="block text-xs font-bold text-weeble-text mb-1.5">
              Categories (select one or more)
            </legend>
            {categories.length === 0 ? (
              <p className="text-xs text-weeble-textMuted bg-weeble-pinkWash/60 border border-pink-200 rounded-xl px-3 py-2">
                No categories available yet. Use Manage Categories to add some.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 bg-weeble-pinkWash/60 border border-pink-200 rounded-2xl p-3">
                {categories.map((cat) => {
                  const checked = selectedCategories.includes(cat.id);
                  return (
                    <label
                      key={cat.id}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer transition-all focus-within:ring-2 focus-within:ring-weeble-pink focus-within:ring-offset-1 ${
                        checked
                          ? 'bg-weeble-pink text-white border-weeble-pink shadow-xs'
                          : 'bg-white text-weeble-text border-pink-200 hover:bg-pink-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleCategory(cat.id)}
                        className="sr-only"
                      />
                      <span>{formatCategoryLabel(cat)}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>

          {/* Variants & Per-Variant Pricing */}
          <div>
            <label className="block text-xs font-bold text-weeble-text mb-1.5">
              Available Styles & Pricing
            </label>
            <div className="space-y-2.5 bg-weeble-pinkWash/60 border border-pink-200 rounded-2xl p-3">
              <div>
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
                {variants.includes('magnet') && renderVariantPhotoRow('magnet', 'Magnet')}
              </div>

              <div className="pt-2.5 border-t border-pink-200/70">
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
                {variants.includes('keychain') && renderVariantPhotoRow('keychain', 'Keychain')}
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
              Base Product Photo
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
