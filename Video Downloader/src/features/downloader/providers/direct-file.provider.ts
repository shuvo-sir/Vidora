import { fetch } from 'expo/fetch';

import type {
  AnalysisResult,
  VideoSourceProvider,
} from '../downloader-types';
import {
  hasKnownVideoExtension,
  isVideoMimeType,
  isAudioMimeType,
  filenameFromUrl,
  filenameToTitle,
  parseContentDisposition,
  parseContentLength,
  parseContentRangeTotal,
  parseContentType,
} from '../metadata-parser';
import { sanitizeFilename } from '@/src/utils/sanitize-filename';

function rangeSupport(
  responseStatus: number,
  acceptRanges: string | null
): boolean | null {
  if (responseStatus === 206) return true;
  if (acceptRanges?.toLowerCase() === 'bytes') return true;
  if (acceptRanges?.toLowerCase() === 'none') return false;
  return null;
}

function failedStatus(status: number): AnalysisResult {
  if (status === 401 || status === 403) {
    return {
      status: 'failed',
      requiresRightsConfirmation: true,
      errorCode: 'access_denied',
      message: 'The server denied access to this video URL.',
    };
  }
  if (status === 404) {
    return {
      status: 'failed',
      requiresRightsConfirmation: true,
      errorCode: 'not_found',
      message: 'The video file could not be found.',
    };
  }
  if (status >= 300 && status < 400) {
    return {
      status: 'failed',
      requiresRightsConfirmation: true,
      errorCode: 'redirect',
      message: 'This link redirects to another address. Please use a direct video URL.',
    };
  }
  return {
    status: 'failed',
    requiresRightsConfirmation: true,
    errorCode: 'http_status',
    message: `The server returned HTTP ${status}.`,
  };
}

export const DirectFileProvider: VideoSourceProvider = {
  providerId: 'direct-file',
  displayName: 'Direct File Provider',
  canHandle: (url: URL) =>
    url.protocol === 'https:' &&
    Boolean(url.hostname),
  async analyze(url: URL, signal: AbortSignal): Promise<AnalysisResult> {
    const analyzeResponse = async (
      method: 'HEAD' | 'GET',
      headers?: Record<string, string>
    ) => fetch(url, {
      method,
      headers,
      redirect: 'manual',
      signal,
    });

    let response;
    try {
      response = await analyzeResponse('HEAD');
    } catch (error) {
      if (signal.aborted) throw error;
      throw error;
    }

    if (response.status === 405 || response.status === 501) {
      response.abort();
      try {
        response = await analyzeResponse('GET', { Range: 'bytes=0-0' });
      } catch (error) {
        if (signal.aborted) throw error;
        throw error;
      }
    }

    if (
      (response.status >= 300 && response.status < 400) ||
      response.redirected
    ) {
      response.abort();
      return failedStatus(response.status || 302);
    }

    if (response.status < 200 || response.status >= 300) {
      const failed = failedStatus(response.status);
      response.abort();
      return failed;
    }

    const contentTypeHeader = response.headers.get('content-type');
    const contentType = parseContentType(contentTypeHeader);
    const contentDisposition = response.headers.get('content-disposition');
    const dispositionName = parseContentDisposition(contentDisposition);

    if (contentType === 'text/html') {
      response.abort();
      return {
        status: 'failed',
        requiresRightsConfirmation: true,
        errorCode: 'not_video',
        message: 'The URL does not appear to point directly to a video file.',
      };
    }

    const urlName = filenameFromUrl(url);
    const urlNameSanitized = urlName ? sanitizeFilename(urlName) : null;
    const mimeFallbackName = mimeFallbackNameForContent(contentType);
    let fileName =
      dispositionName ??
      (urlNameSanitized && hasKnownVideoExtension(urlNameSanitized)
        ? urlNameSanitized
        : mimeFallbackName);

    if (!fileName) {
      response.abort();
      return {
        status: 'failed',
        requiresRightsConfirmation: true,
        errorCode: 'not_video',
        message: 'The URL does not appear to point directly to a video file.',
      };
    }

    fileName = sanitizeFilename(fileName);

    if (isVideoMimeType(contentType)) {
      response.abort();
      const contentLength =
        parseContentLength(response.headers.get('content-length')) ??
        parseContentRangeTotal(response.headers.get('content-range'));
      return {
        status: 'supported',
        sourceUrl: url.toString(),
        sourceCategory: 'direct_video_file',
        confidence: 'verified_mime',
        metadata: {
          title: filenameToTitle(fileName),
          fileName,
          mimeType: contentType,
          fileSizeBytes: contentLength,
          mp4SizeBytes: isVideoMimeType(contentType) ? contentLength : null,
          mp3SizeBytes: isAudioMimeType(contentType) ? contentLength : null,
          sourceName: url.hostname,
          thumbnailUri: null,
          durationMs: null,
        },
        supportsRange: rangeSupport(
          response.status,
          response.headers.get('accept-ranges')
        ),
        requiresRightsConfirmation: true,
        message: 'Supported direct video file.',
      };
    }

    if (isAudioMimeType(contentType)) {
      response.abort();
      const contentLength =
        parseContentLength(response.headers.get('content-length')) ??
        parseContentRangeTotal(response.headers.get('content-range'));
      return {
        status: 'supported',
        sourceUrl: url.toString(),
        sourceCategory: 'direct_video_file',
        confidence: 'verified_mime',
        metadata: {
          title: filenameToTitle(fileName),
          fileName,
          mimeType: contentType,
          fileSizeBytes: contentLength,
          mp4SizeBytes: null,
          mp3SizeBytes: contentLength,
          sourceName: url.hostname,
          thumbnailUri: null,
          durationMs: null,
        },
        supportsRange: rangeSupport(
          response.status,
          response.headers.get('accept-ranges')
        ),
        requiresRightsConfirmation: true,
        message: 'Supported direct audio file.',
      };
    }

    if (
      contentType === 'application/octet-stream' &&
      (hasKnownVideoExtension(fileName) ||
        fileName.toLowerCase().endsWith('.mp3'))
    ) {
      response.abort();
      const contentLength =
        parseContentLength(response.headers.get('content-length')) ??
        parseContentRangeTotal(response.headers.get('content-range'));
      return {
        status: 'supported',
        sourceUrl: url.toString(),
        sourceCategory: 'direct_video_file',
        confidence: 'filename_fallback',
        metadata: {
          title: filenameToTitle(fileName),
          fileName,
          mimeType: contentType,
          fileSizeBytes: contentLength,
          mp4SizeBytes: hasKnownVideoExtension(fileName) ? contentLength : null,
          mp3SizeBytes: fileName.toLowerCase().endsWith('.mp3') ? contentLength : null,
          sourceName: url.hostname,
          thumbnailUri: null,
          durationMs: null,
        },
        supportsRange: rangeSupport(
          response.status,
          response.headers.get('accept-ranges')
        ),
        requiresRightsConfirmation: true,
        message: 'Video filename detected, but the media format was not verified.',
      };
    }

    response.abort();
    return {
      status: 'failed',
      requiresRightsConfirmation: true,
      errorCode: 'not_video',
      message: 'The URL does not appear to point directly to a video file.',
    };
  },
};

function mimeFallbackNameForContent(mimeType: string | null): string | null {
  if (mimeType === 'video/mp4') return 'video.mp4';
  if (mimeType === 'video/x-m4v') return 'video.m4v';
  if (mimeType === 'video/quicktime') return 'video.mov';
  if (mimeType === 'video/webm') return 'video.webm';
  if (mimeType === 'video/x-matroska') return 'video.mkv';
  return null;
}
