import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { api } from '../services/api';
import type { AppSettings } from '../services/api';

interface SettingsContextType {
  settings: AppSettings | null;
  loading: boolean;
  updateSetting: (key: keyof AppSettings, value: boolean | number) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const defaultSettings: AppSettings = {
  cacheData: true,
  syncEnabled: true,
  downloadImagesLocally: false,
  recursiveHomeSync: false,
  recursiveSeriesSync: false,
  recursiveConcurrency: 2,
};

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await api.getSettings();
        setSettings(data);
      } catch (err) {
        console.error('Failed to load settings from server, using defaults.', err);
        setSettings(defaultSettings);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const updateSetting = async (key: keyof AppSettings, value: boolean | number) => {
    // Optimistic update
    setSettings(prev => prev ? { ...prev, [key]: value } : defaultSettings);
    
    try {
      await api.updateSettings({ [key]: value });
    } catch (err) {
      console.error('Failed to update setting', err);
      // Revert in case of failure (ideally we should fetch again or hold previous state)
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSetting }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
