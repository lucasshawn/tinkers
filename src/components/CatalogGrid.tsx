import React, { useState } from 'react';
import { Product } from '../types';
import { ProductCard } from './ProductCard';
import { filterProducts } from '../utils/productUtils';
import { Search } from 'lucide-react';

interface CatalogGridProps {
  products: Product[];
  onOpenCustomModal: () => void;
}

const CATEGORIES = [
  { id: 'all', label: '🌸 All Weebles' },
  { id: 'magnets', label: '🧲 Fridge Magnets' },
  { id: 'keychains', label: '🔑 Keychains' },
  { id: 'animals', label: '🐰 Critters' },
  { id: 'sweets', label: '🍩 Sweets' },
  { id: 'under-15', label: '🎀 Under $15' },
];

export const CatalogGrid: React.FC<CatalogGridProps> = ({ products, onOpenCustomModal }) => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = filterProducts(products, selectedCategory, searchQuery);

  return (
    <section id="catalog" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="font-bubble text-3xl sm:text-4xl font-bold text-weeble-text mb-1 flex items-center gap-2">
            <span>Available Creations</span>
            <span>🍓</span>
          </h2>
          <p className="text-sm text-weeble-textMuted">
            Each piece is individually sculpted, baked, and detailed by hand.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-pink-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search weebles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border-2 border-pink-200 rounded-full pl-10 pr-4 py-2 text-sm text-weeble-text placeholder:text-pink-300 focus:outline-none focus:border-weeble-pink transition-colors"
          />
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all border ${
              selectedCategory === cat.id
                ? 'bg-weeble-pink text-white border-weeble-pink shadow-pillow scale-105'
                : 'bg-white text-weeble-text border-pink-200 hover:bg-weeble-pinkWash'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Product Cards Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-3xl border-2 border-pink-200 p-8 max-w-lg mx-auto">
          <span className="text-5xl block mb-3">🔍</span>
          <h3 className="font-bubble text-2xl font-bold text-weeble-text mb-2">
            No Weebles found!
          </h3>
          <p className="text-sm text-weeble-textMuted mb-6">
            Looking for something specific that is sold out or not in stock? You can request a custom creation!
          </p>
          <button
            onClick={onOpenCustomModal}
            className="bg-weeble-pink text-white font-bubble text-sm font-bold px-6 py-2.5 rounded-full shadow-pillow hover:scale-105 transition-transform"
          >
            Request Custom Weeble 💌
          </button>
        </div>
      )}
    </section>
  );
};
