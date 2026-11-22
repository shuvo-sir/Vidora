import { useCallback, useEffect, useRef, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { File } from 'expo-file-system';

import {
  deleteVideo,
  getAllVideos,
  searchVideos,
  sortVideosByDate,
  sortVideosByTitle,
  updateVideo,
} from '@/src/features/library/library-repository';
import type { CreateVideoInput, UpdateVideoInput } from '@/src/features/library/library-repository';
import { createVideo } from '@/src/features/library/library-repository';
import type { LibrarySort, Video } from '@/src/types';

export function useLibraryVideos() {
  const db = useSQLiteContext();
  const mounted = useRef(true);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const applyRecords = useCallback(async (
    operation: () => Promise<Video[]>
  ) => {
    setLoading(true);
    setError(null);
    try {
      const records = await operation();
      if (mounted.current) setVideos(records);
    } catch (caught) {
      if (mounted.current) {
        setError(caught instanceof Error ? caught.message : 'Unable to load videos.');
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  const refresh = useCallback(
    () => applyRecords(async () => {
      const records = await getAllVideos(db);
      await Promise.all(records.map(async (video) => {
        if (!video.localUri) return;

        const updates: UpdateVideoInput = {};
        try {
          const file = new File(video.localUri);
          const size = file.info().size;
          if (typeof size === 'number' && size >= 0 && size !== video.fileSizeBytes) {
            updates.fileSizeBytes = size;
          }
        } catch {
          // The local file may be unavailable while the device is offline or remounted.
        }

        if (!video.thumbnailUri) {
          try {
            const thumbnails = await import('expo-video-thumbnails');
            const thumbnail = await thumbnails.getThumbnailAsync(video.localUri, { time: 1000 });
            updates.thumbnailUri = thumbnail.uri;
          } catch {
            // Keep the existing placeholder if thumbnail generation is unavailable.
          }
        }

        if (video.durationMs === null) {
          try {
            const videoModule = await import('expo-video');
            const player = videoModule.createVideoPlayer(video.localUri);
            const durationSeconds = Number(player.duration);
            if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
              updates.durationMs = Math.round(durationSeconds * 1000);
            }
            if (typeof player.release === 'function') player.release();
          } catch {
            // Duration remains unknown until the local file can be probed.
          }
        }

        if (Object.keys(updates).length > 0) {
          await updateVideo(db, video.id, updates);
        }
      }));
      return getAllVideos(db);
    }),
    [applyRecords, db]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const search = useCallback(
    (query: string) => applyRecords(() => searchVideos(db, query)),
    [applyRecords, db]
  );

  const sort = useCallback(
    (value: LibrarySort) => {
      if (value === 'Newest') return applyRecords(() => sortVideosByDate(db, true));
      if (value === 'Oldest') return applyRecords(() => sortVideosByDate(db, false));
      return applyRecords(() => sortVideosByTitle(db));
    },
    [applyRecords, db]
  );

  const create = useCallback(
    async (input: CreateVideoInput) => {
      const created = await createVideo(db, input);
      await refresh();
      return created;
    },
    [db, refresh]
  );

  const update = useCallback(
    async (id: string, input: UpdateVideoInput) => {
      const updated = await updateVideo(db, id, input);
      await refresh();
      return updated;
    },
    [db, refresh]
  );

  const remove = useCallback(
    async (id: string) => {
      const removed = await deleteVideo(db, id);
      await refresh();
      return removed;
    },
    [db, refresh]
  );

  return { videos, loading, error, refresh, search, sort, create, update, remove };
}
