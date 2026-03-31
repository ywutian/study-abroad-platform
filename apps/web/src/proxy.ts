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
  '/teams/create', // 组队创建页需登录；/teams 和 /teams/[id] 保持公开
  '/notifications',
  '/vault',
  '/uncommon-app',
  '/followers',
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

function buildCspHeader(_nonce: string): string {
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
    // Next.js App Router generates inline scripts (hydration, RSC payload) that
    // cannot reliably receive nonce attributes when combined with next-intl middleware.
    // 'unsafe-inline' is needed for these framework scripts in both dev and prod.
    isDev
      ? `script-src 'self' 'unsafe-eval' 'unsafe-inline'`
      : `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'`,
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

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth check for protected routes (cookie-based, no JWT verification in edge)
  if (isProtectedRoute(pathname) || isAdminRoute(pathname)) {
    const token = request.cookies.get('access_token')?.value;

    if (!token) {
      const loginUrl = new URL(getLoginUrl(request), request.url);
      const pathWithoutLocale = pathname.replace(/^\/(zh|en)/, '') || '/';
      if (/^\/[\w\-/]*$/.test(pathWithoutLocale)) {
        loginUrl.searchParams.set('callbackUrl', pathname);
      }
      return NextResponse.redirect(loginUrl);
    }
  }

  // Authenticated users hitting locale root (landing) → redirect to dashboard
  const isLocaleRoot = /^\/(zh|en)\/?$/.test(pathname);
  if (isLocaleRoot) {
    const token = request.cookies.get('access_token')?.value;
    if (token) {
      const locale = pathname.startsWith('/zh') ? 'zh' : 'en';
      return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
    }
  }

  // Generate per-request nonce for CSP
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCspHeader(nonce);

  // Delegate to next-intl middleware for locale handling
  const intlResponse = intlMiddleware(request);

  // Redirects don't render HTML — no CSP needed
  if (intlResponse.status >= 300 && intlResponse.status < 400) {
    return intlResponse;
  }

  // Forward nonce to server components via the intl middleware's response.
  // x-middleware-request-* headers are how Next.js forwards request headers
  // from middleware to server components (readable via headers() in layout).
  intlResponse.headers.set('x-middleware-request-x-nonce', nonce);

  // Set CSP response header (browser enforces this)
  intlResponse.headers.set('Content-Security-Policy', csp);

  return intlResponse;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
