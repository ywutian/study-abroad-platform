import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from './lib/i18n/config';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localeDetection: true,
});

/** Routes that require authentication (cookie-based token check) */
const PROTECTED_PATTERNS = [
  '/profile',
  '/dashboard',
  '/essays',
  '/resume',
  '/assessment',
  '/prediction',
  '/chat',
  '/settings',
];

/** Routes that require admin role (additional cookie check) */
const ADMIN_PATTERNS = ['/admin'];

function isProtectedRoute(pathname: string): boolean {
  const pathWithoutLocale = pathname.replace(/^\/(zh|en)/, '') || '/';
  return PROTECTED_PATTERNS.some((p) => pathWithoutLocale.startsWith(p));
}

function isAdminRoute(pathname: string): boolean {
  const pathWithoutLocale = pathname.replace(/^\/(zh|en)/, '') || '/';
  return ADMIN_PATTERNS.some((p) => pathWithoutLocale.startsWith(p));
}

function getLoginUrl(request: NextRequest): string {
  const locale = locales.find((l) => request.nextUrl.pathname.startsWith(`/${l}`)) || defaultLocale;
  return `/${locale}/login`;
}

function buildCspHeader(nonce: string): string {
  const isDev = process.env.NODE_ENV !== 'production';

  // connect-src: allow API, WebSocket, and Sentry
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || '';
  const apiUrlNorm = apiUrl.replace(/\/$/, '');
  const apiWsNorm = apiUrl
    ? apiUrl.replace(/^https?:/, (m) => (m === 'https:' ? 'wss:' : 'ws:')).replace(/\/$/, '')
    : '';
  const wsUrlNorm = wsUrl.replace(/\/$/, '');

  const connectSrcParts = ["'self'", 'https://*.sentry.io', 'https://fonts.gstatic.com'];
  if (apiUrlNorm) {
    connectSrcParts.push(apiUrlNorm);
    if (apiWsNorm) connectSrcParts.push(apiWsNorm);
  }
  if (wsUrlNorm && wsUrlNorm !== apiWsNorm) {
    connectSrcParts.push(wsUrlNorm);
    const wsHttps = wsUrlNorm.replace(/^wss?:/, (m) => (m === 'wss:' ? 'https:' : 'http:'));
    if (wsHttps !== apiUrlNorm) connectSrcParts.push(wsHttps);
  }
  // In dev, allow all wss: for convenience
  if (isDev) connectSrcParts.push('wss:');

  const directives = [
    "default-src 'self'",
    // 'strict-dynamic' trusts scripts loaded by nonced scripts (Next.js chunk loading)
    isDev
      ? `script-src 'self' 'unsafe-eval' 'unsafe-inline'`
      : `script-src 'strict-dynamic' 'nonce-${nonce}'`,
    // 'unsafe-inline' needed for Next.js/Radix inline styles
    `style-src 'self' 'unsafe-inline'`,
    "img-src 'self' data: https:",
    `connect-src ${connectSrcParts.join(' ')} data:`,
    "font-src 'self' https://fonts.gstatic.com",
    "frame-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];

  return directives.join('; ');
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth check for protected routes (cookie-based, no JWT verification in edge)
  if (isProtectedRoute(pathname) || isAdminRoute(pathname)) {
    const token =
      request.cookies.get('access_token')?.value ||
      request.cookies.get('auth_check')?.value ||
      request.cookies.get('token')?.value;

    if (!token) {
      const loginUrl = new URL(getLoginUrl(request), request.url);
      // Only pass internal paths as callbackUrl to prevent open redirect attacks
      const pathWithoutLocale = pathname.replace(/^\/(zh|en)/, '') || '/';
      if (/^\/[\w\-/]*$/.test(pathWithoutLocale)) {
        loginUrl.searchParams.set('callbackUrl', pathname);
      }
      return NextResponse.redirect(loginUrl);
    }
  }

  // Generate per-request nonce for CSP
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCspHeader(nonce);

  // Delegate to next-intl middleware for locale handling
  const response = intlMiddleware(request);

  // Redirects don't render HTML — no CSP needed
  if (response.status >= 300 && response.status < 400) {
    return response;
  }

  // Forward nonce as request header so server components can read it via headers()
  // (x-middleware-request-* is Next.js internal convention for request header forwarding)
  response.headers.set('x-middleware-request-x-nonce', nonce);

  // Set CSP response header (browser enforces this)
  response.headers.set('Content-Security-Policy', csp);

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
