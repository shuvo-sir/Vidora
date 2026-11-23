import type { SQLiteDatabase } from 'expo-sqlite';
import * as MediaLibrary from 'expo-media-library/legacy';

import {
  deleteDownload,
  getDownloadById,
  updateDownload,
} from '@/src/features/downloads/download-repository';
import type { Video } from '@/src/types';
import { useDownloadStore } from '@/src/store/download-store';
import {
  deleteVideo,
  getAllVideos,
  updateVideo,
} from './library-repository';

export async function syncDeviceLibrary(
  db: SQLiteDatabase
): Promise<Video[]> {
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      return getAllVideos(db);
    }
  } catch {
    return getAllVideos(db);
  }

  const videos = await getAllVideos(db);
  const validVideos: Video[] = [];

  for (const video of videos) {
    if (!video.assetId) {
      if (video.localUri) validVideos.push(video);
      continue;
    }

    try {
      const asset = await MediaLibrary.getAssetInfoAsync(video.assetId);
      if (!asset) {
        await deleteVideo(db, video.id);
        if (video.downloadId) {
          await deleteDownload(db, video.downloadId);
          useDownloadStore.getState().removeDownload(video.downloadId);
        }
        continue;
      }

      let current = video;
      if (asset.uri && asset.uri !== video.localUri) {
        const updated = await updateVideo(db, video.id, { localUri: asset.uri });
        if (updated) current = updated;
        if (video.downloadId) {
          const download = await getDownloadById(db, video.downloadId);
          if (download?.localUri !== asset.uri) {
            const updatedDownload = await updateDownload(db, video.downloadId, {
              localUri: asset.uri,
            });
            if (updatedDownload) {
              useDownloadStore.getState().updateDownload(updatedDownload);
            }
          }
        }
      }
      validVideos.push(current);
    } catch {
      await deleteVideo(db, video.id);
      if (video.downloadId) {
        await deleteDownload(db, video.downloadId);
        useDownloadStore.getState().removeDownload(video.downloadId);
      }
    }
  }

  return validVideos;
}
