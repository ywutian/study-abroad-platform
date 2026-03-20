/**
 * Glass Morphism System
 *
 * React Native has no backdrop-filter, so we approximate
 * glass effects with semi-transparent backgrounds + borders + shadows.
 *
 * For true blur, use expo-blur's BlurView in supported scenarios
 * (Modal backdrops, Tab Bar backgrounds).
 */
import { ViewStyle } from 'react-native';

const baseShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
};

export const glass = {
  light: {
    /** Subtle glass — list items, chips */
    subtle: {
      backgroundColor: 'rgba(255,255,255,0.60)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.20)',
      ...baseShadow,
      shadowRadius: 3,
      shadowOpacity: 0.08,
      elevation: 2,
    } as ViewStyle,
    /** Medium glass — cards on gradient backgrounds */
    medium: {
      backgroundColor: 'rgba(255,255,255,0.80)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.30)',
      ...baseShadow,
      shadowRadius: 12,
      shadowOpacity: 0.1,
      elevation: 4,
    } as ViewStyle,
    /** Premium glass — hero stats, featured cards */
    premium: {
      backgroundColor: 'rgba(255,255,255,0.72)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.25)',
      ...baseShadow,
      shadowOffset: { width: 0, height: 8 },
      shadowRadius: 24,
      shadowOpacity: 0.12,
      elevation: 8,
    } as ViewStyle,
  },
  dark: {
    /** Subtle glass — list items, chips */
    subtle: {
      backgroundColor: 'rgba(30,41,59,0.65)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.06)',
    } as ViewStyle,
    /** Medium glass — cards on gradient backgrounds */
    medium: {
      backgroundColor: 'rgba(30,41,59,0.85)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.10)',
    } as ViewStyle,
    /** Premium glass — hero stats, featured cards */
    premium: {
      backgroundColor: 'rgba(30,41,59,0.75)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    } as ViewStyle,
  },
} as const;

export type GlassLevel = 'subtle' | 'medium' | 'premium';

/**
 * Get glass style for current theme.
 */
export function getGlass(isDark: boolean, level: GlassLevel = 'subtle'): ViewStyle {
  return isDark ? glass.dark[level] : glass.light[level];
}
