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
export const THEME_APPEARANCE_OVERRIDES_STORAGE_KEY = 'theme-appearance-overrides';

export const COLOR_THEME_CATEGORIES = [
  { id: 'lumni-warm-ai', labelZh: 'Lumni / 暖 AI', labelEn: 'Lumni / Warm AI' },
  { id: 'human-ai-beige', labelZh: '人文 AI 米色', labelEn: 'Human AI Beige' },
  { id: 'premium-mono', labelZh: '高级黑白', labelEn: 'Premium Mono' },
  { id: 'framer-cool-dark', labelZh: '酷感深色', labelEn: 'Cool Dark Studio' },
  { id: 'indigo-saas', labelZh: '靛蓝 SaaS', labelEn: 'Indigo SaaS' },
  { id: 'stripe-infrastructure', labelZh: '基础设施蓝紫', labelEn: 'Infrastructure Blue' },
  { id: 'electric-ai', labelZh: '电感 AI', labelEn: 'Electric AI' },
  { id: 'purple-gradient-tech', labelZh: '紫蓝科技', labelEn: 'Purple Tech' },
  { id: 'dark-developer', labelZh: '暗色开发者', labelEn: 'Dark Developer' },
  { id: 'calm-academic-saas', labelZh: '冷静学术', labelEn: 'Calm Academic' },
  { id: 'editorial-essay', labelZh: '文书编辑', labelEn: 'Editorial Essay' },
  { id: 'warm-professional', labelZh: '暖调专业', labelEn: 'Warm Professional' },
  { id: 'consulting-finance', labelZh: '咨询金融', labelEn: 'Consulting Finance' },
  { id: 'soft-studio-pastel', labelZh: '柔和工作室', labelEn: 'Soft Studio Pastel' },
  { id: 'natural-calm', labelZh: '自然低饱和', labelEn: 'Natural Calm' },
  { id: 'high-contrast', labelZh: '高对比无障碍', labelEn: 'High Contrast' },
] as const;

export type ColorThemeCategory = (typeof COLOR_THEME_CATEGORIES)[number]['id'];

type NeutralFamily = 'warm' | 'sand' | 'slate' | 'mauve' | 'sage' | 'pearl' | 'charcoal';
type ThemeMood =
  | 'warm'
  | 'cool'
  | 'dark'
  | 'paper'
  | 'pastel'
  | 'academic'
  | 'natural'
  | 'contrast'
  | 'electric';
export type ThemeTypographyPreset = 'system' | 'humanist' | 'editorial' | 'mono' | 'compact';
export type ThemeRadiusPreset = 'sharp' | 'standard' | 'soft' | 'pill';
export type ThemeDensityPreset = 'compact' | 'standard' | 'comfortable';
export type ThemeButtonPreset = 'solid' | 'outline' | 'soft' | 'glass' | 'brutal';
export type ThemeCardPreset = 'flat' | 'bordered' | 'elevated' | 'glass' | 'editorial';
export type ThemeShadowPreset = 'none' | 'subtle' | 'medium' | 'dramatic';
export type ThemeTexturePreset = 'none' | 'grid' | 'paper' | 'noise' | 'glow';
export type ThemeMotionPreset = 'quiet' | 'standard' | 'expressive';

export type ThemeDnaPreset =
  | 'warm-editorial'
  | 'linear-hairline'
  | 'stripe-glass'
  | 'slate-cool-neutral'
  | 'forest-old-money'
  | 'midnight-prestige'
  | 'dark-developer';

export const THEME_DNA_PRESETS: ThemeDnaPreset[] = [
  'warm-editorial',
  'linear-hairline',
  'stripe-glass',
  'slate-cool-neutral',
  'forest-old-money',
  'midnight-prestige',
  'dark-developer',
];

type HexColor = `#${string}`;

export const THEME_RADIUS_PRESETS: ThemeRadiusPreset[] = ['sharp', 'standard', 'soft', 'pill'];
export const THEME_DENSITY_PRESETS: ThemeDensityPreset[] = ['compact', 'standard', 'comfortable'];
export const THEME_BUTTON_PRESETS: ThemeButtonPreset[] = [
  'solid',
  'outline',
  'soft',
  'glass',
  'brutal',
];
export const THEME_CARD_PRESETS: ThemeCardPreset[] = [
  'flat',
  'bordered',
  'elevated',
  'glass',
  'editorial',
];
export const THEME_SHADOW_PRESETS: ThemeShadowPreset[] = ['none', 'subtle', 'medium', 'dramatic'];
export const THEME_MOTION_PRESETS: ThemeMotionPreset[] = ['quiet', 'standard', 'expressive'];

export type ThemeAppearanceNumericKey =
  | 'clarity'
  | 'frost'
  | 'glow'
  | 'texture'
  | 'contrast'
  | 'saturation'
  | 'colorPresence';

export type ThemeAppearanceOverrides = Partial<{
  clarity: number;
  frost: number;
  glow: number;
  texture: number;
  contrast: number;
  saturation: number;
  colorPresence: number;
  radiusPreset: ThemeRadiusPreset;
  densityPreset: ThemeDensityPreset;
  buttonPreset: ThemeButtonPreset;
  cardPreset: ThemeCardPreset;
  shadowPreset: ThemeShadowPreset;
  motionPreset: ThemeMotionPreset;
}>;

export type ThemeAppearancePresetId = 'premium' | 'crisp' | 'glass' | 'editorial' | 'contrast';

export const THEME_APPEARANCE_PRESETS: Record<ThemeAppearancePresetId, ThemeAppearanceOverrides> = {
  premium: {
    clarity: 98,
    frost: 2,
    glow: 14,
    texture: 16,
    contrast: 84,
    saturation: 56,
    colorPresence: 22,
    radiusPreset: 'standard',
    densityPreset: 'standard',
    cardPreset: 'bordered',
    buttonPreset: 'solid',
    shadowPreset: 'subtle',
    motionPreset: 'standard',
  },
  crisp: {
    clarity: 96,
    frost: 0,
    glow: 10,
    texture: 8,
    contrast: 82,
    saturation: 62,
    colorPresence: 28,
    cardPreset: 'bordered',
    buttonPreset: 'solid',
    shadowPreset: 'subtle',
  },
  glass: {
    clarity: 74,
    frost: 62,
    glow: 48,
    texture: 24,
    contrast: 66,
    saturation: 78,
    colorPresence: 58,
    cardPreset: 'glass',
    buttonPreset: 'glass',
    shadowPreset: 'medium',
  },
  editorial: {
    clarity: 90,
    frost: 8,
    glow: 14,
    texture: 36,
    contrast: 78,
    saturation: 50,
    colorPresence: 24,
    radiusPreset: 'sharp',
    cardPreset: 'editorial',
    buttonPreset: 'outline',
    shadowPreset: 'subtle',
    motionPreset: 'quiet',
  },
  contrast: {
    clarity: 100,
    frost: 0,
    glow: 0,
    texture: 0,
    contrast: 100,
    saturation: 58,
    colorPresence: 16,
    radiusPreset: 'sharp',
    cardPreset: 'bordered',
    buttonPreset: 'brutal',
    shadowPreset: 'none',
    motionPreset: 'quiet',
  },
};

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
  mood?: ThemeMood;
  canvasStrength?: number;
  lightCanvas?: HexColor;
  lightSurface?: HexColor;
  darkCanvas?: HexColor;
  darkSurface?: HexColor;
  typographyPreset?: ThemeTypographyPreset;
  radiusPreset?: ThemeRadiusPreset;
  densityPreset?: ThemeDensityPreset;
  buttonPreset?: ThemeButtonPreset;
  cardPreset?: ThemeCardPreset;
  shadowPreset?: ThemeShadowPreset;
  texturePreset?: ThemeTexturePreset;
  motionPreset?: ThemeMotionPreset;
  dnaPreset?: ThemeDnaPreset;
  featured?: boolean;
  experimental?: boolean;
  premiumRank?: number;
};

export type ThemePackageDefinition = ColorThemeDefinition;

export const HERO_VISUAL_IDS = [
  'matrix-premium',
  'deer-moon-monolith',
  'framer-orbit',
  'lovable-aura',
  'beige-editorial',
  'command-minimal',
  'dense-cockpit',
  'centered-mark',
] as const;

export type HeroVisualId = (typeof HERO_VISUAL_IDS)[number];

export type HeroVisualDefinition = {
  id: HeroVisualId;
  labelZh: string;
  labelEn: string;
  descriptionZh: string;
  descriptionEn: string;
  tone: 'product' | 'brand' | 'dark-tech' | 'aura' | 'editorial' | 'minimal';
};

export const DEFAULT_HERO_VISUAL_ID: HeroVisualId = 'matrix-premium';
export const HERO_VISUAL_STORAGE_KEY = 'lumni-hero-visual';

export const HERO_VISUAL_DEFINITIONS = [
  {
    id: 'matrix-premium',
    labelZh: '矩阵高级版',
    labelEn: 'Matrix Premium',
    descriptionZh: '默认玻璃产品工作台，鹿月作为精致品牌章。',
    descriptionEn: 'Default glass product workbench with the deer-moon as a refined brand seal.',
    tone: 'product',
  },
  {
    id: 'deer-moon-monolith',
    labelZh: '鹿月黑金章',
    labelEn: 'Deer Moon Monolith',
    descriptionZh: '黑色鹿角托月品牌装置，悬浮说明产品能力。',
    descriptionEn: 'Black deer-and-moon brand monolith with product context on hover.',
    tone: 'brand',
  },
  {
    id: 'framer-orbit',
    labelZh: 'Framer 光轨',
    labelEn: 'Framer Orbit',
    descriptionZh: '局部暗色科技光轨，页面整体仍保持清亮。',
    descriptionEn: 'Localized dark-tech orbit visuals while the page stays bright.',
    tone: 'dark-tech',
  },
  {
    id: 'lovable-aura',
    labelZh: 'Lovable 光晕',
    labelEn: 'Lovable Aura',
    descriptionZh: '蓝粉橙柔和光晕，降低可爱感并保持企业质感。',
    descriptionEn: 'Soft blue, rose, and orange aura with a polished enterprise feel.',
    tone: 'aura',
  },
  {
    id: 'beige-editorial',
    labelZh: '米色杂志',
    labelEn: 'Beige Editorial',
    descriptionZh: 'Claude-like 米色、高级留白和黑金细节。',
    descriptionEn: 'Claude-like beige, editorial whitespace, and black-gold details.',
    tone: 'editorial',
  },
  {
    id: 'command-minimal',
    labelZh: '极简指挥台',
    labelEn: 'Command Minimal',
    descriptionZh: '最稳重的企业级 cockpit，信息密度更克制。',
    descriptionEn: 'The most restrained enterprise cockpit with calmer information density.',
    tone: 'minimal',
  },
  {
    id: 'dense-cockpit',
    labelZh: '高密度驾驶舱 · Pro',
    labelEn: 'Dense Cockpit · Pro',
    descriptionZh:
      '浏览器外壳产品台 · 学校 / 匹配 / 文书三栏循环展示，配重磅金色徽章与升学官信任带。',
    descriptionEn:
      'Browser-chrome product console with cycling list / fit / essay tabs, accent badges, and a counselor trust band.',
    tone: 'product',
  },
  {
    id: 'centered-mark',
    labelZh: '居中鹿月章 · Mark',
    labelEn: 'Centered Mark',
    descriptionZh: '鹿角与金月作为情感锚点居中展示，带鼠标视差倾斜与轻微倾斜的产品窗口。',
    descriptionEn:
      'Deer-moon mark as the emotional centerpiece with mouse-parallax tilt and a softly rotated product window.',
    tone: 'brand',
  },
] as const satisfies readonly HeroVisualDefinition[];

export function parseHeroVisualId(value: unknown): HeroVisualId {
  if (typeof value !== 'string') return DEFAULT_HERO_VISUAL_ID;
  return HERO_VISUAL_IDS.includes(value as HeroVisualId)
    ? (value as HeroVisualId)
    : DEFAULT_HERO_VISUAL_ID;
}

export function getHeroVisualDefinition(id: HeroVisualId): HeroVisualDefinition {
  return (
    HERO_VISUAL_DEFINITIONS.find((definition) => definition.id === id) ?? HERO_VISUAL_DEFINITIONS[0]
  );
}

export type ThemeStyleMeta = {
  typographyPreset: ThemeTypographyPreset;
  radiusPreset: ThemeRadiusPreset;
  densityPreset: ThemeDensityPreset;
  buttonPreset: ThemeButtonPreset;
  cardPreset: ThemeCardPreset;
  shadowPreset: ThemeShadowPreset;
  texturePreset: ThemeTexturePreset;
  motionPreset: ThemeMotionPreset;
};

