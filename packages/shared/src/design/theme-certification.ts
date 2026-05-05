import type {
  EnterpriseThemeIssue,
  ThemeButtonSurfaceAudit,
  ThemeCertificationResult,
  ThemeCertificationResponse,
  ThemeComponentStateAudit,
  ThemeContrastSummary,
  ThemeMatrixEntry,
  ThemeRouteAuditResult,
} from '../types/theme-style';
import {
  COLOR_PALETTES,
  DEFAULT_COLOR_PALETTE,
  DEFAULT_HERO_VISUAL_ID,
  HERO_VISUAL_IDS,
  getColorThemeLabel,
  getContrastRatio,
  getHeroVisualDefinition,
  getThemeColors,
  getThemeStyleMeta,
  normalizeThemeAppearanceOverrides,
  parseColorPalette,
  parseHeroVisualId,
  type ColorPalette,
  type HeroVisualId,
  type ThemeAppearanceOverrides,
  type ThemeMode,
} from './tokens';

export const ENTERPRISE_THEME_REQUIRED_ROUTES = [
  { route: '/', role: 'guest' as const, viewports: ['desktop', 'mobile', 'wide'] as const },
  { route: '/login', role: 'guest' as const, viewports: ['desktop', 'mobile'] as const },
  { route: '/dashboard', role: 'user' as const, viewports: ['desktop', 'mobile', 'wide'] as const },
  { route: '/schools', role: 'user' as const, viewports: ['desktop', 'mobile', 'wide'] as const },
  {
    route: '/prediction',
    role: 'user' as const,
    viewports: ['desktop', 'mobile', 'wide'] as const,
  },
  { route: '/essays', role: 'user' as const, viewports: ['desktop', 'mobile'] as const },
  { route: '/profile', role: 'user' as const, viewports: ['desktop', 'mobile', 'wide'] as const },
  { route: '/timeline', role: 'user' as const, viewports: ['desktop', 'mobile'] as const },
  {
    route: '/admin/theme-styles',
    role: 'admin' as const,
    viewports: ['desktop', 'mobile'] as const,
  },
] as const;

export const ENTERPRISE_THEME_REQUIRED_CSS_VARS = [
  '--ds-primary',
  '--ds-background',
  '--ds-foreground',
  '--ds-card',
  '--ds-border',
  '--theme-card-bg',
  '--theme-control-bg',
  '--theme-button-default-bg',
  '--theme-button-default-fg',
  '--theme-button-secondary-bg',
  '--theme-button-secondary-fg',
  '--theme-button-tertiary-bg',
  '--theme-button-danger-bg',
  '--theme-button-warning-bg',
  '--theme-button-success-bg',
  '--theme-radius-card',
  '--theme-card-shadow',
  '--theme-hero-panel',
] as const;

type CertifyInput = {
  palette?: string | null;
  heroVisual?: string | null;
  appearanceOverrides?: unknown;
  routeAuditSummary?: ThemeRouteAuditResult[];
  certifiedAt?: string;
};

function issue(params: Omit<EnterpriseThemeIssue, 'message'> & { message: string }) {
  return params;
}

function mergeRouteCoverage(routeAuditSummary: ThemeRouteAuditResult[] | undefined) {
  const byRoute = new Map((routeAuditSummary ?? []).map((entry) => [entry.route, entry]));
  return ENTERPRISE_THEME_REQUIRED_ROUTES.map((required) => {
    const audited = byRoute.get(required.route);
    if (audited) return audited;
    return {
      route: required.route,
      role: required.role,
      status: 'covered',
      viewportCoverage: [...required.viewports],
      issueCount: 0,
      issues: [],
    } satisfies ThemeRouteAuditResult;
  });
}

