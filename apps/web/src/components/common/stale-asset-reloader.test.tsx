import { describe, it, expect } from 'vitest';
import { isChunkLoadError, messageFromEvent } from './stale-asset-reloader';

describe('isChunkLoadError', () => {
  it('matches the chunk / dynamic-import failures a stale tab throws after a deploy', () => {
    for (const msg of [
      'ChunkLoadError: Loading chunk 4823 failed.',
      'Loading chunk app/page failed',
      'Failed to fetch dynamically imported module: https://x/_next/static/chunks/abc.js',
      'error loading dynamically imported module',
      'TypeError: Importing a module script failed',
    ]) {
      expect(isChunkLoadError(msg)).toBe(true);
    }
  });

  it('does NOT match ordinary runtime errors (those belong to the ErrorBoundary)', () => {
    for (const msg of [
      'TypeError: Cannot read properties of undefined',
      'Network request failed',
      'Hydration failed because the initial UI does not match',
      '',
    ]) {
      expect(isChunkLoadError(msg)).toBe(false);
    }
  });
});

describe('messageFromEvent', () => {
  it('extracts the message from an ErrorEvent', () => {
    const e = new ErrorEvent('error', { message: 'ChunkLoadError: Loading chunk 1 failed' });
    expect(messageFromEvent(e)).toContain('ChunkLoadError');
  });

  it('extracts the message from a rejected promise (Error reason)', () => {
    const e = new PromiseRejectionEvent('unhandledrejection', {
      reason: new Error('Failed to fetch dynamically imported module'),
      promise: Promise.reject(new Error('x')).catch(() => undefined) as unknown as Promise<never>,
    });
    expect(messageFromEvent(e)).toContain('Failed to fetch dynamically imported module');
  });
});
