import { sanitizeFilename } from '@/src/utils/sanitize-filename';

const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.m4v',
  '.mov',
  '.webm',
  '.mkv',
  '.avi',
  '.mpeg',
  '.mpg',
  '.m2ts',
  '.3gp',
]);

export function parseContentType(header: string | null): string | null {
  if (!header) return null;
  const first = header.split(';', 1)[0]?.trim().toLowerCase();
  if (!first || !/^[-a-z0-9.+]+\/[-a-z0-9.+]+$/.test(first)) return null;
  return first;
}

export function parseContentLength(header: string | null): number | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value < 0) return null;
  return value;
}

export function parseContentRangeTotal(header: string | null): number | null {
  if (!header) return null;
  const match = /^bytes\s+\d+-\d+\/(\d+|\*)$/i.exec(header.trim());
  if (!match || match[1] === '*') return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function decodeExtendedFilename(value: string): string | null {
  const match = /^([^']*)'[^']*'(.*)$/.exec(value);
  if (!match) return null;
  try {
    return decodeURIComponent(match[2].replace(/\+/g, ' '));
  } catch {
    return null;
  }
}

export function parseContentDisposition(header: string | null): string | null {
  if (!header) return null;

  const extendedMatch =
    /(?:^|;)\s*filename\*\s*=\s*(?:UTF-8''|utf-8'')([^;]+)/i.exec(header);
  if (extendedMatch) {
    const raw = extendedMatch[1].trim().replace(/^"|"$|^'|'$/g, '');
    const decoded = decodeExtendedFilename(raw) ?? decodeURIComponentSafe(raw);
    if (decoded) return sanitizeFilename(decoded);
  }

  const match = /(?:^|;)\s*filename\s*=\s*(?:"([^"]*)"|([^;]*))/i.exec(header);
  if (!match) return null;
  const raw = (match[1] ?? match[2] ?? '').trim();
  return raw ? sanitizeFilename(raw) : null;
}

function decodeURIComponentSafe(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function isVideoMimeType(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return (
    mimeType.startsWith('video/') ||
    mimeType === 'application/vnd.apple.mpegurl' ||
    mimeType === 'application/x-mpegurl'
  );
}

export function isAudioMimeType(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return (
    mimeType === 'audio/mpeg' ||
    mimeType === 'audio/mp3' ||
    mimeType === 'audio/mp4' ||
    mimeType === 'audio/x-m4a'
  );
}

export function hasKnownVideoExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return Array.from(VIDEO_EXTENSIONS).some((extension) => lower.endsWith(extension));
}

export function filenameFromUrl(url: URL): string | null {
  const segments = url.pathname.split('/').filter(Boolean);
  if (!segments.length) return null;
  try {
    return decodeURIComponentSafe(segments[segments.length - 1]) ?? null;
  } catch {
    return null;
  }
}

export function filenameToTitle(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  const base =
    lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
  return base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Video';
}
