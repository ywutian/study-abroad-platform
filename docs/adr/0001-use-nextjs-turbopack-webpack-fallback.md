# ADR-0001: Next.js 16 Turbopack Webpack Fallback

- Status: accepted
- Date: 2026-02-07
- Decision-makers: Core Team
- Tags: frontend, build-tooling, next.js

## Context

Next.js 16.1.3 ships with Turbopack as the default dev compiler. During comprehensive testing (2026-02-07), we discovered that **all routes inside route groups** (`(main)`, `(auth)`) return 404 when using Turbopack mode.

The root cause is an incompatibility between Turbopack's route resolution and the `next-intl` middleware matcher configuration. The original matcher `['/', '/(zh|en)/:path*']` works correctly with Webpack but fails silently with Turbopack.

This is a **P0 Critical** issue affecting 100% of authenticated pages.

## Decision

1. **Update the middleware matcher** to use an exclusion-based pattern that is compatible with both Turbopack and Webpack:

   ```typescript
   matcher: [
     '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
   ];
   ```

2. **Default to Webpack for development** as a safety net:

   ```json
   "dev": "next dev --webpack",
   "dev:turbo": "next dev"
   ```

3. Provide `dev:turbo` as an opt-in script for developers who want to test Turbopack compatibility.

## Consequences

### Positive

- All routes work correctly in both Webpack and Turbopack modes
- Developers have a stable default (`dev`) and an experimental option (`dev:turbo`)
- No code changes required in page components or layouts

### Negative

- Webpack mode is slower than Turbopack for Hot Module Replacement (HMR)
- Need to periodically re-test Turbopack compatibility with future Next.js releases

### Neutral

- Production builds (`next build`) are unaffected — they always use Webpack
- The exclusion-based matcher is actually more maintainable than the original inclusion-based one
