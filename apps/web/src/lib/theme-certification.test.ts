import { describe, expect, it } from 'vitest';
import {
  COLOR_PALETTES,
  DEFAULT_COLOR_PALETTE,
  DEFAULT_HERO_VISUAL_ID,
  ENTERPRISE_THEME_REQUIRED_ROUTES,
  HERO_VISUAL_IDS,
  buildThemeCertificationMatrix,
  certifyEnterpriseTheme,
} from '@study-abroad/shared';

describe('enterprise theme certification', () => {
  it('certifies every palette, hero visual, and light/dark mode combination', () => {
    const matrix = buildThemeCertificationMatrix('2026-05-02T00:00:00.000Z');

    expect(matrix.defaultPalette).toBe('cobalt-saas');
    expect(matrix.defaultHeroVisual).toBe('command-center');
    expect(matrix.total).toBe(COLOR_PALETTES.length * HERO_VISUAL_IDS.length);
    expect(matrix.matrix).toHaveLength(matrix.total);
    expect(matrix.failed).toBe(0);
    expect(matrix.diagnostics.buttonVariantCount).toBe(8);
    expect(matrix.passed + matrix.warning + matrix.failed).toBe(matrix.total);

    for (const entry of matrix.matrix) {
      expect(entry.certification.modes.light.tokenCompleteness).toBe(1);
      expect(entry.certification.modes.dark.tokenCompleteness).toBe(1);
      expect(entry.certification.modes.light.minimumContrastRatio).toBeGreaterThanOrEqual(3);
      expect(entry.certification.modes.dark.minimumContrastRatio).toBeGreaterThanOrEqual(3);
      expect(entry.certification.buttonSurfaceAudit).toHaveLength(16);
      expect(
        entry.certification.componentStateAudit.every((audit) => audit.status === 'passed')
      ).toBe(true);
      expect(entry.certification.routeAuditSummary).toHaveLength(
        ENTERPRISE_THEME_REQUIRED_ROUTES.length
      );
    }
  });

  it('keeps the selected blue enterprise default fully certified', () => {
    const certification = certifyEnterpriseTheme({
      palette: DEFAULT_COLOR_PALETTE,
      heroVisual: DEFAULT_HERO_VISUAL_ID,
      certifiedAt: '2026-05-02T00:00:00.000Z',
    });

    expect(certification.palette).toBe('cobalt-saas');
    expect(certification.heroVisual).toBe('command-center');
    expect(certification.status).toBe('passed');
    expect(certification.score).toBeGreaterThanOrEqual(95);
    expect(certification.contrastSummary.minimumTextContrast).toBeGreaterThanOrEqual(4.5);
    expect(certification.issues).toEqual([]);
  });
});