const BASE_COLOR_THEME_DEFINITIONS = [
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
    featured: true,
    premiumRank: 1,
    dnaPreset: 'warm-editorial',
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
    featured: true,
    premiumRank: 4,
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
    dnaPreset: 'linear-hairline',
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
    featured: true,
    premiumRank: 7,
    dnaPreset: 'slate-cool-neutral',
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
    featured: true,
    premiumRank: 8,
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
    featured: true,
    premiumRank: 9,
    dnaPreset: 'stripe-glass',
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
    experimental: true,
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
    experimental: true,
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
    dnaPreset: 'dark-developer',
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
    dnaPreset: 'forest-old-money',
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

const EXTRA_COLOR_THEME_DEFINITIONS = [
  {
    id: 'oatmeal-ai',
    category: 'human-ai-beige',
    labelZh: '燕麦 AI',
    labelEn: 'Oatmeal AI',
    descriptionZh: '燕麦米色和陶土高光，亲近但不幼稚。',
    descriptionEn: 'Oatmeal neutrals with clay highlights for approachable AI.',
    primary: '#6f4f3a',
    accent: '#c57b45',
    neutral: 'sand',
    darkPrimary: '#d8a57d',
  },
  {
    id: 'parchment-copper',
    category: 'human-ai-beige',
    labelZh: '羊皮纸铜',
    labelEn: 'Parchment Copper',
    descriptionZh: '纸感底色和铜色重点，适合长文阅读。',
    descriptionEn: 'Parchment surfaces and copper accents for reading-heavy flows.',
    primary: '#5b4636',
    accent: '#c17b4a',
    neutral: 'warm',
    darkPrimary: '#d9a177',
  },
  {
    id: 'vanilla-ink',
    category: 'human-ai-beige',
    labelZh: '香草墨色',
    labelEn: 'Vanilla Ink',
    descriptionZh: '香草米白配墨色 CTA，高级而克制。',
    descriptionEn: 'Vanilla ivory with ink actions for restrained premium UI.',
    primary: '#211a15',
    accent: '#e2b66f',
    neutral: 'warm',
    darkPrimary: '#e8c985',
  },
  {
    id: 'soft-clay-ai',
    category: 'human-ai-beige',
    labelZh: '柔陶 AI',
    labelEn: 'Soft Clay AI',
    descriptionZh: '柔陶红橙，适合温暖的 AI 助手体验。',
    descriptionEn: 'Soft clay-orange for warmer assistant experiences.',
    primary: '#8a4b39',
    accent: '#d98a64',
    neutral: 'sand',
    darkPrimary: '#eda888',
  },
  {
    id: 'cream-charcoal',
    category: 'human-ai-beige',
    labelZh: '奶油炭灰',
    labelEn: 'Cream Charcoal',
    descriptionZh: '奶油底与炭灰字色，类似现代 AI 文档工具。',
    descriptionEn: 'Cream base and charcoal ink for modern AI document tooling.',
    primary: '#2f2a25',
    accent: '#bfa584',
    neutral: 'sand',
    darkPrimary: '#d9c6aa',
  },
  {
    id: 'peach-paper',
    category: 'human-ai-beige',
    labelZh: '桃色纸面',
    labelEn: 'Peach Paper',
    descriptionZh: '桃杏纸感，适合 onboarding 和轻咨询。',
    descriptionEn: 'Peach-paper warmth for onboarding and light advisory flows.',
    primary: '#8f4b3f',
    accent: '#f0a36a',
    neutral: 'sand',
    darkPrimary: '#f5b98c',
  },
  {
    id: 'cocoa-beige',
    category: 'human-ai-beige',
    labelZh: '可可米色',
    labelEn: 'Cocoa Beige',
    descriptionZh: '可可棕和米色，稳重的人文科技感。',
    descriptionEn: 'Cocoa brown over beige for grounded human-tech warmth.',
    primary: '#604539',
    accent: '#b78a62',
    neutral: 'warm',
    darkPrimary: '#d2aa86',
  },
  {
    id: 'maple-cream',
    category: 'human-ai-beige',
    labelZh: '枫糖奶油',
    labelEn: 'Maple Cream',
    descriptionZh: '枫糖金棕，高级但比默认更明亮。',
    descriptionEn: 'Maple-gold warmth that feels brighter than the default.',
    primary: '#7c4a21',
    accent: '#d8a04e',
    neutral: 'warm',
    darkPrimary: '#e7bd75',
  },

  {
    id: 'studio-black-blue',
    category: 'framer-cool-dark',
    labelZh: '工作室黑蓝',
    labelEn: 'Studio Black Blue',
    descriptionZh: '黑白底加电蓝高光，偏酷感官网。',
    descriptionEn: 'Black-white base with electric blue highlights.',
    primary: '#050505',
    accent: '#0099ff',
    neutral: 'charcoal',
    darkPrimary: '#ffffff',
    experimental: true,
  },
  {
    id: 'chrome-glass',
    category: 'framer-cool-dark',
    labelZh: '铬色玻璃',
    labelEn: 'Chrome Glass',
    descriptionZh: '深色玻璃和冰蓝边缘，科技展示感强。',
    descriptionEn: 'Dark glass with icy blue edges for tech showcase pages.',
    primary: '#0b0f19',
    accent: '#7dd3fc',
    neutral: 'charcoal',
    darkPrimary: '#bae6fd',
  },
  {
    id: 'neon-edge',
    category: 'framer-cool-dark',
    labelZh: '霓虹边缘',
    labelEn: 'Neon Edge',
    descriptionZh: '黑底紫色边缘光，适合强视觉首屏。',
    descriptionEn: 'Black surfaces with violet edge light for bold hero sections.',
    primary: '#111827',
    accent: '#8b5cf6',
    neutral: 'charcoal',
    darkPrimary: '#c4b5fd',
  },
  {
    id: 'liquid-black',
    category: 'framer-cool-dark',
    labelZh: '液态黑',
    labelEn: 'Liquid Black',
    descriptionZh: '极深背景与青色流光，偏未来工具感。',
    descriptionEn: 'Deep black with cyan light for future-tool energy.',
    primary: '#020617',
    accent: '#22d3ee',
    neutral: 'charcoal',
    darkPrimary: '#67e8f9',
  },
  {
    id: 'carbon-violet',
    category: 'framer-cool-dark',
    labelZh: '碳紫',
    labelEn: 'Carbon Violet',
    descriptionZh: '碳黑和紫色，适合设计/创作场景。',
    descriptionEn: 'Carbon black and violet for design and creation surfaces.',
    primary: '#18181b',
    accent: '#a855f7',
    neutral: 'charcoal',
    darkPrimary: '#d8b4fe',
  },
  {
    id: 'optic-blue',
    category: 'framer-cool-dark',
    labelZh: '光学蓝',
    labelEn: 'Optic Blue',
    descriptionZh: '深蓝黑与亮蓝，专业且有冲击力。',
    descriptionEn: 'Blue-black with bright blue for polished visual impact.',
    primary: '#0f172a',
    accent: '#3b82f6',
    neutral: 'charcoal',
    darkPrimary: '#93c5fd',
  },
  {
    id: 'deep-space-ui',
    category: 'framer-cool-dark',
    labelZh: '深空 UI',
    labelEn: 'Deep Space UI',
    descriptionZh: '深空黑和蓝紫，偏 AI 控制台。',
    descriptionEn: 'Deep-space black and blue-violet for AI console surfaces.',
    primary: '#09090b',
    accent: '#6574ff',
    neutral: 'charcoal',
    darkPrimary: '#a5b4fc',
  },
  {
    id: 'black-sapphire',
    category: 'framer-cool-dark',
    labelZh: '黑蓝宝石',
    labelEn: 'Black Sapphire',
    descriptionZh: '蓝宝石高光，适合暗色高级品牌感。',
    descriptionEn: 'Sapphire highlights for premium dark-brand styling.',
    primary: '#0b1120',
    accent: '#60a5fa',
    neutral: 'charcoal',
    darkPrimary: '#bfdbfe',
  },

  {
    id: 'blurple-infra',
    category: 'stripe-infrastructure',
    labelZh: '蓝紫基础设施',
    labelEn: 'Blurple Infra',
    descriptionZh: '蓝紫和青色，偏 API/支付基础设施。',
    descriptionEn: 'Blurple and cyan for API and infrastructure workflows.',
    primary: '#635bff',
    accent: '#00d4ff',
    neutral: 'pearl',
    darkPrimary: '#a5b4fc',
  },
  {
    id: 'cloud-slate',
    category: 'stripe-infrastructure',
    labelZh: '云端板岩',
    labelEn: 'Cloud Slate',
    descriptionZh: '板岩灰和云蓝，干净的 SaaS 控制台。',
    descriptionEn: 'Slate gray and cloud blue for clean SaaS consoles.',
    primary: '#334155',
    accent: '#3b82f6',
    neutral: 'slate',
    darkPrimary: '#93c5fd',
  },
  {
    id: 'payment-blue',
    category: 'stripe-infrastructure',
    labelZh: '支付蓝',
    labelEn: 'Payment Blue',
    descriptionZh: '可信蓝和紫色，适合账户/订阅界面。',
    descriptionEn: 'Trust blue and violet for account and subscription UI.',
    primary: '#2563eb',
    accent: '#7c3aed',
    neutral: 'pearl',
    darkPrimary: '#93c5fd',
  },
  {
    id: 'api-cobalt',
    category: 'stripe-infrastructure',
    labelZh: 'API 钴蓝',
    labelEn: 'API Cobalt',
    descriptionZh: '钴蓝与青色，偏工程平台感。',
    descriptionEn: 'Cobalt and cyan for platform-engineering surfaces.',
    primary: '#1d4ed8',
    accent: '#22d3ee',
    neutral: 'slate',
    darkPrimary: '#93c5fd',
  },
  {
    id: 'data-indigo',
    category: 'stripe-infrastructure',
    labelZh: '数据靛蓝',
    labelEn: 'Data Indigo',
    descriptionZh: '靛蓝和青色，适合图表/分析。',
    descriptionEn: 'Indigo and cyan tuned for charts and analytics.',
    primary: '#4f46e5',
    accent: '#06b6d4',
    neutral: 'pearl',
    darkPrimary: '#a5b4fc',
  },
  {
    id: 'trust-navy',
    category: 'stripe-infrastructure',
    labelZh: '可信海军蓝',
    labelEn: 'Trust Navy',
    descriptionZh: '海军蓝和浅蓝，安全可信。',
    descriptionEn: 'Navy and light blue for secure, trustworthy UI.',
    primary: '#172554',
    accent: '#60a5fa',
    neutral: 'slate',
    darkPrimary: '#bfdbfe',
  },
  {
    id: 'platform-purple',
    category: 'stripe-infrastructure',
    labelZh: '平台紫',
    labelEn: 'Platform Purple',
    descriptionZh: '平台感紫色和青蓝，适合工具页。',
    descriptionEn: 'Platform violet and cyan-blue for tooling pages.',
    primary: '#5b21b6',
    accent: '#38bdf8',
    neutral: 'pearl',
    darkPrimary: '#c4b5fd',
  },
  {
    id: 'terminal-cloud',
    category: 'stripe-infrastructure',
    labelZh: '终端云',
    labelEn: 'Terminal Cloud',
    descriptionZh: '蓝绿和靛蓝，作为云工具风格。',
    descriptionEn: 'Teal and indigo for cloud-tool interface styling.',
    primary: '#0f766e',
    accent: '#6366f1',
    neutral: 'slate',
    darkPrimary: '#5eead4',
  },

  {
    id: 'manuscript-rose',
    category: 'editorial-essay',
    labelZh: '手稿玫瑰',
    labelEn: 'Manuscript Rose',
    descriptionZh: '玫瑰手稿感，适合文书修改。',
    descriptionEn: 'Rose manuscript styling for essay revision flows.',
    primary: '#7f3b4b',
    accent: '#d98ba3',
    neutral: 'mauve',
    darkPrimary: '#e7a7b8',
  },
  {
    id: 'annotation-amber',
    category: 'editorial-essay',
    labelZh: '批注琥珀',
    labelEn: 'Annotation Amber',
    descriptionZh: '琥珀批注感，强调建议和反馈。',
    descriptionEn: 'Amber annotation accents for suggestions and feedback.',
    primary: '#704214',
    accent: '#d6a337',
    neutral: 'warm',
    darkPrimary: '#e6c766',
  },
  {
    id: 'draft-mauve',
    category: 'editorial-essay',
    labelZh: '草稿灰紫',
    labelEn: 'Draft Mauve',
    descriptionZh: '灰紫草稿感，适合沉浸写作。',
    descriptionEn: 'Mauve draft surfaces for immersive writing.',
    primary: '#6b5262',
    accent: '#b38aa5',
    neutral: 'mauve',
    darkPrimary: '#d8a7c6',
  },
  {
    id: 'letterpress',
    category: 'editorial-essay',
    labelZh: '活版印刷',
    labelEn: 'Letterpress',
    descriptionZh: '墨色和旧纸高光，阅读感更强。',
    descriptionEn: 'Ink and aged-paper highlights for stronger editorial tone.',
    primary: '#24201c',
    accent: '#a68a64',
    neutral: 'warm',
    darkPrimary: '#d2b890',
  },
  {
    id: 'archive-paper',
    category: 'editorial-essay',
    labelZh: '档案纸',
    labelEn: 'Archive Paper',
    descriptionZh: '档案纸和浅棕，适合资料整理。',
    descriptionEn: 'Archive paper and light brown for profile organization.',
    primary: '#5c4b3d',
    accent: '#b6976b',
    neutral: 'warm',
    darkPrimary: '#d4b98a',
  },
  {
    id: 'editorial-ink',
    category: 'editorial-essay',
    labelZh: '编辑墨色',
    labelEn: 'Editorial Ink',
    descriptionZh: '黑墨色和纸张中性色，最克制的文书主题。',
    descriptionEn: 'Ink and paper neutrals for the most restrained essay theme.',
    primary: '#171717',
    accent: '#a68a64',
    neutral: 'warm',
    darkPrimary: '#d7c6ad',
  },
  {
    id: 'margin-lilac',
    category: 'editorial-essay',
    labelZh: '页边丁香',
    labelEn: 'Margin Lilac',
    descriptionZh: '页边批注式丁香紫，适合资料卡片。',
    descriptionEn: 'Lilac margin-note styling for profile and document cards.',
    primary: '#5b4b72',
    accent: '#b9a1d0',
    neutral: 'mauve',
    darkPrimary: '#d7c1ea',
  },
  {
    id: 'proofreader-blue',
    category: 'editorial-essay',
    labelZh: '校对蓝',
    labelEn: 'Proofreader Blue',
    descriptionZh: '蓝灰校对感，适合 AI 修改建议。',
    descriptionEn: 'Blue-gray proofreading tone for AI revision suggestions.',
    primary: '#2f4f68',
    accent: '#7da6c8',
    neutral: 'pearl',
    darkPrimary: '#a8c7df',
  },

  {
    id: 'boardroom-navy',
    category: 'consulting-finance',
    labelZh: '董事会海军蓝',
    labelEn: 'Boardroom Navy',
    descriptionZh: '海军蓝和金色，高端咨询感。',
    descriptionEn: 'Navy and gold for premium advisory experiences.',
    primary: '#111f3d',
    accent: '#c7a45b',
    neutral: 'slate',
    darkPrimary: '#c8d4ff',
    dnaPreset: 'midnight-prestige',
  },
  {
    id: 'brass-black',
    category: 'consulting-finance',
    labelZh: '黄铜黑',
    labelEn: 'Brass Black',
    descriptionZh: '黑色和黄铜，高级商务风。',
    descriptionEn: 'Black and brass for polished business surfaces.',
    primary: '#16120f',
    accent: '#b88a3d',
    neutral: 'warm',
    darkPrimary: '#d8b56f',
  },
  {
    id: 'premium-burgundy',
    category: 'consulting-finance',
    labelZh: '高级酒红',
    labelEn: 'Premium Burgundy',
    descriptionZh: '酒红和暖金，适合付费/高端入口。',
    descriptionEn: 'Burgundy and warm gold for premium upgrade surfaces.',
    primary: '#6f1d2c',
    accent: '#c28b55',
    neutral: 'warm',
    darkPrimary: '#e5a3ad',
  },
  {
    id: 'market-blue',
    category: 'consulting-finance',
    labelZh: '市场蓝',
    labelEn: 'Market Blue',
    descriptionZh: '市场分析式蓝色，适合数据/榜单。',
    descriptionEn: 'Market-analysis blue for data and ranking interfaces.',
    primary: '#173f5f',
    accent: '#3ca6d0',
    neutral: 'slate',
    darkPrimary: '#93c5fd',
  },
  {
    id: 'executive-taupe',
    category: 'consulting-finance',
    labelZh: '行政灰褐',
    labelEn: 'Executive Taupe',
    descriptionZh: '灰褐和浅金，成熟稳重。',
    descriptionEn: 'Taupe and pale gold for mature, stable product UI.',
    primary: '#4a4038',
    accent: '#b8a086',
    neutral: 'sand',
    darkPrimary: '#d3bea3',
  },
  {
    id: 'dossier-navy',
    category: 'consulting-finance',
    labelZh: '档案海军蓝',
    labelEn: 'Dossier Navy',
    descriptionZh: '深蓝和月金，适合申请档案系统。',
    descriptionEn: 'Deep navy and moon gold for application dossiers.',
    primary: '#1e2a44',
    accent: '#d1a85a',
    neutral: 'slate',
    darkPrimary: '#c7d2fe',
  },
  {
    id: 'walnut-gold',
    category: 'consulting-finance',
    labelZh: '胡桃金',
    labelEn: 'Walnut Gold',
    descriptionZh: '胡桃棕和金色，偏高端服务品牌。',
    descriptionEn: 'Walnut brown and gold for high-touch service branding.',
    primary: '#4b2e1f',
    accent: '#c68d3d',
    neutral: 'warm',
    darkPrimary: '#e0b16d',
  },
  {
    id: 'capital-graphite',
    category: 'consulting-finance',
    labelZh: '资本石墨',
    labelEn: 'Capital Graphite',
    descriptionZh: '石墨和钢蓝，冷静专业。',
    descriptionEn: 'Graphite and steel blue for calm professional interfaces.',
    primary: '#2b3036',
    accent: '#8da2b8',
    neutral: 'charcoal',
    darkPrimary: '#c4ced8',
  },

  {
    id: 'lavender-paper',
    category: 'soft-studio-pastel',
    labelZh: '薰衣草纸',
    labelEn: 'Lavender Paper',
    descriptionZh: '柔和薰衣草紫，适合温柔创作感。',
    descriptionEn: 'Soft lavender paper for gentle creative flows.',
    primary: '#6d5d8c',
    accent: '#c7b7f3',
    neutral: 'mauve',
    darkPrimary: '#ddd6fe',
  },
  {
    id: 'powder-blue',
    category: 'soft-studio-pastel',
    labelZh: '粉雾蓝',
    labelEn: 'Powder Blue',
    descriptionZh: '粉雾浅蓝，清爽低压。',
    descriptionEn: 'Powder blue for fresh, low-pressure screens.',
    primary: '#3b6380',
    accent: '#a8d8f0',
    neutral: 'pearl',
    darkPrimary: '#bae6fd',
  },
  {
    id: 'peach-glass',
    category: 'soft-studio-pastel',
    labelZh: '蜜桃玻璃',
    labelEn: 'Peach Glass',
    descriptionZh: '蜜桃和半透明感，适合轻盈活动页。',
    descriptionEn: 'Peach glass accents for light campaign surfaces.',
    primary: '#8f5149',
    accent: '#f4a38b',
    neutral: 'sand',
    darkPrimary: '#fecaca',
  },
  {
    id: 'rose-quartz',
    category: 'soft-studio-pastel',
    labelZh: '玫瑰石英',
    labelEn: 'Rose Quartz',
    descriptionZh: '柔玫瑰石英色，适合社群与案例。',
    descriptionEn: 'Soft rose-quartz tone for community and case pages.',
    primary: '#8f4a62',
    accent: '#e7a5b7',
    neutral: 'mauve',
    darkPrimary: '#f9a8d4',
  },
  {
    id: 'buttercream',
    category: 'soft-studio-pastel',
    labelZh: '奶油黄',
    labelEn: 'Buttercream',
    descriptionZh: '奶油黄高光，温暖但不过分甜。',
    descriptionEn: 'Buttercream yellow that feels warm without being too sweet.',
    primary: '#7a5c24',
    accent: '#f2c76b',
    neutral: 'warm',
    darkPrimary: '#fde68a',
  },
  {
    id: 'mint-quiet',
    category: 'soft-studio-pastel',
    labelZh: '静谧薄荷',
    labelEn: 'Quiet Mint',
    descriptionZh: '低饱和薄荷，少量保留绿色清爽感。',
    descriptionEn: 'Low-saturation mint, keeping green fresh and restrained.',
    primary: '#32675e',
    accent: '#9fd8c8',
    neutral: 'sage',
    darkPrimary: '#bbf7d0',
  },
  {
    id: 'sky-blush',
    category: 'soft-studio-pastel',
    labelZh: '天空腮红',
    labelEn: 'Sky Blush',
    descriptionZh: '蓝灰配腮红，适合轻社交界面。',
    descriptionEn: 'Blue-gray with blush accents for light social UI.',
    primary: '#4d6d8b',
    accent: '#f0a6b8',
    neutral: 'pearl',
    darkPrimary: '#bfdbfe',
  },
  {
    id: 'pearl-violet',
    category: 'soft-studio-pastel',
    labelZh: '珍珠紫',
    labelEn: 'Pearl Violet',
    descriptionZh: '珍珠底和柔紫，高级轻盈。',
    descriptionEn: 'Pearl base and soft violet for airy premium styling.',
    primary: '#514f7d',
    accent: '#aaa7e8',
    neutral: 'pearl',
    darkPrimary: '#c4b5fd',
  },

  {
    id: 'eucalyptus',
    category: 'natural-calm',
    labelZh: '尤加利',
    labelEn: 'Eucalyptus',
    descriptionZh: '尤加利绿灰，自然低饱和。',
    descriptionEn: 'Eucalyptus green-gray for quiet natural calm.',
    primary: '#3f6f64',
    accent: '#93c9b4',
    neutral: 'sage',
    darkPrimary: '#a7f3d0',
  },
  {
    id: 'forest-slate',
    category: 'natural-calm',
    labelZh: '森林板岩',
    labelEn: 'Forest Slate',
    descriptionZh: '森林绿和板岩感，适合长期使用。',
    descriptionEn: 'Forest green and slate for long-session interfaces.',
    primary: '#24463d',
    accent: '#7aa891',
    neutral: 'sage',
    darkPrimary: '#9fd8bd',
  },
  {
    id: 'moss-ivory',
    category: 'natural-calm',
    labelZh: '苔藓象牙',
    labelEn: 'Moss Ivory',
    descriptionZh: '苔藓和象牙白，低刺激阅读环境。',
    descriptionEn: 'Moss and ivory for low-stimulus reading environments.',
    primary: '#4f5d38',
    accent: '#a8a66f',
    neutral: 'sage',
    darkPrimary: '#d9d38f',
  },
  {
    id: 'lake-teal',
    category: 'natural-calm',
    labelZh: '湖水蓝绿',
    labelEn: 'Lake Teal',
    descriptionZh: '湖水蓝绿，适合搜索和探索。',
    descriptionEn: 'Lake teal for search and discovery surfaces.',
    primary: '#155e75',
    accent: '#5eead4',
    neutral: 'slate',
    darkPrimary: '#99f6e4',
  },
  {
    id: 'clay-sage',
    category: 'natural-calm',
    labelZh: '陶土鼠尾草',
    labelEn: 'Clay Sage',
    descriptionZh: '陶土和鼠尾草，温和自然。',
    descriptionEn: 'Clay and sage for a soft natural balance.',
    primary: '#6b6042',
    accent: '#b6a76a',
    neutral: 'sage',
    darkPrimary: '#d8ce8f',
  },
  {
    id: 'mineral-green',
    category: 'natural-calm',
    labelZh: '矿物绿',
    labelEn: 'Mineral Green',
    descriptionZh: '矿物绿灰，专业但不冷。',
    descriptionEn: 'Mineral green-gray that feels professional without coldness.',
    primary: '#3d5a4b',
    accent: '#86b89a',
    neutral: 'sage',
    darkPrimary: '#bbf7d0',
  },
  {
    id: 'cedar-cream',
    category: 'natural-calm',
    labelZh: '雪松奶油',
    labelEn: 'Cedar Cream',
    descriptionZh: '雪松棕和奶油底，适合品牌故事感。',
    descriptionEn: 'Cedar brown over cream for a grounded brand-story feel.',
    primary: '#5a3425',
    accent: '#b9855b',
    neutral: 'warm',
    darkPrimary: '#e0a47d',
  },
  {
    id: 'stone-olive',
    category: 'natural-calm',
    labelZh: '石橄榄',
    labelEn: 'Stone Olive',
    descriptionZh: '石灰和橄榄，克制的自然专业感。',
    descriptionEn: 'Stone gray and olive for restrained natural professionalism.',
    primary: '#57534e',
    accent: '#9ca37a',
    neutral: 'sage',
    darkPrimary: '#d4d4aa',
  },

  {
    id: 'contrast-black-white',
    category: 'high-contrast',
    labelZh: '黑白高对比',
    labelEn: 'Black White Contrast',
    descriptionZh: '黑白强对比，适合高可读性。',
    descriptionEn: 'Strong black-white contrast for maximum readability.',
    primary: '#000000',
    accent: '#005fcc',
    neutral: 'pearl',
    darkPrimary: '#ffffff',
  },
  {
    id: 'contrast-white-black',
    category: 'high-contrast',
    labelZh: '白黑金',
    labelEn: 'White Black Gold',
    descriptionZh: '白底黑字和金色焦点，高级且清晰。',
    descriptionEn: 'White, black, and gold focus accents for crisp premium UI.',
    primary: '#111111',
    accent: '#facc15',
    neutral: 'warm',
    darkPrimary: '#ffffff',
  },
  {
    id: 'contrast-blue',
    category: 'high-contrast',
    labelZh: '高对比蓝',
    labelEn: 'Contrast Blue',
    descriptionZh: '高饱和蓝和青色，适合明显交互状态。',
    descriptionEn: 'High-saturation blue and cyan for obvious interaction states.',
    primary: '#0037ff',
    accent: '#00e5ff',
    neutral: 'pearl',
    darkPrimary: '#93c5fd',
  },
  {
    id: 'contrast-amber',
    category: 'high-contrast',
    labelZh: '高对比琥珀',
    labelEn: 'Contrast Amber',
    descriptionZh: '深棕和琥珀，暖色高对比。',
    descriptionEn: 'Deep brown and amber for warm high-contrast UI.',
    primary: '#422006',
    accent: '#f59e0b',
    neutral: 'warm',
    darkPrimary: '#fbbf24',
  },
  {
    id: 'contrast-violet',
    category: 'high-contrast',
    labelZh: '高对比紫',
    labelEn: 'Contrast Violet',
    descriptionZh: '深紫和亮紫，强辨识度。',
    descriptionEn: 'Deep and bright violet for strong identity.',
    primary: '#4c1d95',
    accent: '#c084fc',
    neutral: 'mauve',
    darkPrimary: '#ddd6fe',
  },
  {
    id: 'contrast-navy',
    category: 'high-contrast',
    labelZh: '高对比海军蓝',
    labelEn: 'Contrast Navy',
    descriptionZh: '深海军蓝和天蓝，高级可读。',
    descriptionEn: 'Deep navy and sky blue for premium readable contrast.',
    primary: '#020617',
    accent: '#38bdf8',
    neutral: 'slate',
    darkPrimary: '#bae6fd',
  },
  {
    id: 'contrast-paper',
    category: 'high-contrast',
    labelZh: '纸面红黑',
    labelEn: 'Paper Red Black',
    descriptionZh: '纸白、黑字和红色重点，适合提醒密集页。',
    descriptionEn: 'Paper, black, and red accents for alert-heavy workflows.',
    primary: '#1c1917',
    accent: '#dc2626',
    neutral: 'warm',
    darkPrimary: '#fecaca',
  },
  {
    id: 'contrast-cyan',
    category: 'high-contrast',
    labelZh: '高对比青',
    labelEn: 'Contrast Cyan',
    descriptionZh: '深青和亮青，现代无障碍科技感。',
    descriptionEn: 'Deep cyan and bright cyan for accessible modern tech.',
    primary: '#003344',
    accent: '#22d3ee',
    neutral: 'pearl',
    darkPrimary: '#a5f3fc',
  },
] as const satisfies readonly ColorThemeDefinition[];

const ENTERPRISE_COLOR_THEME_DEFINITIONS = [
  {
    id: 'lumni-starlight',
    category: 'lumni-warm-ai',
    labelZh: 'Lumni 星月白',
    labelEn: 'Lumni Starlight',
    descriptionZh: '更轻盈的星月白和月金高光，减少暗色压迫感。',
    descriptionEn: 'A lighter starlit ivory with moon-gold highlights.',
    primary: '#211b15',
    accent: '#e0b95d',
    neutral: 'warm',
    darkPrimary: '#f0d28a',
    canvasStrength: 0.12,
    buttonPreset: 'solid',
    cardPreset: 'bordered',
    texturePreset: 'paper',
    featured: true,
    premiumRank: 2,
  },
  {
    id: 'lumni-pearl-gold',
    category: 'lumni-warm-ai',
    labelZh: 'Lumni 珍珠金',
    labelEn: 'Lumni Pearl Gold',
    descriptionZh: '珍珠白画布和克制金色，适合企业级首页。',
    descriptionEn: 'Pearl canvas with restrained gold for enterprise landing pages.',
    primary: '#2a241c',
    accent: '#caa45a',
    neutral: 'pearl',
    darkPrimary: '#e6c987',
    canvasStrength: 0.1,
    radiusPreset: 'standard',
    shadowPreset: 'subtle',
    featured: true,
    premiumRank: 3,
  },
  {
    id: 'notion-cream-ai',
    category: 'human-ai-beige',
    labelZh: 'Notion 奶油 AI',
    labelEn: 'Notion Cream AI',
    descriptionZh: '奶油文档底和墨色操作，适合阅读型工作台。',
    descriptionEn: 'Cream document surfaces and ink actions for reading-heavy tools.',
    primary: '#2b2520',
    accent: '#b98b5e',
    neutral: 'sand',
    darkPrimary: '#d9b184',
    canvasStrength: 0.09,
    typographyPreset: 'humanist',
    texturePreset: 'paper',
    featured: true,
    premiumRank: 6,
  },
  {
    id: 'linen-coral',
    category: 'human-ai-beige',
    labelZh: '亚麻珊瑚',
    labelEn: 'Linen Coral',
    descriptionZh: '亚麻底与珊瑚重点，温暖但更现代。',
    descriptionEn: 'Linen canvas with coral accents for modern warmth.',
    primary: '#754438',
    accent: '#e07961',
    neutral: 'sand',
    darkPrimary: '#f0a28c',
    canvasStrength: 0.12,
    cardPreset: 'editorial',
  },
  {
    id: 'mono-swiss',
    category: 'premium-mono',
    labelZh: '瑞士单色',
    labelEn: 'Swiss Mono',
    descriptionZh: '瑞士排版感黑白灰，界面更利落。',
    descriptionEn: 'Swiss-style monochrome with crisp interface contrast.',
    primary: '#111111',
    accent: '#737373',
    neutral: 'pearl',
    darkPrimary: '#fafafa',
    typographyPreset: 'compact',
    radiusPreset: 'sharp',
    buttonPreset: 'outline',
    cardPreset: 'flat',
    shadowPreset: 'none',
    featured: true,
    premiumRank: 5,
  },
  {
    id: 'gallery-ink',
    category: 'premium-mono',
    labelZh: '画廊墨色',
    labelEn: 'Gallery Ink',
    descriptionZh: '画廊白、墨色字和细边框，适合高级内容页。',
    descriptionEn: 'Gallery white, ink text, and fine borders for premium content.',
    primary: '#181716',
    accent: '#9b948a',
    neutral: 'warm',
    darkPrimary: '#e8e3da',
    typographyPreset: 'editorial',
    cardPreset: 'editorial',
    featured: true,
    premiumRank: 10,
  },
  {
    id: 'framer-plasma',
    category: 'framer-cool-dark',
    labelZh: 'Framer 等离子',
    labelEn: 'Framer Plasma',
    descriptionZh: '亮蓝紫高光和玻璃层级，偏视觉设计工具。',
    descriptionEn: 'Blue-violet plasma highlights with glassy design-tool layers.',
    primary: '#101827',
    accent: '#7c5cff',
    neutral: 'charcoal',
    darkPrimary: '#c7d2fe',
    canvasStrength: 0.12,
    buttonPreset: 'glass',
    cardPreset: 'glass',
    texturePreset: 'glow',
    experimental: true,
  },
  {
    id: 'studio-cobalt-black',
    category: 'framer-cool-dark',
    labelZh: '钴黑工作室',
    labelEn: 'Studio Cobalt Black',
    descriptionZh: '钴蓝与黑白工作室感，保留酷感但不压暗浅色模式。',
    descriptionEn: 'Cobalt studio styling without darkening the light canvas.',
    primary: '#0b1220',
    accent: '#2563eb',
    neutral: 'pearl',
    darkPrimary: '#93c5fd',
    canvasStrength: 0.1,
    shadowPreset: 'dramatic',
  },
  {
    id: 'saas-mint-blue',
    category: 'indigo-saas',
    labelZh: 'SaaS 薄荷蓝',
    labelEn: 'SaaS Mint Blue',
    descriptionZh: '清爽蓝绿企业工具感，降低传统靛蓝厚重感。',
    descriptionEn: 'Fresh blue-green enterprise tooling with lighter SaaS energy.',
    primary: '#145369',
    accent: '#2dd4bf',
    neutral: 'pearl',
    darkPrimary: '#99f6e4',
    canvasStrength: 0.11,
  },
  {
    id: 'product-hunt-clean',
    category: 'indigo-saas',
    labelZh: '产品清单橙',
    labelEn: 'Product Clean Orange',
    descriptionZh: '白底、深蓝文字和产品感橙色 CTA。',
    descriptionEn: 'White canvas, navy text, and product-orange CTAs.',
    primary: '#172554',
    accent: '#f97316',
    neutral: 'pearl',
    darkPrimary: '#bfdbfe',
    canvasStrength: 0.08,
    buttonPreset: 'solid',
  },
  {
    id: 'infra-azure',
    category: 'stripe-infrastructure',
    labelZh: '基础设施天青',
    labelEn: 'Infrastructure Azure',
    descriptionZh: '天青和冷白，类似现代支付/云服务官网。',
    descriptionEn: 'Azure and cool white for payment and cloud infrastructure UI.',
    primary: '#0f3d75',
    accent: '#38bdf8',
    neutral: 'pearl',
    darkPrimary: '#bae6fd',
    canvasStrength: 0.1,
  },
  {
    id: 'payments-violet',
    category: 'stripe-infrastructure',
    labelZh: '支付紫蓝',
    labelEn: 'Payments Violet',
    descriptionZh: '紫蓝交易工具感，适合数据密集面板。',
    descriptionEn: 'Violet-blue payment tooling for dense data panels.',
    primary: '#3730a3',
    accent: '#8b5cf6',
    neutral: 'slate',
    darkPrimary: '#c4b5fd',
    canvasStrength: 0.1,
  },
  {
    id: 'electric-mint',
    category: 'electric-ai',
    labelZh: '电感薄荷',
    labelEn: 'Electric Mint',
    descriptionZh: '电蓝薄荷高光，科技感更清透。',
    descriptionEn: 'Electric mint highlights for a cleaner AI-tech feel.',
    primary: '#064e63',
    accent: '#5eead4',
    neutral: 'pearl',
    darkPrimary: '#99f6e4',
    canvasStrength: 0.13,
    motionPreset: 'expressive',
    experimental: true,
  },
  {
    id: 'cyber-lilac',
    category: 'electric-ai',
    labelZh: '赛博丁香',
    labelEn: 'Cyber Lilac',
    descriptionZh: '丁香紫和电蓝，明亮但有未来感。',
    descriptionEn: 'Lilac and electric blue for bright future-facing interfaces.',
    primary: '#4c1d95',
    accent: '#60a5fa',
    neutral: 'mauve',
    darkPrimary: '#ddd6fe',
    canvasStrength: 0.14,
    texturePreset: 'glow',
    experimental: true,
  },
  {
    id: 'gradient-orchid',
    category: 'purple-gradient-tech',
    labelZh: '兰花渐变',
    labelEn: 'Gradient Orchid',
    descriptionZh: '兰花紫和洋红高光，适合更张扬的 AI 首屏。',
    descriptionEn: 'Orchid and magenta highlights for expressive AI landing pages.',
    primary: '#581c87',
    accent: '#e879f9',
    neutral: 'mauve',
    darkPrimary: '#f0abfc',
    canvasStrength: 0.15,
    shadowPreset: 'medium',
    experimental: true,
  },
  {
    id: 'aura-blue-pink',
    category: 'purple-gradient-tech',
    labelZh: '蓝粉光晕',
    labelEn: 'Aura Blue Pink',
    descriptionZh: '蓝粉高光与轻玻璃卡片，明亮科技感。',
    descriptionEn: 'Blue-pink aura accents with light glass cards.',
    primary: '#1e3a8a',
    accent: '#f472b6',
    neutral: 'pearl',
    darkPrimary: '#bfdbfe',
    canvasStrength: 0.14,
    cardPreset: 'glass',
    experimental: true,
  },
  {
    id: 'developer-void',
    category: 'dark-developer',
    labelZh: '开发者浅空',
    labelEn: 'Developer Void',
    descriptionZh: '开发者黑蓝语义，但浅色模式保持清爽。',
    descriptionEn: 'Developer blue-black semantics with a clean light canvas.',
    primary: '#0f172a',
    accent: '#22d3ee',
    neutral: 'slate',
    darkPrimary: '#67e8f9',
    canvasStrength: 0.09,
    typographyPreset: 'mono',
    buttonPreset: 'outline',
  },
  {
    id: 'terminal-amber-pro',
    category: 'dark-developer',
    labelZh: '终端琥珀 Pro',
    labelEn: 'Terminal Amber Pro',
    descriptionZh: '终端琥珀和工程感排版，适合专业控制台。',
    descriptionEn: 'Terminal amber and engineering typography for pro consoles.',
    primary: '#1f2937',
    accent: '#f59e0b',
    neutral: 'charcoal',
    darkPrimary: '#fcd34d',
    canvasStrength: 0.08,
    typographyPreset: 'mono',
    radiusPreset: 'sharp',
  },
  {
    id: 'campus-ivy',
    category: 'calm-academic-saas',
    labelZh: '常春藤校园',
    labelEn: 'Campus Ivy',
    descriptionZh: '学院绿与纸白，稳重但不过绿。',
    descriptionEn: 'Academic ivy and paper white for calm admissions workflows.',
    primary: '#244c3a',
    accent: '#a9823a',
    neutral: 'sage',
    darkPrimary: '#c7d7b0',
    canvasStrength: 0.08,
    typographyPreset: 'editorial',
    featured: true,
    premiumRank: 13,
  },
  {
    id: 'library-blue',
    category: 'calm-academic-saas',
    labelZh: '图书馆蓝',
    labelEn: 'Library Blue',
    descriptionZh: '低饱和藏蓝和纸面灰，适合学术资料页。',
    descriptionEn: 'Muted library blue and paper gray for academic references.',
    primary: '#1e3a5f',
    accent: '#8aa1c1',
    neutral: 'pearl',
    darkPrimary: '#c7d2fe',
    canvasStrength: 0.07,
    featured: true,
    premiumRank: 12,
  },
  {
    id: 'editor-cream-red',
    category: 'editorial-essay',
    labelZh: '编辑奶油红',
    labelEn: 'Editor Cream Red',
    descriptionZh: '编辑批注红和奶油纸面，适合文书修改。',
    descriptionEn: 'Editorial red annotations over cream writing surfaces.',
    primary: '#3f2b25',
    accent: '#d94b4b',
    neutral: 'warm',
    darkPrimary: '#fca5a5',
    canvasStrength: 0.08,
    typographyPreset: 'editorial',
    cardPreset: 'editorial',
  },
  {
    id: 'manuscript-blue',
    category: 'editorial-essay',
    labelZh: '手稿蓝',
    labelEn: 'Manuscript Blue',
    descriptionZh: '手稿纸面和墨蓝重点，长文界面更安静。',
    descriptionEn: 'Manuscript paper and ink-blue accents for quiet writing UI.',
    primary: '#26384f',
    accent: '#5b7fa6',
    neutral: 'warm',
    darkPrimary: '#bfdbfe',
    canvasStrength: 0.07,
    typographyPreset: 'editorial',
  },
  {
    id: 'consulting-steel',
    category: 'consulting-finance',
    labelZh: '咨询钢灰',
    labelEn: 'Consulting Steel',
    descriptionZh: '钢灰蓝与细边框，适合企业咨询感。',
    descriptionEn: 'Steel blue-gray and fine borders for consulting-grade UI.',
    primary: '#263647',
    accent: '#73859a',
    neutral: 'pearl',
    darkPrimary: '#cbd5e1',
    canvasStrength: 0.07,
    radiusPreset: 'standard',
    cardPreset: 'bordered',
    featured: true,
    premiumRank: 11,
  },
  {
    id: 'finance-emerald',
    category: 'consulting-finance',
    labelZh: '金融祖母绿',
    labelEn: 'Finance Emerald',
    descriptionZh: '金融绿和象牙白，作为特殊专业主题保留。',
    descriptionEn: 'Finance emerald and ivory for a specialized professional palette.',
    primary: '#14532d',
    accent: '#d4af37',
    neutral: 'warm',
    darkPrimary: '#bbf7d0',
    canvasStrength: 0.07,
  },
  {
    id: 'pastel-mint',
    category: 'soft-studio-pastel',
    labelZh: '柔和薄荷',
    labelEn: 'Pastel Mint',
    descriptionZh: '薄荷与白瓷感，适合轻量设置和仪表盘。',
    descriptionEn: 'Mint and porcelain surfaces for light dashboards.',
    primary: '#2f5d62',
    accent: '#8dd7c7',
    neutral: 'pearl',
    darkPrimary: '#b2f5ea',
    canvasStrength: 0.14,
    radiusPreset: 'soft',
    cardPreset: 'glass',
  },
  {
    id: 'pastel-candy',
    category: 'soft-studio-pastel',
    labelZh: '柔糖粉蓝',
    labelEn: 'Pastel Candy',
    descriptionZh: '粉蓝糖色但保持商务克制。',
    descriptionEn: 'Pastel candy blue-pink while staying business-friendly.',
    primary: '#5b4b8a',
    accent: '#f0a6ca',
    neutral: 'mauve',
    darkPrimary: '#ddd6fe',
    canvasStrength: 0.15,
    radiusPreset: 'soft',
  },
  {
    id: 'natural-seafoam',
    category: 'natural-calm',
    labelZh: '海沫自然',
    labelEn: 'Natural Seafoam',
    descriptionZh: '海沫蓝绿与石灰白，清爽自然。',
    descriptionEn: 'Seafoam and limestone white for a clean natural palette.',
    primary: '#2d5a57',
    accent: '#7db9a7',
    neutral: 'sage',
    darkPrimary: '#b7e4d5',
    canvasStrength: 0.1,
  },
  {
    id: 'natural-stone',
    category: 'natural-calm',
    labelZh: '石色自然',
    labelEn: 'Natural Stone',
    descriptionZh: '石色、橄榄和浅纸面，低饱和高级感。',
    descriptionEn: 'Stone, olive, and light paper for muted natural polish.',
    primary: '#4a4f3c',
    accent: '#b7a56a',
    neutral: 'sage',
    darkPrimary: '#d4d0a8',
    canvasStrength: 0.08,
    featured: true,
    premiumRank: 14,
  },
  {
    id: 'contrast-lime',
    category: 'high-contrast',
    labelZh: '高对比青柠',
    labelEn: 'Contrast Lime',
    descriptionZh: '黑白可读性配青柠重点，用于强识别界面。',
    descriptionEn: 'Black-white readability with lime emphasis.',
    primary: '#111827',
    accent: '#84cc16',
    neutral: 'pearl',
    darkPrimary: '#d9f99d',
    canvasStrength: 0.05,
    radiusPreset: 'sharp',
    buttonPreset: 'brutal',
    shadowPreset: 'none',
    experimental: true,
  },
  {
    id: 'contrast-orange',
    category: 'high-contrast',
    labelZh: '高对比橙',
    labelEn: 'Contrast Orange',
    descriptionZh: '高对比黑白橙，CTA 识别度强。',
    descriptionEn: 'High-contrast black-white-orange for unmistakable CTAs.',
    primary: '#0a0a0a',
    accent: '#f97316',
    neutral: 'pearl',
    darkPrimary: '#fed7aa',
    canvasStrength: 0.05,
    radiusPreset: 'sharp',
    buttonPreset: 'brutal',
    experimental: true,
  },
  {
    id: 'luxury-platinum',
    category: 'premium-mono',
    labelZh: '铂金奢华',
    labelEn: 'Luxury Platinum',
    descriptionZh: '铂金灰白和黑色 CTA，适合高端品牌质感。',
    descriptionEn: 'Platinum gray-white with black CTAs for luxury-grade polish.',
    primary: '#161616',
    accent: '#b7b0a3',
    neutral: 'pearl',
    darkPrimary: '#f2f0ea',
    canvasStrength: 0.06,
    typographyPreset: 'editorial',
    cardPreset: 'elevated',
    featured: true,
    premiumRank: 15,
  },
  {
    id: 'neo-brutal-blue',
    category: 'high-contrast',
    labelZh: '新粗野蓝',
    labelEn: 'Neo Brutal Blue',
    descriptionZh: '高对比蓝白和硬朗边框，提供完全不同的视觉性格。',
    descriptionEn: 'High-contrast blue-white with hard borders for a distinct palette.',
    primary: '#001f54',
    accent: '#00a3ff',
    neutral: 'pearl',
    darkPrimary: '#bae6fd',
    canvasStrength: 0.04,
    radiusPreset: 'sharp',
    buttonPreset: 'brutal',
    cardPreset: 'bordered',
    shadowPreset: 'none',
    experimental: true,
  },
] as const satisfies readonly ColorThemeDefinition[];

export const COLOR_THEME_DEFINITIONS = [
  ...BASE_COLOR_THEME_DEFINITIONS,
  ...EXTRA_COLOR_THEME_DEFINITIONS,
  ...ENTERPRISE_COLOR_THEME_DEFINITIONS,
] as const satisfies readonly ColorThemeDefinition[];

export type ColorPalette = (typeof COLOR_THEME_DEFINITIONS)[number]['id'];

const COLOR_THEME_DEFINITION_LIST = COLOR_THEME_DEFINITIONS as readonly ColorThemeDefinition[];

export const FEATURED_COLOR_PALETTE_IDS = COLOR_THEME_DEFINITION_LIST.filter(
  (theme) => theme.featured
)
  .slice()
  .sort((a, b) => (a.premiumRank ?? 999) - (b.premiumRank ?? 999))
  .map((theme) => theme.id) as ColorPalette[];

export const EXPERIMENTAL_COLOR_PALETTE_IDS = COLOR_THEME_DEFINITION_LIST.filter(
  (theme) => theme.experimental
).map((theme) => theme.id) as ColorPalette[];

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

const categoryMood: Record<ColorThemeCategory, ThemeMood> = {
  'lumni-warm-ai': 'warm',
  'human-ai-beige': 'paper',
  'premium-mono': 'contrast',
  'framer-cool-dark': 'dark',
  'indigo-saas': 'cool',
  'stripe-infrastructure': 'cool',
  'electric-ai': 'electric',
  'purple-gradient-tech': 'electric',
  'dark-developer': 'dark',
  'calm-academic-saas': 'academic',
  'editorial-essay': 'paper',
  'warm-professional': 'warm',
  'consulting-finance': 'academic',
  'soft-studio-pastel': 'pastel',
  'natural-calm': 'natural',
  'high-contrast': 'contrast',
};

const categoryStyleDefaults: Record<ColorThemeCategory, ThemeStyleMeta> = {
  'lumni-warm-ai': {
    typographyPreset: 'humanist',
    radiusPreset: 'standard',
    densityPreset: 'comfortable',
    buttonPreset: 'solid',
    cardPreset: 'bordered',
    shadowPreset: 'subtle',
    texturePreset: 'paper',
    motionPreset: 'standard',
  },
  'human-ai-beige': {
    typographyPreset: 'humanist',
    radiusPreset: 'soft',
    densityPreset: 'comfortable',
    buttonPreset: 'soft',
    cardPreset: 'editorial',
    shadowPreset: 'subtle',
    texturePreset: 'paper',
    motionPreset: 'quiet',
  },
  'premium-mono': {
    typographyPreset: 'compact',
    radiusPreset: 'sharp',
    densityPreset: 'standard',
    buttonPreset: 'outline',
    cardPreset: 'flat',
    shadowPreset: 'none',
    texturePreset: 'none',
    motionPreset: 'quiet',
  },
  'framer-cool-dark': {
    typographyPreset: 'system',
    radiusPreset: 'soft',
    densityPreset: 'standard',
    buttonPreset: 'glass',
    cardPreset: 'glass',
    shadowPreset: 'dramatic',
    texturePreset: 'glow',
    motionPreset: 'expressive',
  },
  'indigo-saas': {
    typographyPreset: 'system',
    radiusPreset: 'standard',
    densityPreset: 'standard',
    buttonPreset: 'solid',
    cardPreset: 'elevated',
    shadowPreset: 'medium',
    texturePreset: 'grid',
    motionPreset: 'standard',
  },
  'stripe-infrastructure': {
    typographyPreset: 'compact',
    radiusPreset: 'standard',
    densityPreset: 'compact',
    buttonPreset: 'solid',
    cardPreset: 'bordered',
    shadowPreset: 'subtle',
    texturePreset: 'grid',
    motionPreset: 'standard',
  },
  'electric-ai': {
    typographyPreset: 'system',
    radiusPreset: 'soft',
    densityPreset: 'standard',
    buttonPreset: 'glass',
    cardPreset: 'glass',
    shadowPreset: 'medium',
    texturePreset: 'glow',
    motionPreset: 'expressive',
  },
  'purple-gradient-tech': {
    typographyPreset: 'system',
    radiusPreset: 'soft',
    densityPreset: 'comfortable',
    buttonPreset: 'glass',
    cardPreset: 'glass',
    shadowPreset: 'dramatic',
    texturePreset: 'glow',
    motionPreset: 'expressive',
  },
  'dark-developer': {
    typographyPreset: 'mono',
    radiusPreset: 'sharp',
    densityPreset: 'compact',
    buttonPreset: 'outline',
    cardPreset: 'bordered',
    shadowPreset: 'none',
    texturePreset: 'grid',
    motionPreset: 'quiet',
  },
  'calm-academic-saas': {
    typographyPreset: 'editorial',
    radiusPreset: 'standard',
    densityPreset: 'comfortable',
    buttonPreset: 'solid',
    cardPreset: 'editorial',
    shadowPreset: 'subtle',
    texturePreset: 'paper',
    motionPreset: 'quiet',
  },
  'editorial-essay': {
    typographyPreset: 'editorial',
    radiusPreset: 'standard',
    densityPreset: 'comfortable',
    buttonPreset: 'soft',
    cardPreset: 'editorial',
    shadowPreset: 'subtle',
    texturePreset: 'paper',
    motionPreset: 'quiet',
  },
  'warm-professional': {
    typographyPreset: 'humanist',
    radiusPreset: 'standard',
    densityPreset: 'standard',
    buttonPreset: 'solid',
    cardPreset: 'bordered',
    shadowPreset: 'medium',
    texturePreset: 'paper',
    motionPreset: 'standard',
  },
  'consulting-finance': {
    typographyPreset: 'compact',
    radiusPreset: 'standard',
    densityPreset: 'compact',
    buttonPreset: 'solid',
    cardPreset: 'bordered',
    shadowPreset: 'subtle',
    texturePreset: 'none',
    motionPreset: 'quiet',
  },
  'soft-studio-pastel': {
    typographyPreset: 'humanist',
    radiusPreset: 'soft',
    densityPreset: 'comfortable',
    buttonPreset: 'soft',
    cardPreset: 'glass',
    shadowPreset: 'medium',
    texturePreset: 'glow',
    motionPreset: 'standard',
  },
  'natural-calm': {
    typographyPreset: 'humanist',
    radiusPreset: 'standard',
    densityPreset: 'comfortable',
    buttonPreset: 'soft',
    cardPreset: 'bordered',
    shadowPreset: 'subtle',
    texturePreset: 'paper',
    motionPreset: 'quiet',
  },
  'high-contrast': {
    typographyPreset: 'compact',
    radiusPreset: 'sharp',
    densityPreset: 'standard',
    buttonPreset: 'brutal',
    cardPreset: 'bordered',
    shadowPreset: 'none',
    texturePreset: 'none',
    motionPreset: 'quiet',
  },
};

function getThemeStyleMetaFromDefinition(definition: ColorThemeDefinition): ThemeStyleMeta {
  const base = categoryStyleDefaults[definition.category];
  return {
    typographyPreset: definition.typographyPreset ?? base.typographyPreset,
    radiusPreset: definition.radiusPreset ?? base.radiusPreset,
    densityPreset: definition.densityPreset ?? base.densityPreset,
    buttonPreset: definition.buttonPreset ?? base.buttonPreset,
    cardPreset: definition.cardPreset ?? base.cardPreset,
    shadowPreset: definition.shadowPreset ?? base.shadowPreset,
    texturePreset: definition.texturePreset ?? base.texturePreset,
    motionPreset: definition.motionPreset ?? base.motionPreset,
  };
}

function isOneOf<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === 'string' && values.includes(value);
}

