import { THEME_CSS_TEXT } from '@/lib/theme-css';

// Generated at build time from constants — nothing per-request about it.
export const dynamic = 'force-static';

/**
 * The full palette sheet. `[locale]/layout.tsx` inlines only
 * CRITICAL_COLOR_PALETTE_IDS and links here for the remaining ~144, which are
 * all still user-selectable (settings page + the palette menu's "all" tab and
 * search). Inlining all 160 put ~1.82 MB in front of the LCP element and a
 * second copy in the RSC flight, on a document served `no-store`.
 *
 * The href carries a content hash (see lib/theme-css.ts), so `immutable` is
 * safe. `/theme.css` must stay in proxy.ts's matcher exclusions or it gets
 * 307'd to `/{locale}/theme.css` — the same trap that pinned stale service
 * workers in the 2026-06 incident.
 */
export function GET() {
  return new Response(THEME_CSS_TEXT, {
    headers: {
      'content-type': 'text/css; charset=utf-8',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
