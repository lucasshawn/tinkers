import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { SettingsProvider, useSettings, SETTINGS_STORAGE_KEY } from '../src/context/SettingsContext';

describe('SettingsContext', () => {
  beforeEach(() => {
    localStorage.removeItem('weebles_settings_v1');
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <SettingsProvider>{children}</SettingsProvider>
  );

  it('provides default site settings matching current live site and does not write to localStorage on initial load', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });

    expect(result.current.settings.contactEmail).toBe('weeblesclay@gmail.com');
    expect(result.current.settings.customOrderEmail).toBe('weeblesclay@gmail.com');
    expect(result.current.settings.socials.tiktok).toBe('https://tiktok.com/@weebles_clay');
    expect(result.current.settings.socials.instagram).toBe('https://instagram.com/weebles_clay');
    expect(result.current.settings.socials.facebookMarketplace).toBe('https://facebook.com/marketplace');
    // Ensure localStorage was NOT written on initial load
    expect(localStorage.getItem('weebles_settings_v1')).toBeNull();
  });

  it('updates settings and persists to state and localStorage', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });

    expect(localStorage.getItem('weebles_settings_v1')).toBeNull();

    act(() => {
      result.current.updateSettings({
        ...result.current.settings,
        contactEmail: 'newcontact@weebles.com',
      });
    });

    expect(result.current.settings.contactEmail).toBe('newcontact@weebles.com');
    expect(localStorage.getItem('weebles_settings_v1')).toContain('newcontact@weebles.com');
  });

  it('resets settings back to default and cleans up localStorage', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });

    act(() => {
      result.current.updateSettings({
        ...result.current.settings,
        contactEmail: 'custom@weebles.com',
      });
    });

    expect(result.current.settings.contactEmail).toBe('custom@weebles.com');
    expect(localStorage.getItem('weebles_settings_v1')).toContain('custom@weebles.com');

    act(() => {
      result.current.resetSettings();
    });

    expect(result.current.settings.contactEmail).toBe('weeblesclay@gmail.com');
    expect(localStorage.getItem('weebles_settings_v1')).toBeNull();
  });

  it('gracefully returns default settings when used outside of SettingsProvider', () => {
    const { result } = renderHook(() => useSettings());

    expect(result.current.settings.contactEmail).toBe('weeblesclay@gmail.com');
    expect(result.current.settings.socials.tiktok).toBe('https://tiktok.com/@weebles_clay');
  });

  it('initializes from localStorage if valid data is present', () => {
    const stored = {
      contactEmail: 'stored@weebles.com',
      customOrderEmail: 'stored@weebles.com',
      socials: {
        tiktok: 'https://tiktok.com/@stored',
        instagram: 'https://instagram.com/stored',
        facebookMarketplace: 'https://facebook.com/marketplace/stored',
      },
    };
    localStorage.setItem('weebles_settings_v1', JSON.stringify(stored));

    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.settings.contactEmail).toBe('stored@weebles.com');
    expect(result.current.settings.socials.tiktok).toBe('https://tiktok.com/@stored');
  });

  it('provides seeded default categories and preserves an explicit empty categories array from localStorage', () => {
    expect(SETTINGS_STORAGE_KEY).toBe('weebles_settings_v1');
    const { result: defaultResult } = renderHook(() => useSettings(), { wrapper });
    expect(defaultResult.current.settings.categories?.map((c) => c.id)).toEqual([
      'animals',
      'sweets',
      'fantasy',
      'mini-friends',
    ]);

    localStorage.setItem(
      'weebles_settings_v1',
      JSON.stringify({
        contactEmail: 'stored@weebles.com',
        customOrderEmail: 'stored@weebles.com',
        socials: { tiktok: '', instagram: '', facebookMarketplace: '' },
        categories: [],
      })
    );

    const { result: emptyResult } = renderHook(() => useSettings(), { wrapper });
    expect(emptyResult.current.settings.categories).toEqual([]);
  });

  it('falls back to default categories when localStorage settings omit categories', () => {
    localStorage.setItem(
      'weebles_settings_v1',
      JSON.stringify({
        contactEmail: 'legacy@weebles.com',
        customOrderEmail: 'legacy@weebles.com',
        socials: { tiktok: '', instagram: '', facebookMarketplace: '' },
      })
    );

    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.settings.categories?.map((c) => c.id)).toEqual([
      'animals',
      'sweets',
      'fantasy',
      'mini-friends',
    ]);
  });
});
