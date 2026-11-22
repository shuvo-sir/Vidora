import { useCallback, useEffect, useRef } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import { DownloadManager } from '@/src/features/downloads/download-manager';
import type {
  AnalysisResult,
  DownloadFormat,
} from '@/src/features/downloader/downloader-types';
import { useDownloadStore } from '@/src/store/download-store';

let managerInstance: DownloadManager | null = null;
let managerDatabase: SQLiteDatabase | null = null;

export function useDownloadManager() {
  const db = useSQLiteContext();
  const initializedRef = useRef(false);

  if (!managerInstance || managerDatabase !== db) {
    managerInstance = new DownloadManager(db);
    managerDatabase = db;
  }

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    void managerInstance?.initialize();
  }, []);

  const refresh = useCallback(
    () => managerInstance?.refreshHistory(),
    []
  );
  const start = useCallback(
    (
      analysis: AnalysisResult,
      sourceUrl?: string,
      selectedFormat: DownloadFormat = 'original'
    ) => managerInstance?.startDownload(
      analysis,
      sourceUrl,
      selectedFormat
    ),
    []
  );
  const startSocial = useCallback(
    (
      analysis: AnalysisResult,
      sourceUrl: string,
      formatId: string,
      formatType: 'mp4' | 'mp3' = 'mp4'
    ) => managerInstance?.startSocialDownload(
      analysis,
      sourceUrl,
      formatId,
      formatType
    ),
    []
  );
  const pause = useCallback(
    (id: string) => managerInstance?.pause(id),
    []
  );
  const resume = useCallback(
    (id: string) => managerInstance?.resume(id),
    []
  );
  const cancel = useCallback(
    (id: string) => managerInstance?.cancel(id),
    []
  );
  const retry = useCallback(
    (id: string) => managerInstance?.retry(id),
    []
  );
  const remove = useCallback(
    (id: string) => managerInstance?.remove(id),
    []
  );

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
  };
}
