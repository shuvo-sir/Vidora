import { useCallback, useEffect, useRef, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import {
  createDownload,
  deleteDownload,
  getAllDownloads,
  updateDownload,
} from '@/src/features/downloads/download-repository';
import type { CreateDownloadInput, UpdateDownloadInput } from '@/src/features/downloads/download-types';
import type { Download } from '@/src/types';

export function useDownloads() {
  const db = useSQLiteContext();
  const mounted = useRef(true);
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const records = await getAllDownloads(db);
      if (mounted.current) setDownloads(records);
    } catch (caught) {
      if (mounted.current) {
        setError(caught instanceof Error ? caught.message : 'Unable to load downloads.');
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: CreateDownloadInput) => {
      const created = await createDownload(db, input);
      await refresh();
      return created;
    },
    [db, refresh]
  );

  const update = useCallback(
    async (id: string, input: UpdateDownloadInput) => {
      const updated = await updateDownload(db, id, input);
      await refresh();
      return updated;
    },
    [db, refresh]
  );

  const remove = useCallback(
    async (id: string) => {
      const removed = await deleteDownload(db, id);
      await refresh();
      return removed;
    },
    [db, refresh]
  );

  return { downloads, loading, error, refresh, create, update, remove };
}
