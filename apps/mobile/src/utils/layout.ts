/**
 * Shared Layout Utilities
 *
 * Common flex/padding patterns extracted to eliminate
 * repetitive inline style definitions across screens.
 */
import { ViewStyle } from 'react-native';
import { spacing } from './theme';

/** Common flex layout combinations */
export const layout = {
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' } as ViewStyle,
  row: { flexDirection: 'row', alignItems: 'center' } as ViewStyle,
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as ViewStyle,
  rowEnd: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  } as ViewStyle,
  column: { flexDirection: 'column' } as ViewStyle,
  fill: { flex: 1 } as ViewStyle,
  fillCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' } as ViewStyle,
} as const;

/** Common padding presets */
export const padding = {
  /** Standard page horizontal padding (16px) */
  page: { paddingHorizontal: spacing.lg } as ViewStyle,
  /** Section padding (16px horizontal, 24px vertical) */
  section: { paddingHorizontal: spacing.lg, paddingVertical: spacing['2xl'] } as ViewStyle,
  /** Card internal padding (16px) */
  card: { padding: spacing.lg } as ViewStyle,
  /** Large card padding (24px) */
  cardLg: { padding: spacing['2xl'] } as ViewStyle,
} as const;
