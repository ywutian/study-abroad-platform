/**
 * Enterprise Typography System
 *
 * Responsive scaling based on 390px (iPhone 14) baseline.
 * Negative letter-spacing for headings creates premium brand feel.
 * Body line-height 1.625x matches web design system.
 */
import { Dimensions, PixelRatio, TextStyle } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Scale font sizes proportionally to screen width.
 * Base: 390px (iPhone 14).
 */
const scale = (size: number): number =>
  Math.round(PixelRatio.roundToNearestPixel(size * (SCREEN_WIDTH / 390)));

export const typography = {
  /** Hero display — splash, onboarding, celebrations */
  displayHero: {
    fontSize: scale(36),
    fontWeight: '700' as const,
    lineHeight: scale(40),
    letterSpacing: -0.72,
  },
  /** Section display — page heroes, major sections */
  displaySection: {
    fontSize: scale(30),
    fontWeight: '700' as const,
    lineHeight: scale(36),
    letterSpacing: -0.51,
  },
  /** Page title */
  title: {
    fontSize: scale(24),
    fontWeight: '600' as const,
    lineHeight: scale(30),
    letterSpacing: -0.41,
  },
  /** Section subtitle */
  subtitle: {
    fontSize: scale(20),
    fontWeight: '600' as const,
    lineHeight: scale(27),
    letterSpacing: -0.34,
  },
  /** Large body text — featured paragraphs */
  bodyLg: {
    fontSize: scale(18),
    fontWeight: '400' as const,
    lineHeight: scale(29),
    letterSpacing: -0.2,
  },
  /** Standard body text */
  body: {
    fontSize: scale(16),
    fontWeight: '400' as const,
    lineHeight: scale(26),
    letterSpacing: -0.18,
  },
  /** Small body text */
  bodySm: {
    fontSize: scale(14),
    fontWeight: '400' as const,
    lineHeight: scale(22),
    letterSpacing: -0.08,
  },
  /** Captions, timestamps, hints */
  caption: {
    fontSize: scale(12),
    fontWeight: '400' as const,
    lineHeight: scale(20),
    letterSpacing: 0,
  },
  /** Form labels, navigation items */
  label: {
    fontSize: scale(14),
    fontWeight: '500' as const,
    lineHeight: scale(22),
    letterSpacing: -0.08,
  },
  /** Overline text — section markers, categories */
  overline: {
    fontSize: scale(11),
    fontWeight: '600' as const,
    lineHeight: scale(16),
    letterSpacing: 0.66,
    textTransform: 'uppercase' as const,
  },
  /** Metric numbers — stats, counters, scores */
  metric: {
    fontSize: scale(32),
    fontWeight: '700' as const,
    lineHeight: scale(38),
    letterSpacing: -0.64,
    fontVariant: ['tabular-nums'] as const,
  },
} as const;

export type TypographyKey = keyof typeof typography;
export type TypographyStyle = (typeof typography)[TypographyKey];

/**
 * Get a typography style by key. Useful for dynamic typography selection.
 */
export function getTypography(key: TypographyKey): TextStyle {
  return typography[key] as TextStyle;
}

export { scale };
