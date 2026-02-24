import type { ResumeTheme, ThemeId, FontPairingId } from '../types';
import { THEME_PRESETS } from './presets';
import { FONT_PAIRINGS } from '../fonts/register';

// Default spacing/typography values — merged with color presets
const DEFAULT_THEME_BASE: Omit<
  ResumeTheme,
  | 'primary'
  | 'secondary'
  | 'background'
  | 'sidebarBg'
  | 'sidebarText'
  | 'headerBg'
  | 'headerText'
  | 'text'
  | 'textLight'
  | 'border'
> = {
  fontFamily: { heading: 'Helvetica', body: 'Helvetica' },
  fontSize: { name: 22, sectionTitle: 12, body: 10, small: 8.5 },
  spacing: {
    page: { x: 36, y: 36 }, // 0.5 inch
    sectionGap: 10,
    itemGap: 6,
    lineHeight: 1.3,
    sidebarWidth: '30%',
  },
  decorations: {
    sectionDivider: 'line',
    headingStyle: 'underline',
    bulletStyle: 'disc',
    borderRadius: 0,
    showIcons: false,
    pageSize: 'LETTER',
    dateFormat: 'MMM YYYY',
  },
};

/**
 * Build a full ResumeTheme from a ThemeId + FontPairingId + optional overrides.
 */
export function buildTheme(
  themeId: ThemeId,
  fontPairingId: FontPairingId = 'helvetica',
  overrides?: Partial<ResumeTheme>
): ResumeTheme {
  const preset = THEME_PRESETS[themeId];
  const fontPair = FONT_PAIRINGS[fontPairingId];

  const base: ResumeTheme = {
    ...DEFAULT_THEME_BASE,
    primary: preset.primary,
    secondary: preset.secondary,
    background: preset.background,
    sidebarBg: preset.sidebarBg,
    sidebarText: preset.sidebarText,
    headerBg: preset.headerBg,
    headerText: preset.headerText,
    text: preset.text,
    textLight: preset.textLight,
    border: preset.border,
    fontFamily: {
      heading: fontPair.heading,
      body: fontPair.body,
    },
  };

  if (!overrides) return base;

  // Deep merge overrides
  return {
    ...base,
    ...overrides,
    fontFamily: { ...base.fontFamily, ...overrides.fontFamily },
    fontSize: { ...base.fontSize, ...overrides.fontSize },
    spacing: {
      ...base.spacing,
      ...overrides.spacing,
      page: { ...base.spacing.page, ...overrides.spacing?.page },
    },
    decorations: { ...base.decorations, ...overrides.decorations },
  };
}

export { THEME_PRESETS } from './presets';
