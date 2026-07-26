import { describe, it, expect } from 'vitest';
import { env } from './env';

describe('env validation', () => {
  it('exports env object with required fields', () => {
    expect(env).toBeDefined();
    expect(typeof env.NODE_ENV).toBe('string');
  });

  it('provides default for NEXT_PUBLIC_APP_URL', () => {
    expect(env.NEXT_PUBLIC_APP_URL).toBe('https://www.lumniedu.com');
  });

  it('provides default for NEXT_PUBLIC_API_URL', () => {
    // In test environment, defaults to empty string (uses Next.js rewrites proxy)
    expect(typeof env.NEXT_PUBLIC_API_URL).toBe('string');
  });

  it('NODE_ENV is set', () => {
    expect(['development', 'production', 'test']).toContain(env.NODE_ENV);
  });
});
