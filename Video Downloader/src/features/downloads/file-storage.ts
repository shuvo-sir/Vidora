import { Directory, File, Paths } from 'expo-file-system';

import { sanitizeFilename } from '@/src/utils/sanitize-filename';

export const VIDORA_ROOT = new Directory(Paths.document, 'Vidora');
export const DOWNLOADS_DIRECTORY = new Directory(VIDORA_ROOT, 'Downloads');
export const TEMP_DIRECTORY = new Directory(DOWNLOADS_DIRECTORY, 'temporary');
export const VIDEOS_DIRECTORY = new Directory(VIDORA_ROOT, 'videos');

export function initializeDownloadDirectories(): void {
  if (!VIDORA_ROOT.exists) VIDORA_ROOT.create({ idempotent: true });
  if (!DOWNLOADS_DIRECTORY.exists) DOWNLOADS_DIRECTORY.create({ idempotent: true });
  if (!TEMP_DIRECTORY.exists) TEMP_DIRECTORY.create({ idempotent: true });
  if (!VIDEOS_DIRECTORY.exists) VIDEOS_DIRECTORY.create({ idempotent: true });
}

export function createTemporaryFile(downloadId: string, fileName: string): File {
  initializeDownloadDirectories();
  const safeName = sanitizeFilename(fileName);
  const dot = safeName.lastIndexOf('.');
  const name = dot > 0 ? safeName.slice(0, dot) : safeName;
  const extension = dot > 0 ? safeName.slice(dot) : '';
  const safeDownloadId = sanitizeFilename(downloadId, 'download').slice(0, 80);
  let candidate = new File(TEMP_DIRECTORY, `${safeDownloadId}-${sanitizeFilename(name).slice(0, 80)}${extension}`);
  let suffix = 1;
  while (candidate.exists) {
    candidate = new File(TEMP_DIRECTORY, `${safeDownloadId}-${sanitizeFilename(name).slice(0, 80)}-${suffix}${extension}`);
    suffix += 1;
  }
  return candidate;
}

export function createFinalFile(downloadId: string, fileName: string): File {
  initializeDownloadDirectories();
  const safeName = sanitizeFilename(fileName);
  const dot = safeName.lastIndexOf('.');
  const name = dot > 0 ? safeName.slice(0, dot) : safeName;
  const extension = dot > 0 ? safeName.slice(dot) : '';
  const safeDownloadId = sanitizeFilename(downloadId, 'download').slice(0, 80);
  let candidate = new File(VIDEOS_DIRECTORY, `${sanitizeFilename(name).slice(0, 80)}-${safeDownloadId}${extension}`);
  let suffix = 1;
  while (candidate.exists) {
    candidate = new File(VIDEOS_DIRECTORY, `${sanitizeFilename(name).slice(0, 80)}-${safeDownloadId}-${suffix}${extension}`);
    suffix += 1;
  }
  return candidate;
}

export function getFileSize(file: File): number {
  return file.exists ? (file.info().size ?? 0) : 0;
}

export function isLocalFileValid(file: File): boolean {
  return file.exists && getFileSize(file) > 0;
}

export function deleteOwnFile(file: File): void {
  if (file.exists) file.delete();
}

export function deleteTemporaryFilesForDownload(downloadId: string): void {
  initializeDownloadDirectories();
  for (const entry of TEMP_DIRECTORY.list()) {
    if (entry instanceof File && entry.name.startsWith(`${downloadId}-`)) {
      entry.delete();
    }
  }
}

export function isEnoughDiskSpace(expectedBytes: number | null): boolean {
  if (!expectedBytes || expectedBytes <= 0) return true;
  return Paths.availableDiskSpace > expectedBytes + 16 * 1024 * 1024;
}
