import type { DownloadStatus } from '@/src/types';

export type CreateDownloadInput = {
  id?: string;
  title: string;
  sourceUrl: string;
  sourceName?: string | null;
  thumbnailUri?: string | null;
  fileName: string;
  mimeType?: string | null;
  totalBytes?: number;
  downloadedBytes?: number;
  status: DownloadStatus;
  errorMessage?: string | null;
  localUri?: string | null;
  isDemo?: boolean;
  resumeData?: string | null;
  assetId?: string | null;
  mediaType?: 'video' | 'audio' | null;
};

export type UpdateDownloadInput = Partial<
  Omit<CreateDownloadInput, 'id'>
> & {
  completedAt?: number | null;
  resumeData?: string | null;
};

export type DownloadProgress = {
  downloadId: string;
  bytesWritten: number;
  totalBytes: number | null;
  progressPercent: number | null;
  bytesPerSecond: number | null;
  updatedAt: number;
};

export type DownloadOperationResult =
  | { ok: true; downloadId: string; localUri?: string }
  | { ok: false; downloadId: string; code: string; message: string };

export type DownloadRuntimeState = {
  taskId: string;
  phase: 'starting' | 'active' | 'pausing' | 'paused';
  progress: DownloadProgress | null;
};
