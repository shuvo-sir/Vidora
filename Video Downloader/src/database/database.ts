import type { SQLiteDatabase } from 'expo-sqlite';

import {
  CREATE_DOWNLOADS_TABLE,
  CREATE_SETTINGS_TABLE,
  CREATE_SCHEMA_INDEXES,
  CREATE_VIDEOS_TABLE,
} from './schema';

export const DATABASE_NAME = 'vidora.db';
export const CURRENT_SCHEMA_VERSION = 5;

export async function initializeDatabase(db: SQLiteDatabase): Promise<void> {
  try {
    await db.execAsync('PRAGMA foreign_keys = ON');
    await db.execAsync('PRAGMA journal_mode = WAL');

    const result = await db.getFirstAsync<{ user_version: number }>(
      'PRAGMA user_version'
    );
    const userVersion = result?.user_version ?? 0;

    if (userVersion > CURRENT_SCHEMA_VERSION) {
      throw new Error(
        `Database schema version ${userVersion} is newer than this app supports (${CURRENT_SCHEMA_VERSION}).`
      );
    }

    await db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync(CREATE_DOWNLOADS_TABLE);
      await transaction.execAsync(CREATE_VIDEOS_TABLE);
      await transaction.execAsync(CREATE_SETTINGS_TABLE);
      await transaction.execAsync(CREATE_SCHEMA_INDEXES);

      const downloadColumns = await transaction.getAllAsync<{ name: string }>(
        'PRAGMA table_info(downloads)'
      );
      if (!downloadColumns.some((column) => column.name === 'resume_data')) {
        await transaction.execAsync(
          'ALTER TABLE downloads ADD COLUMN resume_data TEXT'
        );
      }
      if (!downloadColumns.some((column) => column.name === 'assetId')) {
        await transaction.execAsync(
          'ALTER TABLE downloads ADD COLUMN assetId TEXT'
        );
      }
      if (!downloadColumns.some((column) => column.name === 'mediaType')) {
        await transaction.execAsync(
          'ALTER TABLE downloads ADD COLUMN mediaType TEXT'
        );
      }

      const videoColumns = await transaction.getAllAsync<{ name: string }>(
        'PRAGMA table_info(videos)'
      );
      if (!videoColumns.some((column) => column.name === 'assetId')) {
        await transaction.execAsync(
          'ALTER TABLE videos ADD COLUMN assetId TEXT'
        );
      }
      if (!videoColumns.some((column) => column.name === 'mediaType')) {
        await transaction.execAsync(
          'ALTER TABLE videos ADD COLUMN mediaType TEXT'
        );
      }

      await transaction.execAsync(
        `PRAGMA user_version = ${CURRENT_SCHEMA_VERSION}`
      );
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? `Database initialization failed: ${error.message}`
        : 'Database initialization failed.';
    throw new Error(message);
  }
}
