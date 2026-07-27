import { createHash } from 'node:crypto';

import { getThemeCssText } from '@study-abroad/shared';

/** All 160 palettes. Served by `app/theme.css/route.ts`, never inlined. */
export const THEME_CSS_TEXT = getThemeCssText();

/**
 * Content hash rather than the build id: the href changes only when the palette
 * definitions actually change, so `immutable` is safe *and* a deploy that does
 * not touch tokens.ts keeps every visitor's cached copy. Using the build id
 * would bust the cache on every deploy for no reason.
 */
export const THEME_CSS_HREF = `/theme.css?v=${createHash('sha256')
  .update(THEME_CSS_TEXT)
  .digest('hex')
  .slice(0, 12)}`;