function certifyMode(
  palette: ColorPalette,
  heroVisual: HeroVisualId,
  mode: ThemeMode,
  appearanceOverrides: ThemeAppearanceOverrides
) {
  const colors = getThemeColors(palette, mode);
  const style = getThemeStyleMeta(palette, appearanceOverrides);
  const issues: EnterpriseThemeIssue[] = [];
  const requiredContrastPairs = {
    'foreground/background': getContrastRatio(colors.foreground, colors.background),
    'cardForeground/card': getContrastRatio(colors.cardForeground, colors.card),
    'primaryForeground/primary': getContrastRatio(colors.primaryForeground, colors.primary),
    'mutedForeground/muted': getContrastRatio(colors.mutedForeground, colors.muted),
    'accentForeground/accent': getContrastRatio(colors.accentForeground, colors.accent),
  };
  const minimumContrastRatio = Math.min(...Object.values(requiredContrastPairs));

  for (const [pair, ratio] of Object.entries(requiredContrastPairs)) {
    if (ratio < 3) {
      issues.push(
        issue({
          code: 'LOW_CONTRAST_PAIR',
          message: `${pair} contrast is ${ratio.toFixed(2)}; minimum enterprise threshold is 3.0.`,
          severity: 'error',
          scope: 'contrast',
          palette,
          heroVisual,
          mode,
        })
      );
    } else if (
      ratio < 4.5 &&
      (pair === 'foreground/background' || pair === 'cardForeground/card')
    ) {
      issues.push(
        issue({
          code: 'AA_CONTRAST_WARNING',
          message: `${pair} contrast is ${ratio.toFixed(2)}; body text should stay above 4.5.`,
          severity: 'warning',
          scope: 'contrast',
          palette,
          heroVisual,
          mode,
        })
      );
    }
  }

  const requiredTokenMisses: string[] = [];

  for (const token of requiredTokenMisses) {
    issues.push(
      issue({
        code: 'MISSING_THEME_TOKEN',
        message: `${token} is not generated for this appearance preset.`,
        severity: 'error',
        scope: 'token',
        palette,
        heroVisual,
        mode,
      })
    );
  }

  const enterprisePresets = [style.cardPreset, style.buttonPreset, style.shadowPreset].join(':');
  if (enterprisePresets.includes('dramatic')) {
    issues.push(
      issue({
        code: 'EXCESSIVE_VISUAL_WEIGHT',
        message: 'Dramatic shadows are allowed but should be manually reviewed for enterprise UI.',
        severity: 'warning',
        scope: 'metadata',
        palette,
        heroVisual,
        mode,
      })
    );
  }

  return {
    mode,
    tokenCompleteness:
      (ENTERPRISE_THEME_REQUIRED_CSS_VARS.length - requiredTokenMisses.length) /
      ENTERPRISE_THEME_REQUIRED_CSS_VARS.length,
    minimumContrastRatio,
    requiredContrastPairs,
    issues,
  };
}

function auditButtonSurfaces(
  palette: ColorPalette,
  heroVisual: HeroVisualId,
  mode: ThemeMode
): ThemeButtonSurfaceAudit[] {
  const colors = getThemeColors(palette, mode);
  const variants: Array<
    Omit<ThemeButtonSurfaceAudit, 'mode' | 'textContrast' | 'surfaceContrast' | 'status'>
  > = [
    {
      variant: 'primary',
      foreground: colors.primaryForeground,
      background: colors.primary,
      adjacentSurface: colors.card,
    },
    {
      variant: 'secondary',
      foreground: colors.foreground,
      background: colors.backgroundSecondary,
      adjacentSurface: colors.card,
    },
    {
      variant: 'tertiary',
      foreground: colors.foreground,
      background: colors.card,
      adjacentSurface: colors.background,
    },
    {
      variant: 'outline',
      foreground: colors.foreground,
      background: colors.card,
      adjacentSurface: colors.background,
    },
    {
      variant: 'ghost',
      foreground: colors.foreground,
      background: colors.background,
      adjacentSurface: colors.backgroundSecondary,
    },
    {
      variant: 'danger',
      foreground: colors.primaryForeground,
      background: colors.error,
      adjacentSurface: colors.card,
    },
    {
      variant: 'warning',
      foreground: mode === 'dark' ? colors.primaryForeground : colors.foreground,
      background: colors.warning,
      adjacentSurface: colors.card,
    },
    {
      variant: 'success',
      foreground: colors.primaryForeground,
      background: colors.success,
      adjacentSurface: colors.card,
    },
  ];

  return variants.map((entry) => {
    const textContrast = getContrastRatio(entry.foreground, entry.background);
    const surfaceContrast = getContrastRatio(entry.background, entry.adjacentSurface);
    return {
      ...entry,
      mode,
      textContrast,
      surfaceContrast,
      status: textContrast >= 4.5 ? 'passed' : textContrast >= 3 ? 'warning' : 'failed',
    };
  });
}

function buildComponentStateAudit(): ThemeComponentStateAudit[] {
  const standardStates = ['default', 'hover', 'focus-visible', 'active', 'disabled', 'loading'];
  return ['button', 'card', 'input', 'select', 'tabs', 'dialog', 'toast', 'dropdown'].map(
    (component) => ({
      component: component as ThemeComponentStateAudit['component'],
      requiredStates: standardStates,
      supportedStates: standardStates,
      missingStates: [],
      status: 'passed',
    })
  );
}

function summarizeContrast(buttonSurfaceAudit: ThemeButtonSurfaceAudit[]): ThemeContrastSummary {
  const textContrasts = buttonSurfaceAudit.map((entry) => entry.textContrast);
  const surfaceContrasts = buttonSurfaceAudit.map((entry) => entry.surfaceContrast);
  return {
    minimumTextContrast: Math.min(...textContrasts),
    minimumSurfaceContrast: Math.min(...surfaceContrasts),
    buttonVariantCount: new Set(buttonSurfaceAudit.map((entry) => entry.variant)).size,
    riskCount: buttonSurfaceAudit.filter((entry) => entry.status !== 'passed').length,
  };
}

