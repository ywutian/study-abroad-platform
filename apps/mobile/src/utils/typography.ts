/**
 * Mobile typography adapter backed by the shared semantic typography scale.
 */
import { typography as sharedTypography } from '@study-abroad/shared';
import { Dimensions, PixelRatio, TextStyle } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const scale = (size: number): number =>
  Math.round(PixelRatio.roundToNearestPixel(size * (SCREEN_WIDTH / 390)));

export const typography = {
  displayHero: {
    fontSize: scale(sharedTypography.displayHero.fontSize),
    fontWeight: sharedTypography.displayHero.fontWeight,
    lineHeight: scale(sharedTypography.displayHero.lineHeight),
    letterSpacing: sharedTypography.displayHero.letterSpacing,
  },
  displaySection: {
    fontSize: scale(sharedTypography.displaySection.fontSize),
    fontWeight: sharedTypography.displaySection.fontWeight,
    lineHeight: scale(sharedTypography.displaySection.lineHeight),
    letterSpacing: sharedTypography.displaySection.letterSpacing,
  },
  title: {
    fontSize: scale(sharedTypography.title.fontSize),
    fontWeight: sharedTypography.title.fontWeight,
    lineHeight: scale(sharedTypography.title.lineHeight),
    letterSpacing: sharedTypography.title.letterSpacing,
  },
  subtitle: {
    fontSize: scale(sharedTypography.subtitle.fontSize),
    fontWeight: sharedTypography.subtitle.fontWeight,
    lineHeight: scale(sharedTypography.subtitle.lineHeight),
    letterSpacing: sharedTypography.subtitle.letterSpacing,
  },
  bodyLg: {
    fontSize: scale(sharedTypography.bodyLg.fontSize),
    fontWeight: sharedTypography.bodyLg.fontWeight,
    lineHeight: scale(sharedTypography.bodyLg.lineHeight),
    letterSpacing: sharedTypography.bodyLg.letterSpacing,
  },
  body: {
    fontSize: scale(sharedTypography.body.fontSize),
    fontWeight: sharedTypography.body.fontWeight,
    lineHeight: scale(sharedTypography.body.lineHeight),
    letterSpacing: sharedTypography.body.letterSpacing,
  },
  bodySm: {
    fontSize: scale(sharedTypography.bodySm.fontSize),
    fontWeight: sharedTypography.bodySm.fontWeight,
    lineHeight: scale(sharedTypography.bodySm.lineHeight),
    letterSpacing: sharedTypography.bodySm.letterSpacing,
  },
  caption: {
    fontSize: scale(12),
    fontWeight: '400' as const,
    lineHeight: scale(20),
    letterSpacing: 0,
  },
  label: {
    fontSize: scale(sharedTypography.label.fontSize),
    fontWeight: sharedTypography.label.fontWeight,
    lineHeight: scale(sharedTypography.label.lineHeight),
    letterSpacing: sharedTypography.label.letterSpacing,
  },
  overline: {
    fontSize: scale(sharedTypography.overline.fontSize),
    fontWeight: sharedTypography.overline.fontWeight,
    lineHeight: scale(sharedTypography.overline.lineHeight),
    letterSpacing: sharedTypography.overline.letterSpacing,
    textTransform: sharedTypography.overline.textTransform,
  },
  metric: {
    fontSize: scale(sharedTypography.metric.fontSize),
    fontWeight: sharedTypography.metric.fontWeight,
    lineHeight: scale(sharedTypography.metric.lineHeight),
    letterSpacing: sharedTypography.metric.letterSpacing,
    fontVariant: ['tabular-nums'] as const,
  },
} as const;

export type TypographyKey = keyof typeof typography;
export type TypographyStyle = (typeof typography)[TypographyKey];

export function getTypography(key: TypographyKey): TextStyle {
  return typography[key] as TextStyle;
}

export { scale };
