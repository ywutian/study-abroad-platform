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
    primary: '#1d1813',
    primaryForeground: '#fff7ea',
    background: '#f7f1e6',
    backgroundSecondary: '#efe4d2',
    backgroundTertiary: '#e3d1b8',
    foreground: '#1d1813',
    foregroundSecondary: '#4e4034',
    foregroundMuted: '#6f665b',
    card: '#fff9ef',
    cardForeground: '#1d1813',
    border: '#d8c8b2',
    borderLight: '#eee1cf',
    borderStrong: '#bdaa90',
    muted: '#efe4d2',
    mutedForeground: '#6f665b',
    accent: '#f4e6c2',
    accentForeground: '#1d1813',
    success: '#6f7b58',
    warning: '#b7832f',
    error: '#b85c58',
    info: '#6574ff',
    violet: '#6574ff',
    pink: '#e76f8a',
    input: '#f2e7d7',
    inputBorder: '#d8c8b2',
    inputFocus: '#1d1813',
    placeholder: '#9a8c79',
    overlay: 'rgba(29, 24, 19, 0.52)',
  },
  dark: {
    primary: '#ddb85a',
    primaryForeground: '#191510',
    background: '#0f0d0a',
    backgroundSecondary: '#15110d',
    backgroundTertiary: '#211a13',
    foreground: '#f6edde',
    foregroundSecondary: '#d8c8b2',
    foregroundMuted: '#cdbca4',
    card: '#191510',
    cardForeground: '#f6edde',
    border: '#3b3026',
    borderLight: '#2a211a',
    borderStrong: '#574736',
    muted: '#211a13',
    mutedForeground: '#a99b88',
    accent: '#2a2117',
    accentForeground: '#f6edde',
    success: '#a3a06f',
    warning: '#ddb85a',
    error: '#e98a7f',
    info: '#8d96ff',
    violet: '#8d96ff',
    pink: '#f09ab0',
    input: '#211a13',
    inputBorder: '#3b3026',
    inputFocus: '#ddb85a',
    placeholder: '#9a8c79',
    overlay: 'rgba(0, 0, 0, 0.68)',
  },
} as const;

export const semanticSurfaces = {
  light: {
    surface: colors.light.card,
    surfaceMuted: colors.light.muted,
    surfaceSubtle: '#fff4e2',
    border: colors.light.border,
    borderStrong: colors.light.borderStrong,
    infoSurface: '#ececff',
  },
  dark: {
    surface: colors.dark.card,
    surfaceMuted: colors.dark.muted,
    surfaceSubtle: '#15110d',
    border: colors.dark.border,
    borderStrong: colors.dark.borderStrong,
    infoSurface: '#211a13',
  },
} as const;

