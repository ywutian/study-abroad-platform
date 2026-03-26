/**
 * Mobile 主题 - 与 Web 端保持一致
 *
 * 注：颜色值与 packages/shared/src/design/tokens.ts 保持同步
 * Web 使用 oklch，Mobile 使用对应的 Hex 值
 */
import { useReducedMotion } from 'react-native-reanimated';
import { useThemeStore } from '@/stores/theme';

// ==================== 颜色系统 ====================
// oklch -> Hex 对照：
// oklch(0.55 0.22 265) -> #6366f1 (primary light)
// oklch(0.65 0.18 265) -> #818cf8 (primary dark)

export const colors = {
  light: {
    // Brand
    primary: '#6366f1',
    primaryForeground: '#ffffff',

    // Background
    background: '#fafbfc', // oklch(0.985 0.003 265)
    backgroundSecondary: '#f8fafc',
    backgroundTertiary: '#f1f5f9',

    // Foreground
    foreground: '#0f172a',
    foregroundSecondary: '#475569',
    foregroundMuted: '#94a3b8',

    // Cards
    card: '#ffffff',
    cardForeground: '#0f172a',

    // Border
    border: '#e2e8f0',
    borderLight: '#f1f5f9',

    // States
    success: '#10b981',
    successForeground: '#ffffff',
    warning: '#f59e0b',
    warningForeground: '#0f172a',
    error: '#ef4444',
    errorForeground: '#ffffff',
    info: '#3b82f6',
    infoForeground: '#ffffff',

    // Input
    input: '#f1f5f9',
    inputBorder: '#e2e8f0',
    inputFocus: '#6366f1',
    placeholder: '#94a3b8',

    // Special
    accent: '#6366f1',
    accentForeground: '#ffffff',
    muted: '#f1f5f9',
    mutedForeground: '#64748b',

    // Extended palette
    violet: '#8b5cf6',
    pink: '#ec4899',

    // Overlay & Shadow
    overlay: 'rgba(0, 0, 0, 0.5)',
    shadow: 'rgba(0, 0, 0, 0.1)',

    // On-Gradient (text/elements on colored gradient backgrounds, always white)
    onGradient: '#ffffff',
    onGradientMuted: 'rgba(255, 255, 255, 0.8)',
    onGradientOverlay: 'rgba(255, 255, 255, 0.2)',
  },
  dark: {
    // Brand
    primary: '#818cf8',
    primaryForeground: '#0f172a',

    // Background
    background: '#0f172a',
    backgroundSecondary: '#1e293b',
    backgroundTertiary: '#334155',

    // Foreground
    foreground: '#f8fafc',
    foregroundSecondary: '#cbd5e1',
    foregroundMuted: '#8896ab',

    // Cards
    card: '#1e293b',
    cardForeground: '#f8fafc',

    // Border
    border: '#334155',
    borderLight: '#475569',

    // States
    success: '#34d399',
    successForeground: '#0f172a',
    warning: '#fbbf24',
    warningForeground: '#0f172a',
    error: '#f87171',
    errorForeground: '#0f172a',
    info: '#60a5fa',
    infoForeground: '#0f172a',

    // Input
    input: '#1e293b',
    inputBorder: '#334155',
    inputFocus: '#818cf8',
    placeholder: '#64748b',

    // Special
    accent: '#818cf8',
    accentForeground: '#0f172a',
    muted: '#1e293b',
    mutedForeground: '#94a3b8',

    // Extended palette
    violet: '#a78bfa',
    pink: '#f472b6',

    // Overlay & Shadow
    overlay: 'rgba(0, 0, 0, 0.7)',
    shadow: 'rgba(0, 0, 0, 0.3)',

    // On-Gradient (text/elements on colored gradient backgrounds, always white)
    onGradient: '#ffffff',
    onGradientMuted: 'rgba(255, 255, 255, 0.8)',
    onGradientOverlay: 'rgba(255, 255, 255, 0.2)',
  },
} as const;

// ==================== 间距系统 ====================
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

// ==================== 字体大小 ====================
export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
} as const;

