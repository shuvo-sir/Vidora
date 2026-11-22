import type { SourceCategory } from './downloader-types';

function matchesHostname(hostname: string, base: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, '');
  return normalized === base || normalized.endsWith(`.${base}`);
}

export function classifySourceUrl(url: URL): SourceCategory {
  const hostname = url.hostname.toLowerCase();
  if (matchesHostname(hostname, 'youtube.com') || matchesHostname(hostname, 'youtu.be')) {
    return 'youtube';
  }
  if (
    matchesHostname(hostname, 'facebook.com') ||
    matchesHostname(hostname, 'fb.watch') ||
    matchesHostname(hostname, 'facebook.net')
  ) {
    return 'facebook';
  }
  if (matchesHostname(hostname, 'instagram.com')) return 'instagram';
  if (matchesHostname(hostname, 'tiktok.com')) return 'tiktok';

  const extension = hostname && url.pathname.toLowerCase();
  if (/\.(mp4|m4v|mov|webm|mkv|avi|mpeg|mpg|m2ts|3gp)$/.test(extension)) {
    return 'direct_video_file';
  }
  return 'unknown';
}
