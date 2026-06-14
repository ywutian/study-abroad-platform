'use client';

import { useCallback, useRef, type ComponentProps, type MouseEvent } from 'react';
import { Link, usePathname } from '@/lib/i18n/navigation';

/**
 * Drop-in replacement for the i18n <Link> that guarantees a click is never a no-op.
 *
 * App Router soft navigations can silently hang — a stuck loading.tsx, a stale RSC payload
 * after a deploy, or a failed prefetch (vercel/next.js #86151, #28038, discussion #57565).
 * The URL never commits and the page just sits there ("点 tab 没有任何反应"). This wrapper
 * arms a watchdog on click: if the route hasn't moved off the current path within
 * `fallbackMs`, it forces a full-page navigation to the link's resolved href so the user
 * always gets there.
 *
 * Why this only fires on genuinely-stuck nav (not slow nav): App Router commits the URL as
 * soon as the destination's loading state shows, so `usePathname` changes almost immediately
 * on a working navigation — even a slow-loading one. If the pathname is *still* the starting
 * path after `fallbackMs`, the soft nav never committed = stuck.
 *
 * The hard-nav target is read from the rendered anchor's own `href`, so it inherits whatever
 * locale prefix / pathname mapping the i18n <Link> computed — no reconstruction needed.
 */
type SafeLinkProps = ComponentProps<typeof Link> & {
  /** How long a soft nav may sit without committing before we hard-navigate. */
  fallbackMs?: number;
};

export function SafeLink({ onClick, fallbackMs = 3000, ...props }: SafeLinkProps) {
  const pathname = usePathname();
  // Keep the latest committed pathname readable inside the timeout closure.
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const handleClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(e);

      // Let the browser own modified / non-primary clicks (new tab, download, etc.)
      // and bail if a consumer already handled it.
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      // Capture synchronously — currentTarget is nulled by the time the timeout runs.
      const targetUrl = e.currentTarget.href;
      if (!targetUrl) return;
      // Clicking the route we're already on (e.g. the active tab) → nothing to recover.
      try {
        if (new URL(targetUrl).pathname === window.location.pathname) return;
      } catch {
        return;
      }

      const startedFrom = pathnameRef.current;
      window.setTimeout(() => {
        // Still parked on the page we clicked from → the soft nav is stuck. Hard-navigate.
        if (pathnameRef.current === startedFrom) {
          // @release-navigation-allowed: stuck soft-nav recovery — a full navigation IS the escape hatch here, not a routing bypass.
          window.location.assign(targetUrl);
        }
      }, fallbackMs);
    },
    [onClick, fallbackMs]
  );

  return <Link onClick={handleClick} {...props} />;
}
