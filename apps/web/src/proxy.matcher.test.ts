import { describe, expect, it, vi } from 'vitest';

// proxy.ts only needs these at request time; mocking them lets us import the
// REAL exported config (the artifact under guard) without the Next runtime.
vi.mock('next-intl/middleware', () => ({ default: () => () => null }));
vi.mock('next/server', () => ({ NextRequest: class {}, NextResponse: class {} }));

import { config } from './proxy';

/**
 * Guards the proxy matcher against re-intercepting root public assets.
 *
 * Incident (2026-06): the matcher matched /sw.js, so the proxy 307-locale-
 * redirected it. Browsers reject redirected service-worker scripts, which
 * permanently pinned every previously-installed SW (registered since the
 * 2026-01 scaffold via next-pwa) with a stale precache — affected visitors
 * could no longer navigate after deploys ("页面无法跳转") while clean
 * profiles worked. Redirected robots.txt/sitemap.xml also hid the site from
 * crawlers. If one of the "must NOT match" cases below starts matching, that
 * incident comes back.
 *
 * The matcher string `/((?!…).*)` is itself a valid regex — Next.js compiles
 * it via path-to-regexp, but anchoring it directly reproduces the same
 * match/no-match decisions for these literal paths.
 */
const matcher = new RegExp(`^${config.matcher[0]}$`);

describe('proxy config.matcher', () => {
  it.each([
    '/sw.js',
    '/workbox-2191059d.js',
    '/workbox-abc123.js.map',
    '/manifest.json',
    '/robots.txt',
    '/sitemap.xml',
    '/favicon.ico',
    '/api/v1/auth/login',
    '/_next/static/chunks/main.js',
    '/_next/image',
    '/globe.svg',
    '/og-image.png',
  ])('does NOT match %s (served without locale redirect)', (path) => {
    expect(matcher.test(path)).toBe(false);
  });

  it.each([
    '/',
    '/zh',
    '/en/dashboard',
    '/zh/schools',
    '/login',
    '/zh/admin/users',
    '/en/prediction',
  ])('still matches %s (locale + CSP middleware must run)', (path) => {
    expect(matcher.test(path)).toBe(true);
  });
});
