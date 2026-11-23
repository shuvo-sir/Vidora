import {
  createElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { DownloadManager } from '@/src/features/downloads/download-manager';
import type {
  AnalysisResult,
  DownloadFormat,
} from '@/src/features/downloader/downloader-types';
import { useDownloadStore } from '@/src/store/download-store';

const DownloadManagerContext = createContext<DownloadManager | null>(null);

export function DownloadManagerProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const manager = useMemo(() => new DownloadManager(db), [db]);

  useEffect(() => {
    void manager.initialize();
  }, [manager]);

  return createElement(DownloadManagerContext.Provider, { value: manager }, children);
}

export function useDownloadManager() {
  const manager = useContext(DownloadManagerContext);
  if (!manager) {
    throw new Error('useDownloadManager must be used within a DownloadManagerProvider.');
  }

  const refresh = useCallback(() => manager.refreshHistory(), [manager]);
  const start = useCallback(
    (
      analysis: AnalysisResult,
      sourceUrl?: string,
      selectedFormat: DownloadFormat = 'original'
    ) => manager.startDownload(analysis, sourceUrl, selectedFormat),
    [manager]
  );
  const startSocial = useCallback(
    (
      analysis: AnalysisResult,
      sourceUrl: string,
      formatId: string,
      formatType: 'mp4' | 'mp3' = 'mp4'
    ) => manager.startSocialDownload(analysis, sourceUrl, formatId, formatType),
    [manager]
  );
  const pause = useCallback((id: string) => manager.pause(id), [manager]);
  const resume = useCallback((id: string) => manager.resume(id), [manager]);
  const cancel = useCallback((id: string) => manager.cancel(id), [manager]);
  const retry = useCallback((id: string) => manager.retry(id), [manager]);
  const remove = useCallback((id: string) => manager.remove(id), [manager]);
  const clearAll = useCallback(() => manager.clearAll(), [manager]);

  return {
    downloads: useDownloadStore((state) => state.downloads),
    activeDownloadId: useDownloadStore((state) => state.activeDownloadId),
    progressById: useDownloadStore((state) => state.progressById),
    statusMessageById: useDownloadStore((state) => state.statusMessageById),
    loading: useDownloadStore((state) => state.loading),
    initialized: useDownloadStore((state) => state.initialized),
    error: useDownloadStore((state) => state.error),
    refresh,
    start,
    startSocial,
    pause,
    resume,
    cancel,
    retry,
    remove,
    clearAll,
  };
}
