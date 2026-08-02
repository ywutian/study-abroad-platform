import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from './lib/i18n/config';
import { buildCspHeader } from './lib/security/csp';

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
  '/teams/create', // 组队创建页需登录；/teams 和 /teams/:id 保持公开
  '/notifications',
  '/timeline',
  '/vault',
  '/uncommon-app',
  '/followers',
  '/outcomes', // user outcome reporting (API is JWT + @CurrentUser scoped; this adds an edge redirect)
  '/counselor', // counselor pattern pages (API additionally role-gated @Roles)
  // Admin routes also have role checks via ADMIN_PATTERNS; keeping /admin here
  // lets integration audits recognize that admin API pages are authenticated.
  '/admin',
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

function hasSessionCookie(request: NextRequest): boolean {
  return Boolean(
    request.cookies.get('refreshToken')?.value || request.cookies.get('access_token')?.value
  );
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth check for protected routes (cookie-based, no JWT verification in edge)
  if (isProtectedRoute(pathname) || isAdminRoute(pathname)) {
    if (!hasSessionCookie(request)) {
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
    if (hasSessionCookie(request)) {
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

  // Forward three request headers to the render:
  //   x-pathname               -> generateMetadata, for a per-page canonical +
  //                               hreflang (a layout only knows the locale, and
  //                               would canonicalize every subpage to the root)
  //   x-nonce                  -> the layout, for its own inline <script>/<style>
  //   content-security-policy  -> Next itself, which parses the nonce out of it
  //                               (app-render.js -> getScriptNonceFromHeader) to
  //                               stamp its hydration/RSC inline scripts. Setting
  //                               CSP only on the response is why the nonce never
  //                               worked before.
  //
  // Next only reads `x-middleware-request-<key>` for keys listed in
  // `x-middleware-override-headers`, and DELETES every request header missing
  // from that list (next/dist/server/lib/router-utils/resolve-routes.js).
  // next-intl already publishes that list with the full incoming header set, so
  // we APPEND — replacing it would strip `cookie` and log everyone out. If a
  // next-intl upgrade ever stops emitting it, skip forwarding: canonical
  // degrades to the locale root and the CSP falls back to its 'unsafe-inline'
  // leg. Both are survivable; losing cookies is not.
  const overrides = intlResponse.headers.get('x-middleware-override-headers');
  if (overrides) {
    intlResponse.headers.set(
      'x-middleware-override-headers',
      `${overrides},x-pathname,x-nonce,content-security-policy`
    );
    intlResponse.headers.set('x-middleware-request-x-pathname', pathname);
    intlResponse.headers.set('x-middleware-request-x-nonce', nonce);
    intlResponse.headers.set('x-middleware-request-content-security-policy', csp);
  }

  // Set CSP response header (browser enforces this)
  intlResponse.headers.set('Content-Security-Policy', csp);

  return intlResponse;
}

export const config = {
  // sw.js / workbox-*.js / manifest.json / robots.txt / sitemap*.xml MUST stay
  // excluded: the proxy otherwise 307-locale-redirects them, and browsers
  // reject redirected service-worker scripts — every previously-installed SW
  // gets pinned forever with its stale precache (the 2026-06 "页面无法跳转"
  // incident: visitors from the Jan–Mar window could no longer navigate after
  // deploys, while clean profiles worked). Redirected robots/sitemap also hid
  // the site from crawlers. Guarded by proxy.matcher.test.ts + the
  // release-runtime CI assert step ("Assert root public assets bypass proxy").
  matcher: [
    '/((?!api|_next/static|_next/image|\\.well-known|favicon.ico|sw\\.js|workbox-.*\\.js|manifest\\.json|robots\\.txt|sitemap.*\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
