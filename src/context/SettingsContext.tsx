import React, { createContext, useCallback, useContext, useState } from 'react';
import { SiteSettings } from '../types/settings';
import defaultSettingsData from '../data/settings.json';
import { normalizeSettings } from '../utils/socialPlatforms';

export interface SettingsContextType {
  settings: SiteSettings;
  updateSettings: (newSettings: SiteSettings) => void;
  hydrateSettings: (remoteSettings: SiteSettings) => void;
  resetSettings: () => void;
}

export const SETTINGS_STORAGE_KEY = 'weebles_settings_v1';
const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const rawDefaults = defaultSettingsData as SiteSettings;
export const DEFAULT_SETTINGS: SiteSettings = normalizeSettings(rawDefaults, rawDefaults);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SiteSettings>(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return normalizeSettings(parsed, DEFAULT_SETTINGS);
      }
    } catch {
      // Fallback
    }
    return DEFAULT_SETTINGS;
  });

  const updateSettings = useCallback((newSettings: SiteSettings) => {
    const normalized = normalizeSettings(newSettings, DEFAULT_SETTINGS);
    setSettings(normalized);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Ignore
    }
  }, []);

  const hydrateSettings = useCallback((remoteSettings: SiteSettings) => {
    const normalized = normalizeSettings(remoteSettings, DEFAULT_SETTINGS);
    setSettings(normalized);
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, hydrateSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    return {
      settings: DEFAULT_SETTINGS,
      updateSettings: () => {},
      hydrateSettings: () => {},
      resetSettings: () => {},
    };
  }
  return context;
};
