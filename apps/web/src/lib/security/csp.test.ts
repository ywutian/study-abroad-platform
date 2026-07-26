import { describe, it, expect, afterEach, vi } from 'vitest';
import { buildCspHeader } from './csp';

// Pins the converged CSP decision: prod must carry a nonce (that is what makes
// CSP3 browsers ignore the legacy 'unsafe-inline' fallback), dev must NOT, and
// a blind "loosen" must not reintroduce the dangerous unsafe-eval in prod.
describe('buildCspHeader — CSP prod/dev invariants', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('PROD carries the nonce, keeps unsafe-inline only as the CSP2 fallback, and NEVER standalone unsafe-eval', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const csp = buildCspHeader('abc123');
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'unsafe-inline' 'wasm-unsafe-eval'");
    // 'wasm-unsafe-eval' is fine; standalone 'unsafe-eval' (quote-delimited) must not appear.
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it('PROD nonce is in a form Next can parse back out of the header', () => {
    vi.stubEnv('NODE_ENV', 'production');
    // Mirrors next/dist/server/app-render/get-script-nonce-from-header.js: it
    // scans the script-src directive for a source matching this exact shape.
    // If the nonce stops round-tripping, Next silently drops it and its inline
    // hydration scripts render unnonced — which CSP3 then blocks.
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
    const scriptSrc = buildCspHeader(nonce)
      .split(';')
      .map((d) => d.trim())
      .find((d) => d.startsWith('script-src'));
    const parsed = scriptSrc
      ?.split(/\s+/)
      .slice(1)
      .map((s) => s.match(/^'nonce-([A-Za-z0-9+/_-]+={0,2})'$/)?.[1])
      .find(Boolean);
    expect(parsed).toBe(nonce);
  });

  it('DEV ships NO nonce (would break the HMR/error overlay) and allows unsafe-eval', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const csp = buildCspHeader('abc123');
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("'unsafe-inline'");
    expect(csp).not.toContain('nonce-');
  });

  it('style-src stays nonce-free so next/font inline styles survive CSP3', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const styleSrc = buildCspHeader('abc123')
      .split(';')
      .map((d) => d.trim())
      .find((d) => d.startsWith('style-src'));
    expect(styleSrc).toBe("style-src 'self' 'unsafe-inline'");
  });

  it('always hardens framing + base-uri regardless of env', () => {
    for (const env of ['production', 'development']) {
      vi.stubEnv('NODE_ENV', env);
      const csp = buildCspHeader('nonce');
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("default-src 'self'");
    }
  });
});
