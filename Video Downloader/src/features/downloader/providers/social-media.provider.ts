import type {
  AnalysisResult,
  VideoSourceProvider,
} from '../downloader-types';
import { classifySourceUrl } from '../source-classifier';
import { analyzeViaBackend } from '../backend-service';

export const SocialMediaProvider: VideoSourceProvider = {
  providerId: 'social-media',
  displayName: 'YouTube and Facebook Provider',
  canHandle: (url: URL) => {
    const category = classifySourceUrl(url);
    return category === 'youtube' || category === 'facebook';
  },
  async analyze(url: URL, signal: AbortSignal): Promise<AnalysisResult> {
    if (signal.aborted) {
      return {
        status: 'failed',
        sourceUrl: url.toString(),
        sourceCategory: classifySourceUrl(url),
        requiresRightsConfirmation: true,
        errorCode: 'cancelled',
        message: 'Analysis cancelled.',
      };
    }

    const category = classifySourceUrl(url);
    const formatSizes = await analyzeViaBackend(url.toString());
    return {
      status: 'supported',
      sourceUrl: url.toString(),
      sourceCategory: category,
      confidence: 'verified_mime',
      metadata: {
        title: category === 'facebook' ? 'Facebook video' : 'YouTube video',
        fileName: `${category === 'facebook' ? 'Facebook' : 'YouTube'} video.mp4`,
        mimeType: 'video/mp4',
        fileSizeBytes: null,
        mp4SizeBytes: formatSizes.mp4SizeBytes,
        mp3SizeBytes: formatSizes.mp3SizeBytes,
        sourceName: category === 'facebook' ? 'Facebook' : 'YouTube',
        thumbnailUri: null,
        durationMs: null,
      },
      socialFormats: [
        {
          id: 'mp4',
          label: 'MP4',
          ext: 'mp4',
          width: null,
          height: null,
          fps: null,
          sizeBytes: null,
        },
      ],
      supportsRange: false,
      requiresRightsConfirmation: true,
      message: 'The Python backend will prepare the direct MP4 download.',
    };
  },
};
