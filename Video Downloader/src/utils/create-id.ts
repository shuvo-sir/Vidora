export function createId(prefix = 'vidora'): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  const randomPart = Array.from(
    { length: 16 },
    () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
  ).join('');
  return `${prefix}-${Date.now().toString(36)}-${randomPart}`;
}
