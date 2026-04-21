/**
 * Shared design tokens for Web and Mobile.
 *
 * The goal is to keep one semantic source of truth for page shells, status tiers,
 * radii, shadows, and typography tiers while still exposing compatibility exports
 * used throughout the existing codebase.
 */

export type ThemeMode = 'light' | 'dark';

export const colors = {
  light: {
    primary: '#5b66f6',
    primaryForeground: '#ffffff',
    background: '#fafbfd',
    backgroundSecondary: '#f5f7fb',
    backgroundTertiary: '#eef2f6',
    foreground: '#111827',
    foregroundSecondary: '#475467',
    foregroundMuted: '#6b7280',
    card: '#ffffff',
    cardForeground: '#111827',
    border: '#d9e2ec',
    borderLight: '#ebf0f5',
    borderStrong: '#c6d0db',
    muted: '#f3f5f8',
    mutedForeground: '#5f6b7a',
    accent: '#eef2ff',
    accentForeground: '#334155',
    success: '#3a9564',
    warning: '#b9852f',
    error: '#bc4b45',
    info: '#4a81ae',
    violet: '#7b72ff',
    pink: '#d86b9f',
    input: '#f5f7fb',
    inputBorder: '#d9e2ec',
    inputFocus: '#5b66f6',
    placeholder: '#93a0b0',
    overlay: 'rgba(15, 23, 42, 0.5)',
  },
  dark: {
    primary: '#8590ff',
    primaryForeground: '#101726',
    background: '#101726',
    backgroundSecondary: '#141d2d',
    backgroundTertiary: '#1d2739',
    foreground: '#f5f7fb',
    foregroundSecondary: '#d0d8e4',
    foregroundMuted: '#9aa7b8',
    card: '#161f2f',
    cardForeground: '#f5f7fb',
    border: '#283142',
    borderLight: '#202939',
    borderStrong: '#394255',
    muted: '#1b2435',
    mutedForeground: '#aeb8c7',
    accent: '#202a3d',
    accentForeground: '#e6ebf3',
    success: '#64bb84',
    warning: '#d4aa59',
    error: '#d96a63',
    info: '#75abd2',
    violet: '#9f98ff',
    pink: '#f093ba',
    input: '#1b2435',
    inputBorder: '#283142',
    inputFocus: '#8590ff',
    placeholder: '#6f7d90',
    overlay: 'rgba(0, 0, 0, 0.68)',
  },
} as const;

export const semanticSurfaces = {
  light: {
    surface: colors.light.card,
    surfaceMuted: colors.light.muted,
    surfaceSubtle: '#fbfcfd',
    border: colors.light.border,
    borderStrong: colors.light.borderStrong,
    infoSurface: '#eef4f8',
  },
  dark: {
    surface: colors.dark.card,
    surfaceMuted: colors.dark.muted,
    surfaceSubtle: '#121a2a',
    border: colors.dark.border,
    borderStrong: colors.dark.borderStrong,
    infoSurface: '#1a293a',
  },
} as const;

