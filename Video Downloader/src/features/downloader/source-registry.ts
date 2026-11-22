import type { AnalysisResult, VideoSourceProvider } from './downloader-types';
import { DirectFileProvider } from './providers/direct-file.provider';
import { classifySourceUrl } from './source-classifier';
import { findKnownUnsupportedPlatform } from './providers/known-platforms';
import { SocialMediaProvider } from './providers/social-media.provider';

const providers: VideoSourceProvider[] = [
  SocialMediaProvider,
  DirectFileProvider,
];

export function analyzeWithSourceRegistry(
  url: URL,
  signal: AbortSignal
): Promise<AnalysisResult> {
  const category = classifySourceUrl(url);
  const knownPlatform = findKnownUnsupportedPlatform(url.hostname);
  const directExport =
    /\.(mp4|m4v|mov|webm|mkv|mp3|m4a|mpeg|mpg|m2ts|3gp)$/i.test(
      url.pathname
    );

  if (knownPlatform && !directExport) {
    if (category === 'youtube' || category === 'facebook') {
      const provider = providers.find((candidate) =>
        candidate.providerId === 'social-media'
      );
      if (provider) return provider.analyze(url, signal);
    }
    const platformName =
      category === 'youtube'
        ? 'YouTube'
        : category === 'facebook'
          ? 'Facebook'
          : category === 'instagram'
            ? 'Instagram'
            : 'TikTok';
    return Promise.resolve({
      status: 'unsupported',
      sourceUrl: url.toString(),
      sourceCategory: category,
      requiresRightsConfirmation: true,
      errorCode: 'social_media_page',
      message: `${platformName} page link detected. Open the page normally, or provide an authorized direct MP4/MP3 export URL.`,
    });
  }

  const provider = providers.find((candidate) => candidate.canHandle(url));
  if (!provider) {
    return Promise.resolve({
      status: 'unsupported',
      requiresRightsConfirmation: true,
      errorCode: 'no_provider',
      message: 'No supported source provider matches this URL.',
    });
  }

  return provider.analyze(url, signal);
}
