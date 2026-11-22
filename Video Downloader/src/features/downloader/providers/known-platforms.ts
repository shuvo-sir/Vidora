export const KNOWN_UNSUPPORTED_HOSTS = [
  'youtube.com',
  'youtu.be',
  'facebook.com',
  'fb.watch',
  'instagram.com',
  'tiktok.com',
] as const;

export function findKnownUnsupportedPlatform(hostname: string): string | null {
  const normalized = hostname.toLowerCase().replace(/\.$/, '');
  for (const host of KNOWN_UNSUPPORTED_HOSTS) {
    if (normalized === host || normalized.endsWith(`.${host}`)) {
      return host;
    }
  }
  return null;
}
