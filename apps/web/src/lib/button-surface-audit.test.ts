import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COLOR_PALETTE,
  DEFAULT_HERO_VISUAL_ID,
  certifyEnterpriseTheme,
} from '@study-abroad/shared';

describe('enterprise button surface audit', () => {
  it('keeps the default enterprise button set readable in light and dark modes', () => {
    const certification = certifyEnterpriseTheme({
      palette: DEFAULT_COLOR_PALETTE,
      heroVisual: DEFAULT_HERO_VISUAL_ID,
      certifiedAt: '2026-05-02T00:00:00.000Z',
    });

    expect(certification.buttonSurfaceAudit).toHaveLength(16);
    expect(certification.contrastSummary.buttonVariantCount).toBe(8);
    expect(certification.contrastSummary.minimumTextContrast).toBeGreaterThanOrEqual(4.5);
    expect(certification.buttonSurfaceAudit.every((entry) => entry.status === 'passed')).toBe(true);
  });
});