export const admissionStatus = {
  light: {
    reach: {
      value: colors.light.error,
      bg: '#f9eeeb',
      fg: '#8e3a32',
    },
    target: {
      value: colors.light.warning,
      bg: '#f7f0de',
      fg: '#7c5619',
    },
    safety: {
      value: colors.light.success,
      bg: '#ebf6ef',
      fg: '#2d6e47',
    },
    likely: {
      value: colors.light.primary,
      bg: '#eef0ff',
      fg: '#3f49cc',
    },
  },
  dark: {
    reach: {
      value: '#ef8a82',
      bg: 'rgba(217, 106, 99, 0.18)',
      fg: '#ffd5cf',
    },
    target: {
      value: '#e1b664',
      bg: 'rgba(212, 170, 89, 0.18)',
      fg: '#f9e5b6',
    },
    safety: {
      value: '#82cb9f',
      bg: 'rgba(100, 187, 132, 0.18)',
      fg: '#d8f4df',
    },
    likely: {
      value: colors.dark.primary,
      bg: 'rgba(133, 144, 255, 0.18)',
      fg: '#e0e4ff',
    },
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 46,
} as const;

export const fontWeight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const lineHeight = {
  tight: 1.25,
  snug: 1.35,
  normal: 1.5,
  relaxed: 1.625,
  loose: 1.75,
} as const;

export const typography = {
  displayHero: {
    fontSize: fontSize['5xl'],
    lineHeight: 54,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.92,
  },
  displaySection: {
    fontSize: fontSize['4xl'],
    lineHeight: 42,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.68,
  },
  titleLg: {
    fontSize: fontSize['3xl'],
    lineHeight: 36,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.51,
  },
  title: {
    fontSize: fontSize['2xl'],
    lineHeight: 30,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.34,
  },
  subtitle: {
    fontSize: fontSize.xl,
    lineHeight: 28,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.2,
  },
  bodyLg: {
    fontSize: fontSize.lg,
    lineHeight: 29,
    fontWeight: fontWeight.normal,
    letterSpacing: -0.18,
  },
  body: {
    fontSize: fontSize.base,
    lineHeight: 26,
    fontWeight: fontWeight.normal,
    letterSpacing: -0.12,
  },
  bodySm: {
    fontSize: fontSize.sm,
    lineHeight: 22,
    fontWeight: fontWeight.normal,
    letterSpacing: -0.08,
  },
  label: {
    fontSize: fontSize.sm,
    lineHeight: 22,
    fontWeight: fontWeight.medium,
    letterSpacing: -0.08,
  },
  overline: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.66,
    textTransform: 'uppercase' as const,
  },
  metric: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.64,
  },
} as const;

export const borderRadius = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
} as const;

export const shadowTokens = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    shadowOpacity: {
      light: 0.05,
      dark: 0.3,
    },
    elevation: {
      light: 1,
      dark: 1,
    },
    css: {
      light: '0 1px 2px oklch(0 0 0 / 5%)',
      dark: '0 1px 2px oklch(0 0 0 / 30%)',
    },
  },
  elevated: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    shadowOpacity: {
      light: 0.08,
      dark: 0.35,
    },
    elevation: {
      light: 2,
      dark: 2,
    },
    css: {
      light: '0 2px 8px oklch(0 0 0 / 8%)',
      dark: '0 2px 8px oklch(0 0 0 / 35%)',
    },
  },
} as const;

const cardShadowStyle = {
  shadowOffset: shadowTokens.card.shadowOffset,
  shadowRadius: shadowTokens.card.shadowRadius,
  shadowOpacity: shadowTokens.card.shadowOpacity.light,
  elevation: shadowTokens.card.elevation.light,
} as const;

const elevatedShadowStyle = {
  shadowOffset: shadowTokens.elevated.shadowOffset,
  shadowRadius: shadowTokens.elevated.shadowRadius,
  shadowOpacity: shadowTokens.elevated.shadowOpacity.light,
  elevation: shadowTokens.elevated.elevation.light,
} as const;

export const shadows = {
  sm: cardShadowStyle,
  md: elevatedShadowStyle,
  lg: elevatedShadowStyle,
  xl: elevatedShadowStyle,
} as const;

export const elevation = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  card: {
    shadowColor: shadowTokens.card.shadowColor,
    ...cardShadowStyle,
  },
  elevated: {
    shadowColor: shadowTokens.elevated.shadowColor,
    ...elevatedShadowStyle,
  },
  sm: {
    shadowColor: shadowTokens.card.shadowColor,
    ...cardShadowStyle,
  },
  md: {
    shadowColor: shadowTokens.elevated.shadowColor,
    ...elevatedShadowStyle,
  },
  lg: {
    shadowColor: shadowTokens.elevated.shadowColor,
    ...elevatedShadowStyle,
  },
  xl: {
    shadowColor: shadowTokens.elevated.shadowColor,
    ...elevatedShadowStyle,
  },
} as const;

