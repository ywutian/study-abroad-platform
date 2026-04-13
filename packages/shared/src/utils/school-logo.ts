const GOOGLE_FAVICON_BASE = 'https://www.google.com/s2/favicons';
const LOGO_DEV_BASE = 'https://img.logo.dev';
const DEFAULT_LOGO_SIZE = 256;

export interface SchoolLogoInput {
  logoUrl?: string | null;
  website?: string | null;
}

export function normalizeSchoolLogoUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  return trimmed || null;
}

export function isValidSchoolLogoUrl(url?: string | null): boolean {
  const normalized = normalizeSchoolLogoUrl(url);
  if (!normalized) return false;

  try {
    const parsed = new URL(normalized);
    return (
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      parsed.hostname !== 'localhost' &&
      !parsed.hostname.endsWith('.localhost')
    );
  } catch {
    return false;
  }
}

export function extractSchoolLogoDomain(website?: string | null): string | null {
  if (!website || typeof website !== 'string') return null;
  const trimmed = website.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const host = url.hostname.toLowerCase();
    if (!host || host === 'localhost' || host.endsWith('.localhost')) {
      return null;
    }
    return host.startsWith('www.') ? host.slice(4) : host;
  } catch {
    return null;
  }
}

export function getSchoolFaviconUrl(
  website?: string | null,
  size = DEFAULT_LOGO_SIZE
): string | null {
  const domain = extractSchoolLogoDomain(website);
  if (!domain) return null;
  return `${GOOGLE_FAVICON_BASE}?domain=${encodeURIComponent(domain)}&sz=${size}`;
}

export function getSchoolLogoDevUrl(
  websiteOrDomain?: string | null,
  token?: string | null,
  size = DEFAULT_LOGO_SIZE
): string | null {
  const tokenValue = token?.trim();
  if (!tokenValue) return null;

  const domain =
    websiteOrDomain && websiteOrDomain.includes('.')
      ? (extractSchoolLogoDomain(websiteOrDomain) ?? websiteOrDomain.trim())
      : null;

  if (!domain) return null;
  return `${LOGO_DEV_BASE}/${domain}?token=${tokenValue}&size=${size}`;
}

export function getSchoolLogoSources({ logoUrl, website }: SchoolLogoInput): {
  source: string | null;
  fallbackSource: string | null;
} {
  return {
    source: normalizeSchoolLogoUrl(logoUrl),
    fallbackSource: getSchoolFaviconUrl(website),
  };
}
