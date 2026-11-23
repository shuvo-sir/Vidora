import type { SQLiteDatabase } from 'expo-sqlite';

export type AppSettings = {
  theme: 'dark' | 'light';
  wifiOnly: boolean;
  notifications: boolean;
};

export type AppSettingKey = keyof AppSettings;

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  wifiOnly: true,
  notifications: false,
};

const settingKeys: AppSettingKey[] = [
  'theme',
  'wifiOnly',
  'notifications',
];

export async function getAppSettings(
  db: SQLiteDatabase
): Promise<AppSettings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM app_settings'
  );
  const settings = { ...DEFAULT_SETTINGS };
  const savedTheme = rows.find((row) => row.key === 'theme');
  const legacyDarkTheme = rows.find((row) => row.key === 'darkTheme');

  for (const row of rows) {
    if (row.key === 'theme') {
      if (row.value !== 'dark' && row.value !== 'light') {
        throw new Error('Saved theme preference has an invalid value.');
      }
      settings.theme = row.value;
      continue;
    }
    if (row.key === 'darkTheme') {
      if (row.value !== 'true' && row.value !== 'false') {
        throw new Error('Saved theme preference has an invalid value.');
      }
      continue;
    }
    if (!settingKeys.includes(row.key as AppSettingKey)) continue;
    if (row.value !== 'true' && row.value !== 'false') {
      throw new Error(`Saved setting "${row.key}" has an invalid value.`);
    }
    settings[row.key as 'wifiOnly' | 'notifications'] = row.value === 'true';
  }

  if (!savedTheme && legacyDarkTheme) {
    settings.theme = legacyDarkTheme.value === 'true' ? 'dark' : 'light';
  }

  return settings;
}

export async function updateAppSetting<K extends AppSettingKey>(
  db: SQLiteDatabase,
  key: K,
  value: AppSettings[K]
): Promise<void> {
  await db.runAsync(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, String(value)]
  );
}
