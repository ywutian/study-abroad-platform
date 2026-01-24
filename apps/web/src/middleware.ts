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
  '/school-list',
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
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Delegate to next-intl middleware for locale handling
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
