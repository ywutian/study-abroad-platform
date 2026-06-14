'use client';

import { useEffect, useState } from 'react';

/**
 * SSR-safe media-query hook.
 *
 * Returns `false` on the server and on the first client render (so SSR and
 * hydration agree — no mismatch), then updates to the real match after mount.
 * Consumers that gate the mount of heavy/async content on the result therefore
 * never double-mount it across the breakpoint.
 *
 * @example
 *   const isDesktop = useMediaQuery('(min-width: 1024px)'); // Tailwind `lg`
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Tailwind `lg` breakpoint (1024px) — the workbench three-column threshold. */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}
