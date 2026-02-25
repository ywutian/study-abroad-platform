import type { ResumeSettings } from '@study-abroad/shared';
import type { ResumeTheme } from '../types';

/**
 * Apply user ResumeSettings on top of a resolved ResumeTheme.
 * Only overrides fields that are explicitly set (not undefined).
 * This is Layer 3 in the three-layer theme cascade:
 *   Layer 1: DEFAULT_THEME_BASE + color preset + font pairing
 *   Layer 2: Template overrides (TemplateDefinition.overrides)
 *   Layer 3: User settings (Resume.settings) ← this function
 */
export function applyUserSettings(baseTheme: ResumeTheme, settings?: ResumeSettings): ResumeTheme {
  if (!settings) return baseTheme;

  const result = { ...baseTheme };

  // Colors — direct mapping to theme color properties
  if (settings.colors) {
    const c = settings.colors;
    if (c.primary !== undefined) result.primary = c.primary;
    if (c.text !== undefined) result.text = c.text;
    if (c.textLight !== undefined) result.textLight = c.textLight;
    if (c.background !== undefined) result.background = c.background;
    if (c.border !== undefined) result.border = c.border;
    if (c.sidebarBg !== undefined) result.sidebarBg = c.sidebarBg;
    if (c.sidebarText !== undefined) result.sidebarText = c.sidebarText;
    if (c.headerBg !== undefined) result.headerBg = c.headerBg;
    if (c.headerText !== undefined) result.headerText = c.headerText;
  }

  // Fonts
  if (settings.fonts) {
    result.fontFamily = { ...result.fontFamily };
    if (settings.fonts.heading) result.fontFamily.heading = settings.fonts.heading;
    if (settings.fonts.body) result.fontFamily.body = settings.fonts.body;
  }

  // Font sizes
  if (settings.fontSize) {
    result.fontSize = { ...result.fontSize, ...pickDefined(settings.fontSize) };
  }

  // Spacing — flatten pageMarginX/Y back into nested page.{x,y} structure
  if (settings.spacing) {
    result.spacing = { ...result.spacing };
    result.spacing.page = { ...result.spacing.page };
    const s = settings.spacing;
    if (s.pageMarginX !== undefined) result.spacing.page.x = s.pageMarginX;
    if (s.pageMarginY !== undefined) result.spacing.page.y = s.pageMarginY;
    if (s.sectionGap !== undefined) result.spacing.sectionGap = s.sectionGap;
    if (s.itemGap !== undefined) result.spacing.itemGap = s.itemGap;
    if (s.lineHeight !== undefined) result.spacing.lineHeight = s.lineHeight;
  }

  // Decorations
  if (settings.decorations) {
    result.decorations = { ...result.decorations, ...pickDefined(settings.decorations) };
  }

  return result;
}

/** Remove undefined values from an object */
function pickDefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}
