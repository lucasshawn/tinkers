import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Tag, AlertCircle } from 'lucide-react';
import { CategoryOption, Product } from '../../types';
import {
  formatCategoryLabel,
  getProductCategories,
  removeCategoryFromProducts,
  slugifyCategoryId,
} from '../../utils/productUtils';

export interface CategoryManagerModalProps {
  isOpen: boolean;
  categories: CategoryOption[];
  products: Product[];
  onClose: () => void;
  onSaveCategories: (
    updatedCategories: CategoryOption[],
    updatedProducts?: Product[]
  ) => Promise<void>;
}

/** Admin modal for adding and deleting storefront filter categories with cascade product cleanup. */
export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  categories,
  products,
  onClose,
  onSaveCategories,
}) => {
  const [label, setLabel] = useState('');
  const [emoji, setEmoji] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLabel('');
      setEmoji('');
      setError(null);
    }
  }, [isOpen]);

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

  const getUsageCount = (categoryId: string): number =>
    products.filter((p) => getProductCategories(p).includes(categoryId)).length;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setError('Please enter a category name.');
      return;
    }

    const id = slugifyCategoryId(trimmedLabel);
    if (!id) {
      setError('Category name must include letters or numbers.');
      return;
    }

    const duplicate = categories.some(
      (c) =>
        c.id.toLowerCase() === id.toLowerCase() ||
        c.label.trim().toLowerCase() === trimmedLabel.toLowerCase()
    );
    if (duplicate) {
      setError('A category with this name already exists.');
      return;
    }

    const trimmedEmoji = emoji.trim();
    const newCategory: CategoryOption = {
      id,
      label: trimmedLabel,
      ...(trimmedEmoji ? { emoji: trimmedEmoji } : {}),
    };

    setIsSaving(true);
    try {
      await onSaveCategories([...categories, newCategory]);
      setLabel('');
      setEmoji('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add category.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async (cat: CategoryOption) => {
    setError(null);
    const affectedCount = getUsageCount(cat.id);
    const confirmMsg =
      affectedCount > 0
        ? `Remove "${cat.label}"? This will also remove it from ${affectedCount} catalog ${
            affectedCount === 1 ? 'item' : 'items'
          }.`
        : `Remove category "${cat.label}"?`;

    if (!window.confirm(confirmMsg)) return;

    const updatedCategories = categories.filter((c) => c.id !== cat.id);
    const updatedProducts = removeCategoryFromProducts(products, cat.id);

    setIsSaving(true);
    try {
      await onSaveCategories(updatedCategories, updatedProducts);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove category.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      <div
        data-testid="category-modal-backdrop"
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-xs"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-manager-modal-title"
        className="relative bg-white rounded-3xl border-4 border-pink-200 max-w-lg w-full p-6 sm:p-8 shadow-2xl z-10"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-weeble-pinkWash text-weeble-text hover:text-weeble-pink flex items-center justify-center transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-xl bg-pink-100 flex items-center justify-center text-weeble-pink">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <h2
              id="category-manager-modal-title"
              className="font-bubble text-2xl font-bold text-weeble-text leading-tight"
            >
              Manage Categories
            </h2>
            <p className="text-xs text-weeble-textMuted">
              Add or remove storefront filter categories
            </p>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-2xl p-3 flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleAdd} noValidate className="mb-6">
          <div className="flex flex-col sm:flex-row gap-2.5 items-end">
            <div className="w-full sm:w-20">
              <label
                htmlFor="new-category-emoji"
                className="block text-xs font-bold text-weeble-text mb-1"
              >
                Emoji
              </label>
              <input
                id="new-category-emoji"
                type="text"
                maxLength={8}
                placeholder="🏷️"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                disabled={isSaving}
                className="w-full text-sm text-center bg-weeble-pinkWash border border-pink-200 rounded-xl px-2 py-2 text-weeble-text focus:outline-none focus:border-weeble-pink"
              />
            </div>

            <div className="flex-1 w-full">
              <label
                htmlFor="new-category-name"
                className="block text-xs font-bold text-weeble-text mb-1"
              >
                Category Name
              </label>
              <input
                id="new-category-name"
                type="text"
                placeholder="e.g. Holiday Specials"
                value={label}
                onChange={(e) => {
                  setLabel(e.target.value);
                  if (error) setError(null);
                }}
                disabled={isSaving}
                className="w-full text-sm bg-weeble-pinkWash border border-pink-200 rounded-xl px-3 py-2 text-weeble-text focus:outline-none focus:border-weeble-pink"
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full sm:w-auto bg-weeble-pink hover:bg-pink-500 text-white font-bubble text-sm font-bold px-4 py-2 rounded-xl shadow-sm flex items-center justify-center gap-1 transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Add Category</span>
            </button>
          </div>
        </form>

        <div className="border-t border-pink-100 pt-4">
          <h3 className="text-xs font-bold text-weeble-textMuted uppercase tracking-wider mb-3">
            Current Categories ({categories.length})
          </h3>

          {categories.length === 0 ? (
            <div className="text-center py-6 bg-weeble-pinkWash/40 rounded-2xl border border-pink-100 text-xs text-weeble-textMuted">
              No categories yet. Add one above to organize your Weebles!
            </div>
          ) : (
            <div className="divide-y divide-pink-100 max-h-64 overflow-y-auto pr-1">
              {categories.map((cat) => {
                const count = getUsageCount(cat.id);
                return (
                  <div
                    key={cat.id}
                    className="py-2.5 flex items-center justify-between gap-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-sm font-bold text-weeble-text truncate">
                        {formatCategoryLabel(cat)}
                      </span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-pink-50 text-weeble-textMuted border border-pink-100 whitespace-nowrap">
                        {count} {count === 1 ? 'item' : 'items'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemove(cat)}
                      disabled={isSaving}
                      aria-label={`Remove ${cat.label}`}
                      title={`Remove ${cat.label}`}
                      className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-500 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
