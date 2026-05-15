import {
  COLOR_PALETTES,
  COLOR_PALETTE_STORAGE_KEY,
  DEFAULT_COLOR_PALETTE,
  DEFAULT_HERO_VISUAL_ID,
  HERO_VISUAL_IDS,
  HERO_VISUAL_STORAGE_KEY,
  THEME_APPEARANCE_OVERRIDES_STORAGE_KEY,
  admissionStatus,
  getContrastRatio,
  getThemeAppearance,
  getThemeAppearanceOverrideCssVars,
  getThemeColors,
  getThemeSemanticSurfaces,
  getThemeStyleMeta,
  parseColorPalette,
  serializeCssVars,
  webThemeCssVarsByPalette,
  type ColorPalette,
  type ThemeAppearanceOverrides,
  type ThemeMode,
} from './tokens';

export type ThemeModePreference = ThemeMode | 'system';

export const THEME_STORAGE_KEYS = {
  mode: 'theme',
  colorPalette: COLOR_PALETTE_STORAGE_KEY,
  heroVisual: HERO_VISUAL_STORAGE_KEY,
  appearanceOverrides: THEME_APPEARANCE_OVERRIDES_STORAGE_KEY,
} as const;

export type ThemeStatusTone = 'success' | 'warning' | 'error' | 'info';
export type AdmissionStatusTone = keyof (typeof admissionStatus)['light'];

export type ThemeToneContract = {
  value: string;
  bg: string;
  fg: string;
  border: string;
};

export type ThemeContract = ReturnType<typeof getThemeContract>;

function withAlpha(hex: string, alpha: string) {
  return hex.startsWith('#') && hex.length === 7 ? `${hex}${alpha}` : hex;
}

export function parseThemeModePreference(value: unknown): ThemeModePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

export function resolveThemeModePreference(
  preference: ThemeModePreference,
  systemMode: ThemeMode = 'light'
): ThemeMode {
  return preference === 'system' ? systemMode : preference;
}

export function getThemeStatusContract(
  palette: ColorPalette = DEFAULT_COLOR_PALETTE,
  mode: ThemeMode = 'light'
) {
  const colors = getThemeColors(parseColorPalette(palette), mode);
  const tones: Record<ThemeStatusTone, ThemeToneContract> = {
    success: {
      value: colors.success,
      bg: withAlpha(colors.success, mode === 'dark' ? '2e' : '1f'),
      fg: colors.success,
      border: withAlpha(colors.success, mode === 'dark' ? '66' : '3d'),
    },
    warning: {
      value: colors.warning,
      bg: withAlpha(colors.warning, mode === 'dark' ? '30' : '22'),
      fg: colors.warning,
      border: withAlpha(colors.warning, mode === 'dark' ? '66' : '42'),
    },
    error: {
      value: colors.error,
      bg: withAlpha(colors.error, mode === 'dark' ? '30' : '22'),
      fg: colors.error,
      border: withAlpha(colors.error, mode === 'dark' ? '66' : '42'),
    },
    info: {
      value: colors.info,
      bg: withAlpha(colors.info, mode === 'dark' ? '30' : '1f'),
      fg: colors.info,
      border: withAlpha(colors.info, mode === 'dark' ? '66' : '3d'),
    },
  };

  return {
    ...tones,
    admission: admissionStatus[mode],
  };
}

export function getThemeChartContract(
  palette: ColorPalette = DEFAULT_COLOR_PALETTE,
  mode: ThemeMode = 'light'
) {
  const colors = getThemeColors(parseColorPalette(palette), mode);
  return {
    chart1: colors.primary,
    chart2: colors.success,
    chart3: colors.info,
    chart4: colors.warning,
    chart5: colors.error,
    grid: withAlpha(colors.foreground, mode === 'dark' ? '24' : '1a'),
    axis: colors.mutedForeground,
  };
}

export function getThemeContract(
  input: {
    palette?: ColorPalette | string | null;
    mode?: ThemeMode;
    appearanceOverrides?: ThemeAppearanceOverrides;
  } = {}
) {
  const palette = parseColorPalette(input.palette);
  const mode = input.mode ?? 'light';
  const colors = getThemeColors(palette, mode);
  const surfaces = getThemeSemanticSurfaces(palette, mode);
  const style = getThemeStyleMeta(palette, input.appearanceOverrides);
  const appearance = getThemeAppearance(palette, mode, input.appearanceOverrides);
  const baseCssVars = webThemeCssVarsByPalette[palette][mode];
  const overrideCssVars = input.appearanceOverrides
    ? getThemeAppearanceOverrideCssVars(palette, input.appearanceOverrides)
    : {};
  const cssVars = { ...baseCssVars, ...overrideCssVars };

  return {
    id: palette,
    mode,
    colors,
    surfaces,
    style,
    controls: appearance.controls,
    cssVars,
    status: getThemeStatusContract(palette, mode),
    charts: getThemeChartContract(palette, mode),
    focus: {
      ring: colors.primary,
      ringSoft: withAlpha(colors.primary, mode === 'dark' ? '66' : '3d'),
    },
    shadow: {
      card: cssVars['--theme-card-shadow'],
      cardHover: cssVars['--theme-card-hover-shadow'],
      button: cssVars['--theme-button-shadow'],
      buttonHover: cssVars['--theme-button-hover-shadow'],
    },
    radius: {
      base: cssVars['--ds-radius'],
      card: cssVars['--theme-radius-card'],
      button: cssVars['--theme-radius-button'],
      input: cssVars['--theme-radius-input'],
      badge: cssVars['--theme-radius-badge'],
    },
    typography: {
      sans: cssVars['--theme-font-sans'],
      display: cssVars['--theme-font-display'],
      mono: cssVars['--theme-font-mono'],
      headingWeight: cssVars['--theme-heading-weight'],
      bodyTracking: cssVars['--theme-body-tracking'],
      headingTracking: cssVars['--theme-heading-tracking'],
    },
  };
}

