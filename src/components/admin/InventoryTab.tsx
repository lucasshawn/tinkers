import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import { Product } from '../../types';
import { formatPrice } from '../../utils/productUtils';
import { WeebleEditorModal } from './WeebleEditorModal';

export interface InventoryTabProps {
  products: Product[];
  onSave: (updated: Product[], newImage?: { filename: string; base64Data: string }) => Promise<void>;
}

export const InventoryTab: React.FC<InventoryTabProps> = ({ products, onSave }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddNew = () => {
    setEditingProduct(null);
    setIsEditorOpen(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsEditorOpen(true);
  };

  const handleDelete = async (productId: string) => {
    if (!window.confirm('Are you sure you want to remove this Weeble from the catalog?')) return;
    setIsSaving(true);
    try {
      const updated = products.filter((p) => p.id !== productId);
      await onSave(updated);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveModal = async (saved: Product, newImage?: { filename: string; base64Data: string }) => {
    setIsSaving(true);
    try {
      let updated: Product[];
      const exists = products.some((p) => p.id === saved.id);
      if (exists) {
        updated = products.map((p) => (p.id === saved.id ? saved : p));
      } else {
        updated = [saved, ...products];
      }
      await onSave(updated, newImage);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-pink-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search catalog..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border-2 border-pink-200 rounded-full pl-10 pr-4 py-2 text-sm text-weeble-text focus:outline-none focus:border-weeble-pink"
          />
        </div>

        <button
          onClick={handleAddNew}
          disabled={isSaving}
          className="w-full sm:w-auto bg-weeble-pink hover:bg-pink-500 text-white font-bubble text-sm font-bold px-5 py-2.5 rounded-full shadow-pillow flex items-center justify-center gap-1.5 transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add New Weeble</span>
        </button>
      </div>

      {/* Inventory Table / Grid */}
      <div className="bg-white rounded-3xl border-2 border-pink-200 overflow-hidden shadow-sm">
        <div className="divide-y divide-pink-100">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-weeble-textMuted text-sm">
              No Weebles found matching "{searchQuery}"
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className="p-4 sm:p-5 flex items-center gap-4 hover:bg-weeble-pinkWash/30 transition-colors"
              >
                <img
                  src={item.images[0] || '/images/products/placeholder.jpg'}
                  alt={item.name}
                  className="w-16 h-16 rounded-2xl object-cover border border-pink-200 bg-weeble-pinkBg shrink-0"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bubble text-base font-bold text-weeble-text truncate">
                      {item.name}
                    </h3>
                    {item.isOneOfAKind && (
                      <span className="bg-weeble-yellow text-weeble-text text-[10px] font-bold px-2 py-0.5 rounded-full">
                        ⭐ 1-of-1
                      </span>
                    )}
                    {!item.inStock && (
                      <span className="bg-gray-200 text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        💤 Sold Out
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-weeble-textMuted">
                    <span className="font-bold text-weeble-pink">{formatPrice(item.price)}</span>
                    <span>•</span>
                    <span className="capitalize">{item.category}</span>
                    <span>•</span>
                    <span>Stock: {item.stockCount}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleEdit(item)}
                    className="p-2 rounded-xl bg-pink-50 hover:bg-pink-100 text-weeble-pink transition-colors"
                    aria-label="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-500 transition-colors"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <WeebleEditorModal
        product={editingProduct}
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleSaveModal}
      />
    </div>
  );
};
