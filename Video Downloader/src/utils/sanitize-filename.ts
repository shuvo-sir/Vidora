const MAX_FILENAME_BASE_LENGTH = 80;

export function sanitizeFilename(value: string, fallback = 'video'): string {
  let name = value
    .replace(/[^a-zA-Z0-9.\-_]/g, '_')
    .replace(/^[.\-]+|[.\-]+$/g, '');

  if (!name) {
    name = fallback.replace(/[^a-zA-Z0-9.\-_]/g, '_').replace(/^[.\-]+|[.\-]+$/g, '');
  }
  if (!name) name = 'video';

  const extensionIndex = name.lastIndexOf('.');
  const hasExtension = extensionIndex > 0 && name.length - extensionIndex <= 10;
  const extension = hasExtension ? name.slice(extensionIndex) : '';
  const base = (hasExtension ? name.slice(0, extensionIndex) : name).slice(
    0,
    MAX_FILENAME_BASE_LENGTH
  ).replace(/[.\-_]+$/g, '');

  return `${base || 'video'}${extension}`;
}