export function getMobileThemeContract(
  input: {
    palette?: ColorPalette | string | null;
    mode?: ThemeMode;
    appearanceOverrides?: ThemeAppearanceOverrides;
  } = {}
) {
  const contract = getThemeContract(input);
  return {
    id: contract.id,
    mode: contract.mode,
    colors: contract.colors,
    surfaces: contract.surfaces,
    status: contract.status,
    charts: contract.charts,
    controls: contract.controls,
    radius: contract.radius,
    shadow: contract.shadow,
  };
}

export function getExtensionThemeCssText(
  palette: ColorPalette = DEFAULT_COLOR_PALETTE,
  selector = ':root'
) {
  const light = getThemeContract({ palette, mode: 'light' });
  const dark = getThemeContract({ palette, mode: 'dark' });
  const extensionVars = (contract: ThemeContract) => ({
    '--lumni-ext-bg': contract.colors.background,
    '--lumni-ext-bg-soft': contract.colors.backgroundSecondary,
    '--lumni-ext-surface': contract.colors.card,
    '--lumni-ext-surface-muted': contract.colors.muted,
    '--lumni-ext-fg': contract.colors.foreground,
    '--lumni-ext-muted': contract.colors.mutedForeground,
    '--lumni-ext-border': contract.colors.border,
    '--lumni-ext-border-strong': contract.colors.borderStrong,
    '--lumni-ext-primary': contract.colors.primary,
    '--lumni-ext-primary-fg': contract.colors.primaryForeground,
    '--lumni-ext-success-bg': contract.status.success.bg,
    '--lumni-ext-success-fg': contract.status.success.fg,
    '--lumni-ext-error-bg': contract.status.error.bg,
    '--lumni-ext-error-fg': contract.status.error.fg,
    '--lumni-ext-warning-bg': contract.status.warning.bg,
    '--lumni-ext-warning-fg': contract.status.warning.fg,
    '--lumni-ext-info-bg': contract.status.info.bg,
    '--lumni-ext-info-fg': contract.status.info.fg,
    '--lumni-ext-shadow':
      contract.mode === 'dark' ? '0 10px 40px rgba(0,0,0,0.42)' : '0 10px 40px rgba(0,0,0,0.14)',
    '--lumni-ext-radius-card': contract.radius.card,
    '--lumni-ext-radius-button': contract.radius.button,
  });

  return `${selector}{${serializeCssVars(extensionVars(light))}}@media (prefers-color-scheme: dark){${selector}{${serializeCssVars(extensionVars(dark))}}}`;
}

export function getWebThemeBootstrapScript() {
  const palettes = JSON.stringify(COLOR_PALETTES);
  const heroVisuals = JSON.stringify(HERO_VISUAL_IDS);
  return `(function(){try{var palettes=${palettes};var heroes=${heroVisuals};var root=document.documentElement;var palette=localStorage.getItem('${COLOR_PALETTE_STORAGE_KEY}')||root.getAttribute('data-color-palette')||'${DEFAULT_COLOR_PALETTE}';if(palettes.indexOf(palette)===-1){if(palette==='warm')palette='${DEFAULT_COLOR_PALETTE}';else if(palette==='slate')palette='linear-indigo';else palette='${DEFAULT_COLOR_PALETTE}';}root.setAttribute('data-color-palette',palette);var hero=localStorage.getItem('${HERO_VISUAL_STORAGE_KEY}')||root.getAttribute('data-hero-visual')||'${DEFAULT_HERO_VISUAL_ID}';if(hero==='matrix-premium')hero='${DEFAULT_HERO_VISUAL_ID}';if(heroes.indexOf(hero)===-1)hero='${DEFAULT_HERO_VISUAL_ID}';root.setAttribute('data-hero-visual',hero);}catch(e){}})();`;
}

export function getThemeContractContrastSummary(palette: ColorPalette = DEFAULT_COLOR_PALETTE) {
  const light = getThemeContract({ palette, mode: 'light' });
  const dark = getThemeContract({ palette, mode: 'dark' });
  return {
    lightText: getContrastRatio(light.colors.foreground, light.colors.background),
    darkText: getContrastRatio(dark.colors.foreground, dark.colors.background),
    lightCard: getContrastRatio(light.colors.cardForeground, light.colors.card),
    darkCard: getContrastRatio(dark.colors.cardForeground, dark.colors.card),
    lightPrimary: getContrastRatio(light.colors.primaryForeground, light.colors.primary),
    darkPrimary: getContrastRatio(dark.colors.primaryForeground, dark.colors.primary),
  };
}