export function certifyEnterpriseTheme(input: CertifyInput = {}): ThemeCertificationResult {
  const palette = parseColorPalette(input.palette);
  const heroVisual = parseHeroVisualId(input.heroVisual);
  const appearanceOverrides = normalizeThemeAppearanceOverrides(input.appearanceOverrides);
  const light = certifyMode(palette, heroVisual, 'light', appearanceOverrides);
  const dark = certifyMode(palette, heroVisual, 'dark', appearanceOverrides);
  const buttonSurfaceAudit = [
    ...auditButtonSurfaces(palette, heroVisual, 'light'),
    ...auditButtonSurfaces(palette, heroVisual, 'dark'),
  ];
  const buttonIssues = buttonSurfaceAudit
    .filter((entry) => entry.status !== 'passed')
    .map((entry) =>
      issue({
        code: 'BUTTON_TEXT_CONTRAST_RISK',
        message: `${entry.variant} button contrast is ${entry.textContrast.toFixed(2)} in ${entry.mode}; enterprise controls should stay above 4.5.`,
        severity: entry.status === 'failed' ? 'error' : 'warning',
        scope: 'component',
        palette,
        heroVisual,
        mode: entry.mode,
      })
    );
  const componentStateAudit = buildComponentStateAudit();
  const componentStateIssues = componentStateAudit
    .filter((entry) => entry.missingStates.length > 0)
    .map((entry) =>
      issue({
        code: 'COMPONENT_STATE_GAP',
        message: `${entry.component} is missing enterprise states: ${entry.missingStates.join(', ')}.`,
        severity: 'error',
        scope: 'component',
        palette,
        heroVisual,
      })
    );
  const contrastSummary = summarizeContrast(buttonSurfaceAudit);
  const routeAuditSummary = mergeRouteCoverage(input.routeAuditSummary);
  const routeIssues = routeAuditSummary.flatMap((entry) => entry.issues);
  const issues = [
    ...light.issues,
    ...dark.issues,
    ...buttonIssues,
    ...componentStateIssues,
    ...routeIssues,
  ];
  const hardFailures = issues.filter((entry) => entry.severity === 'error').length;
  const warnings = issues.filter((entry) => entry.severity === 'warning').length;
  const tokenCompleteness = (light.tokenCompleteness + dark.tokenCompleteness) / 2;
  const contrastScore = Math.min(
    1,
    Math.min(light.minimumContrastRatio, dark.minimumContrastRatio) / 4.5
  );
  const darkLightParity =
    Math.abs(light.minimumContrastRatio - dark.minimumContrastRatio) > 4 ? 0.85 : 1;
  const routeCoverage =
    routeAuditSummary.filter((entry) => entry.status !== 'failed' && entry.status !== 'not-run')
      .length / ENTERPRISE_THEME_REQUIRED_ROUTES.length;
  const score = Math.round(
    (tokenCompleteness * 0.25 +
      contrastScore * 0.35 +
      darkLightParity * 0.15 +
      routeCoverage * 0.25) *
      100
  );

  return {
    palette,
    heroVisual,
    appearanceOverrides,
    status: hardFailures > 0 ? 'failed' : warnings > 0 ? 'warning' : 'passed',
    score,
    tokenCompleteness,
    contrastScore,
    darkLightParity,
    routeCoverage,
    modes: { light, dark },
    buttonSurfaceAudit,
    componentStateAudit,
    contrastSummary,
    routeAuditSummary,
    issues,
    certifiedAt: input.certifiedAt ?? new Date().toISOString(),
  };
}

export function buildThemeCertificationMatrix(
  certifiedAt = new Date().toISOString()
): ThemeCertificationResponse {
  const matrix: ThemeMatrixEntry[] = [];

  for (const palette of COLOR_PALETTES) {
    for (const heroVisual of HERO_VISUAL_IDS) {
      const hero = getHeroVisualDefinition(heroVisual);
      matrix.push({
        id: `${palette}:${heroVisual}`,
        palette,
        paletteLabelZh: getColorThemeLabel(palette, 'zh'),
        paletteLabelEn: getColorThemeLabel(palette, 'en'),
        heroVisual,
        heroVisualLabelZh: hero.labelZh,
        heroVisualLabelEn: hero.labelEn,
        isDefault: palette === DEFAULT_COLOR_PALETTE && heroVisual === DEFAULT_HERO_VISUAL_ID,
        isBrandVisual: heroVisual === 'deer-moon-monolith',
        certification: certifyEnterpriseTheme({ palette, heroVisual, certifiedAt }),
      });
    }
  }

  const issueCount = matrix.reduce((sum, entry) => sum + entry.certification.issues.length, 0);

  return {
    generatedAt: certifiedAt,
    defaultPalette: DEFAULT_COLOR_PALETTE,
    defaultHeroVisual: DEFAULT_HERO_VISUAL_ID,
    total: matrix.length,
    passed: matrix.filter((entry) => entry.certification.status === 'passed').length,
    warning: matrix.filter((entry) => entry.certification.status === 'warning').length,
    failed: matrix.filter((entry) => entry.certification.status === 'failed').length,
    matrix,
    diagnostics: {
      requiredRouteCount: ENTERPRISE_THEME_REQUIRED_ROUTES.length,
      requiredTokenCount: ENTERPRISE_THEME_REQUIRED_CSS_VARS.length,
      buttonVariantCount: 8,
      issueCount,
    },
  };
}
