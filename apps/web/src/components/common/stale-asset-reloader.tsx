'use client';

import { useEffect } from 'react';

/**
 * Recovers a tab whose cached JS chunks / RSC payloads went stale after a deploy.
 *
 * Symptom this fixes: a tab left open across a deploy clicks a nav tab and "nothing
 * happens" — the App Router attempts a soft navigation, fetches a chunk / RSC payload the
 * new server build no longer has, the load fails, and the router's hard-navigation
 * fallback silently dies (a known App Router class — vercel/next.js #28038, #86151).
 *
 * On a chunk / dynamic-import load failure we force ONE full reload, which re-fetches the
 * current HTML + chunk manifest and unsticks navigation. A short sessionStorage cooldown
 * prevents a reload loop if the failure is genuinely persistent (a real 404, not staleness).
 *
 * This is deliberately narrow — it only reacts to chunk/module load errors, not arbitrary
 * runtime errors (those are the ErrorBoundary's job).
 */
const CHUNK_ERROR_RE =
  /ChunkLoadError|Loading (?:CSS )?chunk [^\s]+ failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;

const COOLDOWN_KEY = 'stale-asset-reload-at';
const COOLDOWN_MS = 15_000;

function reloadOnce() {
  try {
    const last = Number(window.sessionStorage.getItem(COOLDOWN_KEY) || 0);
    // Already reloaded for this reason very recently → the chunk is genuinely missing,
    // not just stale. Don't loop; let the ErrorBoundary / network error surface.
    if (Number.isFinite(last) && Date.now() - last < COOLDOWN_MS) return;
    window.sessionStorage.setItem(COOLDOWN_KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable (private mode / SSR) — proceed to reload anyway.
  }
  // @release-navigation-allowed: hard reload recovers a stale-chunk/RSC tab after a deploy.
  window.location.reload();
}

export function messageFromEvent(e: Event): string {
  if (typeof PromiseRejectionEvent !== 'undefined' && e instanceof PromiseRejectionEvent) {
    const reason = e.reason as unknown;
    if (reason instanceof Error) return `${reason.name}: ${reason.message}`;
    return typeof reason === 'string' ? reason : '';
  }
  if (typeof ErrorEvent !== 'undefined' && e instanceof ErrorEvent) {
    return e.message || (e.error instanceof Error ? e.error.message : '');
  }
  return '';
}

export function isChunkLoadError(message: string): boolean {
  return CHUNK_ERROR_RE.test(message);
}

export function StaleAssetReloader() {
  useEffect(() => {
    const handle = (e: Event) => {
      if (isChunkLoadError(messageFromEvent(e))) reloadOnce();
    };
    window.addEventListener('error', handle);
    window.addEventListener('unhandledrejection', handle);
    return () => {
      window.removeEventListener('error', handle);
      window.removeEventListener('unhandledrejection', handle);
    };
  }, []);

  return null;
}
