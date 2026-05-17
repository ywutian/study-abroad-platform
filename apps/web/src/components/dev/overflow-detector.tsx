'use client';

import { useEffect } from 'react';

/**
 * Dev-only horizontal overflow detector.
 *
 * ## Why this exists
 *
 * The `<main>` element in `app/[locale]/(main)/layout.tsx` has
 * `overflow-x-clip` as a production safety net — it prevents end users
 * from seeing horizontal scrollbars when a single misbehaving component
 * overflows. But the trade-off is that **in development the overflow
 * also gets silently clipped**, so authors don't see the problem until
 * a screenshot from production rolls in.
 *
 * This component runs only in development (and only when explicitly
 * enabled via NODE_ENV) and walks every element in the body, looking
 * for nodes whose `scrollWidth` exceeds their `clientWidth` — the
 * unambiguous signal of horizontal overflow. The offending element is
 * outlined in red and a structured warning is logged with:
 *
 *   - the element (clickable in DevTools)
 *   - its tag + id + first className
 *   - the overflow magnitude (px)
 *   - a short DOM-path crumb so you know where in the tree it lives
 *
 * ## Why not just remove `overflow-x-clip`?
 *
 * Because we still want production users protected. The dev/prod split
 * means: in dev you SEE every overflow and fix it; in prod the user
 * is shielded from the long-tail bugs we missed.
 *
 * ## Tuning
 *
 * - `MIN_DELTA_PX`: ignore tiny sub-pixel rounding deltas (1px).
 * - `ALLOWED_TAGS`: never flag these (e.g. ScrollArea viewports are
 *   deliberately wider than parents). Extend the allowlist via the
 *   `data-allow-overflow-x` attribute on any element whose horizontal
 *   overflow is intentional.
 *
 * ## Performance
 *
 * - Runs once on mount + once per ResizeObserver entry on document.body.
 * - Debounced to 200ms during rapid resize.
 * - Touched elements are cached so the same warning isn't spammed
 *   on each pass; it re-warns only when the overflow delta changes.
 * - In production this component renders nothing and registers nothing.
 */

const MIN_DELTA_PX = 1;
const ALLOWED_TAGS = new Set(['SVG', 'PATH', 'CANVAS', 'IFRAME', 'IMG', 'VIDEO']);
const DEBOUNCE_MS = 200;

type WarnRecord = { delta: number; at: number };

function shortPath(el: Element, depth = 4): string {
  const crumbs: string[] = [];
  let cur: Element | null = el;
  while (cur && depth > 0) {
    const id = cur.id ? `#${cur.id}` : '';
    const firstClass = cur.className
      ? '.' + String(cur.className).split(/\s+/).filter(Boolean).slice(0, 1).join('.')
      : '';
    crumbs.unshift(`${cur.tagName.toLowerCase()}${id}${firstClass}`);
    cur = cur.parentElement;
    depth -= 1;
  }
  return crumbs.join(' > ');
}

function scanForOverflow(seen: WeakMap<Element, WarnRecord>) {
  const all = document.body.getElementsByTagName('*');
  let flagged = 0;
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (ALLOWED_TAGS.has(el.tagName)) continue;
    if (el.hasAttribute('data-allow-overflow-x')) continue;
    const sw = (el as HTMLElement).scrollWidth;
    const cw = (el as HTMLElement).clientWidth;
    if (cw <= 0) continue; // collapsed / hidden
    const delta = sw - cw;
    if (delta <= MIN_DELTA_PX) continue;

    const prior = seen.get(el);
    const now = performance.now();
    if (prior && Math.abs(prior.delta - delta) < 1 && now - prior.at < 5000) {
      continue; // already warned recently with same delta
    }
    seen.set(el, { delta, at: now });
    flagged += 1;

    // Outline the culprit so it's visible in the live DOM.
    const htmlEl = el as HTMLElement;
    const prevOutline = htmlEl.style.outline;
    htmlEl.style.outline = '2px solid red';
    htmlEl.style.outlineOffset = '-2px';
    // Restore after 4s so the page doesn't look permanently broken.
    setTimeout(() => {
      htmlEl.style.outline = prevOutline;
    }, 4000);

    // Structured console warn — DevTools will render `el` as
    // clickable, jumping straight to the offending node.
    // eslint-disable-next-line no-console
    console.warn(
      `[OverflowDetector] horizontal overflow +${delta}px on <${el.tagName.toLowerCase()}> — ${shortPath(el)}`,
      { element: el, scrollWidth: sw, clientWidth: cw, delta }
    );
  }
  if (flagged > 5) {
    // eslint-disable-next-line no-console
    console.warn(
      `[OverflowDetector] ${flagged} elements flagged in this pass. Likely a single root culprit cascading — check the outermost flagged ancestor first.`
    );
  }
}

export function OverflowDetector() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const seen = new WeakMap<Element, WarnRecord>();
    let pending: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => {
        pending = null;
        scanForOverflow(seen);
      }, DEBOUNCE_MS);
    };

    // Initial scan after first paint settles.
    const initial = setTimeout(() => scanForOverflow(seen), 600);

    // Re-scan on body resize (covers viewport changes, font load, lazy
    // content insertion).
    const ro = new ResizeObserver(schedule);
    ro.observe(document.body);

    // Also re-scan on full window resize for safety (covers cases
    // where the resize happens *outside* the body box, e.g. zoom).
    window.addEventListener('resize', schedule);

    return () => {
      clearTimeout(initial);
      if (pending) clearTimeout(pending);
      ro.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, []);

  return null;
}
