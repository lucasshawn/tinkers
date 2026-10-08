import React, { createContext, useContext, useState, useEffect } from 'react';
import { SiteSettings } from '../types/settings';
import defaultSettingsData from '../data/settings.json';

export interface SettingsContextType {
  settings: SiteSettings;
  updateSettings: (newSettings: SiteSettings) => void;
  resetSettings: () => void;
}

const STORAGE_KEY = 'weebles_settings_v1';
const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const DEFAULT_SETTINGS: SiteSettings = defaultSettingsData as SiteSettings;

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SiteSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          socials: {
            ...DEFAULT_SETTINGS.socials,
            ...(parsed?.socials || {}),
          },
        };
      }
    } catch {
      // Fallback
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore
    }
  }, [settings]);

  const updateSettings = (newSettings: SiteSettings) => {
    setSettings(newSettings);
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
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
      resetSettings: () => {},
    };
  }
  return context;
};
