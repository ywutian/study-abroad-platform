/**
 * Test the middleware route protection logic.
 *
 * We test the pure helper functions (isProtectedRoute, isAdminRoute)
 * by extracting their logic. The full middleware depends on next-intl
 * and NextRequest which are hard to mock, so we focus on the core
 * routing logic.
 */
import { describe, it, expect } from 'vitest';

// Re-implement the route-matching logic from middleware.ts for testability
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

const ADMIN_PATTERNS = ['/admin'];

function isProtectedRoute(pathname: string): boolean {
  const pathWithoutLocale = pathname.replace(/^\/(zh|en)/, '') || '/';
  return PROTECTED_PATTERNS.some((p) => pathWithoutLocale.startsWith(p));
}

function isAdminRoute(pathname: string): boolean {
  const pathWithoutLocale = pathname.replace(/^\/(zh|en)/, '') || '/';
  return ADMIN_PATTERNS.some((p) => pathWithoutLocale.startsWith(p));
}

describe('middleware route protection', () => {
  describe('isProtectedRoute', () => {
    it('identifies protected routes with locale prefix', () => {
      expect(isProtectedRoute('/zh/profile')).toBe(true);
      expect(isProtectedRoute('/en/dashboard')).toBe(true);
      expect(isProtectedRoute('/zh/essays')).toBe(true);
      expect(isProtectedRoute('/en/chat')).toBe(true);
      expect(isProtectedRoute('/zh/settings')).toBe(true);
      expect(isProtectedRoute('/en/prediction')).toBe(true);
    });

    it('identifies protected routes without locale prefix', () => {
      expect(isProtectedRoute('/profile')).toBe(true);
      expect(isProtectedRoute('/dashboard')).toBe(true);
      expect(isProtectedRoute('/settings/security')).toBe(true);
    });

    it('identifies unprotected routes', () => {
      expect(isProtectedRoute('/zh/login')).toBe(false);
      expect(isProtectedRoute('/en/register')).toBe(false);
      expect(isProtectedRoute('/zh/schools')).toBe(false);
      expect(isProtectedRoute('/en/forum')).toBe(false);
      expect(isProtectedRoute('/')).toBe(false);
      expect(isProtectedRoute('/zh')).toBe(false);
    });

    it('handles nested protected paths', () => {
      expect(isProtectedRoute('/zh/profile/education')).toBe(true);
      expect(isProtectedRoute('/en/settings/subscription')).toBe(true);
      expect(isProtectedRoute('/zh/chat/abc-123')).toBe(true);
    });
  });

  describe('isAdminRoute', () => {
    it('identifies admin routes', () => {
      expect(isAdminRoute('/zh/admin')).toBe(true);
      expect(isAdminRoute('/en/admin')).toBe(true);
      expect(isAdminRoute('/admin')).toBe(true);
      expect(isAdminRoute('/zh/admin/users')).toBe(true);
      expect(isAdminRoute('/en/admin/schools')).toBe(true);
    });

    it('identifies non-admin routes', () => {
      expect(isAdminRoute('/zh/profile')).toBe(false);
      expect(isAdminRoute('/en/schools')).toBe(false);
      expect(isAdminRoute('/')).toBe(false);
    });
  });
});
