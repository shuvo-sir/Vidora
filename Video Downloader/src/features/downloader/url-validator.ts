import type { UrlValidationResult } from './downloader-types';

function isIpv4(value: string): boolean {
  const parts = value.split('.');
  return (
    parts.length === 4 &&
    parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
  );
}

function isPrivateIpv4(hostname: string): boolean {
  if (!isIpv4(hostname)) return false;
  const [a, b] = hostname.split('.').map(Number);
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 0) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

function isIpv6(hostname: string): boolean {
  const unwrapped = hostname.replace(/^\[|\]$/g, '');
  return unwrapped.includes(':');
}

function isPrivateIpv6(hostname: string): boolean {
  if (!isIpv6(hostname)) return false;
  const value = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return (
    value === '::1' ||
    value === '::' ||
    value.startsWith('fc') ||
    value.startsWith('fd') ||
    value.startsWith('fe8') ||
    value.startsWith('fe9') ||
    value.startsWith('fea') ||
    value.startsWith('feb')
  );
}

export function validateVideoUrl(value: string): UrlValidationResult {
  const trimmed = value.trim();
  if (!trimmed) {
    return { valid: false, errorCode: 'empty', message: 'Please enter a video URL.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, errorCode: 'malformed', message: 'Please enter a valid HTTPS video URL.' };
  }

  if (parsed.protocol !== 'https:') {
    return {
      valid: false,
      errorCode: 'unsafe_scheme',
      message: 'Only HTTPS video URLs are supported.',
    };
  }

  if (parsed.username || parsed.password) {
    return {
      valid: false,
      errorCode: 'credentials',
      message: 'URLs containing usernames or passwords are not supported.',
    };
  }

  if (parsed.port && parsed.port !== '443') {
    return {
      valid: false,
      errorCode: 'unsupported_port',
      message: 'Only standard HTTPS port 443 is supported.',
    };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    return {
      valid: false,
      errorCode: 'localhost',
      message: 'Local and internal network addresses are not supported.',
    };
  }

  if (isIpv4(hostname)) {
    if (isPrivateIpv4(hostname)) {
      return {
        valid: false,
        errorCode: 'private_host',
        message: 'Private network addresses are not supported.',
      };
    }
    return {
      valid: false,
      errorCode: 'ip_literal',
      message: 'IP-address URLs are not supported. Please use a domain name.',
    };
  }

  if (isIpv6(hostname)) {
    if (isPrivateIpv6(hostname)) {
      return {
        valid: false,
        errorCode: 'private_host',
        message: 'Private network addresses are not supported.',
      };
    }
    return {
      valid: false,
      errorCode: 'ip_literal',
      message: 'IP-address URLs are not supported. Please use a domain name.',
    };
  }

  parsed.hash = '';
  parsed.username = '';
  parsed.password = '';
  return {
    valid: true,
    normalizedUrl: parsed.toString(),
    hostname,
    url: parsed,
  };
}
