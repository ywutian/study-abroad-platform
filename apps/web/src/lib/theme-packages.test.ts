import { describe, expect, it } from 'vitest';
import {
  COLOR_THEME_CATEGORIES,
  COLOR_THEME_DEFINITIONS,
  EXPERIMENTAL_COLOR_PALETTE_IDS,
  FEATURED_COLOR_PALETTE_IDS,
  getThemeColors,
  getThemeCssText,
  getThemePreview,
  getThemeStyleMeta,
  type ColorPalette,
} from '@study-abroad/shared';

function hexSaturation(hex: string) {
  const normalized = hex.replace('#', '');
  const r = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const g = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const b = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

describe('global theme packages', () => {
  it('keeps a broad library of enterprise palette packages', () => {
    expect(COLOR_THEME_DEFINITIONS.length).toBeGreaterThanOrEqual(160);

    const accentSignatures = new Set(
      COLOR_THEME_DEFINITIONS.map((theme) => {
        const colors = getThemeColors(theme.id as ColorPalette, 'light');
        return [colors.primary, colors.info, colors.violet, colors.pink, colors.warning].join(':');
      })
    );

    const lightBackgroundSaturation =
      COLOR_THEME_DEFINITIONS.reduce((sum, theme) => {
        return sum + hexSaturation(getThemeColors(theme.id as ColorPalette, 'light').background);
      }, 0) / COLOR_THEME_DEFINITIONS.length;
    const lightCardSaturation =
      COLOR_THEME_DEFINITIONS.reduce((sum, theme) => {
        return sum + hexSaturation(getThemeColors(theme.id as ColorPalette, 'light').card);
      }, 0) / COLOR_THEME_DEFINITIONS.length;

    expect(accentSignatures.size).toBeGreaterThanOrEqual(145);
    expect(lightBackgroundSaturation).toBeLessThan(0.16);
    expect(lightCardSaturation).toBeLessThan(0.12);
  });

  it('keeps theme identity in accents instead of full-page tint', () => {
    const signatures = COLOR_THEME_DEFINITIONS.map((theme) => {
      const colors = getThemeColors(theme.id as ColorPalette, 'light');
      const style = getThemeStyleMeta(theme.id as ColorPalette);
      const preview = getThemePreview(theme.id as ColorPalette);
      return [
        colors.primary,
        colors.info,
        colors.violet,
        preview.heroPanel,
        style.typographyPreset,
        style.radiusPreset,
        style.buttonPreset,
        style.cardPreset,
        style.shadowPreset,
      ].join(':');
    });

    expect(new Set(signatures).size).toBeGreaterThanOrEqual(145);
  });

  it('curates a premium default set while keeping the full library searchable', () => {
    expect(FEATURED_COLOR_PALETTE_IDS.length).toBeGreaterThanOrEqual(12);
    expect(FEATURED_COLOR_PALETTE_IDS.length).toBeLessThanOrEqual(16);
    expect(new Set(FEATURED_COLOR_PALETTE_IDS).size).toBe(FEATURED_COLOR_PALETTE_IDS.length);

    const featuredDefinitions = FEATURED_COLOR_PALETTE_IDS.map((id) =>
      COLOR_THEME_DEFINITIONS.find((theme) => theme.id === id)
    );
    expect(featuredDefinitions.every((theme) => theme?.featured)).toBe(true);

    const experimentalSet = new Set(EXPERIMENTAL_COLOR_PALETTE_IDS);
    expect(EXPERIMENTAL_COLOR_PALETTE_IDS.length).toBeGreaterThanOrEqual(8);
    expect(FEATURED_COLOR_PALETTE_IDS.some((id) => experimentalSet.has(id))).toBe(false);

    const nonFeaturedTheme = COLOR_THEME_DEFINITIONS.find(
      (theme) => !theme.featured && !theme.experimental
    );
    expect(nonFeaturedTheme).toBeDefined();
    expect(COLOR_THEME_DEFINITIONS.map((theme) => theme.id)).toContain(nonFeaturedTheme!.id);
  });

  it('gives every category a distinct enterprise accent sample', () => {
    const samples = COLOR_THEME_CATEGORIES.map((category) => {
      const theme = COLOR_THEME_DEFINITIONS.find((item) => item.category === category.id);
      expect(theme).toBeDefined();
      const colors = getThemeColors(theme!.id as ColorPalette, 'light');
      const preview = getThemePreview(theme!.id as ColorPalette);
      return `${colors.primary}:${colors.info}:${preview.heroPanel}`;
    });

    expect(new Set(samples).size).toBe(COLOR_THEME_CATEGORIES.length);
  });

  it('keeps product surfaces readable for enterprise use', () => {
    const surfaceGaps = COLOR_THEME_DEFINITIONS.map((theme) => {
      const colors = getThemeColors(theme.id as ColorPalette, 'light');
      return Math.abs(hexSaturation(colors.background) - hexSaturation(colors.primary));
    });

    expect(Math.max(...surfaceGaps)).toBeGreaterThan(0.2);
  });

  it('emits enterprise palette CSS variables for every theme', () => {
    const css = getThemeCssText();

    expect(css).toContain('--theme-canvas');
    expect(css).toContain('--theme-surface');
    expect(css).toContain('--theme-brand-presence');
    expect(css).toContain('--theme-brand-tint');
    expect(css).toContain('--theme-glow-1');
    expect(css).toContain('--theme-hero-ink');
    expect(css).toContain('--theme-font-sans');
    expect(css).toContain('--theme-radius-button');
    expect(css).toContain('--theme-card-shadow');
    expect(css).toContain('html:not(.dark)[data-color-palette="studio-black-blue"]');
    expect(css).toContain('html.dark[data-color-palette="contrast-cyan"]');
  });
});
