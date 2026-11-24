import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, renderHook, screen, waitFor, act } from '@testing-library/react';
import React from 'react';
import fs from 'fs';
import path from 'path';
import App from '../src/App';
import { AdminPortal } from '../src/components/admin/AdminPortal';
import { adminApi } from '../src/services/adminApi';
import { adminAuth } from '../src/services/adminAuth';
import {
  CACHE_TTL_MS,
  getCacheTimestampKey,
  isStorageEntryFresh,
  readExpiringStorageItem,
  writeExpiringStorageItem,
  removeExpiringStorageItem,
} from '../src/utils/cacheUtils';
import {
  PRODUCTS_STORAGE_KEY,
  getStoredProducts,
  saveStoredProducts,
} from '../src/utils/productUtils';
import {
  SETTINGS_STORAGE_KEY,
  SettingsProvider,
  useSettings,
} from '../src/context/SettingsContext';
import {
  CONTENT_IMAGES_STORAGE_KEY,
  cacheContentImagePreview,
  resolveContentImageUrl,
} from '../src/utils/contentImageCache';
import { handler as adminSaveHandler } from '../netlify/functions/admin-save';
import { Product } from '../src/types';

describe('12-hour cache expiration', () => {
  const TEST_KEY = 'weebles_test_cache_key';
  const BASE_TIME = Date.UTC(2026, 10, 24, 12, 0, 0);

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('defines a 12-hour cache TTL', () => {
    expect(CACHE_TTL_MS).toBe(12 * 60 * 60 * 1000);
  });

  it('returns fresh values within 12 hours and expires them at 12 hours', () => {
    writeExpiringStorageItem(TEST_KEY, '{"hello":"world"}', BASE_TIME);

    expect(localStorage.getItem(TEST_KEY)).toBe('{"hello":"world"}');
    expect(localStorage.getItem(getCacheTimestampKey(TEST_KEY))).toBe(String(BASE_TIME));

    const almostExpired = BASE_TIME + CACHE_TTL_MS - 1;
    expect(isStorageEntryFresh(TEST_KEY, CACHE_TTL_MS, almostExpired)).toBe(true);
    expect(readExpiringStorageItem(TEST_KEY, CACHE_TTL_MS, almostExpired)).toBe('{"hello":"world"}');

    const expired = BASE_TIME + CACHE_TTL_MS;
    expect(isStorageEntryFresh(TEST_KEY, CACHE_TTL_MS, expired)).toBe(false);
    expect(readExpiringStorageItem(TEST_KEY, CACHE_TTL_MS, expired)).toBeNull();
    expect(localStorage.getItem(TEST_KEY)).toBeNull();
    expect(localStorage.getItem(getCacheTimestampKey(TEST_KEY))).toBeNull();
  });

  it('treats legacy entries without a timestamp as stale for remote refresh while remaining readable', () => {
    localStorage.setItem(TEST_KEY, 'legacy-value');

    expect(isStorageEntryFresh(TEST_KEY, CACHE_TTL_MS, BASE_TIME)).toBe(false);
    expect(readExpiringStorageItem(TEST_KEY, CACHE_TTL_MS, BASE_TIME)).toBe('legacy-value');
  });

  it('clears entries with corrupted or far-future timestamps', () => {
    localStorage.setItem(TEST_KEY, 'corrupt-ts');
    localStorage.setItem(getCacheTimestampKey(TEST_KEY), 'not-a-number');
    expect(readExpiringStorageItem(TEST_KEY, CACHE_TTL_MS, BASE_TIME)).toBeNull();
    expect(localStorage.getItem(TEST_KEY)).toBeNull();

    localStorage.setItem(TEST_KEY, 'future-ts');
    localStorage.setItem(getCacheTimestampKey(TEST_KEY), String(BASE_TIME + 5 * 60 * 1000));
    expect(isStorageEntryFresh(TEST_KEY, CACHE_TTL_MS, BASE_TIME)).toBe(false);
    expect(readExpiringStorageItem(TEST_KEY, CACHE_TTL_MS, BASE_TIME)).toBeNull();
  });

  it('removes both value and timestamp keys with removeExpiringStorageItem', () => {
    writeExpiringStorageItem(TEST_KEY, 'v', BASE_TIME);
    removeExpiringStorageItem(TEST_KEY);
    expect(localStorage.getItem(TEST_KEY)).toBeNull();
    expect(localStorage.getItem(getCacheTimestampKey(TEST_KEY))).toBeNull();
  });

  it('expires cached products in localStorage after 12 hours and falls back to bundled defaults', () => {
    const fallback: Product[] = [
      {
        id: 'fresh-default',
        name: 'Fresh Default Weeble',
        description: 'New deploy product',
        price: 15,
        images: ['/images/products/ghost-weeble.jpg'],
        categories: ['animals'],
        availableVariants: ['magnet'],
        inStock: true,
        stockCount: 4,
      },
    ];
    const cached: Product[] = [
      {
        ...fallback[0],
        id: 'stale-cached',
        name: 'Stale Cached Weeble',
      },
    ];

    saveStoredProducts(cached, BASE_TIME);

    expect(getStoredProducts(fallback, BASE_TIME + 60_000)[0].id).toBe('stale-cached');
    expect(getStoredProducts(fallback, BASE_TIME + CACHE_TTL_MS)[0].id).toBe('fresh-default');
    expect(localStorage.getItem(PRODUCTS_STORAGE_KEY)).toBeNull();
  });

  it('expires cached settings in SettingsProvider after 12 hours and cleans up timestamp on reset', () => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_TIME);

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(SettingsProvider, null, children);

    const { result, unmount } = renderHook(() => useSettings(), { wrapper });
    act(() => {
      result.current.updateSettings({
        ...result.current.settings,
        contactEmail: 'cached@weebles.com',
      });
    });
    expect(localStorage.getItem(getCacheTimestampKey(SETTINGS_STORAGE_KEY))).toBe(String(BASE_TIME));
    unmount();

    // Still valid at 11 hours
    vi.setSystemTime(BASE_TIME + 11 * 60 * 60 * 1000);
    const { result: freshResult, unmount: unmountFresh } = renderHook(() => useSettings(), {
      wrapper,
    });
    expect(freshResult.current.settings.contactEmail).toBe('cached@weebles.com');
    unmountFresh();

    // Expired at 12 hours -> falls back to default settings
    vi.setSystemTime(BASE_TIME + CACHE_TTL_MS);
    const { result: expiredResult } = renderHook(() => useSettings(), { wrapper });
    expect(expiredResult.current.settings.contactEmail).toBe('weeblesclay@gmail.com');
    expect(localStorage.getItem(SETTINGS_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(getCacheTimestampKey(SETTINGS_STORAGE_KEY))).toBeNull();
  });

  it('expires cached content image previews after 12 hours', () => {
    const url = '/images/content/hero-badge.png';
    const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';

    cacheContentImagePreview(url, dataUrl, BASE_TIME);
    expect(resolveContentImageUrl(url, BASE_TIME + 60_000)).toBe(dataUrl);

    // After 12 hours, both in-memory and localStorage caches expire back to canonical URL
    expect(resolveContentImageUrl(url, BASE_TIME + CACHE_TTL_MS)).toBe(url);
    expect(localStorage.getItem(CONTENT_IMAGES_STORAGE_KEY)).toBeNull();
  });

  it('sends Cache-Control: no-store from admin-save GET ?action=load', async () => {
    const response = await adminSaveHandler(
      {
        httpMethod: 'GET',
        queryStringParameters: { action: 'load' },
        headers: {},
      } as any,
      {} as any
    );

    expect(response?.statusCode).toBe(200);
    expect(response?.headers?.['Cache-Control']).toBe('no-store');
  });

  it('configures Netlify HTTP cache headers in netlify.toml', () => {
    const netlifyToml = fs.readFileSync(path.resolve(process.cwd(), 'netlify.toml'), 'utf-8');
    expect(netlifyToml).toContain('for = "/*"');
    expect(netlifyToml).toContain('Cache-Control = "public, max-age=0, must-revalidate"');
    expect(netlifyToml).toContain('for = "/assets/*"');
    expect(netlifyToml).toContain('Cache-Control = "public, max-age=31536000, immutable"');
    expect(netlifyToml).toContain('for = "/images/*"');
    expect(netlifyToml).toContain('Cache-Control = "public, max-age=43200, must-revalidate"');
  });
});