function clampAppearanceValue(value: unknown): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function normalizeThemeAppearanceOverrides(overrides: unknown): ThemeAppearanceOverrides {
  if (!overrides || typeof overrides !== 'object') return {};
  const source = overrides as Record<string, unknown>;
  const normalized: ThemeAppearanceOverrides = {};

  for (const key of [
    'clarity',
    'frost',
    'glow',
    'texture',
    'contrast',
    'saturation',
    'colorPresence',
  ] as const) {
    const value = clampAppearanceValue(source[key]);
    if (value !== undefined) normalized[key] = value;
  }

  if (isOneOf(THEME_RADIUS_PRESETS, source.radiusPreset)) {
    normalized.radiusPreset = source.radiusPreset;
  }
  if (isOneOf(THEME_DENSITY_PRESETS, source.densityPreset)) {
    normalized.densityPreset = source.densityPreset;
  }
  if (isOneOf(THEME_BUTTON_PRESETS, source.buttonPreset)) {
    normalized.buttonPreset = source.buttonPreset;
  }
  if (isOneOf(THEME_CARD_PRESETS, source.cardPreset)) {
    normalized.cardPreset = source.cardPreset;
  }
  if (isOneOf(THEME_SHADOW_PRESETS, source.shadowPreset)) {
    normalized.shadowPreset = source.shadowPreset;
  }
  if (isOneOf(THEME_MOTION_PRESETS, source.motionPreset)) {
    normalized.motionPreset = source.motionPreset;
  }

  return normalized;
}

