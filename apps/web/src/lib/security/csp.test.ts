import { describe, it, expect, afterEach, vi } from 'vitest';
import { buildCspHeader } from './csp';

// Pins the converged CSP decision (#5f0797f0 → #411101a8 → #fdadba28): a future
// blind "tighten" must not break next-intl hydration by dropping unsafe-inline,
// and a blind "loosen" must not reintroduce the dangerous unsafe-eval in prod.
describe('buildCspHeader — CSP prod/dev invariants', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('PROD allows unsafe-inline (next-intl framework scripts) but NEVER standalone unsafe-eval', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const csp = buildCspHeader('nonce');
    expect(csp).toContain("script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'");
    // 'wasm-unsafe-eval' is fine; standalone 'unsafe-eval' (quote-delimited) must not appear.
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it('DEV allows unsafe-eval (tooling) — the only place it is permitted', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const csp = buildCspHeader('nonce');
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("'unsafe-inline'");
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