export const admissionStatus = {
  light: {
    reach: {
      value: colors.light.error,
      bg: '#f8e5e4',
      fg: '#8e3f3c',
    },
    target: {
      value: colors.light.warning,
      bg: '#f7e8c4',
      fg: '#73511e',
    },
    safety: {
      value: colors.light.success,
      bg: '#ece8d2',
      fg: '#555d3c',
    },
    likely: {
      value: colors.light.warning,
      bg: '#f8ebc9',
      fg: '#7a581a',
    },
  },
  dark: {
    reach: {
      value: colors.dark.error,
      bg: 'rgba(233, 138, 127, 0.18)',
      fg: '#f4c9c3',
    },
    target: {
      value: colors.dark.warning,
      bg: 'rgba(221, 184, 90, 0.18)',
      fg: '#f2d7a3',
    },
    safety: {
      value: colors.dark.success,
      bg: 'rgba(163, 160, 111, 0.18)',
      fg: '#e3dfad',
    },
    likely: {
      value: colors.dark.primary,
      bg: 'rgba(221, 184, 90, 0.18)',
      fg: '#f2d7a3',
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

/** User-chosen product color palette, orthogonal to light/dark (`.dark` on `html`). */
export const COLOR_PALETTE_STORAGE_KEY = 'color-palette';

export const COLOR_THEME_CATEGORIES = [
  { id: 'lumni-warm-ai', labelZh: 'Lumni / 暖 AI', labelEn: 'Lumni / Warm AI' },
  { id: 'premium-mono', labelZh: '高级黑白', labelEn: 'Premium Mono' },
  { id: 'indigo-saas', labelZh: '靛蓝 SaaS', labelEn: 'Indigo SaaS' },
  { id: 'electric-ai', labelZh: '电感 AI', labelEn: 'Electric AI' },
  { id: 'purple-gradient-tech', labelZh: '紫蓝科技', labelEn: 'Purple Tech' },
  { id: 'dark-developer', labelZh: '暗色开发者', labelEn: 'Dark Developer' },
  { id: 'calm-academic-saas', labelZh: '冷静学术', labelEn: 'Calm Academic' },
  { id: 'warm-professional', labelZh: '暖调专业', labelEn: 'Warm Professional' },
] as const;

export type ColorThemeCategory = (typeof COLOR_THEME_CATEGORIES)[number]['id'];

type NeutralFamily = 'warm' | 'sand' | 'slate' | 'mauve' | 'sage' | 'pearl' | 'charcoal';
type HexColor = `#${string}`;

export type ColorThemeDefinition = {
  id: string;
  category: ColorThemeCategory;
  labelZh: string;
  labelEn: string;
  descriptionZh: string;
  descriptionEn: string;
  primary: HexColor;
  accent: HexColor;
  neutral: NeutralFamily;
  darkPrimary?: HexColor;
};

export const COLOR_THEME_DEFINITIONS = [
  {
    id: 'lumni-warm',
    category: 'lumni-warm-ai',
    labelZh: 'Lumni 暖米金',
    labelEn: 'Lumni Warm',
    descriptionZh: '当前默认暖米黑金，最适合首页品牌感。',
    descriptionEn: 'The default warm ivory, ink, and gold Lumni theme.',
    primary: '#1d1813',
    accent: '#ddb85a',
    neutral: 'warm',
    darkPrimary: '#ddb85a',
  },
  {
    id: 'moon-gold',
    category: 'lumni-warm-ai',
    labelZh: '月金',
    labelEn: 'Moon Gold',
    descriptionZh: '黑金月光感，适合高级品牌首页。',
    descriptionEn: 'Ink and moon-gold accents for a premium brand feel.',
    primary: '#2b2113',
    accent: '#d8a72d',
    neutral: 'warm',
    darkPrimary: '#e6c766',
  },
  {
    id: 'claude-sand',
    category: 'lumni-warm-ai',
    labelZh: 'Claude 沙岩',
    labelEn: 'Claude Sand',
    descriptionZh: '温和米色和陶土橙，AI 感更亲近。',
    descriptionEn: 'Soft sand and clay-orange warmth for approachable AI.',
    primary: '#7c4a2d',
    accent: '#d88945',
    neutral: 'sand',
    darkPrimary: '#e2a66f',
  },
  {
    id: 'cursor-warm',
    category: 'lumni-warm-ai',
    labelZh: 'Cursor 暖灰',
    labelEn: 'Cursor Warm',
    descriptionZh: '暖灰和深墨，偏开发工具的克制感。',
    descriptionEn: 'Warm graphite surfaces with restrained tool-like contrast.',
    primary: '#27221f',
    accent: '#a89172',
    neutral: 'sand',
    darkPrimary: '#c9b79b',
  },
  {
    id: 'ink-parchment',
    category: 'lumni-warm-ai',
    labelZh: '墨色羊皮纸',
    labelEn: 'Ink Parchment',
    descriptionZh: '纸感背景和墨色 CTA，阅读体验稳定。',
    descriptionEn: 'Parchment surfaces with ink CTAs for calm readability.',
    primary: '#171310',
    accent: '#b88b3f',
    neutral: 'warm',
    darkPrimary: '#dab469',
  },
  {
    id: 'almond-noir',
    category: 'lumni-warm-ai',
    labelZh: '杏仁黑',
    labelEn: 'Almond Noir',
    descriptionZh: '杏仁底色和黑色界面元素。',
    descriptionEn: 'Almond surfaces with strong noir interface elements.',
    primary: '#211a16',
    accent: '#c27b57',
    neutral: 'sand',
    darkPrimary: '#df9a75',
  },
  {
    id: 'lantern-amber',
    category: 'lumni-warm-ai',
    labelZh: '灯笼琥珀',
    labelEn: 'Lantern Amber',
    descriptionZh: '琥珀高光，保留“照亮路线”的隐喻。',
    descriptionEn: 'Amber highlights that reinforce the illuminated-route idea.',
    primary: '#3a260d',
    accent: '#f2a51f',
    neutral: 'warm',
    darkPrimary: '#ffc85a',
  },
  {
    id: 'deer-bronze',
    category: 'lumni-warm-ai',
    labelZh: '鹿角铜棕',
    labelEn: 'Deer Bronze',
    descriptionZh: '铜棕高光，贴合鹿/月亮品牌符号。',
    descriptionEn: 'Bronze accents tuned for the deer-and-moon identity.',
    primary: '#4a2d1c',
    accent: '#b97843',
    neutral: 'warm',
    darkPrimary: '#d79b67',
  },

  {
    id: 'vercel-mono',
    category: 'premium-mono',
    labelZh: 'Vercel 黑白',
    labelEn: 'Vercel Mono',
    descriptionZh: '黑白极简，开发者产品感最强。',
    descriptionEn: 'Pure monochrome for a crisp developer-product feel.',
    primary: '#000000',
    accent: '#666666',
    neutral: 'pearl',
    darkPrimary: '#ffffff',
  },
  {
    id: 'framer-black',
    category: 'premium-mono',
    labelZh: 'Framer 黑',
    labelEn: 'Framer Black',
    descriptionZh: '黑白底加微蓝高光，偏酷感官网。',
    descriptionEn: 'Black-and-white base with a subtle blue tech highlight.',
    primary: '#050505',
    accent: '#4f7cff',
    neutral: 'charcoal',
    darkPrimary: '#ffffff',
  },
  {
    id: 'graphite-white',
    category: 'premium-mono',
    labelZh: '石墨白',
    labelEn: 'Graphite White',
    descriptionZh: '石墨灰和白色界面，适合工作台。',
    descriptionEn: 'Graphite-on-white surfaces for utilitarian dashboards.',
    primary: '#25282c',
    accent: '#7b8794',
    neutral: 'pearl',
    darkPrimary: '#cfd6df',
  },
  {
    id: 'carbon-minimal',
    category: 'premium-mono',
    labelZh: '碳黑极简',
    labelEn: 'Carbon Minimal',
    descriptionZh: '碳黑和浅灰，减少装饰色。',
    descriptionEn: 'Carbon black and light gray with almost no decoration.',
    primary: '#111827',
    accent: '#6b7280',
    neutral: 'slate',
    darkPrimary: '#d1d5db',
  },
  {
    id: 'zinc-lux',
    category: 'premium-mono',
    labelZh: '锌灰高级',
    labelEn: 'Zinc Lux',
    descriptionZh: '锌灰底色，保留高级留白。',
    descriptionEn: 'Zinc neutrals with generous premium whitespace.',
    primary: '#27272a',
    accent: '#a1a1aa',
    neutral: 'pearl',
    darkPrimary: '#d4d4d8',
  },
  {
    id: 'obsidian-paper',
    category: 'premium-mono',
    labelZh: '黑曜纸',
    labelEn: 'Obsidian Paper',
    descriptionZh: '黑曜石主色和纸白表面。',
    descriptionEn: 'Obsidian primary color over paper-white surfaces.',
    primary: '#151515',
    accent: '#8a8178',
    neutral: 'warm',
    darkPrimary: '#ded6cf',
  },
  {
    id: 'mono-ivory',
    category: 'premium-mono',
    labelZh: '象牙单色',
    labelEn: 'Mono Ivory',
    descriptionZh: '象牙白和墨黑，适合保守专业感。',
    descriptionEn: 'Ivory and ink for conservative, polished product UI.',
    primary: '#1f1b17',
    accent: '#b8ad9e',
    neutral: 'warm',
    darkPrimary: '#efe4d2',
  },
  {
    id: 'noir-silver',
    category: 'premium-mono',
    labelZh: '黑银',
    labelEn: 'Noir Silver',
    descriptionZh: '黑银对比，适合深色工作台。',
    descriptionEn: 'Noir and silver contrast for darker productivity surfaces.',
    primary: '#0b0c0f',
    accent: '#9aa4b2',
    neutral: 'charcoal',
    darkPrimary: '#c7d0dc',
  },

  {
    id: 'linear-indigo',
    category: 'indigo-saas',
    labelZh: 'Linear 靛蓝',
    labelEn: 'Linear Indigo',
    descriptionZh: '冷静靛蓝，偏 Linear 的效率工具感。',
    descriptionEn: 'Calm indigo for a Linear-like productivity tone.',
    primary: '#312e81',
    accent: '#6366f1',
    neutral: 'slate',
    darkPrimary: '#a5b4fc',
  },
  {
    id: 'stripe-blue',
    category: 'indigo-saas',
    labelZh: 'Stripe 蓝',
    labelEn: 'Stripe Blue',
    descriptionZh: '可信钴蓝，偏 SaaS 和支付系统感。',
    descriptionEn: 'Trustworthy cobalt-blue SaaS and infrastructure tone.',
    primary: '#3451ff',
    accent: '#7c3aed',
    neutral: 'slate',
    darkPrimary: '#93c5fd',
  },
  {
    id: 'cobalt-saas',
    category: 'indigo-saas',
    labelZh: '钴蓝 SaaS',
    labelEn: 'Cobalt SaaS',
    descriptionZh: '明亮钴蓝，适合数据密集界面。',
    descriptionEn: 'Bright cobalt for dense product and data interfaces.',
    primary: '#2454d6',
    accent: '#4f8cff',
    neutral: 'slate',
    darkPrimary: '#8bb7ff',
  },
  {
    id: 'deep-indigo',
    category: 'indigo-saas',
    labelZh: '深靛蓝',
    labelEn: 'Deep Indigo',
    descriptionZh: '更深的靛蓝，商务感更强。',
    descriptionEn: 'Deeper indigo for a more enterprise-ready impression.',
    primary: '#3730a3',
    accent: '#8b5cf6',
    neutral: 'slate',
    darkPrimary: '#a78bfa',
  },
  {
    id: 'atlas-blue',
    category: 'indigo-saas',
    labelZh: '地图蓝',
    labelEn: 'Atlas Blue',
    descriptionZh: '路线和地图感，适合选校导航。',
    descriptionEn: 'Route-map blue for school discovery and navigation.',
    primary: '#1d4ed8',
    accent: '#38bdf8',
    neutral: 'slate',
    darkPrimary: '#93c5fd',
  },
  {
    id: 'royal-navy',
    category: 'indigo-saas',
    labelZh: '皇家海军蓝',
    labelEn: 'Royal Navy',
    descriptionZh: '海军蓝和金色，偏高校/奖学金气质。',
    descriptionEn: 'Navy and gold with a classic university tone.',
    primary: '#172554',
    accent: '#c8a24a',
    neutral: 'slate',
    darkPrimary: '#93a9ff',
  },
  {
    id: 'thesis-indigo',
    category: 'indigo-saas',
    labelZh: '论文靛蓝',
    labelEn: 'Thesis Indigo',
    descriptionZh: '学术感靛蓝，适合文书和档案页。',
    descriptionEn: 'Academic indigo tuned for essays and profile workflows.',
    primary: '#4338ca',
    accent: '#a78bfa',
    neutral: 'pearl',
    darkPrimary: '#b4b5ff',
  },
  {
    id: 'campus-cobalt',
    category: 'indigo-saas',
    labelZh: '校园钴蓝',
    labelEn: 'Campus Cobalt',
    descriptionZh: '校园蓝调，适合学校列表和榜单。',
    descriptionEn: 'Campus-blue accents for school lists and rankings.',
    primary: '#1e40af',
    accent: '#60a5fa',
    neutral: 'pearl',
    darkPrimary: '#93c5fd',
  },

  {
    id: 'electric-blue',
    category: 'electric-ai',
    labelZh: '电蓝',
    labelEn: 'Electric Blue',
    descriptionZh: '高能电蓝，AI 产品感很明确。',
    descriptionEn: 'High-energy electric blue for an unmistakable AI feel.',
    primary: '#0057ff',
    accent: '#00a3ff',
    neutral: 'pearl',
    darkPrimary: '#75b7ff',
  },
  {
    id: 'signal-cyan',
    category: 'electric-ai',
    labelZh: '信号青',
    labelEn: 'Signal Cyan',
    descriptionZh: '青色信号感，适合搜索和提醒。',
    descriptionEn: 'Cyan signal accents for search and alerting patterns.',
    primary: '#087ea4',
    accent: '#22d3ee',
    neutral: 'slate',
    darkPrimary: '#67e8f9',
  },
  {
    id: 'neural-azure',
    category: 'electric-ai',
    labelZh: '神经天蓝',
    labelEn: 'Neural Azure',
    descriptionZh: '天蓝高光，偏模型/AI 分析。',
    descriptionEn: 'Azure highlights tuned for model and AI analysis screens.',
    primary: '#0369a1',
    accent: '#38bdf8',
    neutral: 'pearl',
    darkPrimary: '#7dd3fc',
  },
  {
    id: 'model-sky',
    category: 'electric-ai',
    labelZh: '模型天空蓝',
    labelEn: 'Model Sky',
    descriptionZh: '轻盈天空蓝，科技但不压迫。',
    descriptionEn: 'Airy sky-blue tech without a heavy visual tone.',
    primary: '#0284c7',
    accent: '#7dd3fc',
    neutral: 'pearl',
    darkPrimary: '#bae6fd',
  },
  {
    id: 'quantum-blue',
    category: 'electric-ai',
    labelZh: '量子蓝',
    labelEn: 'Quantum Blue',
    descriptionZh: '深蓝和亮青，偏前沿科技。',
    descriptionEn: 'Deep blue and bright cyan for frontier-tech energy.',
    primary: '#1e3a8a',
    accent: '#06b6d4',
    neutral: 'slate',
    darkPrimary: '#60a5fa',
  },
  {
    id: 'prism-cyan',
    category: 'electric-ai',
    labelZh: '棱镜青',
    labelEn: 'Prism Cyan',
    descriptionZh: '清透青蓝，适合数据可视化。',
    descriptionEn: 'Clear cyan-blue for analytics and visualizations.',
    primary: '#0e7490',
    accent: '#67e8f9',
    neutral: 'pearl',
    darkPrimary: '#a5f3fc',
  },
  {
    id: 'orbit-ice',
    category: 'electric-ai',
    labelZh: '冰轨道',
    labelEn: 'Orbit Ice',
    descriptionZh: '冰蓝和灰白，冷静的科技感。',
    descriptionEn: 'Icy blue and pale neutrals for calm technology surfaces.',
    primary: '#2563eb',
    accent: '#a5f3fc',
    neutral: 'pearl',
    darkPrimary: '#93c5fd',
  },
  {
    id: 'search-teal',
    category: 'electric-ai',
    labelZh: '搜索蓝绿',
    labelEn: 'Search Teal',
    descriptionZh: '蓝绿色搜索感，但不作为默认主题。',
    descriptionEn: 'Blue-teal search styling, kept away from the default brand.',
    primary: '#0f766e',
    accent: '#2dd4bf',
    neutral: 'pearl',
    darkPrimary: '#5eead4',
  },

  {
    id: 'framer-violet',
    category: 'purple-gradient-tech',
    labelZh: 'Framer 紫',
    labelEn: 'Framer Violet',
    descriptionZh: '紫蓝高光，适合酷感科技页。',
    descriptionEn: 'Violet-blue accents for cooler tech landing surfaces.',
    primary: '#6d28d9',
    accent: '#3b82f6',
    neutral: 'charcoal',
    darkPrimary: '#c4b5fd',
  },
  {
    id: 'iris-night',
    category: 'purple-gradient-tech',
    labelZh: '鸢尾夜色',
    labelEn: 'Iris Night',
    descriptionZh: '鸢尾紫和夜色灰，偏神秘 AI。',
    descriptionEn: 'Iris violet over night neutrals for a mysterious AI tone.',
    primary: '#5b21b6',
    accent: '#a855f7',
    neutral: 'mauve',
    darkPrimary: '#c084fc',
  },
  {
    id: 'lovable-pulse',
    category: 'purple-gradient-tech',
    labelZh: 'Lovable 脉冲',
    labelEn: 'Lovable Pulse',
    descriptionZh: '蓝紫玫红点亮，借鉴 Lovable 的活力但更克制。',
    descriptionEn: 'Blue-violet and rose energy inspired by lively AI builders.',
    primary: '#7c3aed',
    accent: '#e76f8a',
    neutral: 'pearl',
    darkPrimary: '#c4b5fd',
  },
  {
    id: 'violet-cobalt',
    category: 'purple-gradient-tech',
    labelZh: '紫钴',
    labelEn: 'Violet Cobalt',
    descriptionZh: '钴蓝和紫色平衡，SaaS 科技感强。',
    descriptionEn: 'Balanced cobalt and violet for a strong SaaS-tech signal.',
    primary: '#4f46e5',
    accent: '#8b5cf6',
    neutral: 'slate',
    darkPrimary: '#a5b4fc',
  },
  {
    id: 'plum-ai',
    category: 'purple-gradient-tech',
    labelZh: '李子 AI',
    labelEn: 'Plum AI',
    descriptionZh: '梅紫主题，适合文书和创作体验。',
    descriptionEn: 'Plum accents for essay and creative-assistant workflows.',
    primary: '#7e22ce',
    accent: '#d946ef',
    neutral: 'mauve',
    darkPrimary: '#d8b4fe',
  },
  {
    id: 'purple-essay',
    category: 'purple-gradient-tech',
    labelZh: '紫色文书',
    labelEn: 'Purple Essay',
    descriptionZh: '柔紫和纸白，文书页更友好。',
    descriptionEn: 'Soft purple on paper-like surfaces for essay work.',
    primary: '#7c3aed',
    accent: '#c084fc',
    neutral: 'mauve',
    darkPrimary: '#c4b5fd',
  },
  {
    id: 'magenta-orbit',
    category: 'purple-gradient-tech',
    labelZh: '洋红轨道',
    labelEn: 'Magenta Orbit',
    descriptionZh: '洋红点亮，适合强品牌表达。',
    descriptionEn: 'Magenta accents for a louder brand expression.',
    primary: '#be185d',
    accent: '#8b5cf6',
    neutral: 'mauve',
    darkPrimary: '#f0abfc',
  },
  {
    id: 'aurora-indigo',
    category: 'purple-gradient-tech',
    labelZh: '极光靛紫',
    labelEn: 'Aurora Indigo',
    descriptionZh: '极光紫蓝，保留未来感。',
    descriptionEn: 'Aurora indigo-violet for a future-facing visual tone.',
    primary: '#4338ca',
    accent: '#ec4899',
    neutral: 'charcoal',
    darkPrimary: '#a5b4fc',
  },

  {
    id: 'midnight-ai',
    category: 'dark-developer',
    labelZh: '午夜 AI',
    labelEn: 'Midnight AI',
    descriptionZh: '深夜底色和蓝色高光，适合暗色用户。',
    descriptionEn: 'Midnight surfaces with blue AI highlights.',
    primary: '#2563eb',
    accent: '#22d3ee',
    neutral: 'charcoal',
    darkPrimary: '#93c5fd',
  },
  {
    id: 'terminal-lime',
    category: 'dark-developer',
    labelZh: '终端青柠',
    labelEn: 'Terminal Lime',
    descriptionZh: '终端风格高光，作为少数绿色科技主题。',
    descriptionEn: 'Terminal-like lime accents as a focused developer variant.',
    primary: '#365314',
    accent: '#84cc16',
    neutral: 'charcoal',
    darkPrimary: '#bef264',
  },
  {
    id: 'console-cyan',
    category: 'dark-developer',
    labelZh: '控制台青',
    labelEn: 'Console Cyan',
    descriptionZh: '控制台青色，偏开发者工作台。',
    descriptionEn: 'Console cyan for developer-workbench styling.',
    primary: '#155e75',
    accent: '#06b6d4',
    neutral: 'charcoal',
    darkPrimary: '#67e8f9',
  },
  {
    id: 'matrix-blue',
    category: 'dark-developer',
    labelZh: '矩阵蓝',
    labelEn: 'Matrix Blue',
    descriptionZh: '深蓝矩阵感，不走绿色黑客风。',
    descriptionEn: 'Deep matrix-blue without leaning into hacker green.',
    primary: '#1e40af',
    accent: '#38bdf8',
    neutral: 'charcoal',
    darkPrimary: '#93c5fd',
  },
  {
    id: 'code-violet',
    category: 'dark-developer',
    labelZh: '代码紫',
    labelEn: 'Code Violet',
    descriptionZh: '代码编辑器式紫色高光。',
    descriptionEn: 'Editor-like violet highlights for code-adjacent UI.',
    primary: '#6d28d9',
    accent: '#a78bfa',
    neutral: 'charcoal',
    darkPrimary: '#c4b5fd',
  },
  {
    id: 'dev-graphite',
    category: 'dark-developer',
    labelZh: '开发石墨',
    labelEn: 'Dev Graphite',
    descriptionZh: '石墨深灰，最克制的开发者主题。',
    descriptionEn: 'Restrained graphite for developer-heavy workflows.',
    primary: '#374151',
    accent: '#9ca3af',
    neutral: 'charcoal',
    darkPrimary: '#d1d5db',
  },
  {
    id: 'infra-orange',
    category: 'dark-developer',
    labelZh: '基础设施橙',
    labelEn: 'Infra Orange',
    descriptionZh: '深灰加橙色，偏基础设施和运维感。',
    descriptionEn: 'Dark gray and orange for infra and operations cues.',
    primary: '#9a3412',
    accent: '#f97316',
    neutral: 'charcoal',
    darkPrimary: '#fdba74',
  },
  {
    id: 'dark-command',
    category: 'dark-developer',
    labelZh: '暗色指挥台',
    labelEn: 'Dark Command',
    descriptionZh: '暗色指挥台，贴合 Command Center。',
    descriptionEn: 'A command-center theme aligned with Lumni workbench panels.',
    primary: '#111827',
    accent: '#ddb85a',
    neutral: 'charcoal',
    darkPrimary: '#facc15',
  },

  {
    id: 'quiet-linen',
    category: 'calm-academic-saas',
    labelZh: '静谧亚麻',
    labelEn: 'Quiet Linen',
    descriptionZh: '低饱和亚麻色，适合长时间阅读。',
    descriptionEn: 'Low-saturation linen for long reading sessions.',
    primary: '#51463a',
    accent: '#9f8f74',
    neutral: 'sand',
    darkPrimary: '#d6c7ad',
  },
  {
    id: 'fog-slate',
    category: 'calm-academic-saas',
    labelZh: '雾灰',
    labelEn: 'Fog Slate',
    descriptionZh: '雾灰和浅蓝，干净专业。',
    descriptionEn: 'Foggy slate and pale blue for a clean professional UI.',
    primary: '#475569',
    accent: '#94a3b8',
    neutral: 'slate',
    darkPrimary: '#cbd5e1',
  },
  {
    id: 'paper-lilac',
    category: 'calm-academic-saas',
    labelZh: '纸面丁香',
    labelEn: 'Paper Lilac',
    descriptionZh: '淡紫纸感，适合文书/资料页。',
    descriptionEn: 'Paper-lilac calm for essay and profile surfaces.',
    primary: '#6b4e71',
    accent: '#b794c5',
    neutral: 'mauve',
    darkPrimary: '#d8b4e2',
  },
  {
    id: 'porcelain-blue',
    category: 'calm-academic-saas',
    labelZh: '瓷蓝',
    labelEn: 'Porcelain Blue',
    descriptionZh: '瓷白和蓝灰，清爽但不冰冷。',
    descriptionEn: 'Porcelain white with blue-gray clarity.',
    primary: '#31546f',
    accent: '#7ea6c8',
    neutral: 'pearl',
    darkPrimary: '#a8c7df',
  },
  {
    id: 'archive-olive',
    category: 'calm-academic-saas',
    labelZh: '档案橄榄',
    labelEn: 'Archive Olive',
    descriptionZh: '橄榄灰，适合档案和任务管理。',
    descriptionEn: 'Olive-gray for archives and task-management views.',
    primary: '#555d3c',
    accent: '#a3a06f',
    neutral: 'sage',
    darkPrimary: '#c8c48a',
  },
  {
    id: 'mist-pearl',
    category: 'calm-academic-saas',
    labelZh: '薄雾珍珠',
    labelEn: 'Mist Pearl',
    descriptionZh: '珍珠灰白和浅蓝，最轻的科技感。',
    descriptionEn: 'Pearl neutrals and pale blue for the lightest tech feel.',
    primary: '#40556b',
    accent: '#9db4c9',
    neutral: 'pearl',
    darkPrimary: '#c6d6e5',
  },
  {
    id: 'oyster-mauve',
    category: 'calm-academic-saas',
    labelZh: '牡蛎灰紫',
    labelEn: 'Oyster Mauve',
    descriptionZh: '灰紫中性色，柔和但有辨识度。',
    descriptionEn: 'Mauve-neutral surfaces with a soft distinct identity.',
    primary: '#6b5363',
    accent: '#c08497',
    neutral: 'mauve',
    darkPrimary: '#d8a7b8',
  },
  {
    id: 'seminar-burgundy',
    category: 'calm-academic-saas',
    labelZh: '研讨酒红',
    labelEn: 'Seminar Burgundy',
    descriptionZh: '酒红学术感，适合案例和社区。',
    descriptionEn: 'Academic burgundy for cases and community surfaces.',
    primary: '#7f1d1d',
    accent: '#b45309',
    neutral: 'warm',
    darkPrimary: '#fca5a5',
  },

  {
    id: 'copper-cream',
    category: 'warm-professional',
    labelZh: '铜色奶油',
    labelEn: 'Copper Cream',
    descriptionZh: '铜色和奶油白，商务又温暖。',
    descriptionEn: 'Copper and cream for warm professional product UI.',
    primary: '#92400e',
    accent: '#d97706',
    neutral: 'sand',
    darkPrimary: '#fdba74',
  },
  {
    id: 'terra-rose',
    category: 'warm-professional',
    labelZh: '陶土玫瑰',
    labelEn: 'Terra Rose',
    descriptionZh: '陶土红和玫瑰高光，柔和有温度。',
    descriptionEn: 'Terracotta and rose highlights with human warmth.',
    primary: '#9f3f35',
    accent: '#e76f8a',
    neutral: 'sand',
    darkPrimary: '#f4a7a0',
  },
  {
    id: 'clay-coral',
    category: 'warm-professional',
    labelZh: '黏土珊瑚',
    labelEn: 'Clay Coral',
    descriptionZh: '珊瑚橙主题，适合引导和提醒。',
    descriptionEn: 'Coral-clay accents for onboarding and reminders.',
    primary: '#c2410c',
    accent: '#fb7185',
    neutral: 'sand',
    darkPrimary: '#fdba74',
  },
  {
    id: 'cinnamon-paper',
    category: 'warm-professional',
    labelZh: '肉桂纸',
    labelEn: 'Cinnamon Paper',
    descriptionZh: '肉桂棕和纸面背景，稳定耐看。',
    descriptionEn: 'Cinnamon brown over paper surfaces for stable readability.',
    primary: '#7c2d12',
    accent: '#ea580c',
    neutral: 'warm',
    darkPrimary: '#fdba74',
  },
  {
    id: 'apricot-charcoal',
    category: 'warm-professional',
    labelZh: '杏橙炭灰',
    labelEn: 'Apricot Charcoal',
    descriptionZh: '杏橙高光和炭灰主色，现代商务感。',
    descriptionEn: 'Apricot highlights over charcoal for modern business UI.',
    primary: '#3f2f2b',
    accent: '#fb923c',
    neutral: 'sand',
    darkPrimary: '#fdba74',
  },
  {
    id: 'mahogany-cream',
    category: 'warm-professional',
    labelZh: '桃花心木奶油',
    labelEn: 'Mahogany Cream',
    descriptionZh: '木质深红棕和奶油底。',
    descriptionEn: 'Mahogany red-brown over cream surfaces.',
    primary: '#6b2f24',
    accent: '#c9825a',
    neutral: 'warm',
    darkPrimary: '#e2a181',
  },
  {
    id: 'blush-gold',
    category: 'warm-professional',
    labelZh: '腮红金',
    labelEn: 'Blush Gold',
    descriptionZh: '玫瑰和金色，适合更柔和的品牌感。',
    descriptionEn: 'Rose and gold for a softer premium brand tone.',
    primary: '#9d4462',
    accent: '#d8a72d',
    neutral: 'warm',
    darkPrimary: '#f0a6bb',
  },
  {
    id: 'dossier-crimson',
    category: 'warm-professional',
    labelZh: '档案绯红',
    labelEn: 'Dossier Crimson',
    descriptionZh: '绯红主色，适合强调截止和申请节点。',
    descriptionEn: 'Crimson accents for deadlines and application milestones.',
    primary: '#991b1b',
    accent: '#f97316',
    neutral: 'warm',
    darkPrimary: '#fca5a5',
  },
] as const satisfies readonly ColorThemeDefinition[];

export type ColorPalette = (typeof COLOR_THEME_DEFINITIONS)[number]['id'];

export const COLOR_PALETTES = COLOR_THEME_DEFINITIONS.map((theme) => theme.id) as ColorPalette[];

export const DEFAULT_COLOR_PALETTE: ColorPalette = 'lumni-warm';

const legacyColorPaletteAliases: Record<string, ColorPalette> = {
  warm: 'lumni-warm',
  slate: 'linear-indigo',
};

export function isColorPalette(value: string): value is ColorPalette {
  return (COLOR_PALETTES as readonly string[]).includes(value);
}

export function parseColorPalette(raw: string | null | undefined): ColorPalette {
  if (!raw) return DEFAULT_COLOR_PALETTE;
  const normalized = legacyColorPaletteAliases[raw] ?? raw;
  if (isColorPalette(normalized)) return normalized;
  return DEFAULT_COLOR_PALETTE;
}

export function getColorThemeDefinition(id: ColorPalette) {
  return COLOR_THEME_DEFINITIONS.find((theme) => theme.id === id) ?? COLOR_THEME_DEFINITIONS[0];
}

export function getColorThemeLabel(id: ColorPalette, locale: 'zh' | 'en' = 'en'): string {
  const theme = getColorThemeDefinition(id);
  return locale === 'zh' ? theme.labelZh : theme.labelEn;
}

export function getColorThemeDescription(id: ColorPalette, locale: 'zh' | 'en' = 'en'): string {
  const theme = getColorThemeDefinition(id);
  return locale === 'zh' ? theme.descriptionZh : theme.descriptionEn;
}

export function getColorThemeCategoryLabel(
  category: ColorThemeCategory,
  locale: 'zh' | 'en' = 'en'
): string {
  const match = COLOR_THEME_CATEGORIES.find((item) => item.id === category);
  if (!match) return category;
  return locale === 'zh' ? match.labelZh : match.labelEn;
}

/** Any palette row with the same keys as `colors.light` (hex / rgba strings). */
type WebThemeColorRow = { [K in keyof (typeof colors)['light']]: string };
type SemanticLightRow = { [K in keyof (typeof semanticSurfaces)['light']]: string };
type SemanticDarkRow = { [K in keyof (typeof semanticSurfaces)['dark']]: string };

type Rgb = { r: number; g: number; b: number };

const neutralFamilies: Record<
  NeutralFamily,
  {
    light: Pick<
      WebThemeColorRow,
      | 'background'
      | 'backgroundSecondary'
      | 'backgroundTertiary'
      | 'foreground'
      | 'foregroundSecondary'
      | 'foregroundMuted'
      | 'card'
      | 'border'
      | 'borderLight'
      | 'borderStrong'
      | 'muted'
      | 'mutedForeground'
      | 'input'
      | 'inputBorder'
      | 'placeholder'
      | 'overlay'
    >;
    dark: Pick<
      WebThemeColorRow,
      | 'background'
      | 'backgroundSecondary'
      | 'backgroundTertiary'
      | 'foreground'
      | 'foregroundSecondary'
      | 'foregroundMuted'
      | 'card'
      | 'border'
      | 'borderLight'
      | 'borderStrong'
      | 'muted'
      | 'mutedForeground'
      | 'input'
      | 'inputBorder'
      | 'placeholder'
      | 'overlay'
    >;
  }
> = {
  warm: {
    light: {
      background: '#f7f1e6',
      backgroundSecondary: '#efe4d2',
      backgroundTertiary: '#e3d1b8',
      foreground: '#1d1813',
      foregroundSecondary: '#4e4034',
      foregroundMuted: '#6f665b',
      card: '#fff9ef',
      border: '#d8c8b2',
      borderLight: '#eee1cf',
      borderStrong: '#bdaa90',
      muted: '#efe4d2',
      mutedForeground: '#6f665b',
      input: '#f2e7d7',
      inputBorder: '#d8c8b2',
      placeholder: '#9a8c79',
      overlay: 'rgba(29, 24, 19, 0.52)',
    },
    dark: {
      background: '#0f0d0a',
      backgroundSecondary: '#15110d',
      backgroundTertiary: '#211a13',
      foreground: '#f6edde',
      foregroundSecondary: '#d8c8b2',
      foregroundMuted: '#cdbca4',
      card: '#191510',
      border: '#3b3026',
      borderLight: '#2a211a',
      borderStrong: '#574736',
      muted: '#211a13',
      mutedForeground: '#a99b88',
      input: '#211a13',
      inputBorder: '#3b3026',
      placeholder: '#9a8c79',
      overlay: 'rgba(0, 0, 0, 0.68)',
    },
  },
  sand: {
    light: {
      background: '#f6efe4',
      backgroundSecondary: '#eaddcc',
      backgroundTertiary: '#ddc9b2',
      foreground: '#211915',
      foregroundSecondary: '#534339',
      foregroundMuted: '#75675b',
      card: '#fff8ee',
      border: '#d7c4ae',
      borderLight: '#eadbc8',
      borderStrong: '#b89f82',
      muted: '#eaddcc',
      mutedForeground: '#75675b',
      input: '#f1e3d2',
      inputBorder: '#d7c4ae',
      placeholder: '#9b8b79',
      overlay: 'rgba(33, 25, 21, 0.52)',
    },
    dark: {
      background: '#100d0b',
      backgroundSecondary: '#17110e',
      backgroundTertiary: '#241a14',
      foreground: '#f7eddf',
      foregroundSecondary: '#dcc9b4',
      foregroundMuted: '#c7b7a4',
      card: '#1a1410',
      border: '#3d2e23',
      borderLight: '#2b211a',
      borderStrong: '#5a4535',
      muted: '#241a14',
      mutedForeground: '#aa9a88',
      input: '#241a14',
      inputBorder: '#3d2e23',
      placeholder: '#9b8b79',
      overlay: 'rgba(0, 0, 0, 0.68)',
    },
  },
  slate: {
    light: {
      background: '#f1f5f9',
      backgroundSecondary: '#e2e8f0',
      backgroundTertiary: '#cbd5e1',
      foreground: '#0f172a',
      foregroundSecondary: '#334155',
      foregroundMuted: '#64748b',
      card: '#ffffff',
      border: '#cbd5e1',
      borderLight: '#e2e8f0',
      borderStrong: '#94a3b8',
      muted: '#e2e8f0',
      mutedForeground: '#64748b',
      input: '#f8fafc',
      inputBorder: '#cbd5e1',
      placeholder: '#94a3b8',
      overlay: 'rgba(15, 23, 42, 0.52)',
    },
    dark: {
      background: '#020617',
      backgroundSecondary: '#0f172a',
      backgroundTertiary: '#1e293b',
      foreground: '#f1f5f9',
      foregroundSecondary: '#cbd5e1',
      foregroundMuted: '#94a3b8',
      card: '#0f172a',
      border: '#334155',
      borderLight: '#1e293b',
      borderStrong: '#475569',
      muted: '#1e293b',
      mutedForeground: '#94a3b8',
      input: '#1e293b',
      inputBorder: '#334155',
      placeholder: '#64748b',
      overlay: 'rgba(0, 0, 0, 0.68)',
    },
  },
  mauve: {
    light: {
      background: '#f7f0f5',
      backgroundSecondary: '#eadde7',
      backgroundTertiary: '#dac6d5',
      foreground: '#22161d',
      foregroundSecondary: '#563f4c',
      foregroundMuted: '#756374',
      card: '#fff8fc',
      border: '#d6c2d0',
      borderLight: '#ecdde7',
      borderStrong: '#b898aa',
      muted: '#eadde7',
      mutedForeground: '#756374',
      input: '#f1e3ed',
      inputBorder: '#d6c2d0',
      placeholder: '#9a8492',
      overlay: 'rgba(34, 22, 29, 0.52)',
    },
    dark: {
      background: '#100b0f',
      backgroundSecondary: '#171017',
      backgroundTertiary: '#241821',
      foreground: '#f7edf3',
      foregroundSecondary: '#dec9d7',
      foregroundMuted: '#c7b2c1',
      card: '#1a1118',
      border: '#3d2b38',
      borderLight: '#2b1e28',
      borderStrong: '#5b4052',
      muted: '#241821',
      mutedForeground: '#aa94a4',
      input: '#241821',
      inputBorder: '#3d2b38',
      placeholder: '#9a8492',
      overlay: 'rgba(0, 0, 0, 0.68)',
    },
  },
  sage: {
    light: {
      background: '#f2f0e7',
      backgroundSecondary: '#e3dfcf',
      backgroundTertiary: '#d0c9b1',
      foreground: '#1b1a13',
      foregroundSecondary: '#454330',
      foregroundMuted: '#686453',
      card: '#fbf8ee',
      border: '#cac1a7',
      borderLight: '#e3dac5',
      borderStrong: '#a99d7b',
      muted: '#e3dfcf',
      mutedForeground: '#686453',
      input: '#ebe5d3',
      inputBorder: '#cac1a7',
      placeholder: '#8f8872',
      overlay: 'rgba(27, 26, 19, 0.52)',
    },
    dark: {
      background: '#0d0e0a',
      backgroundSecondary: '#13150f',
      backgroundTertiary: '#1d2117',
      foreground: '#f0eedf',
      foregroundSecondary: '#d4d0b8',
      foregroundMuted: '#bbb69f',
      card: '#15180f',
      border: '#333726',
      borderLight: '#25291c',
      borderStrong: '#4c5238',
      muted: '#1d2117',
      mutedForeground: '#9d9983',
      input: '#1d2117',
      inputBorder: '#333726',
      placeholder: '#8f8872',
      overlay: 'rgba(0, 0, 0, 0.68)',
    },
  },
  pearl: {
    light: {
      background: '#f8fafc',
      backgroundSecondary: '#eef2f6',
      backgroundTertiary: '#dde5ee',
      foreground: '#111827',
      foregroundSecondary: '#3f4b5b',
      foregroundMuted: '#6b7280',
      card: '#ffffff',
      border: '#d5dde7',
      borderLight: '#e8edf3',
      borderStrong: '#aeb9c8',
      muted: '#eef2f6',
      mutedForeground: '#6b7280',
      input: '#f4f7fb',
      inputBorder: '#d5dde7',
      placeholder: '#96a0af',
      overlay: 'rgba(17, 24, 39, 0.5)',
    },
    dark: {
      background: '#080b12',
      backgroundSecondary: '#0e1320',
      backgroundTertiary: '#182131',
      foreground: '#f4f7fb',
      foregroundSecondary: '#d4dce8',
      foregroundMuted: '#a2adbc',
      card: '#111827',
      border: '#2a3547',
      borderLight: '#1d2636',
      borderStrong: '#3c4a61',
      muted: '#182131',
      mutedForeground: '#a2adbc',
      input: '#182131',
      inputBorder: '#2a3547',
      placeholder: '#748093',
      overlay: 'rgba(0, 0, 0, 0.68)',
    },
  },
  charcoal: {
    light: {
      background: '#f4f4f3',
      backgroundSecondary: '#e5e5e2',
      backgroundTertiary: '#d3d3cd',
      foreground: '#151515',
      foregroundSecondary: '#3e3e3a',
      foregroundMuted: '#686861',
      card: '#ffffff',
      border: '#cecec7',
      borderLight: '#e2e2dc',
      borderStrong: '#a8a89f',
      muted: '#e5e5e2',
      mutedForeground: '#686861',
      input: '#eeeeea',
      inputBorder: '#cecec7',
      placeholder: '#8d8d84',
      overlay: 'rgba(21, 21, 21, 0.54)',
    },
    dark: {
      background: '#050506',
      backgroundSecondary: '#0c0d0f',
      backgroundTertiary: '#17191c',
      foreground: '#f4f4f2',
      foregroundSecondary: '#d1d3d8',
      foregroundMuted: '#a5a8ad',
      card: '#101113',
      border: '#2b2d31',
      borderLight: '#1d1f23',
      borderStrong: '#45484f',
      muted: '#17191c',
      mutedForeground: '#a5a8ad',
      input: '#17191c',
      inputBorder: '#2b2d31',
      placeholder: '#777b83',
      overlay: 'rgba(0, 0, 0, 0.72)',
    },
  },
};

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hexToRgb(hex: string): Rgb {
  const normalized = hex.replace('#', '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : normalized;
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb): HexColor {
  return `#${[r, g, b]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, '0'))
    .join('')}`;
}

export function mixHex(foreground: string, background: string, amount: number): HexColor {
  const fg = hexToRgb(foreground);
  const bg = hexToRgb(background);
  const ratio = Math.max(0, Math.min(1, amount));
  return rgbToHex({
    r: fg.r * ratio + bg.r * (1 - ratio),
    g: fg.g * ratio + bg.g * (1 - ratio),
    b: fg.b * ratio + bg.b * (1 - ratio),
  });
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function getContrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

function readableOn(background: string, dark = '#1d1813', light = '#fff7ea'): HexColor {
  return getContrastRatio(light, background) >= getContrastRatio(dark, background)
    ? (light as HexColor)
    : (dark as HexColor);
}

function ensureContrast(color: HexColor, background: string, minimum = 3): HexColor {
  let next = color;
  const bgLuminance = relativeLuminance(background);
  const target = bgLuminance > 0.45 ? '#1d1813' : '#fff7ea';
  for (let i = 0; i < 8 && getContrastRatio(next, background) < minimum; i += 1) {
    next = mixHex(target, next, 0.22);
  }
  return next;
}

function buildThemeColorRows(definition: ColorThemeDefinition): {
  light: WebThemeColorRow;
  dark: WebThemeColorRow;
  surfacesLight: SemanticLightRow;
  surfacesDark: SemanticDarkRow;
} {
  const neutral = neutralFamilies[definition.neutral];
  const lightPrimary = ensureContrast(definition.primary, neutral.light.background, 3);
  const lightInfo = ensureContrast(definition.accent, neutral.light.background, 3);
  const lightAccent = mixHex(definition.accent, neutral.light.card, 0.16);
  const lightAccentForeground =
    getContrastRatio(lightPrimary, lightAccent) >= 4.5
      ? lightPrimary
      : (neutral.light.foreground as HexColor);

  const darkPrimary = ensureContrast(
    definition.darkPrimary ?? mixHex(definition.primary, '#fff7ea', 0.48),
    neutral.dark.background,
    4.5
  );
  const darkAccent = mixHex(definition.accent, neutral.dark.card, 0.24);
  const darkInfo = ensureContrast(
    mixHex(definition.accent, '#fff7ea', 0.5),
    neutral.dark.card,
    4.5
  );

  const light: WebThemeColorRow = {
    ...neutral.light,
    primary: lightPrimary,
    primaryForeground: readableOn(lightPrimary),
    cardForeground: neutral.light.foreground,
    accent: lightAccent,
    accentForeground: lightAccentForeground,
    success: '#6f7b58',
    warning: mixHex(definition.accent, '#b7832f', 0.28),
    error: '#b85c58',
    info: lightInfo,
    violet: mixHex(definition.primary, '#6574ff', 0.55),
    pink: mixHex(definition.accent, '#e76f8a', 0.45),
    inputFocus: lightPrimary,
  };

  const dark: WebThemeColorRow = {
    ...neutral.dark,
    primary: darkPrimary,
    primaryForeground: readableOn(darkPrimary),
    cardForeground: neutral.dark.foreground,
    accent: darkAccent,
    accentForeground:
      getContrastRatio(darkPrimary, darkAccent) >= 4.5
        ? darkPrimary
        : (neutral.dark.foreground as HexColor),
    success: '#a3a06f',
    warning: ensureContrast(mixHex(definition.accent, '#fff7ea', 0.42), neutral.dark.card, 4.5),
    error: '#e98a7f',
    info: darkInfo,
    violet: mixHex(darkPrimary, '#a5b4fc', 0.55),
    pink: mixHex(definition.accent, '#f0abfc', 0.44),
    inputFocus: darkPrimary,
  };

  return {
    light,
    dark,
    surfacesLight: {
      surface: light.card,
      surfaceMuted: light.muted,
      surfaceSubtle: mixHex(definition.accent, light.card, 0.08),
      border: light.border,
      borderStrong: light.borderStrong,
      infoSurface: mixHex(light.info, light.card, 0.12),
    },
    surfacesDark: {
      surface: dark.card,
      surfaceMuted: dark.muted,
      surfaceSubtle: dark.backgroundSecondary,
      border: dark.border,
      borderStrong: dark.borderStrong,
      infoSurface: mixHex(dark.info, dark.card, 0.16),
    },
  };
}

export const themeColorRowsByPalette = Object.fromEntries(
  COLOR_THEME_DEFINITIONS.map((definition) => [definition.id, buildThemeColorRows(definition)])
) as Record<
  ColorPalette,
  {
    light: WebThemeColorRow;
    dark: WebThemeColorRow;
    surfacesLight: SemanticLightRow;
    surfacesDark: SemanticDarkRow;
  }
>;

export function getThemeColors(palette: ColorPalette, mode: ThemeMode): WebThemeColorRow {
  return themeColorRowsByPalette[parseColorPalette(palette)][mode];
}

export function getThemeSemanticSurfaces(
  palette: ColorPalette,
  mode: ThemeMode
): SemanticLightRow | SemanticDarkRow {
  const rows = themeColorRowsByPalette[parseColorPalette(palette)];
  return mode === 'dark' ? rows.surfacesDark : rows.surfacesLight;
}

function createWebThemeCssVars(
  light: WebThemeColorRow,
  dark: WebThemeColorRow,
  surfacesLight: SemanticLightRow,
  surfacesDark: SemanticDarkRow
) {
  return {
    light: {
      '--ds-radius': '0.75rem',
      '--ds-primary': light.primary,
      '--ds-primary-foreground': light.primaryForeground,
      '--ds-secondary': light.backgroundSecondary,
      '--ds-secondary-foreground': light.accentForeground,
      '--ds-success': light.success,
      '--ds-success-foreground': light.primaryForeground,
      '--ds-warning': light.warning,
      '--ds-warning-foreground': light.foreground,
      '--ds-destructive': light.error,
      '--ds-destructive-foreground': light.primaryForeground,
      '--ds-info': light.info,
      '--ds-info-foreground': light.primaryForeground,
      '--ds-background': light.background,
      '--ds-foreground': light.foreground,
      '--ds-card': light.card,
      '--ds-card-foreground': light.cardForeground,
      '--ds-popover': light.card,
      '--ds-popover-foreground': light.cardForeground,
      '--ds-muted': light.muted,
      '--ds-muted-foreground': light.mutedForeground,
      '--ds-accent': light.accent,
      '--ds-accent-foreground': light.accentForeground,
      '--ds-border': light.border,
      '--ds-border-strong': light.borderStrong,
      '--ds-input': light.inputBorder,
      '--ds-ring': light.primary,
      '--ds-shadow-card': shadowTokens.card.css.light,
      '--ds-shadow-elevated': shadowTokens.elevated.css.light,
      '--ds-status-reach': 'var(--ds-destructive)',
      '--ds-status-reach-bg': 'color-mix(in oklab, var(--ds-destructive) 12%, var(--ds-card))',
      '--ds-status-reach-fg':
        'color-mix(in oklab, var(--ds-destructive) 72%, var(--ds-foreground))',
      '--ds-status-target': 'var(--ds-warning)',
      '--ds-status-target-bg': 'color-mix(in oklab, var(--ds-warning) 14%, var(--ds-card))',
      '--ds-status-target-fg': 'color-mix(in oklab, var(--ds-warning) 68%, var(--ds-foreground))',
      '--ds-status-safety': 'var(--ds-success)',
      '--ds-status-safety-bg': 'color-mix(in oklab, var(--ds-success) 12%, var(--ds-card))',
      '--ds-status-safety-fg': 'color-mix(in oklab, var(--ds-success) 70%, var(--ds-foreground))',
      '--ds-status-likely': 'var(--ds-warning)',
      '--ds-status-likely-bg': 'color-mix(in oklab, var(--ds-warning) 14%, var(--ds-card))',
      '--ds-status-likely-fg': 'color-mix(in oklab, var(--ds-warning) 70%, var(--ds-foreground))',
      '--ds-surface-muted': surfacesLight.surfaceMuted,
      '--ds-surface-subtle': surfacesLight.surfaceSubtle,
      '--ds-info-surface': surfacesLight.infoSurface,
    },
    dark: {
      '--ds-radius': '0.75rem',
      '--ds-primary': dark.primary,
      '--ds-primary-foreground': dark.primaryForeground,
      '--ds-secondary': dark.backgroundTertiary,
      '--ds-secondary-foreground': dark.accentForeground,
      '--ds-success': dark.success,
      '--ds-success-foreground': dark.primaryForeground,
      '--ds-warning': dark.warning,
      '--ds-warning-foreground': dark.primaryForeground,
      '--ds-destructive': dark.error,
      '--ds-destructive-foreground': dark.foreground,
      '--ds-info': dark.info,
      '--ds-info-foreground': dark.primaryForeground,
      '--ds-background': dark.background,
      '--ds-foreground': dark.foreground,
      '--ds-card': dark.card,
      '--ds-card-foreground': dark.cardForeground,
      '--ds-popover': dark.card,
      '--ds-popover-foreground': dark.cardForeground,
      '--ds-muted': dark.muted,
      '--ds-muted-foreground': dark.mutedForeground,
      '--ds-accent': dark.accent,
      '--ds-accent-foreground': dark.accentForeground,
      '--ds-border': dark.border,
      '--ds-border-strong': dark.borderStrong,
      '--ds-input': dark.inputBorder,
      '--ds-ring': dark.primary,
      '--ds-shadow-card': shadowTokens.card.css.dark,
      '--ds-shadow-elevated': shadowTokens.elevated.css.dark,
      '--ds-status-reach': 'var(--ds-destructive)',
      '--ds-status-reach-bg': 'color-mix(in oklab, var(--ds-destructive) 12%, var(--ds-card))',
      '--ds-status-reach-fg':
        'color-mix(in oklab, var(--ds-destructive) 72%, var(--ds-foreground))',
      '--ds-status-target': 'var(--ds-warning)',
      '--ds-status-target-bg': 'color-mix(in oklab, var(--ds-warning) 14%, var(--ds-card))',
      '--ds-status-target-fg': 'color-mix(in oklab, var(--ds-warning) 68%, var(--ds-foreground))',
      '--ds-status-safety': 'var(--ds-success)',
      '--ds-status-safety-bg': 'color-mix(in oklab, var(--ds-success) 12%, var(--ds-card))',
      '--ds-status-safety-fg': 'color-mix(in oklab, var(--ds-success) 70%, var(--ds-foreground))',
      '--ds-status-likely': 'var(--ds-warning)',
      '--ds-status-likely-bg': 'color-mix(in oklab, var(--ds-warning) 16%, var(--ds-card))',
      '--ds-status-likely-fg': 'color-mix(in oklab, var(--ds-warning) 48%, var(--ds-foreground))',
      '--ds-surface-muted': surfacesDark.surfaceMuted,
      '--ds-surface-subtle': surfacesDark.surfaceSubtle,
      '--ds-info-surface': surfacesDark.infoSurface,
    },
  } as const;
}

export const webThemeCssVarsByPalette = Object.fromEntries(
  COLOR_PALETTES.map((palette) => {
    const rows = themeColorRowsByPalette[palette];
    return [
      palette,
      createWebThemeCssVars(rows.light, rows.dark, rows.surfacesLight, rows.surfacesDark),
    ];
  })
) as Record<ColorPalette, ReturnType<typeof createWebThemeCssVars>>;

/** @deprecated Use `webThemeCssVarsByPalette[DEFAULT_COLOR_PALETTE]`. */
export const webThemeCssVars = webThemeCssVarsByPalette[DEFAULT_COLOR_PALETTE];

export function serializeCssVars(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([key, value]) => `${key}:${value};`)
    .join('');
}

/**
 * Injects `--ds-*` for each color palette + light/dark. Selectors must beat legacy `:root` rules
 * in bundled CSS; `html[data-color-palette]` wins. Warm applies when attribute absent or `warm`.
 */
export function getThemeCssText(): string {
  return COLOR_PALETTES.map((palette) => {
    const lightSelectors = [`html:not(.dark)[data-color-palette="${palette}"]`];
    const darkSelectors = [`html.dark[data-color-palette="${palette}"]`];

    if (palette === DEFAULT_COLOR_PALETTE) {
      lightSelectors.push('html:not(.dark):not([data-color-palette])');
      darkSelectors.push('html.dark:not([data-color-palette])');
      lightSelectors.push('html:not(.dark)[data-color-palette="warm"]');
      darkSelectors.push('html.dark[data-color-palette="warm"]');
    }

    if (palette === 'linear-indigo') {
      lightSelectors.push('html:not(.dark)[data-color-palette="slate"]');
      darkSelectors.push('html.dark[data-color-palette="slate"]');
    }

    const vars = webThemeCssVarsByPalette[palette];
    return `${lightSelectors.join(',')}{${serializeCssVars(vars.light)}}${darkSelectors.join(
      ','
    )}{${serializeCssVars(vars.dark)}}`;
  }).join('');
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
