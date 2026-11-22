import { BACKEND_SERVER_URL } from '@/src/config';
import { fetchWithRetry } from '@/src/utils/fetch-with-retry';

export type BackendDownloadResponse = {
  download_url: string;
  filesize?: number | null;
  duration?: number | null;
};

export async function downloadViaBackend(
  url: string,
  formatType: 'mp4' | 'mp3',
  onRetry?: (retryNumber: number) => void
): Promise<{ downloadUrl: string; fileSizeBytes: number | null; durationMs: number | null }> {
  try {
    const response = await fetchWithRetry(`${BACKEND_SERVER_URL}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, format_type: formatType }),
      timeoutMs: 60_000,
      retries: 2,
      onRetry,
    });

    if (!response.ok) {
      let errorMessage = 'Backend failed to process video.';

      try {
        const errorData = await response.json() as
          | string
          | {
              detail?: string | {
                code?: string;
                message?: string;
              };
            };

        if (typeof errorData === 'string') {
          errorMessage = errorData;
        } else if (typeof errorData.detail === 'string') {
          errorMessage = errorData.detail;
        } else if (errorData.detail?.message) {
          if (response.status === 500) {
            errorMessage = errorData.detail.message;
          } else if (
            response.status === 502 &&
            errorData.detail.code === 'download_failed'
          ) {
            errorMessage =
              'YouTube blocked the download. Try another video or update yt-dlp.';
          } else {
            errorMessage = errorData.detail.message;
          }
        } else if (response.status === 502) {
          errorMessage =
            'YouTube blocked the download. Try another video or update yt-dlp.';
        }
      } catch {
        if (response.status === 502) {
          errorMessage =
            'YouTube blocked the download. Try another video or update yt-dlp.';
        } else if (response.status === 504) {
          errorMessage = 'The backend download timed out. Try again.';
        } else if (response.status === 429) {
          errorMessage = 'Too many download requests. Try again later.';
        } else {
          errorMessage = `Backend failed with HTTP ${response.status}.`;
        }
      }

      throw new Error(errorMessage);
    }

    const body = await response.json() as Partial<BackendDownloadResponse>;
    const downloadUrl = body.download_url?.trim();
    if (!downloadUrl) {
      throw new Error('The backend response did not include a download URL.');
    }

    const resolvedUrl = new URL(downloadUrl, `${BACKEND_SERVER_URL}/`).toString();
    const rawFileSize = body.filesize;
    const rawDuration = body.duration;
    return {
      downloadUrl: resolvedUrl,
      fileSizeBytes:
        typeof rawFileSize === 'number' && Number.isFinite(rawFileSize)
          ? Math.max(0, Math.round(rawFileSize))
          : null,
      durationMs:
        typeof rawDuration === 'number' && Number.isFinite(rawDuration)
          ? Math.max(0, Math.round(rawDuration * 1000))
          : null,
    };
  } catch (caught) {
    if (caught instanceof Error && caught.name === 'AbortError') {
      throw new Error(
        'The backend server took too long to respond. Please try again.'
      );
    }
    if (caught instanceof TypeError) {
      throw new Error(
        'Cannot reach the backend server. Check your connection and try again.'
      );
    }
    throw caught;
  }
}
