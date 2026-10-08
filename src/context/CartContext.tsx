import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { CartItem, Product, VariantType } from '../types';

export interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, variant: VariantType) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  totalCount: number;
  subtotal: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
}

const STORAGE_KEY = 'weebles_cart_v1';
const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save cart to localStorage', e);
    }
  }, [items]);

  const addToCart = useCallback((product: Product, variant: VariantType) => {
    const compositeId = `${product.id}-${variant}`;
    const maxQuantity = product.isOneOfAKind ? 1 : (product.stockCount || 10);

    setItems((prev) => {
      const existing = prev.find((item) => item.id === compositeId);
      if (existing) {
        const itemMax = existing.maxQuantity ?? maxQuantity;
        if (existing.quantity >= itemMax) {
          return prev;
        }
        return prev.map((item) =>
          item.id === compositeId
            ? { ...item, quantity: Math.min(item.quantity + 1, itemMax) }
            : item
        );
      }
      const newItem: CartItem = {
        id: compositeId,
        productId: product.id,
        name: product.name,
        variant,
        price: product.price,
        image: product.images[0] || '',
        quantity: 1,
        maxQuantity,
      };
      return [...prev, newItem];
    });
    setIsCartOpen(true);
  }, []);

  const removeFromCart = useCallback((cartItemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== cartItemId));
  }, []);

  const updateQuantity = useCallback((cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== cartItemId) return item;
        const maxAllowed = item.maxQuantity ?? 10;
        return {
          ...item,
          quantity: Math.min(quantity, maxAllowed),
        };
      })
    );
  }, [removeFromCart]);

  const clearCart = useCallback(() => {
    setItems((prev) => (prev.length === 0 ? prev : []));
  }, []);

  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalCount,
        subtotal,
        isCartOpen,
        setIsCartOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