function mergeThemeStyleMeta(
  base: ThemeStyleMeta,
  overrides?: ThemeAppearanceOverrides
): ThemeStyleMeta {
  const next = normalizeThemeAppearanceOverrides(overrides);
  return {
    ...base,
    radiusPreset: next.radiusPreset ?? base.radiusPreset,
    densityPreset: next.densityPreset ?? base.densityPreset,
    buttonPreset: next.buttonPreset ?? base.buttonPreset,
    cardPreset: next.cardPreset ?? base.cardPreset,
    shadowPreset: next.shadowPreset ?? base.shadowPreset,
    motionPreset: next.motionPreset ?? base.motionPreset,
  };
}

export type ResolvedThemeAppearanceControls = {
  clarity: number;
  frost: number;
  glow: number;
  texture: number;
  contrast: number;
  saturation: number;
  colorPresence: number;
};

function getDefaultThemeAppearanceControls(style: ThemeStyleMeta): ResolvedThemeAppearanceControls {
  const isGlass = style.cardPreset === 'glass' || style.buttonPreset === 'glass';
  return {
    clarity: isGlass ? 88 : 96,
    frost: isGlass ? 12 : 2,
    glow: style.texturePreset === 'glow' ? 24 : style.texturePreset === 'none' ? 4 : 12,
    texture:
      style.texturePreset === 'none'
        ? 0
        : style.texturePreset === 'grid'
          ? 14
          : style.texturePreset === 'paper'
            ? 16
            : style.texturePreset === 'noise'
              ? 10
              : 18,
    contrast: 82,
    saturation: 58,
    colorPresence:
      style.texturePreset === 'glow' || style.motionPreset === 'expressive'
        ? 32
        : style.cardPreset === 'editorial'
          ? 20
          : 24,
  };
}

