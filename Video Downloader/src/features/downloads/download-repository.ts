import type { SQLiteDatabase } from 'expo-sqlite';

import type { CreateDownloadInput, UpdateDownloadInput } from './download-types';
import type { Download, DownloadStatus } from '@/src/types';
import { createId } from '@/src/utils/create-id';

type DownloadRow = {
  id: string;
  title: string;
  source_url: string;
  source_name: string | null;
  thumbnail_uri: string | null;
  file_name: string;
  mime_type: string | null;
  total_bytes: number;
  downloaded_bytes: number;
  status: DownloadStatus;
  error_message: string | null;
  local_uri: string | null;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
  is_demo: number;
  resume_data: string | null;
  assetId: string | null;
  mediaType: 'video' | 'audio' | null;
};

function toDownload(row: DownloadRow): Download {
  return {
    id: row.id,
    title: row.title,
    sourceUrl: row.source_url,
    sourceName: row.source_name,
    thumbnailUri: row.thumbnail_uri,
    fileName: row.file_name,
    mimeType: row.mime_type,
    totalBytes: row.total_bytes,
    downloadedBytes: row.downloaded_bytes,
    status: row.status,
    errorMessage: row.error_message,
    localUri: row.local_uri,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    isDemo: row.is_demo === 1,
    resumeData: row.resume_data,
    assetId: row.assetId,
    mediaType: row.mediaType,
  };
}

function validateFileCount(label: string, value: number) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
}

export async function createDownload(
  db: SQLiteDatabase,
  input: CreateDownloadInput
): Promise<Download> {
  validateFileCount('totalBytes', input.totalBytes ?? 0);
  validateFileCount('downloadedBytes', input.downloadedBytes ?? 0);

  if (!input.title.trim()) throw new Error('Download title is required.');
  if (!input.sourceUrl.trim()) throw new Error('Source URL is required.');
  if (!input.fileName.trim()) throw new Error('File name is required.');

  const now = Date.now();
  const id = input.id ?? createId('download');
  const completedAt =
    input.status === 'completed' ? now : null;
  await db.runAsync(
    `INSERT INTO downloads (
      id, title, source_url, source_name, thumbnail_uri, file_name, mime_type,
      total_bytes, downloaded_bytes, status, error_message, local_uri,
      created_at, updated_at, completed_at, is_demo, resume_data, assetId, mediaType
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.title.trim(),
      input.sourceUrl.trim(),
      input.sourceName ?? null,
      input.thumbnailUri ?? null,
      input.fileName.trim(),
      input.mimeType ?? null,
      input.totalBytes ?? 0,
      input.downloadedBytes ?? 0,
      input.status,
      input.errorMessage ?? null,
      input.localUri ?? null,
      now,
      now,
      completedAt,
      input.isDemo ? 1 : 0,
      input.resumeData ?? null,
      input.assetId ?? null,
      input.mediaType ?? null,
    ]
  );

  const created = await getDownloadById(db, id);
  if (!created) throw new Error('The download record could not be loaded after creation.');
  return created;
}

export async function getAllDownloads(db: SQLiteDatabase): Promise<Download[]> {
  const rows = await db.getAllAsync<DownloadRow>(
    'SELECT * FROM downloads ORDER BY created_at DESC'
  );
  return rows.map(toDownload);
}

export async function getDownloadById(
  db: SQLiteDatabase,
  id: string
): Promise<Download | null> {
  const row = await db.getFirstAsync<DownloadRow>(
    'SELECT * FROM downloads WHERE id = ?',
    [id]
  );
  return row ? toDownload(row) : null;
}

export async function getDownloadsByStatus(
  db: SQLiteDatabase,
  status: DownloadStatus
): Promise<Download[]> {
  const rows = await db.getAllAsync<DownloadRow>(
    'SELECT * FROM downloads WHERE status = ? ORDER BY created_at DESC',
    [status]
  );
  return rows.map(toDownload);
}

export async function updateDownload(
  db: SQLiteDatabase,
  id: string,
  input: UpdateDownloadInput
): Promise<Download | null> {
  if (input.totalBytes !== undefined) validateFileCount('totalBytes', input.totalBytes);
  if (input.downloadedBytes !== undefined) {
    validateFileCount('downloadedBytes', input.downloadedBytes);
  }

  const existing = await getDownloadById(db, id);
  if (!existing) return null;

  const now = Date.now();
  const nextStatus = input.status ?? existing.status;
  const completedAt =
    input.completedAt !== undefined
      ? input.completedAt
      : nextStatus === 'completed'
        ? existing.completedAt ?? now
        : null;

  await db.runAsync(
    `UPDATE downloads SET
      title = ?, source_url = ?, source_name = ?, thumbnail_uri = ?, file_name = ?,
      mime_type = ?, total_bytes = ?, downloaded_bytes = ?, status = ?,
      error_message = ?, local_uri = ?, updated_at = ?, completed_at = ?, is_demo = ?,
      resume_data = ?, assetId = ?, mediaType = ?
    WHERE id = ?`,
    [
      (input.title ?? existing.title).trim(),
      (input.sourceUrl ?? existing.sourceUrl).trim(),
      input.sourceName !== undefined ? input.sourceName : existing.sourceName,
      input.thumbnailUri !== undefined ? input.thumbnailUri : existing.thumbnailUri,
      (input.fileName ?? existing.fileName).trim(),
      input.mimeType !== undefined ? input.mimeType : existing.mimeType,
      input.totalBytes ?? existing.totalBytes,
      input.downloadedBytes ?? existing.downloadedBytes,
      nextStatus,
      input.errorMessage !== undefined ? input.errorMessage : existing.errorMessage,
      input.localUri !== undefined ? input.localUri : existing.localUri,
      now,
      completedAt,
      input.isDemo !== undefined ? (input.isDemo ? 1 : 0) : (existing.isDemo ? 1 : 0),
      input.resumeData !== undefined ? input.resumeData : existing.resumeData,
      input.assetId !== undefined ? input.assetId : existing.assetId,
      input.mediaType !== undefined ? input.mediaType : existing.mediaType,
      id,
    ]
  );
  return getDownloadById(db, id);
}

export async function deleteDownload(db: SQLiteDatabase, id: string): Promise<boolean> {
  const result = await db.runAsync('DELETE FROM downloads WHERE id = ?', [id]);
  return result.changes > 0;
}

export async function clearDownloadHistory(db: SQLiteDatabase): Promise<number> {
  const result = await db.runAsync('DELETE FROM downloads');
  return result.changes;
}

export async function clearDemoDownloads(db: SQLiteDatabase): Promise<number> {
  const result = await db.runAsync(
    'DELETE FROM downloads WHERE is_demo = 1'
  );
  return result.changes;
}

export async function getRecentDownloads(
  db: SQLiteDatabase,
  limit = 5
): Promise<Download[]> {
  const safeLimit = Math.max(1, Math.floor(limit));
  const rows = await db.getAllAsync<DownloadRow>(
    'SELECT * FROM downloads ORDER BY created_at DESC LIMIT ?',
    [safeLimit]
  );
  return rows.map(toDownload);
}
