import {
  DownloadTask as ExpoDownloadTask,
  File,
  type DownloadPauseState,
  type DownloadProgress,
} from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';
import * as MediaLibrary from 'expo-media-library/legacy';

import type {
  AnalysisResult,
  DownloadFormat,
} from '@/src/features/downloader/downloader-types';
import { analyzeVideoUrl } from '@/src/features/downloader/analysis-service';
import { validateVideoUrl } from '@/src/features/downloader/url-validator';
import {
  createDownload,
  getAllDownloads,
  getDownloadById,
  updateDownload,
} from './download-repository';
import { deleteVideo, getAllVideos } from '@/src/features/library/library-repository';
import {
  createFinalFile,
  createTemporaryFile,
  deleteOwnFile,
  deleteTemporaryFilesForDownload,
  getFileSize,
  isEnoughDiskSpace,
  isLocalFileValid,
  initializeDownloadDirectories,
} from './file-storage';
import type { DownloadOperationResult } from './download-types';
import { createId } from '@/src/utils/create-id';
import { useDownloadStore } from '@/src/store/download-store';
import type { Download } from '@/src/types';
import { downloadViaBackend } from '@/src/features/downloader/backend-service';
import { notifyDownloadCompleted } from '@/src/features/settings/download-notifications';
import { useSettingsStore } from '@/src/store/settings-store';
import { useNetworkStore } from '@/src/store/network-store';
import { useLibraryStore } from '@/src/store/library-store';

type TaskRuntime = {
  task: ExpoDownloadTask;
  downloadId: string;
  tempFile: File;
  durationMs: number | null;
  expectedSizeBytes: number | null;
  lastPersistedBytes: number;
  lastPersistedAt: number;
  lastProgressAt: number;
  lastProgressBytes: number;
  cancelRequested: boolean;
  completion: Promise<void> | null;
};

type SocialDownloadPayload = {
  provider: 'ytdlp';
  formatId: string;
  formatType: 'mp4' | 'mp3';
};

function normalizeSourceUrl(value: string): string {
  const url = validateVideoUrl(value);
  return url.valid ? url.normalizedUrl : value.trim();
}

function parseSocialPayload(
  resumeData: string | null
): SocialDownloadPayload | null {
  if (!resumeData) return null;
  try {
    const parsed = JSON.parse(resumeData) as Partial<SocialDownloadPayload>;
    if (
      parsed.provider === 'ytdlp' &&
      typeof parsed.formatId === 'string'
    ) {
      return {
        provider: 'ytdlp',
        formatId: parsed.formatId,
        formatType: parsed.formatType === 'mp3' ? 'mp3' : 'mp4',
      };
    }
  } catch {
    return null;
  }
  return null;
}

export class DownloadManager {
  private activeTask: TaskRuntime | null = null;
  private tasks = new Map<string, TaskRuntime>();
  private initialized = false;
  private initializing = false;
  private queueSuspended = false;
  private startingTask = false;
  private db: SQLiteDatabase;
  private unsubscribeSettings: (() => void) | null = null;
  private unsubscribeNetwork: (() => void) | null = null;

  constructor(db: SQLiteDatabase) {
    this.db = db;
  }

