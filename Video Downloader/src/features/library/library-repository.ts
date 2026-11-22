import type { SQLiteDatabase } from 'expo-sqlite';

import type { Video } from '@/src/types';

export type CreateVideoInput = {
  id: string;
  downloadId?: string | null;
  title: string;
  sourceName?: string | null;
  thumbnailUri?: string | null;
  fileName: string;
  localUri?: string | null;
  mimeType?: string | null;
  fileSizeBytes?: number;
  durationMs?: number | null;
  isDemo?: boolean;
  assetId?: string | null;
  mediaType?: 'video' | 'audio' | null;
};

export type UpdateVideoInput = Partial<Omit<CreateVideoInput, 'id'>>;

type VideoRow = {
  id: string;
  download_id: string | null;
  title: string;
  source_name: string | null;
  thumbnail_uri: string | null;
  file_name: string;
  local_uri: string | null;
  mime_type: string | null;
  file_size_bytes: number;
  duration_ms: number | null;
  saved_at: number;
  is_demo: number;
  assetId: string | null;
  mediaType: 'video' | 'audio' | null;
};

function toVideo(row: VideoRow): Video {
  return {
    id: row.id,
    downloadId: row.download_id,
    title: row.title,
    sourceName: row.source_name,
    thumbnailUri: row.thumbnail_uri,
    fileName: row.file_name,
    localUri: row.local_uri,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    durationMs: row.duration_ms,
    savedAt: row.saved_at,
    isDemo: row.is_demo === 1,
    assetId: row.assetId,
    mediaType: row.mediaType,
  };
}

export async function createVideo(
  db: SQLiteDatabase,
  input: CreateVideoInput
): Promise<Video> {
  if (!input.title.trim()) throw new Error('Video title is required.');
  if (!input.fileName.trim()) throw new Error('File name is required.');

  const fileSize = input.fileSizeBytes ?? 0;
  if (!Number.isInteger(fileSize) || fileSize < 0) {
    throw new Error('File size must be a non-negative integer.');
  }
  if (
    input.durationMs !== undefined &&
    input.durationMs !== null &&
    (!Number.isInteger(input.durationMs) || input.durationMs < 0)
  ) {
    throw new Error('Duration must be a non-negative integer.');
  }

  await db.runAsync(
    `INSERT INTO videos (
      id, download_id, title, source_name, thumbnail_uri, file_name,
      local_uri, mime_type, file_size_bytes, duration_ms, saved_at, is_demo,
      assetId, mediaType
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.id,
      input.downloadId ?? null,
      input.title.trim(),
      input.sourceName ?? null,
      input.thumbnailUri ?? null,
      input.fileName.trim(),
      input.localUri ?? null,
      input.mimeType ?? null,
      fileSize,
      input.durationMs ?? null,
      Date.now(),
      input.isDemo ? 1 : 0,
      input.assetId ?? null,
      input.mediaType ?? null,
    ]
  );

  const created = await getVideoById(db, input.id);
  if (!created) throw new Error('The video record could not be loaded after creation.');
  return created;
}

export async function getAllVideos(db: SQLiteDatabase): Promise<Video[]> {
  const rows = await db.getAllAsync<VideoRow>(
    'SELECT * FROM videos ORDER BY saved_at DESC'
  );
  return rows.map(toVideo);
}

export async function getVideoById(
  db: SQLiteDatabase,
  id: string
): Promise<Video | null> {
  const row = await db.getFirstAsync<VideoRow>(
    'SELECT * FROM videos WHERE id = ?',
    [id]
  );
  return row ? toVideo(row) : null;
}

export async function searchVideos(
  db: SQLiteDatabase,
  query: string
): Promise<Video[]> {
  const search = `%${query.trim()}%`;
  const rows = await db.getAllAsync<VideoRow>(
    'SELECT * FROM videos WHERE title LIKE ? COLLATE NOCASE ORDER BY saved_at DESC',
    [search]
  );
  return rows.map(toVideo);
}

export async function sortVideosByDate(
  db: SQLiteDatabase,
  newestFirst = true
): Promise<Video[]> {
  const direction = newestFirst ? 'DESC' : 'ASC';
  const rows = await db.getAllAsync<VideoRow>(
    `SELECT * FROM videos ORDER BY saved_at ${direction}`
  );
  return rows.map(toVideo);
}

export async function sortVideosByTitle(db: SQLiteDatabase): Promise<Video[]> {
  const rows = await db.getAllAsync<VideoRow>(
    'SELECT * FROM videos ORDER BY title COLLATE NOCASE ASC'
  );
  return rows.map(toVideo);
}

export async function updateVideo(
  db: SQLiteDatabase,
  id: string,
  input: UpdateVideoInput
): Promise<Video | null> {
  const existing = await getVideoById(db, id);
  if (!existing) return null;

  const fileSize = input.fileSizeBytes ?? existing.fileSizeBytes;
  if (!Number.isInteger(fileSize) || fileSize < 0) {
    throw new Error('File size must be a non-negative integer.');
  }

  await db.runAsync(
    `UPDATE videos SET
      download_id = ?, title = ?, source_name = ?, thumbnail_uri = ?, file_name = ?,
      local_uri = ?, mime_type = ?, file_size_bytes = ?, duration_ms = ?, is_demo = ?
      , assetId = ?, mediaType = ?
    WHERE id = ?`,
    [
      input.downloadId !== undefined ? input.downloadId : existing.downloadId,
      (input.title ?? existing.title).trim(),
      input.sourceName !== undefined ? input.sourceName : existing.sourceName,
      input.thumbnailUri !== undefined ? input.thumbnailUri : existing.thumbnailUri,
      (input.fileName ?? existing.fileName).trim(),
      input.localUri !== undefined ? input.localUri : existing.localUri,
      input.mimeType !== undefined ? input.mimeType : existing.mimeType,
      fileSize,
      input.durationMs !== undefined ? input.durationMs : existing.durationMs,
      input.isDemo !== undefined ? (input.isDemo ? 1 : 0) : (existing.isDemo ? 1 : 0),
      input.assetId !== undefined ? input.assetId : existing.assetId,
      input.mediaType !== undefined ? input.mediaType : existing.mediaType,
      id,
    ]
  );
  return getVideoById(db, id);
}

export async function deleteVideo(db: SQLiteDatabase, id: string): Promise<boolean> {
  const result = await db.runAsync('DELETE FROM videos WHERE id = ?', [id]);
  return result.changes > 0;
}

export async function getVideoCount(db: SQLiteDatabase): Promise<number> {
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM videos'
  );
  return result?.count ?? 0;
}

export async function getTotalLibrarySize(db: SQLiteDatabase): Promise<number> {
  const result = await db.getFirstAsync<{ total: number | null }>(
    'SELECT SUM(file_size_bytes) AS total FROM videos'
  );
  return result?.total ?? 0;
}

export async function clearDemoVideos(db: SQLiteDatabase): Promise<number> {
  const result = await db.runAsync(
    'DELETE FROM videos WHERE is_demo = 1'
  );
  return result.changes;
}
