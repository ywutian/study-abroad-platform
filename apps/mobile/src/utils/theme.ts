/**
 * Mobile theme adapter backed by the shared design token source.
 */
import {
  admissionStatus,
  animation as sharedAnimation,
  borderRadius as sharedBorderRadius,
  colors as sharedColors,
  componentSize as sharedComponentSize,
  darkElevation as sharedDarkElevation,
  elevation as sharedElevation,
  fontSize as sharedFontSize,
  fontWeight as sharedFontWeight,
  lineHeight as sharedLineHeight,
  opacity as sharedOpacity,
  semanticSurfaces,
  shadows as sharedShadows,
  spacing as sharedSpacing,
} from '@study-abroad/shared';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useThemeStore } from '@/stores/theme';

export const colors = {
  light: {
    ...sharedColors.light,
    successForeground: '#ffffff',
    warningForeground: '#111827',
    errorForeground: '#ffffff',
    infoForeground: '#ffffff',
    shadow: 'rgba(0, 0, 0, 0.08)',
    onGradient: '#ffffff',
    onGradientMuted: 'rgba(255, 255, 255, 0.8)',
    onGradientOverlay: 'rgba(255, 255, 255, 0.2)',
    surfaceMuted: semanticSurfaces.light.surfaceMuted,
    surfaceSubtle: semanticSurfaces.light.surfaceSubtle,
    infoSurface: semanticSurfaces.light.infoSurface,
  },
  dark: {
    ...sharedColors.dark,
    successForeground: '#101726',
    warningForeground: '#101726',
    errorForeground: '#101726',
    infoForeground: '#101726',
    shadow: 'rgba(0, 0, 0, 0.35)',
    onGradient: '#ffffff',
    onGradientMuted: 'rgba(255, 255, 255, 0.8)',
    onGradientOverlay: 'rgba(255, 255, 255, 0.2)',
    surfaceMuted: semanticSurfaces.dark.surfaceMuted,
    surfaceSubtle: semanticSurfaces.dark.surfaceSubtle,
    infoSurface: semanticSurfaces.dark.infoSurface,
  },
} as const;

export const statusColors = admissionStatus;
export const spacing = sharedSpacing;
export const fontSize = sharedFontSize;
export const fontWeight = sharedFontWeight;
export const borderRadius = sharedBorderRadius;
export const lineHeight = sharedLineHeight;
export const animation = sharedAnimation;
export const shadows = sharedShadows;
export const elevation = sharedElevation;
export const darkElevation = sharedDarkElevation;
export const componentSize = sharedComponentSize;
export const opacity = sharedOpacity;

/**
 * Append an alpha hex suffix to a #RRGGBB color string.
 */
export function withOpacity(color: string, alpha: number): string {
  const hex = Math.round(Math.min(Math.max(alpha, 0), 1) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${color}${hex}`;
}

export function useColors() {
  try {
    const colorScheme = useThemeStore((state) => state.colorScheme);
    return colorScheme === 'dark' ? colors.dark : colors.light;
  } catch {
    return colors.light;
  }
}

export function getColors(isDark?: boolean) {
  return isDark ? colors.dark : colors.light;
}

export function createStyles<T extends Record<string, any>>(stylesCreator: (theme: Colors) => T) {
  return (isDark: boolean): T => {
    const theme: Colors = isDark ? colors.dark : colors.light;
    return stylesCreator(theme);
  };
}

export function useAnimationConfig() {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) {
    return {
      duration: { instant: 0, fast: 0, normal: 0, slow: 0, slower: 0 },
      spring: {
        gentle: { damping: 20, stiffness: 400 },
        snappy: { damping: 20, stiffness: 400 },
        bouncy: { damping: 20, stiffness: 400 },
      },
      stagger: { fast: 0, normal: 0, slow: 0 },
      pressScale: { button: 1, card: 1, icon: 1, tab: 1 },
    } as const;
  }

  return animation;
}

export type ColorScheme = 'light' | 'dark';
export type Colors = { [K in keyof typeof colors.light]: string };
export type Spacing = keyof typeof spacing;
export type BorderRadius = keyof typeof borderRadius;
export type FontSize = keyof typeof fontSize;
export type FontWeight = keyof typeof fontWeight;
