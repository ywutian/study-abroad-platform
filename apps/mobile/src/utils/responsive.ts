/**
 * Responsive Design Utilities
 *
 * Breakpoints and responsive helpers for phone/tablet/iPad layouts.
 */
import { Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

/** Device type breakpoints */
export const breakpoints = {
  phone: width < 428,
  tablet: width >= 428 && width < 768,
  pad: width >= 768,
} as const;

/** Responsive grid column counts */
export const gridColumns = {
  actions: breakpoints.pad ? 4 : breakpoints.tablet ? 3 : 2,
  cards: breakpoints.pad ? 3 : 2,
  badges: breakpoints.pad ? 4 : 3,
  stats: breakpoints.pad ? 4 : breakpoints.tablet ? 3 : 2,
} as const;

/** Responsive spacing values */
export const responsiveSpacing = {
  pageHorizontal: breakpoints.pad ? 32 : 16,
  sectionGap: breakpoints.pad ? 40 : 24,
  cardGap: breakpoints.pad ? 16 : 12,
} as const;

/** Responsive modal width */
export const responsiveModal = {
  maxWidth: breakpoints.pad ? 560 : ('90%' as const),
} as const;
