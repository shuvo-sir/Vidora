import { create } from 'zustand';

import type { Download } from '@/src/types';
import type { DownloadProgress } from '@/src/features/downloads/download-types';

type DownloadStore = {
  downloads: Download[];
  activeDownloadId: string | null;
  queuedDownloads: string[];
  progressById: Record<string, DownloadProgress>;
  statusMessageById: Record<string, string>;
  loading: boolean;
  initialized: boolean;
  error: string | null;
  setDownloads: (downloads: Download[]) => void;
  addDownload: (download: Download) => void;
  updateDownload: (download: Download) => void;
  removeDownload: (id: string) => void;
  setActiveDownload: (id: string | null) => void;
  setQueuedDownloads: (ids: string[]) => void;
  setProgress: (progress: DownloadProgress) => void;
  clearProgress: (id: string) => void;
  setStatusMessage: (id: string, message: string) => void;
  clearStatusMessage: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  setError: (error: string | null) => void;
  resetError: () => void;
};

export const useDownloadStore = create<DownloadStore>((set) => ({
  downloads: [],
  activeDownloadId: null,
  queuedDownloads: [],
  progressById: {},
  statusMessageById: {},
  loading: false,
  initialized: false,
  error: null,
  setDownloads: (downloads) =>
    set({
      downloads,
      queuedDownloads: downloads
        .filter((item) => item.status === 'queued')
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((item) => item.id),
    }),
  addDownload: (download) =>
    set((state) => ({
      downloads: [download, ...state.downloads.filter((item) => item.id !== download.id)],
      queuedDownloads: download.status === 'queued'
        ? [...state.queuedDownloads, download.id]
        : state.queuedDownloads,
    })),
  updateDownload: (download) =>
    set((state) => ({
      downloads: state.downloads
        .map((item) => (item.id === download.id ? download : item))
        .sort((a, b) => b.createdAt - a.createdAt),
      queuedDownloads: download.status === 'queued'
        ? state.queuedDownloads.includes(download.id)
          ? state.queuedDownloads
          : [...state.queuedDownloads, download.id]
        : state.queuedDownloads.filter((id) => id !== download.id),
    })),
  removeDownload: (id) =>
    set((state) => ({
      downloads: state.downloads.filter((item) => item.id !== id),
      queuedDownloads: state.queuedDownloads.filter((item) => item !== id),
      activeDownloadId: state.activeDownloadId === id ? null : state.activeDownloadId,
      progressById: Object.fromEntries(
        Object.entries(state.progressById).filter(([key]) => key !== id)
      ),
      statusMessageById: Object.fromEntries(
        Object.entries(state.statusMessageById).filter(([key]) => key !== id)
      ),
    })),
  setActiveDownload: (activeDownloadId) => set({ activeDownloadId }),
  setQueuedDownloads: (queuedDownloads) => set({ queuedDownloads }),
  setProgress: (progress) =>
    set((state) => ({
      progressById: { ...state.progressById, [progress.downloadId]: progress },
    })),
  clearProgress: (id) =>
    set((state) => {
      const next = { ...state.progressById };
      delete next[id];
      return { progressById: next };
    }),
  setStatusMessage: (id: string, message: string) =>
    set((state) => ({
      statusMessageById: { ...state.statusMessageById, [id]: message },
    })),
  clearStatusMessage: (id: string) =>
    set((state) => {
      const next = { ...state.statusMessageById };
      delete next[id];
      return { statusMessageById: next };
    }),
  setLoading: (loading: boolean) => set({ loading }),
  setInitialized: (initialized: boolean) => set({ initialized }),
  setError: (error: string | null) => set({ error }),
  resetError: () => set({ error: null }),
}));