export const darkElevation = {
  card: {
    ...elevation.card,
    shadowOpacity: shadowTokens.card.shadowOpacity.dark,
    elevation: shadowTokens.card.elevation.dark,
  },
  elevated: {
    ...elevation.elevated,
    shadowOpacity: shadowTokens.elevated.shadowOpacity.dark,
    elevation: shadowTokens.elevated.elevation.dark,
  },
  sm: {
    ...elevation.card,
    shadowOpacity: shadowTokens.card.shadowOpacity.dark,
    elevation: shadowTokens.card.elevation.dark,
  },
  md: {
    ...elevation.elevated,
    shadowOpacity: shadowTokens.elevated.shadowOpacity.dark,
    elevation: shadowTokens.elevated.elevation.dark,
  },
  lg: {
    ...elevation.elevated,
    shadowOpacity: shadowTokens.elevated.shadowOpacity.dark,
    elevation: shadowTokens.elevated.elevation.dark,
  },
  xl: {
    ...elevation.elevated,
    shadowOpacity: shadowTokens.elevated.shadowOpacity.dark,
    elevation: shadowTokens.elevated.elevation.dark,
  },
} as const;

export const animation = {
  duration: {
    instant: 100,
    fast: 150,
    normal: 200,
    slow: 300,
    slower: 500,
  },
  easing: {
    easeIn: [0.4, 0, 1, 1] as const,
    easeOut: [0, 0, 0.2, 1] as const,
    easeInOut: [0.4, 0, 0.2, 1] as const,
    spring: { damping: 15, stiffness: 150 },
    css: {
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
  },
  presets: {
    fadeIn: { duration: 200, easing: 'easeOut' },
    fadeOut: { duration: 150, easing: 'easeIn' },
    scaleIn: { duration: 200, easing: 'easeOut' },
    slideUp: { duration: 300, easing: 'easeOut' },
    slideDown: { duration: 200, easing: 'easeIn' },
  },
  stagger: {
    fast: 30,
    normal: 50,
    slow: 80,
  },
  spring: {
    gentle: { damping: 15, stiffness: 150 },
    snappy: { damping: 20, stiffness: 300 },
    bouncy: { damping: 10, stiffness: 200 },
  },
  pressScale: {
    button: 0.96,
    card: 0.98,
    icon: 0.9,
    tab: 0.92,
  },
} as const;

export const componentSize = {
  avatarXs: 24,
  avatarSm: 32,
  avatarMd: 40,
  avatarLg: 56,
  avatarXl: 80,
  iconSm: 36,
  iconMd: 44,
  iconLg: 56,
  buttonSm: 36,
  buttonMd: 44,
  buttonLg: 52,
  touchTarget: 44,
} as const;

export const opacity = {
  '05': 0.05,
  '08': 0.08,
  '10': 0.1,
  '12': 0.12,
  '15': 0.15,
  '20': 0.2,
  '30': 0.3,
  '35': 0.35,
  '50': 0.5,
  '70': 0.7,
} as const;

export const pageShellVariants = {
  marketing: {
    surfaceRole: 'canvas',
    maxWidth: 'wide',
  },
  entry: {
    surfaceRole: 'entry',
    maxWidth: 'medium',
  },
  tool: {
    surfaceRole: 'tool',
    maxWidth: 'wide',
  },
  ai: {
    surfaceRole: 'ai',
    maxWidth: 'wide',
  },
  community: {
    surfaceRole: 'community',
    maxWidth: 'wide',
  },
  admin: {
    surfaceRole: 'admin',
    maxWidth: 'fluid',
  },
} as const;

export const zIndex = {
  hide: -1,
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  fixed: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  tooltip: 1600,
  toast: 1700,
} as const;

export const transition = {
  fast: '150ms',
  normal: '200ms',
  slow: '300ms',
  slower: '500ms',
} as const;

export const webThemeCssVars = {
  light: {
    '--ds-radius': '0.75rem',
    '--ds-primary': 'oklch(0.58 0.22 255)',
    '--ds-primary-foreground': 'oklch(0.99 0 0)',
    '--ds-secondary': 'oklch(0.965 0.008 260)',
    '--ds-secondary-foreground': 'oklch(0.30 0.04 260)',
    '--ds-success': 'oklch(0.68 0.18 155)',
    '--ds-success-foreground': 'oklch(0.99 0 0)',
    '--ds-warning': 'oklch(0.78 0.15 75)',
    '--ds-warning-foreground': 'oklch(0.20 0 0)',
    '--ds-destructive': 'oklch(0.60 0.20 25)',
    '--ds-destructive-foreground': 'oklch(0.99 0 0)',
    '--ds-info': 'oklch(0.62 0.16 200)',
    '--ds-info-foreground': 'oklch(0.99 0 0)',
    '--ds-background': 'oklch(0.988 0.002 260)',
    '--ds-foreground': 'oklch(0.12 0.02 260)',
    '--ds-card': 'oklch(1 0 0)',
    '--ds-card-foreground': 'oklch(0.12 0.02 260)',
    '--ds-popover': 'oklch(1 0 0)',
    '--ds-popover-foreground': 'oklch(0.12 0.02 260)',
    '--ds-muted': 'oklch(0.965 0.005 260)',
    '--ds-muted-foreground': 'oklch(0.48 0.02 260)',
    '--ds-accent': 'oklch(0.96 0.015 260)',
    '--ds-accent-foreground': 'oklch(0.20 0.08 260)',
    '--ds-border': 'oklch(0.92 0.008 260)',
    '--ds-border-strong': 'oklch(0.85 0.012 260)',
    '--ds-input': 'oklch(0.92 0.008 260)',
    '--ds-ring': 'oklch(0.58 0.22 255)',
    '--ds-shadow-card': shadowTokens.card.css.light,
    '--ds-shadow-elevated': shadowTokens.elevated.css.light,
    '--ds-status-reach': 'var(--ds-destructive)',
    '--ds-status-reach-bg': 'color-mix(in oklab, var(--ds-destructive) 12%, var(--ds-card))',
    '--ds-status-reach-fg': 'color-mix(in oklab, var(--ds-destructive) 72%, var(--ds-foreground))',
    '--ds-status-target': 'var(--ds-warning)',
    '--ds-status-target-bg': 'color-mix(in oklab, var(--ds-warning) 14%, var(--ds-card))',
    '--ds-status-target-fg': 'color-mix(in oklab, var(--ds-warning) 68%, var(--ds-foreground))',
    '--ds-status-safety': 'var(--ds-success)',
    '--ds-status-safety-bg': 'color-mix(in oklab, var(--ds-success) 12%, var(--ds-card))',
    '--ds-status-safety-fg': 'color-mix(in oklab, var(--ds-success) 70%, var(--ds-foreground))',
    '--ds-status-likely': 'var(--ds-primary)',
    '--ds-status-likely-bg': 'color-mix(in oklab, var(--ds-primary) 10%, var(--ds-card))',
    '--ds-status-likely-fg': 'color-mix(in oklab, var(--ds-primary) 72%, var(--ds-foreground))',
    '--ds-surface-muted': 'oklch(0.972 0.007 260)',
    '--ds-surface-subtle': 'oklch(0.985 0.004 260)',
    '--ds-info-surface': 'oklch(0.96 0.04 200)',
  },
  dark: {
    '--ds-radius': '0.75rem',
    '--ds-primary': 'oklch(0.68 0.20 255)',
    '--ds-primary-foreground': 'oklch(0.12 0.02 260)',
    '--ds-secondary': 'oklch(0.20 0.015 260)',
    '--ds-secondary-foreground': 'oklch(0.90 0.01 260)',
    '--ds-success': 'oklch(0.72 0.16 155)',
    '--ds-success-foreground': 'oklch(0.10 0.015 260)',
    '--ds-warning': 'oklch(0.80 0.14 75)',
    '--ds-warning-foreground': 'oklch(0.10 0.015 260)',
    '--ds-destructive': 'oklch(0.65 0.18 25)',
    '--ds-destructive-foreground': 'oklch(0.99 0 0)',
    '--ds-info': 'oklch(0.72 0.14 200)',
    '--ds-info-foreground': 'oklch(0.10 0.015 260)',
    '--ds-background': 'oklch(0.11 0.015 260)',
    '--ds-foreground': 'oklch(0.96 0.008 260)',
    '--ds-card': 'oklch(0.16 0.018 260)',
    '--ds-card-foreground': 'oklch(0.96 0.008 260)',
    '--ds-popover': 'oklch(0.16 0.018 260)',
    '--ds-popover-foreground': 'oklch(0.96 0.008 260)',
    '--ds-muted': 'oklch(0.20 0.015 260)',
    '--ds-muted-foreground': 'oklch(0.70 0.012 260)',
    '--ds-accent': 'oklch(0.24 0.02 260)',
    '--ds-accent-foreground': 'oklch(0.90 0.01 260)',
    '--ds-border': 'oklch(0.22 0.01 260)',
    '--ds-border-strong': 'oklch(0.32 0.012 260)',
    '--ds-input': 'oklch(0.22 0.01 260)',
    '--ds-ring': 'oklch(0.68 0.20 255)',
    '--ds-shadow-card': shadowTokens.card.css.dark,
    '--ds-shadow-elevated': shadowTokens.elevated.css.dark,
    '--ds-status-reach': 'var(--ds-destructive)',
    '--ds-status-reach-bg': 'color-mix(in oklab, var(--ds-destructive) 12%, var(--ds-card))',
    '--ds-status-reach-fg': 'color-mix(in oklab, var(--ds-destructive) 72%, var(--ds-foreground))',
    '--ds-status-target': 'var(--ds-warning)',
    '--ds-status-target-bg': 'color-mix(in oklab, var(--ds-warning) 14%, var(--ds-card))',
    '--ds-status-target-fg': 'color-mix(in oklab, var(--ds-warning) 68%, var(--ds-foreground))',
    '--ds-status-safety': 'var(--ds-success)',
    '--ds-status-safety-bg': 'color-mix(in oklab, var(--ds-success) 12%, var(--ds-card))',
    '--ds-status-safety-fg': 'color-mix(in oklab, var(--ds-success) 70%, var(--ds-foreground))',
    '--ds-status-likely': 'var(--ds-primary)',
    '--ds-status-likely-bg': 'color-mix(in oklab, var(--ds-primary) 10%, var(--ds-card))',
    '--ds-status-likely-fg': 'color-mix(in oklab, var(--ds-primary) 72%, var(--ds-foreground))',
    '--ds-surface-muted': 'oklch(0.18 0.018 260)',
    '--ds-surface-subtle': 'oklch(0.14 0.016 260)',
    '--ds-info-surface': 'oklch(0.22 0.04 200)',
  },
} as const;

export function serializeCssVars(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([key, value]) => `${key}:${value};`)
    .join('');
}