export function resolveThemeAppearanceControls(
  palette: ColorPalette,
  overrides?: ThemeAppearanceOverrides
): ResolvedThemeAppearanceControls {
  const base = getDefaultThemeAppearanceControls(getThemeStyleMeta(palette));
  const next = normalizeThemeAppearanceOverrides(overrides);
  return {
    clarity: next.clarity ?? base.clarity,
    frost: next.frost ?? base.frost,
    glow: next.glow ?? base.glow,
    texture: next.texture ?? base.texture,
    contrast: next.contrast ?? base.contrast,
    saturation: next.saturation ?? base.saturation,
    colorPresence: next.colorPresence ?? base.colorPresence,
  };
}

const moodCanvasBase: Record<ThemeMood, { light: HexColor; dark: HexColor }> = {
  warm: { light: '#fbf1e5', dark: '#120d0a' },
  cool: { light: '#f3f7ff', dark: '#050b19' },
  dark: { light: '#f2f4f8', dark: '#020305' },
  paper: { light: '#faf0e3', dark: '#100c0a' },
  pastel: { light: '#fbf3f8', dark: '#100b11' },
  academic: { light: '#f4f1e8', dark: '#070b15' },
  natural: { light: '#f3f2e8', dark: '#090f0b' },
  contrast: { light: '#ffffff', dark: '#000000' },
  electric: { light: '#f3f6ff', dark: '#020617' },
};

const moodCanvasStrength: Record<ThemeMood, { light: number; dark: number }> = {
  warm: { light: 0.02, dark: 0.08 },
  cool: { light: 0.018, dark: 0.09 },
  dark: { light: 0.014, dark: 0.12 },
  paper: { light: 0.018, dark: 0.07 },
  pastel: { light: 0.022, dark: 0.09 },
  academic: { light: 0.016, dark: 0.08 },
  natural: { light: 0.018, dark: 0.07 },
  contrast: { light: 0.006, dark: 0.04 },
  electric: { light: 0.024, dark: 0.12 },
};

function themeHash(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 9973;
  }
  return hash / 9973;
}

function getThemeMood(definition: ColorThemeDefinition): ThemeMood {
  return definition.mood ?? categoryMood[definition.category];
}

function getThemeTint(definition: ColorThemeDefinition): HexColor {
  return mixHex(definition.accent, definition.primary, 0.58);
}

function getLayerTintPresence(definition: ColorThemeDefinition, mode: ThemeMode): number {
  const mood = getThemeMood(definition);
  const rawPresence = definition.canvasStrength ?? moodCanvasStrength[mood][mode];
  const configured = rawPresence * (mode === 'light' ? 0.2 : 0.5);
  const limit =
    mode === 'light'
      ? mood === 'pastel' || mood === 'electric'
        ? 0.014
        : mood === 'contrast'
          ? 0.006
          : 0.012
      : mood === 'electric' || mood === 'dark'
        ? 0.16
        : mood === 'contrast'
          ? 0.06
          : 0.12;
  return Math.max(mode === 'light' ? 0.001 : 0.028, Math.min(limit, configured));
}

function tuneLightCanvas(definition: ColorThemeDefinition, neutralBackground: string): HexColor {
  const mood = getThemeMood(definition);
  const tint = getThemeTint(definition);
  const base = mixHex(moodCanvasBase[mood].light, neutralBackground, 0.06);
  const jitter = (themeHash(definition.id) - 0.5) * 0.003;
  const strength = Math.max(0.002, getLayerTintPresence(definition, 'light') + jitter);
  return mixHex(tint, base, strength);
}

