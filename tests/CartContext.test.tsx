import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { CartProvider, useCart } from '../src/context/CartContext';
import { Product } from '../src/types';

const testProduct: Product = {
  id: 'prod-1',
  name: 'Strawberry Bunny',
  description: 'Bunny magnet',
  price: 14.0,
  images: ['/img1.jpg'],
  category: 'animals',
  availableVariants: ['magnet', 'keychain'],
  inStock: true,
  stockCount: 5,
};

describe('CartContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <CartProvider>{children}</CartProvider>
  );

  it('adds item to cart with specific variant', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addToCart(testProduct, 'magnet');
    });

    expect(result.current.items.length).toBe(1);
    expect(result.current.items[0].id).toBe('prod-1-magnet');
    expect(result.current.items[0].variant).toBe('magnet');
    expect(result.current.items[0].quantity).toBe(1);
    expect(result.current.subtotal).toBe(14.0);
    expect(result.current.totalCount).toBe(1);
    expect(result.current.isCartOpen).toBe(true);
  });

  it('keeps distinct line items for different variants of the same product', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addToCart(testProduct, 'magnet');
      result.current.addToCart(testProduct, 'keychain');
    });

    expect(result.current.items.length).toBe(2);
    expect(result.current.totalCount).toBe(2);
    expect(result.current.subtotal).toBe(28.0);
  });

  it('increments quantity when same variant is added again', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addToCart(testProduct, 'magnet');
      result.current.addToCart(testProduct, 'magnet');
    });

    expect(result.current.items.length).toBe(1);
    expect(result.current.items[0].quantity).toBe(2);
    expect(result.current.totalCount).toBe(2);
    expect(result.current.subtotal).toBe(28.0);
  });

  it('updates quantity and removes item when quantity reaches 0', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addToCart(testProduct, 'magnet');
    });

    act(() => {
      result.current.updateQuantity('prod-1-magnet', 3);
    });
    expect(result.current.items[0].quantity).toBe(3);

    act(() => {
      result.current.updateQuantity('prod-1-magnet', 0);
    });
    expect(result.current.items.length).toBe(0);
  });

  it('removes item directly', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addToCart(testProduct, 'magnet');
      result.current.removeFromCart('prod-1-magnet');
    });

    expect(result.current.items.length).toBe(0);
  });

  it('clears cart completely', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addToCart(testProduct, 'magnet');
      result.current.clearCart();
    });

    expect(result.current.items.length).toBe(0);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.subtotal).toBe(0);
  });

  it('toggles isCartOpen state', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    expect(result.current.isCartOpen).toBe(false);
    act(() => {
      result.current.setIsCartOpen(true);
    });
    expect(result.current.isCartOpen).toBe(true);
    act(() => {
      result.current.setIsCartOpen(false);
    });
    expect(result.current.isCartOpen).toBe(false);
  });

  it('persists items to localStorage and initializes from localStorage', () => {
    const { result, unmount } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addToCart(testProduct, 'keychain');
    });

    const stored = JSON.parse(localStorage.getItem('weebles_cart_v1') || '[]');
    expect(stored.length).toBe(1);
    expect(stored[0].id).toBe('prod-1-keychain');

    unmount();

    // Re-render hook with existing localStorage
    const { result: newResult } = renderHook(() => useCart(), { wrapper });
    expect(newResult.current.items.length).toBe(1);
    expect(newResult.current.items[0].id).toBe('prod-1-keychain');
    expect(newResult.current.totalCount).toBe(1);
  });

  it('throws an error when useCart is used outside CartProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      renderHook(() => useCart());
    }).toThrow('useCart must be used within a CartProvider');
    consoleSpy.mockRestore();
  });
});
