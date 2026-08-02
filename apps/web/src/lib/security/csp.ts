/**
 * Content-Security-Policy builder. Extracted from proxy.ts so the prod/dev
 * directive set can be unit-tested (csp.test.ts).
 *
 *   - PROD `script-src` carries a per-request `'nonce-…'`. Any CSP Level 3
 *     browser ignores `'unsafe-inline'` once a nonce is present, so injected
 *     inline scripts are blocked; `'unsafe-inline'` stays only as the
 *     backwards-compatible fallback for CSP2-only browsers (this is the shape
 *     Google's strict-CSP guide recommends), never as the modern behaviour.
 *   - DEV deliberately ships NO nonce: the dev server's HMR/error-overlay
 *     inline scripts are not all nonced, and dev CSP is not a security
 *     boundary. Adding one there would only break the dev overlay.
 *   - `'unsafe-eval'` is **dev-only** and must NEVER appear in prod. (prod uses
 *     the far narrower `'wasm-unsafe-eval'` for WASM instantiation only.)
 *
 * History: an earlier nonce attempt (#411101a8) was reverted to plain
 * `'unsafe-inline'` (#fdadba28) after it broke hydration, and the code was
 * annotated "can't be nonced together with next-intl". That diagnosis was
 * wrong — the nonce was never reaching Next at all. Next reads it from the
 * **request** `content-security-policy` header (app-render.js →
 * getScriptNonceFromHeader), and all three legs were broken: this builder
 * ignored its own `nonce` argument, the CSP was only ever set as a *response*
 * header, and proxy.ts's request-header forwarding never registered its keys
 * in `x-middleware-override-headers`. Fixing the plumbing makes the nonce work
 * with next-intl untouched.
 *
 * `style-src` keeps `'unsafe-inline'` with NO nonce on purpose: next/font and
 * React inject inline styles that carry no nonce, so noncing styles would
 * disable them via the same CSP3 rule and drop critical CSS.
 *
 * The test pins all of this so a future blind "tighten" can't break hydration,
 * and a blind "loosen" can't drop the nonce or reintroduce `unsafe-eval` in
 * prod. See .claude/rules/security.md (CSP).
 */
export function buildCspHeader(nonce: string): string {
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
    // Nonce first so CSP3 browsers enforce it and ignore the trailing
    // 'unsafe-inline' (kept only for CSP2-only browsers). Dev gets no nonce —
    // see the file header. 'unsafe-eval' stays DEV-ONLY.
    isDev
      ? `script-src 'self' 'unsafe-eval' 'unsafe-inline'`
      : `script-src 'self' 'nonce-${nonce}' 'unsafe-inline' 'wasm-unsafe-eval'`,
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