function tuneDarkCanvas(definition: ColorThemeDefinition, neutralBackground: string): HexColor {
  const mood = getThemeMood(definition);
  const tint = getThemeTint(definition);
  const base = mixHex(moodCanvasBase[mood].dark, neutralBackground, 0.18);
  const jitter = (themeHash(`${definition.id}:dark`) - 0.5) * 0.012;
  const strength = Math.max(0.024, getLayerTintPresence(definition, 'dark') + jitter);
  return mixHex(tint, base, strength);
}

function buildThemeColorRows(definition: ColorThemeDefinition): {
  light: WebThemeColorRow;
  dark: WebThemeColorRow;
  surfacesLight: SemanticLightRow;
  surfacesDark: SemanticDarkRow;
} {
  if (definition.id === DEFAULT_COLOR_PALETTE) {
    return {
      light: { ...colors.light },
      dark: { ...colors.dark },
      surfacesLight: { ...semanticSurfaces.light },
      surfacesDark: { ...semanticSurfaces.dark },
    };
  }

  const neutral = neutralFamilies[definition.neutral];
  const mood = getThemeMood(definition);
  const tint = getThemeTint(definition);
  const lightPresence = getLayerTintPresence(definition, 'light');
  const darkPresence = getLayerTintPresence(definition, 'dark');
  const lightCanvas = tuneLightCanvas(definition, neutral.light.background);
  const lightSurface =
    definition.lightSurface ??
    mixHex(tint, mood === 'contrast' ? '#ffffff' : neutral.light.card, lightPresence * 0.16);
  const lightMuted = mixHex(tint, neutral.light.muted, Math.min(0.04, lightPresence * 0.5));
  const lightPrimary = ensureContrast(definition.primary, lightCanvas, 4.5);
  const lightInfo = ensureContrast(definition.accent, lightCanvas, 3.2);
  const lightAccent = mixHex(definition.accent, lightSurface, mood === 'electric' ? 0.14 : 0.1);
  const lightAccentForeground =
    getContrastRatio(lightPrimary, lightAccent) >= 4.5
      ? lightPrimary
      : ensureContrast(neutral.light.foreground as HexColor, lightAccent, 4.5);
  const lightForeground = ensureContrast(neutral.light.foreground as HexColor, lightCanvas, 7);

  const darkCanvas = tuneDarkCanvas(definition, neutral.dark.background);
  const darkSurface =
    definition.darkSurface ??
    mixHex(
      tint,
      neutral.dark.card,
      mood === 'electric' ? darkPresence * 0.72 : darkPresence * 0.56
    );
  const darkPrimary = ensureContrast(
    definition.darkPrimary ?? mixHex(definition.primary, '#fff7ea', 0.48),
    darkCanvas,
    4.5
  );
  const darkAccent = mixHex(definition.accent, darkSurface, mood === 'electric' ? 0.28 : 0.22);
  const darkInfo = ensureContrast(mixHex(definition.accent, '#fff7ea', 0.5), darkSurface, 4.5);
  const darkForeground = ensureContrast(neutral.dark.foreground as HexColor, darkCanvas, 7);

  const light: WebThemeColorRow = {
    background: lightCanvas,
    backgroundSecondary: mixHex(
      tint,
      neutral.light.backgroundSecondary,
      Math.min(0.035, lightPresence * 0.45)
    ),
    backgroundTertiary: mixHex(
      tint,
      neutral.light.backgroundTertiary,
      Math.min(0.045, lightPresence * 0.55)
    ),
    foreground: lightForeground,
    foregroundSecondary: neutral.light.foregroundSecondary,
    foregroundMuted: neutral.light.foregroundMuted,
    card: lightSurface,
    primary: lightPrimary,
    primaryForeground: readableOn(lightPrimary),
    cardForeground: lightForeground,
    border: mixHex(tint, neutral.light.border, Math.min(0.035, lightPresence * 0.45)),
    borderLight: mixHex(tint, neutral.light.borderLight, Math.min(0.025, lightPresence * 0.35)),
    borderStrong: mixHex(
      lightPrimary,
      neutral.light.borderStrong,
      Math.min(0.09, lightPresence * 0.9)
    ),
    muted: lightMuted,
    mutedForeground: neutral.light.mutedForeground,
    accent: lightAccent,
    accentForeground: lightAccentForeground,
    success: '#6f7b58',
    warning: '#b7832f',
    error: '#b85c58',
    info: lightInfo,
    violet: mixHex(definition.primary, '#6574ff', 0.55),
    pink: mixHex(definition.accent, '#e76f8a', 0.45),
    input: mixHex(tint, neutral.light.input, Math.min(0.025, lightPresence * 0.35)),
    inputBorder: mixHex(tint, neutral.light.inputBorder, Math.min(0.03, lightPresence * 0.4)),
    inputFocus: lightPrimary,
    placeholder: mixHex(lightForeground, lightCanvas, 0.38),
    overlay: `rgba(${hexToRgb(lightForeground).r}, ${hexToRgb(lightForeground).g}, ${
      hexToRgb(lightForeground).b
    }, 0.52)`,
  };

  const dark: WebThemeColorRow = {
    background: darkCanvas,
    backgroundSecondary: mixHex(
      tint,
      neutral.dark.backgroundSecondary,
      Math.min(0.12, darkPresence)
    ),
    backgroundTertiary: mixHex(tint, neutral.dark.backgroundTertiary, Math.min(0.16, darkPresence)),
    foreground: darkForeground,
    foregroundSecondary: neutral.dark.foregroundSecondary,
    foregroundMuted: neutral.dark.foregroundMuted,
    card: darkSurface,
    primary: darkPrimary,
    primaryForeground: readableOn(darkPrimary),
    cardForeground: darkForeground,
    border: mixHex(tint, neutral.dark.border, Math.min(0.14, darkPresence)),
    borderLight: mixHex(tint, neutral.dark.borderLight, Math.min(0.1, darkPresence)),
    borderStrong: mixHex(darkPrimary, neutral.dark.borderStrong, Math.min(0.2, darkPresence * 1.3)),
    muted: mixHex(tint, neutral.dark.muted, Math.min(0.14, darkPresence)),
    mutedForeground: neutral.dark.mutedForeground,
    accent: darkAccent,
    accentForeground:
      getContrastRatio(darkPrimary, darkAccent) >= 4.5
        ? darkPrimary
        : ensureContrast(neutral.dark.foreground as HexColor, darkAccent, 4.5),
    success: '#a3a06f',
    warning: ensureContrast('#ddb85a', darkSurface, 4.5),
    error: '#e98a7f',
    info: darkInfo,
    violet: mixHex(darkPrimary, '#a5b4fc', 0.55),
    pink: mixHex(definition.accent, '#f0abfc', 0.44),
    input: mixHex(tint, neutral.dark.input, Math.min(0.12, darkPresence)),
    inputBorder: mixHex(tint, neutral.dark.inputBorder, Math.min(0.14, darkPresence)),
    inputFocus: darkPrimary,
    placeholder: mixHex(darkForeground, darkCanvas, 0.36),
    overlay: 'rgba(0, 0, 0, 0.68)',
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

export type ThemeAppearance = {
  id: ColorPalette;
  mode: ThemeMode;
  colors: WebThemeColorRow;
  surfaces: SemanticLightRow | SemanticDarkRow;
  style: ThemeStyleMeta;
  controls: ResolvedThemeAppearanceControls;
};

export type ThemePreview = {
  id: ColorPalette;
  labelZh: string;
  labelEn: string;
  category: ColorThemeCategory;
  canvas: string;
  surface: string;
  primary: string;
  accent: string;
  border: string;
  foreground: string;
  heroPanel: string;
  style: ThemeStyleMeta;
};

export function getThemeStyleMeta(
  palette: ColorPalette,
  overrides?: ThemeAppearanceOverrides
): ThemeStyleMeta {
  const base = getThemeStyleMetaFromDefinition(getColorThemeDefinition(parseColorPalette(palette)));
  return mergeThemeStyleMeta(base, overrides);
}

export function getThemeAppearance(
  palette: ColorPalette,
  mode: ThemeMode,
  overrides?: ThemeAppearanceOverrides
): ThemeAppearance {
  const nextPalette = parseColorPalette(palette);
  return {
    id: nextPalette,
    mode,
    colors: getThemeColors(nextPalette, mode),
    surfaces: getThemeSemanticSurfaces(nextPalette, mode),
    style: getThemeStyleMeta(nextPalette, overrides),
    controls: resolveThemeAppearanceControls(nextPalette, overrides),
  };
}

export function getThemePreview(
  palette: ColorPalette,
  overrides?: ThemeAppearanceOverrides
): ThemePreview {
  const nextPalette = parseColorPalette(palette);
  const definition = getColorThemeDefinition(nextPalette);
  const colorsForPreview = getThemeColors(nextPalette, 'light');
  const style = getThemeStyleMeta(nextPalette, overrides);
  return {
    id: nextPalette,
    labelZh: definition.labelZh,
    labelEn: definition.labelEn,
    category: definition.category,
    canvas: colorsForPreview.background,
    surface: colorsForPreview.card,
    primary: colorsForPreview.primary,
    accent: colorsForPreview.info,
    border: colorsForPreview.border,
    foreground: colorsForPreview.foreground,
    heroPanel:
      style.cardPreset === 'glass'
        ? mixHex(colorsForPreview.info, colorsForPreview.card, 0.08)
        : mixHex(colorsForPreview.info, colorsForPreview.card, 0.04),
    style,
  };
}

const fontStacks: Record<
  ThemeTypographyPreset,
  {
    sans: string;
    display: string;
    mono: string;
    headingWeight: string;
    bodyTracking: string;
    headingTracking: string;
  }
> = {
  system: {
    sans: "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei UI', sans-serif",
    display:
      "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', sans-serif",
    mono: "var(--font-geist-mono), 'SFMono-Regular', 'SF Mono', Menlo, Consolas, monospace",
    headingWeight: '760',
    bodyTracking: '0',
    headingTracking: '0',
  },
  humanist: {
    sans: "var(--font-geist-sans), ui-sans-serif, system-ui, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei UI', sans-serif",
    display:
      "var(--font-geist-sans), ui-sans-serif, system-ui, 'PingFang SC', 'Hiragino Sans GB', sans-serif",
    mono: "var(--font-geist-mono), 'SFMono-Regular', 'SF Mono', Menlo, Consolas, monospace",
    headingWeight: '720',
    bodyTracking: '0.005em',
    headingTracking: '0',
  },
  editorial: {
    sans: "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei UI', sans-serif",
    display: "Georgia, 'Times New Roman', 'Songti SC', 'Noto Serif CJK SC', serif",
    mono: "var(--font-geist-mono), 'SFMono-Regular', 'SF Mono', Menlo, Consolas, monospace",
    headingWeight: '690',
    bodyTracking: '0.003em',
    headingTracking: '0',
  },
  mono: {
    sans: "var(--font-geist-mono), 'SFMono-Regular', 'SF Mono', Menlo, Consolas, monospace",
    display: "var(--font-geist-mono), 'SFMono-Regular', 'SF Mono', Menlo, Consolas, monospace",
    mono: "var(--font-geist-mono), 'SFMono-Regular', 'SF Mono', Menlo, Consolas, monospace",
    headingWeight: '680',
    bodyTracking: '0',
    headingTracking: '0.01em',
  },
  compact: {
    sans: "var(--font-geist-sans), Inter, -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', sans-serif",
    display:
      "var(--font-geist-sans), Inter, -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif",
    mono: "var(--font-geist-mono), 'SFMono-Regular', 'SF Mono', Menlo, Consolas, monospace",
    headingWeight: '740',
    bodyTracking: '0',
    headingTracking: '0',
  },
};

const radiusVars: Record<
  ThemeRadiusPreset,
  { base: string; card: string; button: string; input: string; badge: string }
> = {
  sharp: {
    base: '0.5rem',
    card: '0.5rem',
    button: '0.375rem',
    input: '0.375rem',
    badge: '0.25rem',
  },
  standard: {
    base: '0.75rem',
    card: '0.75rem',
    button: '0.625rem',
    input: '0.625rem',
    badge: '0.5rem',
  },
  soft: { base: '1rem', card: '1rem', button: '0.875rem', input: '0.875rem', badge: '0.75rem' },
  pill: { base: '1.25rem', card: '1.25rem', button: '9999px', input: '9999px', badge: '9999px' },
};

const densityVars: Record<
  ThemeDensityPreset,
  { controlHeight: string; buttonPaddingX: string; cardPadding: string; compactGap: string }
> = {
  compact: {
    controlHeight: '2.25rem',
    buttonPaddingX: '0.875rem',
    cardPadding: '1rem',
    compactGap: '0.5rem',
  },
  standard: {
    controlHeight: '2.5rem',
    buttonPaddingX: '1rem',
    cardPadding: '1.25rem',
    compactGap: '0.75rem',
  },
  comfortable: {
    controlHeight: '2.75rem',
    buttonPaddingX: '1.125rem',
    cardPadding: '1.5rem',
    compactGap: '1rem',
  },
};

const shadowVars: Record<
  ThemeShadowPreset,
  { card: string; cardHover: string; button: string; buttonHover: string }
> = {
  none: {
    card: 'none',
    cardHover: 'none',
    button: 'none',
    buttonHover: 'none',
  },
  subtle: {
    card: '0 1px 2px color-mix(in oklab, var(--ds-foreground) 8%, transparent)',
    cardHover: '0 8px 24px color-mix(in oklab, var(--ds-foreground) 10%, transparent)',
    button: '0 1px 2px color-mix(in oklab, var(--ds-foreground) 9%, transparent)',
    buttonHover: '0 7px 18px color-mix(in oklab, var(--ds-primary) 16%, transparent)',
  },
  medium: {
    card: '0 10px 30px color-mix(in oklab, var(--ds-foreground) 10%, transparent)',
    cardHover: '0 18px 48px color-mix(in oklab, var(--ds-foreground) 14%, transparent)',
    button: '0 6px 18px color-mix(in oklab, var(--ds-primary) 18%, transparent)',
    buttonHover: '0 12px 28px color-mix(in oklab, var(--ds-primary) 24%, transparent)',
  },
  dramatic: {
    card: '0 20px 60px color-mix(in oklab, var(--ds-primary) 18%, transparent)',
    cardHover: '0 28px 80px color-mix(in oklab, var(--ds-primary) 24%, transparent)',
    button: '0 10px 28px color-mix(in oklab, var(--ds-primary) 28%, transparent)',
    buttonHover: '0 18px 45px color-mix(in oklab, var(--ds-primary) 34%, transparent)',
  },
};

const buttonVars: Record<
  ThemeButtonPreset,
  { borderWidth: string; weight: string; letterSpacing: string; transform: string }
> = {
  solid: { borderWidth: '1px', weight: '650', letterSpacing: '0', transform: 'translateY(-1px)' },
  outline: { borderWidth: '1px', weight: '600', letterSpacing: '0', transform: 'translateY(-1px)' },
  soft: { borderWidth: '1px', weight: '620', letterSpacing: '0', transform: 'translateY(-1px)' },
  glass: { borderWidth: '1px', weight: '650', letterSpacing: '0', transform: 'translateY(-1px)' },
  brutal: {
    borderWidth: '2px',
    weight: '750',
    letterSpacing: '0',
    transform: 'translate(-1px, -1px)',
  },
};

const cardVars: Record<
  ThemeCardPreset,
  { borderWidth: string; surfaceMix: string; dividerOpacity: string }
> = {
  flat: { borderWidth: '1px', surfaceMix: '100%', dividerOpacity: '72%' },
  bordered: { borderWidth: '1px', surfaceMix: '96%', dividerOpacity: '82%' },
  elevated: { borderWidth: '1px', surfaceMix: '98%', dividerOpacity: '72%' },
  glass: { borderWidth: '1px', surfaceMix: '76%', dividerOpacity: '62%' },
  editorial: { borderWidth: '1px', surfaceMix: '99%', dividerOpacity: '86%' },
};

const textureOpacity: Record<ThemeTexturePreset, string> = {
  none: '0',
  grid: '0.26',
  paper: '0.22',
  noise: '0.2',
  glow: '0.28',
};

function percent(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function decimal(value: number): string {
  return (Math.round(value * 100) / 100).toString();
}

function createThemeAppearanceCssVars(
  palette: ColorPalette,
  style: ThemeStyleMeta,
  overrides?: ThemeAppearanceOverrides
): Record<string, string> {
  const controls = resolveThemeAppearanceControls(palette, overrides);
  const clarity = controls.clarity / 100;
  const frost = controls.frost / 100;
  const glow = controls.glow / 100;
  const texture = controls.texture / 100;
  const contrast = controls.contrast / 100;
  const saturation = controls.saturation / 100;
  const colorPresence = controls.colorPresence / 100;
  const radii = radiusVars[style.radiusPreset];
  const density = densityVars[style.densityPreset];
  const shadows = shadowVars[style.shadowPreset];
  const button = buttonVars[style.buttonPreset];
  const card = cardVars[style.cardPreset];
  const surfaceAlpha = Math.max(0.68, Math.min(1, 0.94 + clarity * 0.08 - frost * 0.26));
  const popoverAlpha = Math.max(0.78, Math.min(1, surfaceAlpha + 0.08));
  const controlAlpha = Math.max(0.74, Math.min(1, surfaceAlpha + 0.03));
  const borderBoost = percent(0.42 + contrast * 0.28);
  const brandPresencePct = percent(0.04 + colorPresence * 0.12);
  const glowPct = percent(glow * (0.1 + colorPresence * 0.16));
  const glowWarmPct = percent(glow * (0.08 + colorPresence * 0.12));
  const textureStrength =
    Number.parseFloat(textureOpacity[style.texturePreset]) * Math.max(0.08, texture);
  const blurPx = Math.round(frost * 24);
  const saturate = 0.94 + saturation * 0.22;
  const buttonSurface =
    style.buttonPreset === 'glass'
      ? `color-mix(in oklab, var(--ds-card) ${percent(controlAlpha - 0.08)}, transparent)`
      : style.buttonPreset === 'soft'
        ? 'color-mix(in oklab, var(--ds-primary) 12%, var(--ds-card))'
        : 'var(--ds-primary)';
  const buttonForeground =
    style.buttonPreset === 'soft' || style.buttonPreset === 'glass'
      ? 'var(--ds-primary)'
      : 'var(--ds-primary-foreground)';

  return {
    '--theme-clarity-strength': decimal(clarity),
    '--theme-frost-strength': decimal(frost),
    '--theme-glow-strength': decimal(glow),
    '--theme-texture-strength': decimal(textureStrength),
    '--theme-contrast-strength': decimal(contrast),
    '--theme-saturation-strength': decimal(saturation),
    '--theme-brand-presence': decimal(colorPresence),
    '--theme-surface-alpha': decimal(surfaceAlpha),
    '--theme-surface-alpha-percent': percent(surfaceAlpha),
    '--theme-popover-alpha-percent': percent(popoverAlpha),
    '--theme-control-alpha-percent': percent(controlAlpha),
    '--theme-backdrop-blur': `${blurPx}px`,
    '--theme-backdrop-saturate': percent(saturate),
    '--theme-card-bg': `color-mix(in oklab, var(--ds-card) ${percent(surfaceAlpha)}, transparent)`,
    '--theme-popover-bg': `color-mix(in oklab, var(--ds-popover) ${percent(popoverAlpha)}, transparent)`,
    '--theme-control-bg': `color-mix(in oklab, var(--ds-background) ${percent(controlAlpha)}, var(--ds-card))`,
    '--theme-border-strong-dynamic': `color-mix(in oklab, var(--ds-border-strong) ${borderBoost}, var(--ds-foreground))`,
    '--theme-brand-tint': `color-mix(in oklab, var(--ds-info) ${brandPresencePct}, var(--ds-card))`,
    '--theme-glow-1': `color-mix(in oklab, var(--ds-info) ${glowPct}, transparent)`,
    '--theme-glow-2': `color-mix(in oklab, var(--ds-warning) ${glowWarmPct}, transparent)`,
    '--theme-grid': `color-mix(in oklab, var(--ds-foreground) ${percent(0.035 + texture * 0.07)}, transparent)`,
    '--theme-radius-card': radii.card,
    '--theme-radius-button': radii.button,
    '--theme-radius-input': radii.input,
    '--theme-radius-badge': radii.badge,
    '--theme-control-height': density.controlHeight,
    '--theme-button-padding-x': density.buttonPaddingX,
    '--theme-card-padding': density.cardPadding,
    '--theme-compact-gap': density.compactGap,
    '--theme-button-border-width': button.borderWidth,
    '--theme-button-weight': button.weight,
    '--theme-button-tracking': button.letterSpacing,
    '--theme-button-hover-transform': button.transform,
    '--theme-button-shadow': shadows.button,
    '--theme-button-hover-shadow': shadows.buttonHover,
    '--theme-button-default-bg': buttonSurface,
    '--theme-button-default-fg': buttonForeground,
    '--theme-button-default-border':
      style.buttonPreset === 'brutal' ? 'var(--ds-foreground)' : 'var(--ds-primary)',
    '--theme-button-outline-bg': `color-mix(in oklab, var(--ds-card) ${percent(controlAlpha)}, transparent)`,
    '--theme-card-border-width': card.borderWidth,
    '--theme-card-shadow': shadows.card,
    '--theme-card-hover-shadow': shadows.cardHover,
    '--theme-card-surface-mix': card.surfaceMix,
    '--theme-divider-opacity': card.dividerOpacity,
    '--theme-motion-scale':
      style.motionPreset === 'quiet' ? '0.55' : style.motionPreset === 'expressive' ? '1.18' : '1',
    '--ds-radius': radii.base,
  };
}

export const THEME_APPEARANCE_CSS_VAR_NAMES = [
  '--theme-clarity-strength',
  '--theme-frost-strength',
  '--theme-glow-strength',
  '--theme-texture-strength',
  '--theme-contrast-strength',
  '--theme-saturation-strength',
  '--theme-brand-presence',
  '--theme-surface-alpha',
  '--theme-surface-alpha-percent',
  '--theme-popover-alpha-percent',
  '--theme-control-alpha-percent',
  '--theme-backdrop-blur',
  '--theme-backdrop-saturate',
  '--theme-card-bg',
  '--theme-popover-bg',
  '--theme-control-bg',
  '--theme-brand-tint',
  '--theme-border-strong-dynamic',
  '--theme-glow-1',
  '--theme-glow-2',
  '--theme-grid',
  '--theme-radius-card',
  '--theme-radius-button',
  '--theme-radius-input',
  '--theme-radius-badge',
  '--theme-control-height',
  '--theme-button-padding-x',
  '--theme-card-padding',
  '--theme-compact-gap',
  '--theme-button-border-width',
  '--theme-button-weight',
  '--theme-button-tracking',
  '--theme-button-hover-transform',
  '--theme-button-shadow',
  '--theme-button-hover-shadow',
  '--theme-button-default-bg',
  '--theme-button-default-fg',
  '--theme-button-default-border',
  '--theme-button-outline-bg',
  '--theme-card-border-width',
  '--theme-card-shadow',
  '--theme-card-hover-shadow',
  '--theme-card-surface-mix',
  '--theme-divider-opacity',
  '--theme-motion-scale',
  '--ds-radius',
] as const;

export function getThemeAppearanceOverrideCssVars(
  palette: ColorPalette,
  overrides?: ThemeAppearanceOverrides
): Record<string, string> {
  const nextPalette = parseColorPalette(palette);
  return createThemeAppearanceCssVars(
    nextPalette,
    getThemeStyleMeta(nextPalette, overrides),
    overrides
  );
}

type DnaCssBundle = {
  light?: Record<string, string>;
  dark?: Record<string, string>;
  shared?: Record<string, string>;
};

const DNA_PRESETS: Record<ThemeDnaPreset, DnaCssBundle> = {
  'warm-editorial': {
    shared: {
      '--theme-font-display':
        "var(--font-newsreader, 'Newsreader'), 'Tiempos', 'Source Serif Pro', Georgia, serif",
      '--theme-font-eyebrow': "'Geist', 'Inter', system-ui, sans-serif",
      '--theme-display-weight': '500',
      '--theme-display-tracking': '-0.025em',
      '--theme-display-leading': '1.0',
      '--theme-radius-button-dna': '10px',
      '--theme-radius-card-dna': '14px',
      '--theme-nav-blur': 'saturate(180%) blur(12px)',
      '--theme-nav-bg': 'color-mix(in srgb, var(--ds-background) 88%, transparent)',
      '--theme-nav-shadow': 'inset 0 -1px 0 0 var(--ds-border)',
      '--theme-nav-link-tracking': '0',
      '--theme-nav-link-weight': '500',
      '--theme-nav-link-tt': 'none',
      '--theme-cta-radius': '12px',
      '--theme-cta-shadow': '0 1px 2px rgba(29,24,19,0.05), 0 0 0 1px rgba(29,24,19,0.06)',
      '--theme-cta-shadow-hover':
        '0 6px 16px -4px rgba(29,24,19,0.18), 0 0 0 1px rgba(29,24,19,0.10)',
      '--theme-cta-pad-y': '12px',
      '--theme-cta-pad-x': '18px',
      '--theme-hero-pad-y': '110px',
      '--theme-hero-grid-show': '0',
      '--theme-hero-grain-show': '1',
      '--theme-hero-headline-style': 'italic-em',
      '--theme-hero-eyebrow-tt': 'none',
      '--theme-hero-eyebrow-tracking': '0',
    },
  },
  'linear-hairline': {
    shared: {
      '--theme-font-display': "'Geist', 'Inter', system-ui, sans-serif",
      '--theme-font-eyebrow': "'Geist Mono', 'JetBrains Mono', monospace",
      '--theme-display-weight': '600',
      '--theme-display-tracking': '-0.032em',
      '--theme-display-leading': '1.02',
      '--theme-radius-button-dna': '6px',
      '--theme-radius-card-dna': '8px',
      '--theme-nav-bg': 'color-mix(in srgb, var(--ds-background) 80%, transparent)',
      '--theme-nav-blur': 'saturate(180%) blur(20px)',
      '--theme-nav-shadow': 'inset 0 -1px 0 0 var(--ds-border)',
      '--theme-nav-height': '56px',
      '--theme-nav-link-size': '13px',
      '--theme-nav-link-weight': '500',
      '--theme-nav-link-tracking': '-0.01em',
      '--theme-nav-link-tt': 'none',
      '--theme-cta-bg': 'var(--ds-info)',
      '--theme-cta-bg-hover': 'color-mix(in oklab, var(--ds-info) 88%, var(--ds-foreground))',
      '--theme-cta-fg': '#ffffff',
      '--theme-cta-radius': '6px',
      '--theme-cta-shadow':
        'inset 0 1px 0 rgba(255,255,255,0.10), 0 0 0 1px color-mix(in oklab, var(--ds-info) 30%, transparent), 0 1px 2px color-mix(in oklab, var(--ds-info) 20%, transparent)',
      '--theme-cta-shadow-hover':
        'inset 0 1px 0 rgba(255,255,255,0.10), 0 0 0 1px color-mix(in oklab, var(--ds-info) 50%, transparent), 0 4px 12px -2px color-mix(in oklab, var(--ds-info) 30%, transparent)',
      '--theme-cta-pad-y': '8px',
      '--theme-cta-pad-x': '12px',
      '--theme-cta-tracking': '-0.012em',
      '--theme-cta-weight': '500',
      '--theme-hero-pad-y': '72px',
      '--theme-hero-grid-show': '1',
      '--theme-hero-grain-show': '0',
      '--theme-hero-headline-style': 'normal',
      '--theme-hero-eyebrow-tt': 'none',
      '--theme-hero-eyebrow-tracking': '-0.01em',
    },
  },
  'stripe-glass': {
    shared: {
      '--theme-font-display': "var(--font-inter, 'Inter'), 'Geist', system-ui, sans-serif",
      '--theme-font-eyebrow': "'Inter', 'Geist', sans-serif",
      '--theme-display-weight': '700',
      '--theme-display-tracking': '-0.028em',
      '--theme-display-leading': '1.05',
      '--theme-radius-button-dna': '12px',
      '--theme-radius-card-dna': '16px',
      '--theme-nav-bg': 'color-mix(in srgb, var(--ds-background) 70%, transparent)',
      '--theme-nav-blur': 'saturate(180%) blur(24px)',
      '--theme-nav-shadow': '0 1px 0 0 var(--ds-border), 0 8px 24px -16px rgba(10,37,64,0.10)',
      '--theme-nav-link-weight': '500',
      '--theme-nav-link-tracking': '0',
      '--theme-nav-link-tt': 'none',
      '--theme-cta-bg':
        'linear-gradient(180deg, var(--ds-info), color-mix(in oklab, var(--ds-info) 85%, var(--ds-foreground)))',
      '--theme-cta-bg-hover':
        'linear-gradient(180deg, color-mix(in oklab, var(--ds-info) 90%, white), var(--ds-info))',
      '--theme-cta-fg': '#ffffff',
      '--theme-cta-radius': '12px',
      '--theme-cta-shadow':
        '0 1px 2px rgba(99,91,255,0.20), inset 0 1px 0 rgba(255,255,255,0.20), 0 0 0 1px rgba(99,91,255,0.20)',
      '--theme-cta-shadow-hover':
        '0 12px 32px -8px rgba(99,91,255,0.40), inset 0 1px 0 rgba(255,255,255,0.20), 0 0 0 1px rgba(99,91,255,0.30)',
      '--theme-cta-pad-y': '12px',
      '--theme-cta-pad-x': '20px',
      '--theme-hero-pad-y': '120px',
      '--theme-hero-grid-show': '0',
      '--theme-hero-grain-show': '0',
      '--theme-hero-headline-style': 'normal',
    },
  },
  'slate-cool-neutral': {
    shared: {
      '--theme-font-display': "var(--font-inter, 'Inter'), 'Geist', system-ui, sans-serif",
      '--theme-font-eyebrow': "'Inter', sans-serif",
      '--theme-display-weight': '600',
      '--theme-display-tracking': '-0.024em',
      '--theme-display-leading': '1.08',
      '--theme-radius-button-dna': '8px',
      '--theme-radius-card-dna': '10px',
      '--theme-nav-bg': 'color-mix(in srgb, var(--ds-background) 90%, transparent)',
      '--theme-nav-blur': 'saturate(150%) blur(8px)',
      '--theme-nav-shadow': 'inset 0 -1px 0 0 var(--ds-border)',
      '--theme-nav-link-weight': '500',
      '--theme-nav-link-tracking': '-0.005em',
      '--theme-nav-link-tt': 'none',
      '--theme-cta-radius': '8px',
      '--theme-cta-shadow': '0 1px 2px rgba(15,23,42,0.06), 0 0 0 1px rgba(15,23,42,0.08)',
      '--theme-cta-shadow-hover':
        '0 4px 12px -2px rgba(15,23,42,0.12), 0 0 0 1px rgba(15,23,42,0.10)',
      '--theme-hero-pad-y': '88px',
      '--theme-hero-grid-show': '1',
      '--theme-hero-grain-show': '0',
      '--theme-hero-headline-style': 'normal',
    },
  },
  'forest-old-money': {
    shared: {
      '--theme-font-display':
        "var(--font-newsreader, 'Newsreader'), 'Tiempos', 'Source Serif Pro', Georgia, serif",
      '--theme-font-eyebrow': "'Inter', sans-serif",
      '--theme-display-weight': '500',
      '--theme-display-tracking': '-0.022em',
      '--theme-display-leading': '1.06',
      '--theme-radius-button-dna': '6px',
      '--theme-radius-card-dna': '10px',
      '--theme-nav-bg': 'color-mix(in srgb, var(--ds-background) 92%, transparent)',
      '--theme-nav-blur': 'saturate(140%) blur(8px)',
      '--theme-nav-shadow': 'inset 0 -1px 0 0 var(--ds-border)',
      '--theme-nav-link-weight': '500',
      '--theme-nav-link-tracking': '0.02em',
      '--theme-nav-link-tt': 'uppercase',
      '--theme-nav-link-size': '12px',
      '--theme-cta-radius': '6px',
      '--theme-cta-shadow': '0 1px 2px rgba(28,42,31,0.08), 0 0 0 1px rgba(28,42,31,0.10)',
      '--theme-cta-shadow-hover':
        '0 4px 12px -2px rgba(28,42,31,0.18), 0 0 0 1px rgba(28,42,31,0.14)',
      '--theme-hero-pad-y': '120px',
      '--theme-hero-grid-show': '0',
      '--theme-hero-grain-show': '1',
      '--theme-hero-headline-style': 'serif',
      '--theme-hero-eyebrow-tt': 'uppercase',
      '--theme-hero-eyebrow-tracking': '0.08em',
    },
  },
  'midnight-prestige': {
    shared: {
      '--theme-font-display': "var(--font-inter, 'Inter'), 'Geist', system-ui, sans-serif",
      '--theme-font-eyebrow': "'Inter', 'Geist', sans-serif",
      '--theme-display-weight': '600',
      '--theme-display-tracking': '-0.028em',
      '--theme-display-leading': '1.04',
      '--theme-radius-button-dna': '10px',
      '--theme-radius-card-dna': '14px',
      '--theme-nav-bg': 'color-mix(in srgb, var(--ds-background) 70%, transparent)',
      '--theme-nav-blur': 'saturate(180%) blur(20px)',
      '--theme-nav-shadow': '0 1px 0 0 color-mix(in oklab, var(--ds-warning) 14%, transparent)',
      '--theme-nav-link-weight': '500',
      '--theme-nav-link-tracking': '0',
      '--theme-nav-link-tt': 'none',
      '--theme-cta-bg': 'var(--ds-warning)',
      '--theme-cta-bg-hover': 'color-mix(in oklab, var(--ds-warning) 92%, white)',
      '--theme-cta-fg': 'var(--ds-foreground)',
      '--theme-cta-radius': '10px',
      '--theme-cta-shadow':
        '0 1px 2px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.20), 0 0 0 1px color-mix(in oklab, var(--ds-warning) 30%, transparent)',
      '--theme-cta-shadow-hover':
        '0 12px 32px -8px color-mix(in oklab, var(--ds-warning) 40%, transparent), inset 0 1px 0 rgba(255,255,255,0.30)',
      '--theme-hero-pad-y': '108px',
      '--theme-hero-grid-show': '0',
      '--theme-hero-grain-show': '0',
      '--theme-hero-headline-style': 'normal',
    },
  },
  'dark-developer': {
    shared: {
      '--theme-font-display': "'Geist', 'Inter', system-ui, sans-serif",
      '--theme-font-eyebrow': "'Geist Mono', 'JetBrains Mono', monospace",
      '--theme-display-weight': '600',
      '--theme-display-tracking': '-0.030em',
      '--theme-display-leading': '1.04',
      '--theme-radius-button-dna': '6px',
      '--theme-radius-card-dna': '8px',
      '--theme-nav-bg': 'color-mix(in srgb, var(--ds-background) 80%, transparent)',
      '--theme-nav-blur': 'saturate(180%) blur(20px)',
      '--theme-nav-shadow': 'inset 0 -1px 0 0 var(--ds-border)',
      '--theme-nav-link-weight': '500',
      '--theme-nav-link-tracking': '-0.005em',
      '--theme-nav-link-tt': 'none',
      '--theme-cta-bg': 'var(--ds-info)',
      '--theme-cta-bg-hover': 'color-mix(in oklab, var(--ds-info) 90%, white)',
      '--theme-cta-fg': '#ffffff',
      '--theme-cta-radius': '6px',
      '--theme-cta-shadow':
        'inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px color-mix(in oklab, var(--ds-info) 35%, transparent), 0 1px 2px rgba(0,0,0,0.30)',
      '--theme-cta-shadow-hover':
        'inset 0 1px 0 rgba(255,255,255,0.10), 0 0 0 1px color-mix(in oklab, var(--ds-info) 55%, transparent), 0 6px 16px -4px color-mix(in oklab, var(--ds-info) 40%, transparent)',
      '--theme-hero-pad-y': '80px',
      '--theme-hero-grid-show': '1',
      '--theme-hero-grain-show': '0',
      '--theme-hero-headline-style': 'normal',
    },
  },
};

export function getDnaCssBundle(preset: ThemeDnaPreset | undefined): DnaCssBundle {
  if (!preset) return {};
  return DNA_PRESETS[preset] ?? {};
}

function createWebThemeCssVars(
  light: WebThemeColorRow,
  dark: WebThemeColorRow,
  surfacesLight: SemanticLightRow,
  surfacesDark: SemanticDarkRow,
  style: ThemeStyleMeta,
  palette: ColorPalette = DEFAULT_COLOR_PALETTE
) {
  const fonts = fontStacks[style.typographyPreset];
  const radii = radiusVars[style.radiusPreset];
  const density = densityVars[style.densityPreset];
  const shadows = shadowVars[style.shadowPreset];
  const button = buttonVars[style.buttonPreset];
  const card = cardVars[style.cardPreset];
  const appearanceVars = createThemeAppearanceCssVars(palette, style);
  const dnaBundle = getDnaCssBundle(
    (getColorThemeDefinition(palette) as ColorThemeDefinition).dnaPreset
  );
  const dnaShared = dnaBundle.shared ?? {};
  const dnaLight = { ...dnaShared, ...(dnaBundle.light ?? {}) };
  const dnaDark = { ...dnaShared, ...(dnaBundle.dark ?? {}) };
  const lightHeroPanel =
    style.cardPreset === 'glass'
      ? mixHex(light.info, light.card, 0.08)
      : style.buttonPreset === 'brutal'
        ? mixHex(light.primary, light.card, 0.1)
        : mixHex(light.info, light.card, 0.04);
  const darkHeroPanel =
    style.cardPreset === 'glass'
      ? mixHex(dark.info, dark.card, 0.12)
      : mixHex(dark.primary, dark.card, 0.06);

  return {
    light: {
      '--theme-canvas': light.background,
      '--theme-canvas-soft': light.backgroundSecondary,
      '--theme-surface': light.card,
      '--theme-surface-raised': mixHex(light.card, light.background, 0.78),
      '--theme-border': light.border,
      '--theme-glow-1': `color-mix(in oklab, ${light.info} 18%, transparent)`,
      '--theme-glow-2': `color-mix(in oklab, ${light.warning} 16%, transparent)`,
      '--theme-hero-panel': lightHeroPanel,
      '--theme-hero-panel-raised': mixHex(light.info, lightHeroPanel, 0.04),
      '--theme-hero-ink': light.foreground,
      '--theme-hero-muted': light.mutedForeground,
      '--theme-hero-soft': light.foregroundSecondary,
      '--theme-hero-inset': `color-mix(in oklab, ${light.primary} 3%, ${light.card})`,
      '--theme-hero-active': `color-mix(in oklab, ${light.info} 10%, ${light.card})`,
      '--theme-brand-mark': light.primary,
      '--theme-grid': `color-mix(in oklab, ${light.foreground} 7%, transparent)`,
      '--theme-font-sans': fonts.sans,
      '--theme-font-display': fonts.display,
      '--theme-font-mono': fonts.mono,
      '--theme-heading-weight': fonts.headingWeight,
      '--theme-body-tracking': fonts.bodyTracking,
      '--theme-heading-tracking': fonts.headingTracking,
      '--theme-radius-card': radii.card,
      '--theme-radius-button': radii.button,
      '--theme-radius-input': radii.input,
      '--theme-radius-badge': radii.badge,
      '--theme-control-height': density.controlHeight,
      '--theme-button-padding-x': density.buttonPaddingX,
      '--theme-card-padding': density.cardPadding,
      '--theme-compact-gap': density.compactGap,
      '--theme-button-border-width': button.borderWidth,
      '--theme-button-weight': button.weight,
      '--theme-button-tracking': button.letterSpacing,
      '--theme-button-hover-transform': button.transform,
      '--theme-button-shadow': shadows.button,
      '--theme-button-hover-shadow': shadows.buttonHover,
      '--theme-card-border-width': card.borderWidth,
      '--theme-card-shadow': shadows.card,
      '--theme-card-hover-shadow': shadows.cardHover,
      '--theme-card-surface-mix': card.surfaceMix,
      '--theme-divider-opacity': card.dividerOpacity,
      '--theme-texture-opacity': textureOpacity[style.texturePreset],
      '--theme-motion-scale':
        style.motionPreset === 'quiet'
          ? '0.55'
          : style.motionPreset === 'expressive'
            ? '1.18'
            : '1',
      ...appearanceVars,
      '--ds-radius': radii.base,
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
      ...dnaLight,
    },
    dark: {
      '--theme-canvas': dark.background,
      '--theme-canvas-soft': dark.backgroundSecondary,
      '--theme-surface': dark.card,
      '--theme-surface-raised': mixHex(dark.card, dark.background, 0.76),
      '--theme-border': dark.border,
      '--theme-glow-1': `color-mix(in oklab, ${dark.info} 22%, transparent)`,
      '--theme-glow-2': `color-mix(in oklab, ${dark.warning} 16%, transparent)`,
      '--theme-hero-panel': darkHeroPanel,
      '--theme-hero-panel-raised': mixHex(dark.info, darkHeroPanel, 0.06),
      '--theme-hero-ink': dark.foreground,
      '--theme-hero-muted': dark.mutedForeground,
      '--theme-hero-soft': dark.foregroundSecondary,
      '--theme-hero-inset': `color-mix(in oklab, ${dark.primary} 5%, ${dark.card})`,
      '--theme-hero-active': `color-mix(in oklab, ${dark.info} 12%, ${dark.card})`,
      '--theme-brand-mark': dark.primary,
      '--theme-grid': `color-mix(in oklab, ${dark.foreground} 8%, transparent)`,
      '--theme-font-sans': fonts.sans,
      '--theme-font-display': fonts.display,
      '--theme-font-mono': fonts.mono,
      '--theme-heading-weight': fonts.headingWeight,
      '--theme-body-tracking': fonts.bodyTracking,
      '--theme-heading-tracking': fonts.headingTracking,
      '--theme-radius-card': radii.card,
      '--theme-radius-button': radii.button,
      '--theme-radius-input': radii.input,
      '--theme-radius-badge': radii.badge,
      '--theme-control-height': density.controlHeight,
      '--theme-button-padding-x': density.buttonPaddingX,
      '--theme-card-padding': density.cardPadding,
      '--theme-compact-gap': density.compactGap,
      '--theme-button-border-width': button.borderWidth,
      '--theme-button-weight': button.weight,
      '--theme-button-tracking': button.letterSpacing,
      '--theme-button-hover-transform': button.transform,
      '--theme-button-shadow': shadows.button,
      '--theme-button-hover-shadow': shadows.buttonHover,
      '--theme-card-border-width': card.borderWidth,
      '--theme-card-shadow': shadows.card,
      '--theme-card-hover-shadow': shadows.cardHover,
      '--theme-card-surface-mix': card.surfaceMix,
      '--theme-divider-opacity': card.dividerOpacity,
      '--theme-texture-opacity': textureOpacity[style.texturePreset],
      '--theme-motion-scale':
        style.motionPreset === 'quiet'
          ? '0.55'
          : style.motionPreset === 'expressive'
            ? '1.18'
            : '1',
      ...appearanceVars,
      '--ds-radius': radii.base,
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
      ...dnaDark,
    },
  } as const;
}

export const webThemeCssVarsByPalette = Object.fromEntries(
  COLOR_PALETTES.map((palette) => {
    const rows = themeColorRowsByPalette[palette];
    const style = getThemeStyleMeta(palette);
    return [
      palette,
      createWebThemeCssVars(
        rows.light,
        rows.dark,
        rows.surfacesLight,
        rows.surfacesDark,
        style,
        palette
      ),
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
