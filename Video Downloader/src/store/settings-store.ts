import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  DEFAULT_SETTINGS,
  getAppSettings,
  updateAppSetting,
  type AppSettingKey,
  type AppSettings,
} from '@/src/features/settings/settings-repository';

type SettingsStore = AppSettings & {
  isReady: boolean;
  error: string | null;
  updateSetting: <K extends AppSettingKey>(
    db: SQLiteDatabase,
    key: K,
    value: AppSettings[K]
  ) => Promise<void>;
  clearError: () => void;
};

let settingsLoadPromise: Promise<void> | null = null;

export const useSettingsStore = create<SettingsStore>((set) => ({
  ...DEFAULT_SETTINGS,
  isReady: false,
  error: null,
  updateSetting: async (db, key, value) => {
    set((state) => ({ ...state, [key]: value, error: null }));
    try {
      await updateAppSetting(db, key, value);
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : 'Unable to save this preference.';
      set({ error: message });
      throw new Error(message);
    }
  },
  clearError: () => set({ error: null }),
}));

export function initializeSettings(db: SQLiteDatabase): Promise<void> {
  if (!settingsLoadPromise) {
    settingsLoadPromise = getAppSettings(db)
      .then((settings) => {
        useSettingsStore.setState({ ...settings, isReady: true, error: null });
      })
      .catch((caught: unknown) => {
        const message =
          caught instanceof Error
            ? caught.message
            : 'Unable to load saved preferences.';
        useSettingsStore.setState({ isReady: true, error: message });
        throw new Error(message);
      });
  }
  return settingsLoadPromise;
}
