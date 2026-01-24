# ADR-0001: Next.js 16 Turbopack Webpack Fallback

- Status: accepted
- Date: 2026-02-07
- Decision-makers: Core Team
- Tags: frontend, build-tooling, next.js

## Context

Next.js 16 (currently 16.1.6) ships with Turbopack as the default dev compiler. During initial testing (2026-02-07, on 16.1.3), we discovered that **all routes inside route groups** (`(main)`, `(auth)`) return 404 when using Turbopack mode.

The root cause is an incompatibility between Turbopack's route resolution and the `next-intl` middleware matcher configuration. The original matcher `['/', '/(zh|en)/:path*']` works correctly with Webpack but fails silently with Turbopack.

This is a **P0 Critical** issue affecting 100% of authenticated pages.

## Decision

1. **Update the middleware matcher** to use an exclusion-based pattern that is compatible with both Turbopack and Webpack:

   ```typescript
   matcher: [
     '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
   ];
   ```

2. **Provide a Webpack fallback script** as a safety net:

   ```json
   "dev": "next dev",
   "dev:webpack": "next dev --webpack"
   ```

3. Provide `dev:webpack` as a fallback script for developers who encounter Turbopack issues.

## Consequences

### Positive

- All routes work correctly in both Webpack and Turbopack modes
- Developers have a Turbopack default (`dev`) and a Webpack fallback (`dev:webpack`)
- No code changes required in page components or layouts

### Negative

- Need to periodically re-test Turbopack compatibility with future Next.js releases
- Webpack fallback is slower than Turbopack for Hot Module Replacement (HMR)

### Neutral

- Production builds (`next build`) are unaffected — they always use Webpack
- The exclusion-based matcher is actually more maintainable than the original inclusion-based one
