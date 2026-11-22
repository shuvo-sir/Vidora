export type DownloadStatus =
  | 'queued'
  | 'downloading'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type Download = {
  id: string;
  title: string;
  sourceUrl: string;
  sourceName: string | null;
  thumbnailUri: string | null;
  fileName: string;
  mimeType: string | null;
  totalBytes: number;
  downloadedBytes: number;
  status: DownloadStatus;
  errorMessage: string | null;
  localUri: string | null;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  isDemo: boolean;
  resumeData: string | null;
  assetId: string | null;
  mediaType: 'video' | 'audio' | null;
};

export type Video = {
  id: string;
  downloadId: string | null;
  title: string;
  sourceName: string | null;
  thumbnailUri: string | null;
  fileName: string;
  localUri: string | null;
  mimeType: string | null;
  fileSizeBytes: number;
  durationMs: number | null;
  savedAt: number;
  isDemo: boolean;
  assetId: string | null;
  mediaType: 'video' | 'audio' | null;
};

export type DownloadFilter =
  | 'All'
  | 'Active'
  | 'Completed'
  | 'Failed';
export type LibrarySort = 'Newest' | 'Oldest' | 'Title A-Z';
