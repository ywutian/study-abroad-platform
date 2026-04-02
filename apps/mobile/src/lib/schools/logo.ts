const GOOGLE_FAVICON_BASE = 'https://www.google.com/s2/favicons';
const FAVICON_SIZE = 256;

export interface SchoolLogoInput {
  logoUrl?: string | null;
  website?: string | null;
}

function normalizeUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  return trimmed || null;
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

export function getSchoolFaviconUrl(website?: string | null): string | null {
  const domain = extractSchoolLogoDomain(website);
  if (!domain) return null;
  return `${GOOGLE_FAVICON_BASE}?domain=${encodeURIComponent(domain)}&sz=${FAVICON_SIZE}`;
}

export function getSchoolLogoSources({ logoUrl, website }: SchoolLogoInput): {
  source: string | null;
  fallbackSource: string | null;
} {
  return {
    source: normalizeUrl(logoUrl),
    fallbackSource: getSchoolFaviconUrl(website),
  };
}
