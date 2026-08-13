/**
 * Mobile theme adapter backed by the shared design token source.
 */
import {
  DEFAULT_COLOR_PALETTE,
  admissionStatus,
  animation as sharedAnimation,
  borderRadius as sharedBorderRadius,
  colors as sharedColors,
  componentSize as sharedComponentSize,
  darkElevation as sharedDarkElevation,
  elevation as sharedElevation,
  fontSize as sharedFontSize,
  fontWeight as sharedFontWeight,
  getThemeAppearance,
  getMobileThemeContract,
  lineHeight as sharedLineHeight,
  opacity as sharedOpacity,
  parseColorPalette,
  semanticSurfaces,
  shadows as sharedShadows,
  spacing as sharedSpacing,
  type ColorPalette,
} from '@study-abroad/shared';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useThemeStore } from '@/stores/theme';
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';

type MobileThemeContract = ReturnType<typeof getMobileThemeContract>;
type SharedColorRow = MobileThemeContract['colors'];
type SharedSurfaceRow = MobileThemeContract['surfaces'];

function withMobileExtras(base: SharedColorRow, surfaces: SharedSurfaceRow, mode: ColorScheme) {
  const dark = mode === 'dark';
  return {
    ...base,
    successForeground: base.primaryForeground,
    warningForeground: dark ? base.primaryForeground : base.foreground,
    errorForeground: base.primaryForeground,
    infoForeground: base.primaryForeground,
    shadow: dark ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.08)',
    onGradient: base.primaryForeground,
    onGradientMuted: withOpacity(base.primaryForeground, 0.8),
    onGradientOverlay: withOpacity(base.primaryForeground, 0.2),
    surfaceMuted: surfaces.surfaceMuted,
    surfaceSubtle: surfaces.surfaceSubtle,
    infoSurface: surfaces.infoSurface,
  };
}

export const colors = {
  light: withMobileExtras(sharedColors.light, semanticSurfaces.light, 'light'),
  dark: withMobileExtras(sharedColors.dark, semanticSurfaces.dark, 'dark'),
} as const;

/**
 * Brand font families. `mono` = Geist Mono (loaded in app/_layout.tsx) — the
 * "Nocturne" signature for numerals (stats, day counts, tiers). Canonical
 * colors intentionally stay in the shared token source (see the
 * `no-shared-token-drift` rule); the redesign's warm dark-gold look comes from
 * the existing default palette.
 */
export const fontFamily = {
  mono: 'GeistMono',
} as const;

export function getPaletteColors(
  palette: ColorPalette = DEFAULT_COLOR_PALETTE,
  mode: ColorScheme = 'light'
) {
  const nextPalette = parseColorPalette(palette);
  if (nextPalette === DEFAULT_COLOR_PALETTE) {
    return mode === 'dark' ? colors.dark : colors.light;
  }

  const contract = getMobileThemeContract({ palette: nextPalette, mode });
  return withMobileExtras(contract.colors, contract.surfaces, mode);
}

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
  const colorScheme = useThemeStore((state) => state.colorScheme);
  const colorPalette = useThemeStore((state) => state.colorPalette);
  return getPaletteColors(colorPalette, colorScheme === 'dark' ? 'dark' : 'light');
}

export function useThemeAppearance() {
  const colorScheme = useThemeStore((state) => state.colorScheme);
  const colorPalette = useThemeStore((state) => state.colorPalette);
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  return getThemeAppearance(colorPalette, mode);
}

export function getMobileTheme(
  palette: ColorPalette = DEFAULT_COLOR_PALETTE,
  mode: ColorScheme = 'light'
) {
  return getMobileThemeContract({ palette: parseColorPalette(palette), mode });
}

export function useThemeContract() {
  const colorScheme = useThemeStore((state) => state.colorScheme);
  const colorPalette = useThemeStore((state) => state.colorPalette);
  return getMobileTheme(colorPalette, colorScheme === 'dark' ? 'dark' : 'light');
}

export function getColors(isDark?: boolean, palette: ColorPalette = DEFAULT_COLOR_PALETTE) {
  return getPaletteColors(palette, isDark ? 'dark' : 'light');
}

export function createStyles<T extends Record<string, ViewStyle | TextStyle | ImageStyle>>(
  stylesCreator: (theme: Colors) => T
) {
  return (isDark: boolean): T => {
    const theme: Colors = getColors(isDark);
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