// ==================== 字重 ====================
export const fontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

// ==================== 圆角 ====================
export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  full: 9999,
} as const;

// ==================== 行高 ====================
export const lineHeight = {
  tight: 1.25,
  normal: 1.5,
  relaxed: 1.75,
} as const;

// ==================== 动画配置 ====================
export const animation = {
  // 时长（毫秒）
  duration: {
    instant: 100,
    fast: 150,
    normal: 200,
    slow: 300,
    slower: 500,
  },
  // Spring 配置 (Reanimated)
  spring: {
    gentle: { damping: 15, stiffness: 150 },
    snappy: { damping: 20, stiffness: 300 },
    bouncy: { damping: 10, stiffness: 200 },
  },
  // 交错延迟
  stagger: {
    fast: 30,
    normal: 50,
    slow: 80,
  },
  // 按钮按下缩放
  pressScale: {
    button: 0.96,
    card: 0.98,
    icon: 0.9,
    tab: 0.92,
  },
} as const;

// ==================== 阴影 ====================
export const shadows = {
  sm: {
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    shadowOpacity: 0.05,
    elevation: 1,
  },
  md: {
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    shadowOpacity: 0.1,
    elevation: 3,
  },
  lg: {
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 15,
    shadowOpacity: 0.1,
    elevation: 5,
  },
  xl: {
    shadowOffset: { width: 0, height: 20 },
    shadowRadius: 25,
    shadowOpacity: 0.15,
    elevation: 8,
  },
} as const;

// ==================== 层次阴影系统 ====================
export const elevation = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    shadowOpacity: 0.08,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    shadowOpacity: 0.1,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    shadowOpacity: 0.12,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 48,
    shadowOpacity: 0.16,
    elevation: 16,
  },
} as const;

export const darkElevation = {
  sm: { ...elevation.sm, shadowOpacity: 0.2 },
  md: { ...elevation.md, shadowOpacity: 0.28 },
  lg: { ...elevation.lg, shadowOpacity: 0.32 },
  xl: { ...elevation.xl, shadowOpacity: 0.4 },
} as const;

// ==================== 组件尺寸 ====================
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

// ==================== 透明度预设 ====================
export const opacity = {
  '05': 0.05,
  '08': 0.08,
  '10': 0.1,
  '15': 0.15,
  '20': 0.2,
  '30': 0.3,
  '50': 0.5,
  '70': 0.7,
} as const;

// ==================== Utilities ====================

/**
 * Append an alpha hex suffix to a #RRGGBB color string.
 * @param color  Hex color, e.g. '#6366f1'
 * @param opacity Value between 0 and 1
 */
export function withOpacity(color: string, opacity: number): string {
  const hex = Math.round(Math.min(Math.max(opacity, 0), 1) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${color}${hex}`;
}

// ==================== Hooks ====================

/**
 * 获取当前主题颜色
 */
export function useColors() {
  try {
    const colorScheme = useThemeStore((state) => state.colorScheme);
    return colorScheme === 'dark' ? colors.dark : colors.light;
  } catch {
    return colors.light;
  }
}

/**
 * 获取颜色（非 Hook 版本）
 */
export function getColors(isDark?: boolean) {
  return isDark ? colors.dark : colors.light;
}

/**
 * 创建主题感知样式
 */
export function createStyles<T extends Record<string, any>>(stylesCreator: (theme: Colors) => T) {
  return (isDark: boolean): T => {
    const theme: Colors = isDark ? colors.dark : colors.light;
    return stylesCreator(theme);
  };
}

/**
 * Returns animation config that respects the user's reduced-motion preference.
 * When reduced motion is enabled, all durations are set to 0.
 */
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
    } as const;
  }
  return animation;
}

// ==================== 类型导出 ====================
export type ColorScheme = 'light' | 'dark';
export type Colors = { [K in keyof typeof colors.light]: string };
export type Spacing = keyof typeof spacing;
export type BorderRadius = keyof typeof borderRadius;
export type FontSize = keyof typeof fontSize;
export type FontWeight = keyof typeof fontWeight;
