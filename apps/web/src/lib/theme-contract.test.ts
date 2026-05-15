import { describe, expect, it } from 'vitest';
import {
  COLOR_PALETTES,
  DEFAULT_COLOR_PALETTE,
  getExtensionThemeCssText,
  getMobileThemeContract,
  getThemeContract,
  getThemeContractContrastSummary,
  getWebThemeBootstrapScript,
  parseThemeModePreference,
  resolveThemeModePreference,
} from '@study-abroad/shared';

describe('cross-platform theme contract', () => {
  it('normalizes persisted theme mode preferences', () => {
    expect(parseThemeModePreference('light')).toBe('light');
    expect(parseThemeModePreference('dark')).toBe('dark');
    expect(parseThemeModePreference('system')).toBe('system');
    expect(parseThemeModePreference('legacy')).toBe('system');
    expect(resolveThemeModePreference('system', 'dark')).toBe('dark');
  });

  it('keeps light and dark contracts key-compatible for every palette', () => {
    for (const palette of COLOR_PALETTES) {
      const light = getThemeContract({ palette, mode: 'light' });
      const dark = getThemeContract({ palette, mode: 'dark' });

      expect(Object.keys(dark.colors).sort()).toEqual(Object.keys(light.colors).sort());
      expect(Object.keys(dark.surfaces).sort()).toEqual(Object.keys(light.surfaces).sort());
      expect(Object.keys(dark.status).sort()).toEqual(Object.keys(light.status).sort());
      expect(Object.keys(dark.charts).sort()).toEqual(Object.keys(light.charts).sort());
      expect(light.radius).toEqual(dark.radius);
    }
  });

  it('keeps default text and primary button contrast enterprise-ready', () => {
    const summary = getThemeContractContrastSummary(DEFAULT_COLOR_PALETTE);

    expect(summary.lightText).toBeGreaterThanOrEqual(4.5);
    expect(summary.darkText).toBeGreaterThanOrEqual(4.5);
    expect(summary.lightCard).toBeGreaterThanOrEqual(4.5);
    expect(summary.darkCard).toBeGreaterThanOrEqual(4.5);
    expect(summary.lightPrimary).toBeGreaterThanOrEqual(4.5);
    expect(summary.darkPrimary).toBeGreaterThanOrEqual(4.5);
  });

  it('emits mobile-safe status and chart contracts', () => {
    const contract = getMobileThemeContract({
      palette: DEFAULT_COLOR_PALETTE,
      mode: 'dark',
    });

    expect(contract.status.success.bg).toMatch(/^#/);
    expect(contract.status.warning.border).toMatch(/^#/);
    expect(contract.charts.chart1).toMatch(/^#/);
    expect(contract.charts.axis).toMatch(/^#/);
  });

  it('emits browser extension CSS variables for light and system-dark', () => {
    const css = getExtensionThemeCssText(DEFAULT_COLOR_PALETTE, ':root');

    expect(css).toContain('--lumni-ext-bg');
    expect(css).toContain('--lumni-ext-primary-fg');
    expect(css).toContain('@media (prefers-color-scheme: dark)');
  });

  it('emits a first-paint web bootstrap script for palette and hero visual', () => {
    const script = getWebThemeBootstrapScript();

    expect(script).toContain('data-color-palette');
    expect(script).toContain('data-hero-visual');
    expect(script).toContain('localStorage.getItem');
  });
});