export function getThemeCssText(): string {
  return `:root{${serializeCssVars(webThemeCssVars.light)}}.dark{${serializeCssVars(
    webThemeCssVars.dark
  )}}`;
}

export const cssVars = {
  '--spacing-xs': '0.25rem',
  '--spacing-sm': '0.5rem',
  '--spacing-md': '0.75rem',
  '--spacing-lg': '1rem',
  '--spacing-xl': '1.25rem',
  '--spacing-2xl': '1.5rem',
  '--spacing-3xl': '2rem',
  '--spacing-4xl': '2.5rem',
  '--spacing-5xl': '3rem',
  '--radius-sm': '0.5rem',
  '--radius-md': '0.75rem',
  '--radius-lg': '1rem',
  '--radius-xl': '1.25rem',
  '--radius-2xl': '1.5rem',
  '--radius-full': '9999px',
  '--shadow-card': 'var(--ds-shadow-card)',
  '--shadow-elevated': 'var(--ds-shadow-elevated)',
} as const;

export function spacingToRem(key: keyof typeof spacing): string {
  return `${spacing[key] / 16}rem`;
}

export function getColor(colorScheme: ColorScheme, colorKey: keyof Colors): string {
  return colors[colorScheme][colorKey];
}

export function getAdmissionStatus(
  colorScheme: ColorScheme,
  tier: keyof (typeof admissionStatus)['light']
) {
  return admissionStatus[colorScheme][tier];
}

export type ColorScheme = ThemeMode;
export type Colors = typeof colors.light;
export type Spacing = keyof typeof spacing;
export type BorderRadius = keyof typeof borderRadius;
export type FontSize = keyof typeof fontSize;
export type FontWeight = keyof typeof fontWeight;