describe('stale-while-revalidate remote catalog hydration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('fetches loadStoreData with cache: no-store so browsers never reuse stale HTTP responses', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ products: [], settings: {} }),
    } as any);

    await adminApi.loadStoreData();

    expect(fetchSpy).toHaveBeenCalledWith(
      '/.netlify/functions/admin-save?action=load',
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
      })
    );
  });

  it('refreshes storefront products and settings from remote even when localStorage has a fresh cache', async () => {
    vi.stubEnv('MODE', 'production');

    const staleProducts: Product[] = [
      {
        id: 'weeble-old',
        name: 'Old Cached Bumblebee',
        description: 'Previously cached product',
        price: 14,
        images: ['/images/products/bumblebee-keychain.jpg'],
        categories: ['animals'],
        availableVariants: ['magnet'],
        inStock: true,
        stockCount: 2,
      },
    ];
    const remoteProducts: Product[] = [
      ...staleProducts,
      {
        id: 'weeble-peppermint-cocoa',
        name: 'Peppermint Cocoa',
        description: 'Holiday cocoa charm',
        price: 15,
        images: ['/images/products/peppermint-cocoa.jpg'],
        categories: ['sweets'],
        availableVariants: ['magnet', 'keychain'],
        inStock: true,
        stockCount: 3,
      },
    ];

    // Simulate a PC browser that visited recently (fresh < 12h timestamp in localStorage)
    saveStoredProducts(staleProducts);
    writeExpiringStorageItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        contactEmail: 'weeblesclay@gmail.com',
        customOrderEmail: 'weeblesclay@gmail.com',
        socials: { tiktok: '', instagram: '', facebookMarketplace: '' },
        announcementBanner: { enabled: true, text: 'Old Cached Banner' },
      })
    );

    const loadSpy = vi.spyOn(adminApi, 'loadStoreData').mockResolvedValue({
      products: remoteProducts,
      settings: {
        contactEmail: 'weeblesclay@gmail.com',
        customOrderEmail: 'weeblesclay@gmail.com',
        socials: { tiktok: '', instagram: '', facebookMarketplace: '' },
        announcementBanner: { enabled: true, text: 'Holiday Drop Live!' },
      },
    });

    render(React.createElement(App));

    await waitFor(() => {
      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Peppermint Cocoa')).toBeInTheDocument();
      expect(screen.getByText('Holiday Drop Live!')).toBeInTheDocument();
    });

    const cachedAfter = JSON.parse(localStorage.getItem(PRODUCTS_STORAGE_KEY) || '[]');
    expect(cachedAfter.some((p: Product) => p.id === 'weeble-peppermint-cocoa')).toBe(true);
  });

  it('refreshes AdminPortal inventory from remote even when localStorage has a fresh cache', async () => {
    vi.stubEnv('MODE', 'production');
    adminAuth.setSession({ token: 'valid-token', email: 'lucasshawn@gmail.com', name: 'Shawn' });

    const staleProducts: Product[] = [
      {
        id: 'weeble-old',
        name: 'Old Cached Bumblebee',
        description: 'Previously cached product',
        price: 14,
        images: ['/images/products/bumblebee-keychain.jpg'],
        categories: ['animals'],
        availableVariants: ['magnet'],
        inStock: true,
        stockCount: 2,
      },
    ];
    const remoteProducts: Product[] = [
      ...staleProducts,
      {
        id: 'weeble-christmas-macaron',
        name: 'Christmas Macaron',
        description: 'Festive holiday macaron',
        price: 16,
        images: ['/images/products/christmas-macaron.jpg'],
        categories: ['sweets'],
        availableVariants: ['keychain'],
        inStock: true,
        stockCount: 4,
      },
    ];

    saveStoredProducts(staleProducts);

    const loadSpy = vi.spyOn(adminApi, 'loadStoreData').mockResolvedValue({
      products: remoteProducts,
      settings: {
        contactEmail: 'weeblesclay@gmail.com',
        customOrderEmail: 'weeblesclay@gmail.com',
        socials: { tiktok: '', instagram: '', facebookMarketplace: '' },
      },
      changes: [],
    });

    render(
      React.createElement(SettingsProvider, null, React.createElement(AdminPortal))
    );

    await waitFor(() => {
      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Christmas Macaron')).toBeInTheDocument();
    });
  });
});
