/**
 * 共享设计 tokens - Web & Mobile 通用
 */

// 颜色系统
export const colors = {
  light: {
    primary: '#6366f1',
    primaryForeground: '#ffffff',
    background: '#ffffff',
    backgroundSecondary: '#f8fafc',
    backgroundTertiary: '#f1f5f9',
    foreground: '#0f172a',
    foregroundSecondary: '#475569',
    foregroundMuted: '#94a3b8',
    card: '#ffffff',
    cardForeground: '#0f172a',
    border: '#e2e8f0',
    borderLight: '#f1f5f9',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    muted: '#f1f5f9',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  dark: {
    primary: '#818cf8',
    primaryForeground: '#0f172a',
    background: '#0f172a',
    backgroundSecondary: '#1e293b',
    backgroundTertiary: '#334155',
    foreground: '#f8fafc',
    foregroundSecondary: '#cbd5e1',
    foregroundMuted: '#64748b',
    card: '#1e293b',
    cardForeground: '#f8fafc',
    border: '#334155',
    borderLight: '#475569',
    success: '#34d399',
    warning: '#fbbf24',
    error: '#f87171',
    info: '#60a5fa',
    muted: '#1e293b',
    overlay: 'rgba(0, 0, 0, 0.7)',
  },
} as const;

// 间距系统（移动端使用像素，Web 使用 rem）
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

// 响应式断点
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

// 动画配置
export const animation = {
  // 时长（毫秒）
  duration: {
    instant: 100,
    fast: 150,
    normal: 200,
    slow: 300,
    slower: 500,
  },
  // 缓动函数
  easing: {
    // Cubic bezier values for mobile (Reanimated)
    easeIn: [0.4, 0, 1, 1] as const,
    easeOut: [0, 0, 0.2, 1] as const,
    easeInOut: [0.4, 0, 0.2, 1] as const,
    spring: { damping: 15, stiffness: 150 },
    // CSS timing functions for web
    css: {
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
  },
  // 预设动画
  presets: {
    fadeIn: { duration: 200, easing: 'easeOut' },
    fadeOut: { duration: 150, easing: 'easeIn' },
    scaleIn: { duration: 200, easing: 'easeOut' },
    slideUp: { duration: 300, easing: 'easeOut' },
    slideDown: { duration: 200, easing: 'easeIn' },
    bounce: { duration: 400, easing: 'spring' },
  },
  // 列表交错动画
  stagger: {
    fast: 30,
    normal: 50,
    slow: 80,
  },
} as const;

// 阴影系统
export const shadows = {
  sm: {
    offset: { width: 0, height: 1 },
    radius: 2,
    opacity: 0.05,
  },
  md: {
    offset: { width: 0, height: 4 },
    radius: 6,
    opacity: 0.1,
  },
  lg: {
    offset: { width: 0, height: 10 },
    radius: 15,
    opacity: 0.1,
  },
  xl: {
    offset: { width: 0, height: 20 },
    radius: 25,
    opacity: 0.15,
  },
} as const;

// 圆角
export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  full: 9999,
} as const;

// 字体大小
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

// 字重
export const fontWeight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

// 行高
export const lineHeight = {
  tight: 1.25,
  normal: 1.5,
  relaxed: 1.75,
} as const;

// Z-Index 层级
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

// 过渡时间
export const transition = {
  fast: '150ms',
  normal: '200ms',
  slow: '300ms',
  slower: '500ms',
} as const;

// 通用样式变量（用于 CSS-in-JS 或样式计算）
export const cssVars = {
  // 间距
  '--spacing-xs': '0.25rem',
  '--spacing-sm': '0.5rem',
  '--spacing-md': '0.75rem',
  '--spacing-lg': '1rem',
  '--spacing-xl': '1.25rem',
  '--spacing-2xl': '1.5rem',
  '--spacing-3xl': '2rem',
  '--spacing-4xl': '2.5rem',
  '--spacing-5xl': '3rem',
  
  // 圆角
  '--radius-sm': '0.25rem',
  '--radius-md': '0.5rem',
  '--radius-lg': '0.75rem',
  '--radius-xl': '1rem',
  '--radius-2xl': '1.25rem',
  '--radius-full': '9999px',
  
  // 阴影
  '--shadow-sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  '--shadow-md': '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  '--shadow-lg': '0 10px 15px -3px rgb(0 0 0 / 0.1)',
  '--shadow-xl': '0 20px 25px -5px rgb(0 0 0 / 0.1)',
} as const;

// 工具函数：将 spacing token 转换为 rem
export function spacingToRem(spacing: keyof typeof spacing): string {
  return `${spacing / 16}rem`;
}

// 工具函数：根据主题获取颜色
export function getColor(colorScheme: ColorScheme, colorKey: keyof Colors): string {
  return colors[colorScheme][colorKey];
}

export type ColorScheme = 'light' | 'dark';
export type Colors = typeof colors.light;
export type Spacing = keyof typeof spacing;
export type BorderRadius = keyof typeof borderRadius;
export type FontSize = keyof typeof fontSize;
export type FontWeight = keyof typeof fontWeight;
