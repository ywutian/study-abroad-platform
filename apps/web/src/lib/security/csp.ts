/**
 * Content-Security-Policy builder. Extracted from proxy.ts so the prod/dev
 * directive set can be unit-tested (csp.test.ts) — the CSP went through a
 * tighten→break→relax loop (#5f0797f0 → #411101a8 nonce → #fdadba28) that
 * converged on a deliberate compromise:
 *
 *   - `'unsafe-inline'` IS allowed in prod: Next.js App Router emits inline
 *     hydration/RSC scripts that can't reliably be nonced together with
 *     next-intl middleware. This is the documented, accepted trade-off.
 *   - `'unsafe-eval'` is **dev-only** and must NEVER appear in prod. (prod uses
 *     the far narrower `'wasm-unsafe-eval'` for WASM instantiation only.)
 *
 * The test pins exactly this so a future blind "tighten" can't silently break
 * hydration, and a blind "loosen" can't reintroduce `unsafe-eval` in prod.
 * See .claude/rules/security.md (CSP).
 */
export function buildCspHeader(_nonce: string): string {
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
    // 'unsafe-eval' stays DEV-ONLY; prod uses the narrower 'wasm-unsafe-eval'.
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