  async initialize(): Promise<void> {
    if (this.initialized || this.initializing) return;
    this.initializing = true;
    const store = useDownloadStore.getState();
    store.setLoading(true);
    store.setError(null);

    try {
      initializeDownloadDirectories();
      const downloads = await getAllDownloads(this.db);
      store.setDownloads(downloads);

      for (const download of downloads) {
        if (download.status === 'downloading') {
          if (parseSocialPayload(download.resumeData)) {
            await updateDownload(this.db, download.id, {
              status: 'paused',
              errorMessage: null,
            });
            continue;
          }
          let restorable = false;
          if (download.resumeData) {
            try {
              const parsed = JSON.parse(download.resumeData) as DownloadPauseState;
              const tempFile = new File(parsed.fileUri);
              restorable =
                Boolean(parsed.resumeData) &&
                tempFile.exists &&
                getFileSize(tempFile) > 0;
            } catch {
              restorable = false;
            }
          }

          if (restorable) {
            await updateDownload(this.db, download.id, {
              status: 'paused',
              errorMessage: null,
            });
          } else {
            await updateDownload(this.db, download.id, {
              status: 'failed',
              errorMessage:
                'This download was interrupted and could not be resumed safely.',
            });
          }
        }
      }

      const reconciled = await getAllDownloads(this.db);
      store.setDownloads(reconciled);
      store.setInitialized(true);
      this.unsubscribeSettings = useSettingsStore.subscribe((state, previous) => {
        if (state.wifiOnly !== previous.wifiOnly) {
          void this.handleNetworkPolicyChange().catch((caught: unknown) => {
            console.error('Unable to apply download network settings:', caught);
          });
        }
      });
      this.unsubscribeNetwork = useNetworkStore.subscribe((state, previous) => {
        if (
          state.type !== previous.type ||
          state.isConnected !== previous.isConnected ||
          state.isInternetReachable !== previous.isInternetReachable
        ) {
          void this.handleNetworkPolicyChange().catch((caught: unknown) => {
            console.error('Unable to apply download network settings:', caught);
          });
        }
      });
      await this.processQueue();
    } catch (caught) {
      store.setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to initialize downloads.'
      );
    } finally {
      store.setLoading(false);
      this.initialized = true;
      this.initializing = false;
    }
  }

  async refreshHistory(): Promise<void> {
    const downloads = await getAllDownloads(this.db);
    useDownloadStore.getState().setDownloads(downloads);
  }

  async clearAll(): Promise<void> {
    this.queueSuspended = true;
    try {
      const activeRuntimes = [...this.tasks.values()];
      for (const runtime of activeRuntimes) {
        runtime.cancelRequested = true;
        runtime.task.cancel();
      }
      await Promise.all(
        activeRuntimes.flatMap((runtime) =>
          runtime.completion ? [runtime.completion] : []
        )
      );
      for (const runtime of activeRuntimes) {
        runtime.task.release();
        deleteTemporaryFilesForDownload(runtime.downloadId);
      }
      this.tasks.clear();
      this.activeTask = null;

      const downloads = await getAllDownloads(this.db);
      const videos = await getAllVideos(this.db);
      await this.db.runAsync(
        `UPDATE downloads SET status = 'cancelled', resume_data = NULL,
         error_message = NULL, updated_at = ? WHERE status != 'completed'`,
        [Date.now()]
      );
      useDownloadStore.getState().setDownloads(await getAllDownloads(this.db));

      const assetIds = new Set<string>();

      for (const download of downloads) {
        if (download.assetId) assetIds.add(download.assetId);
      }
      for (const video of videos) {
        if (video.assetId) assetIds.add(video.assetId);
      }

      if (assetIds.size > 0) {
        const permission = await MediaLibrary.requestPermissionsAsync();
        if (permission.status !== 'granted') {
          throw new Error('Media library permission is required to remove downloaded media.');
        }
        const assetsDeleted = await MediaLibrary.deleteAssetsAsync([...assetIds]);
        if (!assetsDeleted) {
          throw new Error('The system cancelled deletion of downloaded media.');
        }
      }

      for (const download of downloads) {
        deleteTemporaryFilesForDownload(download.id);
      }

      for (const download of downloads) {
        if (!download.assetId && download.localUri) {
          deleteOwnFile(new File(download.localUri));
        }
      }
      for (const video of videos) {
        if (!video.assetId && video.localUri) {
          deleteOwnFile(new File(video.localUri));
        }
      }

      await this.db.withExclusiveTransactionAsync(async (transaction) => {
        await transaction.runAsync('DELETE FROM videos');
        await transaction.runAsync('DELETE FROM downloads');
      });
      useDownloadStore.getState().setDownloads([]);
      useDownloadStore.getState().setActiveDownload(null);
      useLibraryStore.getState().setVideos([]);
    } finally {
      this.queueSuspended = false;
      await this.processQueue();
    }
  }

  async startDownload(
    analysis: AnalysisResult,
    sourceUrlOverride?: string,
    selectedFormat: DownloadFormat = 'original'
  ): Promise<DownloadOperationResult> {
    if (analysis.status !== 'supported' || !analysis.metadata) {
      return {
        ok: false,
        downloadId: '',
        code: 'unsupported',
        message: 'Only a successfully analyzed direct video file can be downloaded.',
      };
    }

    if (
      (analysis.sourceCategory === 'youtube' ||
        analysis.sourceCategory === 'facebook') &&
      analysis.socialFormats
    ) {
      return this.startSocialDownload(
        analysis,
        sourceUrlOverride ?? analysis.sourceUrl,
        'best',
        selectedFormat === 'mp3' ? 'mp3' : 'mp4'
      );
    }

    const sourceUrl =
      analysis.sourceUrl ??
      sourceUrlOverride ??
      '';
    if (!sourceUrl) {
      return {
        ok: false,
        downloadId: '',
        code: 'missing_url',
        message: 'The analyzed source URL is unavailable.',
      };
    }

    const downloadId = createId('download');
    const normalizedUrl = normalizeSourceUrl(sourceUrl);

    const revalidated = await analyzeVideoUrl(normalizedUrl, new AbortController().signal);
    if (revalidated.status !== 'supported' || !revalidated.metadata) {
      return {
        ok: false,
        downloadId: '',
        code: revalidated.errorCode ?? 'revalidation_failed',
        message: revalidated.message,
      };
    }

    const duplicate = (await getAllDownloads(this.db)).find(
      (item) =>
        item.status !== 'completed' &&
        item.status !== 'cancelled' &&
        normalizeSourceUrl(item.sourceUrl) === normalizedUrl
    );
    if (duplicate) {
      return {
        ok: false,
        downloadId: duplicate.id,
        code: 'duplicate',
        message: 'This URL already has an active or queued download.',
      };
    }

    return this.startFromMetadata(
      downloadId,
      normalizedUrl,
      analysis,
      selectedFormat
    );
  }

  async startSocialDownload(
    analysis: AnalysisResult,
    sourceUrlOverride: string | undefined,
    formatId: string,
    formatType: 'mp4' | 'mp3' = 'mp4'
  ): Promise<DownloadOperationResult> {
    if (
      analysis.status !== 'supported' ||
      !analysis.metadata ||
      !analysis.socialFormats
    ) {
      return {
        ok: false,
        downloadId: '',
        code: 'unsupported',
        message: 'No supported social-media formats are available.',
      };
    }

    const sourceUrl = analysis.sourceUrl ?? sourceUrlOverride ?? '';
    if (!sourceUrl) {
      return {
        ok: false,
        downloadId: '',
        code: 'missing_url',
        message: 'The analyzed source URL is unavailable.',
      };
    }
    const normalizedUrl = normalizeSourceUrl(sourceUrl);
    const duplicate = (await getAllDownloads(this.db)).find(
      (item) =>
        item.status !== 'completed' &&
        item.status !== 'cancelled' &&
        normalizeSourceUrl(item.sourceUrl) === normalizedUrl
    );
    if (duplicate) {
      return {
        ok: false,
        downloadId: duplicate.id,
        code: 'duplicate',
        message: 'This URL already has an active or queued download.',
      };
    }

    const selectedFormat =
      analysis.socialFormats.find((format) => format.id === formatId) ??
      analysis.socialFormats.find((format) =>
        format.id === 'best'
      ) ??
      analysis.socialFormats[0];
    const selectedFormatId =
      selectedFormat?.id &&
      !selectedFormat.id.includes('+') &&
      !selectedFormat.id.toLowerCase().includes('merge') &&
      !selectedFormat.id.toLowerCase().includes('bestvideo') &&
      !selectedFormat.id.toLowerCase().includes('bestaudio')
        ? selectedFormat.id
        : 'best[height<=360]';
    const extension = formatType === 'mp3'
      ? 'mp3'
      : (selectedFormat?.ext?.toLowerCase() ?? 'mp4');
    const safeTitle = analysis.metadata.title || 'Untitled video';
    const downloadId = createId('download');

    return this.createAndQueue({
      id: downloadId,
      title: safeTitle,
      sourceUrl: normalizedUrl,
      sourceName: analysis.metadata.sourceName,
      thumbnailUri: analysis.metadata.thumbnailUri,
      fileName: `${safeTitle}.${extension}`,
      mimeType: extension === 'mp3'
        ? 'audio/mpeg'
        : `video/${extension === 'm4v' ? 'x-m4v' : extension}`,
      totalBytes: selectedFormat?.sizeBytes ?? 0,
      downloadedBytes: 0,
      status: 'queued',
      errorMessage: null,
      localUri: null,
      isDemo: false,
      resumeData: JSON.stringify({
        provider: 'ytdlp',
        formatId: formatType === 'mp3' ? 'bestaudio/best' : selectedFormatId,
        formatType,
      } satisfies SocialDownloadPayload),
    });
  }

  async startSupportedUrl(
    sourceUrl: string,
    title: string,
    fileName: string,
    mimeType: string | null,
    totalBytes: number | null
  ): Promise<DownloadOperationResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    let revalidated: AnalysisResult;
    try {
      revalidated = await analyzeVideoUrl(sourceUrl, controller.signal);
    } finally {
      clearTimeout(timeout);
    }

    if (revalidated.status !== 'supported' || !revalidated.metadata) {
      return {
        ok: false,
        downloadId: '',
        code: revalidated.errorCode ?? 'revalidation_failed',
        message: revalidated.message,
      };
    }

    const normalizedUrl = normalizeSourceUrl(sourceUrl);
    const duplicate = (await getAllDownloads(this.db)).find(
      (item) =>
        item.status !== 'completed' &&
        item.status !== 'cancelled' &&
        normalizeSourceUrl(item.sourceUrl) === normalizedUrl
    );
    if (duplicate) {
      return {
        ok: false,
        downloadId: duplicate.id,
        code: 'duplicate',
        message: 'This URL already has an active or queued download.',
      };
    }

    const downloadId = createId('download');
    const metadata = revalidated.metadata;
    return this.createAndQueue({
      id: downloadId,
      title: title || metadata.title,
      sourceUrl: normalizedUrl,
      sourceName: metadata.sourceName,
      thumbnailUri: null,
      fileName: fileName || metadata.fileName,
      mimeType: mimeType ?? metadata.mimeType,
      totalBytes: totalBytes ?? metadata.fileSizeBytes ?? 0,
      downloadedBytes: 0,
      status: 'queued',
      errorMessage: null,
      localUri: null,
      isDemo: false,
    });
  }

  private async startFromMetadata(
    downloadId: string,
    sourceUrl: string,
    analysis: AnalysisResult,
    selectedFormat: DownloadFormat = 'original'
  ): Promise<DownloadOperationResult> {
    if (!sourceUrl) {
      return {
        ok: false,
        downloadId,
        code: 'missing_url',
        message: 'The analyzed source URL is unavailable.',
      };
    }
    const metadata = analysis.metadata!;
    const formatType: 'mp4' | 'mp3' =
      selectedFormat === 'mp3' ? 'mp3' : 'mp4';
    const baseFileName = metadata.fileName.replace(/\.[^.]+$/, '') || metadata.title;
    const fileName = `${baseFileName}.${formatType}`;
    const mimeType = formatType === 'mp3' ? 'audio/mpeg' : 'video/mp4';
    return this.createAndQueue({
      id: downloadId,
      title: metadata.title,
      sourceUrl,
      sourceName: metadata.sourceName,
      thumbnailUri: null,
      fileName,
      mimeType,
      totalBytes: metadata.fileSizeBytes ?? 0,
      downloadedBytes: 0,
      status: 'queued',
      errorMessage: null,
      localUri: null,
      isDemo: false,
      resumeData: JSON.stringify({
        provider: 'ytdlp',
        formatId: formatType === 'mp3' ? 'bestaudio/best' : 'best[ext=mp4]/best',
        formatType,
      } satisfies SocialDownloadPayload),
    });
  }

  private async createAndQueue(
    input: Parameters<typeof createDownload>[1]
  ): Promise<DownloadOperationResult> {
    try {
      if (!isEnoughDiskSpace(input.totalBytes ?? null)) {
        return {
          ok: false,
          downloadId: input.id ?? '',
          code: 'insufficient_storage',
          message: 'There may not be enough available storage to start this download.',
        };
      }
      const download = await createDownload(this.db, input);
      useDownloadStore.getState().addDownload(download);
      await this.processQueue();
      return { ok: true, downloadId: download.id };
    } catch (caught) {
      return {
        ok: false,
        downloadId: input.id ?? '',
        code: 'database_error',
        message:
          caught instanceof Error
            ? caught.message
            : 'The download record could not be created.',
      };
    }
  }

  async pause(downloadId: string): Promise<DownloadOperationResult> {
    const runtime = this.tasks.get(downloadId);
    if (!runtime) {
      return { ok: false, downloadId, code: 'not_active', message: 'This download is not active.' };
    }
    try {
      await runtime.task.pauseAsync();
      const savable = runtime.task.savable();
      await updateDownload(this.db, downloadId, {
        status: 'paused',
        resumeData: JSON.stringify(savable),
        errorMessage: null,
      });
      const download = await getDownloadById(this.db, downloadId);
      if (download) useDownloadStore.getState().updateDownload(download);
      this.tasks.delete(downloadId);
      this.activeTask = null;
      runtime.task.release();
      await this.processQueue();
      return { ok: true, downloadId };
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : 'The download could not be paused.';
      await updateDownload(this.db, downloadId, {
        status: 'failed',
        errorMessage: 'Pause failed. Try restarting this download.',
        resumeData: null,
      });
      const download = await getDownloadById(this.db, downloadId);
      if (download) useDownloadStore.getState().updateDownload(download);
      return { ok: false, downloadId, code: 'pause_failed', message };
    }
  }

  async resume(downloadId: string): Promise<DownloadOperationResult> {
    const download = await getDownloadById(this.db, downloadId);
    if (download && parseSocialPayload(download.resumeData)) {
      await updateDownload(this.db, downloadId, {
        status: 'queued',
        downloadedBytes: 0,
        errorMessage: null,
        completedAt: null,
      });
      const updated = await getDownloadById(this.db, downloadId);
      if (updated) useDownloadStore.getState().updateDownload(updated);
      await this.processQueue();
      return { ok: true, downloadId };
    }
    if (!download || download.status !== 'paused') {
      return { ok: false, downloadId, code: 'not_paused', message: 'This download is not paused.' };
    }
    if (!download.resumeData) return this.restart(downloadId);
    if (!this.parsePauseState(download)) {
      await updateDownload(this.db, downloadId, {
        status: 'failed',
        resumeData: null,
        errorMessage: 'The saved resume state is no longer valid.',
      });
      const updated = await getDownloadById(this.db, downloadId);
      if (updated) useDownloadStore.getState().updateDownload(updated);
      return {
        ok: false,
        downloadId,
        code: 'resume_invalid',
        message: 'Resume data expired. Restart the download from the beginning.',
      };
    }
    await updateDownload(this.db, downloadId, {
      status: 'queued',
      errorMessage: null,
    });
    const updated = await getDownloadById(this.db, downloadId);
    if (updated) useDownloadStore.getState().updateDownload(updated);
    await this.processQueue();
    return { ok: true, downloadId };
  }

  async cancel(downloadId: string): Promise<DownloadOperationResult> {
    const runtime = this.tasks.get(downloadId);
    if (runtime) {
      runtime.cancelRequested = true;
      runtime.task.cancel();
    }

    await updateDownload(this.db, downloadId, {
      status: 'cancelled',
      resumeData: null,
      errorMessage: null,
    });
    deleteTemporaryFilesForDownload(downloadId);
    const download = await getDownloadById(this.db, downloadId);
    if (download) useDownloadStore.getState().updateDownload(download);
    if (runtime) {
      runtime.task.release();
      this.tasks.delete(downloadId);
      if (this.activeTask === runtime) this.activeTask = null;
    }
    await this.processQueue();
    return { ok: true, downloadId };
  }

  async remove(downloadId: string): Promise<DownloadOperationResult> {
    const download = await getDownloadById(this.db, downloadId);
    await this.cancel(downloadId);
    if (download?.status === 'completed') {
      if (download.assetId) {
        try {
          const permission = await MediaLibrary.requestPermissionsAsync();
          if (permission.status === 'granted') {
            await MediaLibrary.deleteAssetsAsync([download.assetId]);
          }
        } catch (error) {
          console.warn('Failed to delete the public media asset:', error);
        }
      } else if (download.localUri) {
        try {
          deleteOwnFile(new File(download.localUri));
        } catch (error) {
          console.warn('Failed to delete the private media file:', error);
        }
      }
      await deleteVideo(this.db, downloadId);
      useLibraryStore.getState().removeVideo(downloadId);
    }
    const result = await import('./download-repository');
    await result.deleteDownload(this.db, downloadId);
    useDownloadStore.getState().removeDownload(downloadId);
    return { ok: true, downloadId };
  }

  async retry(downloadId: string): Promise<DownloadOperationResult> {
    const download = await getDownloadById(this.db, downloadId);
    if (!download) {
      return { ok: false, downloadId, code: 'missing', message: 'Download record not found.' };
    }
    if (this.tasks.has(downloadId)) {
      return { ok: false, downloadId, code: 'active', message: 'This download is still active.' };
    }

    const socialPayload = parseSocialPayload(download.resumeData);
    deleteTemporaryFilesForDownload(downloadId);
    await updateDownload(this.db, downloadId, {
      status: 'queued',
      downloadedBytes: 0,
      resumeData: socialPayload
        ? JSON.stringify(socialPayload)
        : null,
      errorMessage: null,
      completedAt: null,
    });
    const updated = await getDownloadById(this.db, downloadId);
    if (updated) useDownloadStore.getState().updateDownload(updated);
    await this.processQueue();
    return { ok: true, downloadId };
  }

  async restart(downloadId: string): Promise<DownloadOperationResult> {
    return this.retry(downloadId);
  }

  private async processQueue(): Promise<void> {
    if (this.queueSuspended || this.activeTask || this.startingTask) return;
    const downloads = useDownloadStore.getState().downloads;
    const next = downloads
      .filter((item) => item.status === 'queued')
      .sort((a, b) => a.createdAt - b.createdAt)[0];
    if (!next) {
      useDownloadStore.getState().setActiveDownload(null);
      return;
    }
    const wifiOnly = useSettingsStore.getState().wifiOnly;
    if (!this.isNetworkAllowed(wifiOnly)) {
      for (const queued of downloads.filter((item) => item.status === 'queued')) {
        useDownloadStore.getState().setStatusMessage(
          queued.id,
          this.getNetworkWaitMessage(wifiOnly)
        );
      }
      return;
    }
    for (const queued of downloads.filter((item) => item.status === 'queued')) {
      useDownloadStore.getState().clearStatusMessage(queued.id);
    }
    this.startingTask = true;
    try {
      await this.startTask(next, this.parsePauseState(next) ?? undefined);
    } finally {
      this.startingTask = false;
      if (!this.queueSuspended && !this.activeTask) {
        void this.processQueue().catch((caught: unknown) => {
          console.error('Unable to continue the download queue:', caught);
        });
      }
    }
  }

  private parsePauseState(download: Download): DownloadPauseState | null {
    if (!download.resumeData || parseSocialPayload(download.resumeData)) return null;
    try {
      const parsed = JSON.parse(download.resumeData) as Partial<DownloadPauseState>;
      if (typeof parsed.fileUri !== 'string' || typeof parsed.resumeData !== 'string') {
        return null;
      }
      return new File(parsed.fileUri).exists
        ? (parsed as DownloadPauseState)
        : null;
    } catch {
      return null;
    }
  }

  private async handleNetworkPolicyChange(): Promise<void> {
    const wifiOnly = useSettingsStore.getState().wifiOnly;
    if (!this.isNetworkAllowed(wifiOnly)) {
      if (this.activeTask) {
        const downloadId = this.activeTask.downloadId;
        const paused = await this.pause(downloadId);
        if (paused.ok) {
          await updateDownload(this.db, downloadId, { status: 'queued' });
          const queued = await getDownloadById(this.db, downloadId);
          if (queued) {
            useDownloadStore.getState().updateDownload(queued);
            useDownloadStore.getState().setStatusMessage(
              queued.id,
              this.getNetworkWaitMessage(wifiOnly)
            );
          }
        }
      }
      await this.processQueue();
      return;
    }
    await this.processQueue();
  }

  private isNetworkAllowed(wifiOnly: boolean): boolean {
    const network = useNetworkStore.getState();
    if (
      !network.isConnected ||
      network.type === 'NONE' ||
      network.isInternetReachable === false
    ) {
      return false;
    }
    return !wifiOnly || network.type === 'WIFI';
  }

  private getNetworkWaitMessage(wifiOnly: boolean): string {
    return wifiOnly
      ? 'Waiting for Wi-Fi. Connect to Wi-Fi or turn off Wi-Fi-only downloads.'
      : 'Waiting for an internet connection.';
  }

  private async startTask(
    download: Download,
    pauseState?: DownloadPauseState
  ): Promise<void> {
    if (this.activeTask) return;
    initializeDownloadDirectories();
    const wifiOnly = useSettingsStore.getState().wifiOnly;
    if (!this.isNetworkAllowed(wifiOnly)) {
      useDownloadStore.getState().setStatusMessage(
        download.id,
        this.getNetworkWaitMessage(wifiOnly)
      );
      return;
    }

    let tempFile: File;
    let task: ExpoDownloadTask;
    let durationMs: number | null = null;
    let expectedSizeBytes: number | null = null;

    if (pauseState) {
      tempFile = new File(pauseState.fileUri);
      task = ExpoDownloadTask.fromSavable(pauseState, {});
    } else {
      try {
        const payload = parseSocialPayload(download.resumeData);
        const backendResult = await downloadViaBackend(
          download.sourceUrl,
          payload?.formatType ?? 'mp4',
          () => {
            useDownloadStore.getState().setStatusMessage(
              download.id,
              'Waking up server, please wait...'
            );
          }
        );
        useDownloadStore.getState().clearStatusMessage(download.id);
        const { downloadUrl } = backendResult;
        durationMs = backendResult.durationMs;
        expectedSizeBytes = backendResult.fileSizeBytes;
        tempFile = createTemporaryFile(download.id, download.fileName);
        task = File.createDownloadTask(
          downloadUrl,
          tempFile,
          {}
        );
      } catch (caught) {
        useDownloadStore.getState().clearStatusMessage(download.id);
        await this.failDownloadWithoutRuntime(
          download.id,
          caught instanceof Error
            ? caught.message
            : 'Backend failed to process video'
        );
        return;
      }
    }

    const currentWifiOnly = useSettingsStore.getState().wifiOnly;
    if (!this.isNetworkAllowed(currentWifiOnly)) {
      task.release();
      if (!pauseState) deleteOwnFile(tempFile);
      useDownloadStore.getState().setStatusMessage(
        download.id,
        this.getNetworkWaitMessage(currentWifiOnly)
      );
      return;
    }

    await updateDownload(this.db, download.id, {
      status: 'downloading',
      errorMessage: null,
    });
    const updated = await getDownloadById(this.db, download.id);
    if (updated) useDownloadStore.getState().updateDownload(updated);
    const latestWifiOnly = useSettingsStore.getState().wifiOnly;
    if (!this.isNetworkAllowed(latestWifiOnly)) {
      await updateDownload(this.db, download.id, { status: 'queued' });
      const queued = await getDownloadById(this.db, download.id);
      if (queued) useDownloadStore.getState().updateDownload(queued);
      useDownloadStore.getState().setStatusMessage(
        download.id,
        this.getNetworkWaitMessage(latestWifiOnly)
      );
      task.release();
      if (!pauseState) deleteOwnFile(tempFile);
      return;
    }
    useDownloadStore.getState().setActiveDownload(download.id);

    let lastBytes = download.downloadedBytes;
    const now = Date.now();
    const runtime: TaskRuntime = {
      task,
      downloadId: download.id,
      tempFile,
      durationMs,
      expectedSizeBytes,
      lastPersistedBytes: lastBytes,
      lastPersistedAt: now,
      lastProgressAt: now,
      lastProgressBytes: lastBytes,
      cancelRequested: false,
      completion: null,
    };
    this.tasks.set(download.id, runtime);
    this.activeTask = runtime;

    task.addListener('progress', (progress: DownloadProgress) => {
      void this.handleProgress(runtime, progress);
    });

    const operation = pauseState ? task.resumeAsync() : task.downloadAsync();
    runtime.completion = operation
      .then(async (completedFile: File | null) => {
        if (runtime.cancelRequested) return;
        if (!completedFile) {
          await this.processPausedRuntime(runtime);
          return;
        }
        await this.completeDownload(runtime, completedFile);
      })
      .catch(async () => {
        if (runtime.cancelRequested) return;
        await this.failDownload(runtime, 'The download failed or the server connection ended.');
      });
  }

  private async handleProgress(
    runtime: TaskRuntime,
    progress: DownloadProgress
  ): Promise<void> {
    const bytesWritten = Number.isFinite(progress.bytesWritten)
      ? Math.max(0, progress.bytesWritten)
      : 0;
    const total =
      Number.isFinite(progress.totalBytes) && progress.totalBytes >= 0
        ? progress.totalBytes
        : null;
    const now = Date.now();
    const elapsed = Math.max(1, now - runtime.lastProgressAt);
    const bytesDelta = bytesWritten - runtime.lastProgressBytes;
    const bytesPerSecond =
      bytesDelta >= 0 ? Math.round((bytesDelta * 1000) / elapsed) : null;
    const progressPercent =
      total && total > 0
        ? Math.min(100, Math.round((bytesWritten / total) * 100))
        : null;

    useDownloadStore.getState().setProgress({
      downloadId: runtime.downloadId,
      bytesWritten,
      totalBytes: total,
      progressPercent,
      bytesPerSecond,
      updatedAt: now,
    });

    runtime.lastProgressAt = now;
    runtime.lastProgressBytes = bytesWritten;

    const shouldPersist =
      now - runtime.lastPersistedAt >= 1000 &&
      bytesWritten - runtime.lastPersistedBytes >= 64 * 1024;
    if (shouldPersist) {
      runtime.lastPersistedAt = now;
      runtime.lastPersistedBytes = bytesWritten;
      await updateDownload(this.db, runtime.downloadId, {
        downloadedBytes: bytesWritten,
        totalBytes: total ?? undefined,
        status: 'downloading',
        resumeData: null,
      });
    }
  }

  private async processPausedRuntime(runtime: TaskRuntime): Promise<void> {
    try {
      const savable = runtime.task.savable();
      await updateDownload(this.db, runtime.downloadId, {
        status: 'paused',
        resumeData: JSON.stringify(savable),
      });
    } catch {
      await updateDownload(this.db, runtime.downloadId, {
        status: 'failed',
        resumeData: null,
        errorMessage: 'Pause resume data is unavailable. Restart the download.',
      });
    }
    const download = await getDownloadById(this.db, runtime.downloadId);
    if (download) useDownloadStore.getState().updateDownload(download);
    runtime.task.release();
    this.tasks.delete(runtime.downloadId);
    this.activeTask = null;
  }

  private async failDownloadWithoutRuntime(
    downloadId: string,
    message: string
  ): Promise<void> {
    await updateDownload(this.db, downloadId, {
      status: 'failed',
      resumeData: null,
      errorMessage: message,
    });
    const download = await getDownloadById(this.db, downloadId);
    if (download) useDownloadStore.getState().updateDownload(download);
    useDownloadStore.getState().setActiveDownload(null);
    await this.processQueue();
  }

  private async failDownload(runtime: TaskRuntime, message: string): Promise<void> {
    await updateDownload(this.db, runtime.downloadId, {
      status: 'failed',
      resumeData: null,
      errorMessage: message,
    });
    const download = await getDownloadById(this.db, runtime.downloadId);
    if (download) useDownloadStore.getState().updateDownload(download);
    runtime.task.release();
    this.tasks.delete(runtime.downloadId);
    this.activeTask = null;
    await this.processQueue();
  }

  private async completeDownload(
    runtime: TaskRuntime,
    tempFile: File
  ): Promise<void> {
    if (runtime.cancelRequested) return;
    if (!isLocalFileValid(tempFile)) {
      await this.failDownload(runtime, 'The downloaded file is missing or empty.');
      return;
    }

    const download = await getDownloadById(this.db, runtime.downloadId);
    if (!download) {
      await this.failDownload(runtime, 'The download record could not be found.');
      return;
    }
    const actualSize = getFileSize(tempFile);
    if (download.totalBytes > 0 && actualSize !== download.totalBytes) {
      await this.failDownload(
        runtime,
        'The downloaded file size does not match the source size.'
      );
      return;
    }

    const finalFile = createFinalFile(download.id, download.fileName);
    try {
      await tempFile.move(finalFile);
    } catch {
      await this.failDownload(runtime, 'The completed file could not be moved safely.');
      return;
    }
    if (!isLocalFileValid(finalFile)) {
      await this.failDownload(runtime, 'The completed file could not be verified.');
      return;
    }

    const finalSize = getFileSize(finalFile);

    let durationMs = runtime.durationMs;
    let thumbnailUri: string | null = download.thumbnailUri;

    try {
      const { getThumbnailAsync } = await import('expo-video-thumbnails');
      const thumbnail = await getThumbnailAsync(finalFile.uri, { time: 1000 });
      thumbnailUri = thumbnail.uri;
    } catch (error) {
      console.warn('Failed to generate video thumbnail:', error);
    }

    if (durationMs === null) {
      try {
        const videoModule = await import('expo-video');
        const probePlayer = videoModule.createVideoPlayer(finalFile.uri);
        const durationSeconds = Number(probePlayer.duration);
        if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
          durationMs = Math.round(durationSeconds * 1000);
        }
        if (typeof probePlayer.release === 'function') {
          probePlayer.release();
        }
      } catch (error) {
        console.warn('Failed to read video duration:', error);
      }
    }

    let publicUri = finalFile.uri;
    let assetId: string | null = null;
    let mediaType: 'video' | 'audio' = download.mimeType?.startsWith('audio/')
      ? 'audio'
      : 'video';
    try {
      const { status, canAskAgain } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        throw new Error(
          canAskAgain
            ? 'Media Library permission was not granted.'
            : 'Media Library permission was denied. Enable it in system settings.'
        );
      }
      const asset = await MediaLibrary.createAssetAsync(finalFile.uri);
      assetId = asset.id;
      publicUri = asset.uri;
      if (asset.mediaType === 'audio') mediaType = 'audio';
      deleteOwnFile(finalFile);
    } catch (error) {
      console.error('Failed to save file to public media storage:', error);
    }

    const now = Date.now();
    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync(
        `UPDATE downloads SET status = 'completed', downloaded_bytes = ?, total_bytes = ?,
         local_uri = ?, resume_data = NULL, error_message = NULL,
         assetId = ?, mediaType = ?, updated_at = ?, completed_at = ? WHERE id = ?`,
        [finalSize, download.totalBytes > 0 ? download.totalBytes : finalSize, publicUri, assetId, mediaType, now, now, download.id]
      );
      await transaction.runAsync(
        `INSERT INTO videos (
          id, download_id, title, source_name, thumbnail_uri, file_name,
          local_uri, mime_type, file_size_bytes, duration_ms, saved_at, is_demo,
          assetId, mediaType
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          download_id = excluded.download_id,
          title = excluded.title,
          source_name = excluded.source_name,
          thumbnail_uri = excluded.thumbnail_uri,
          file_name = excluded.file_name,
          local_uri = excluded.local_uri,
          mime_type = excluded.mime_type,
          file_size_bytes = excluded.file_size_bytes,
          duration_ms = excluded.duration_ms,
          saved_at = excluded.saved_at,
          assetId = excluded.assetId,
          mediaType = excluded.mediaType`,
        [
          download.id,
          download.id,
          download.title,
          download.sourceName,
          thumbnailUri,
          download.fileName,
          publicUri,
          download.mimeType,
          finalSize,
          durationMs,
          now,
          assetId,
          mediaType,
        ]
      );
    });

    const completed = await getDownloadById(this.db, download.id);
    if (completed) useDownloadStore.getState().updateDownload(completed);
    useLibraryStore.getState().upsertVideo({
      id: download.id,
      downloadId: download.id,
      title: download.title,
      sourceName: download.sourceName,
      thumbnailUri,
      fileName: download.fileName,
      localUri: publicUri,
      mimeType: download.mimeType,
      fileSizeBytes: finalSize,
      durationMs,
      savedAt: now,
      isDemo: false,
      assetId,
      mediaType,
    });
    useDownloadStore.getState().clearProgress(download.id);
    runtime.task.release();
    this.tasks.delete(download.id);
    this.activeTask = null;
    try {
      if (useSettingsStore.getState().notifications) {
        await notifyDownloadCompleted(download.id, download.title);
      }
    } catch (caught) {
      console.error('Unable to show download completion notification:', caught);
    }
    await this.processQueue();
  }
}
