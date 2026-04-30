import { describe, expect, it } from 'vitest';
import {
  COLOR_THEME_CATEGORIES,
  COLOR_THEME_DEFINITIONS,
  getThemeColors,
  getThemeCssText,
  getThemePreview,
  getThemeStyleMeta,
  type ColorPalette,
} from '@study-abroad/shared';

describe('global theme packages', () => {
  it('keeps a broad library of full visual themes', () => {
    expect(COLOR_THEME_DEFINITIONS.length).toBeGreaterThanOrEqual(160);

    const lightBackgrounds = new Set(
      COLOR_THEME_DEFINITIONS.map((theme) =>
        getThemeColors(theme.id as ColorPalette, 'light').background.toLowerCase()
      )
    );
    const darkBackgrounds = new Set(
      COLOR_THEME_DEFINITIONS.map((theme) =>
        getThemeColors(theme.id as ColorPalette, 'dark').background.toLowerCase()
      )
    );

    expect(lightBackgrounds.size).toBeGreaterThanOrEqual(100);
    expect(darkBackgrounds.size).toBeGreaterThanOrEqual(80);
  });

  it('gives themes distinct full-skin signatures, not just accent colors', () => {
    const signatures = COLOR_THEME_DEFINITIONS.map((theme) => {
      const colors = getThemeColors(theme.id as ColorPalette, 'light');
      const style = getThemeStyleMeta(theme.id as ColorPalette);
      const preview = getThemePreview(theme.id as ColorPalette);
      return [
        colors.background,
        colors.card,
        colors.primary,
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

  it('gives every category a distinct canvas and surface sample', () => {
    const samples = COLOR_THEME_CATEGORIES.map((category) => {
      const theme = COLOR_THEME_DEFINITIONS.find((item) => item.category === category.id);
      expect(theme).toBeDefined();
      const colors = getThemeColors(theme!.id as ColorPalette, 'light');
      return `${colors.background}:${colors.card}`;
    });

    expect(new Set(samples).size).toBe(COLOR_THEME_CATEGORIES.length);
  });

  it('emits full skin CSS variables for every theme', () => {
    const css = getThemeCssText();

    expect(css).toContain('--theme-canvas');
    expect(css).toContain('--theme-surface');
    expect(css).toContain('--theme-glow-1');
    expect(css).toContain('--theme-hero-ink');
    expect(css).toContain('--theme-font-sans');
    expect(css).toContain('--theme-radius-button');
    expect(css).toContain('--theme-card-shadow');
    expect(css).toContain('html:not(.dark)[data-color-palette="studio-black-blue"]');
    expect(css).toContain('html.dark[data-color-palette="contrast-cyan"]');
  });
});
