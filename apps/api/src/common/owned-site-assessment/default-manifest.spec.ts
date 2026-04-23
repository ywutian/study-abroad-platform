import { parseOwnedSiteAssessmentManifest } from './manifest';
import { DEFAULT_OWNED_SITE_ASSESSMENT_MANIFEST } from './default-manifest';

describe('default owned-site-assessment manifest', () => {
  it('parses and covers the seven owned sites across prod and staging', () => {
    const manifest = parseOwnedSiteAssessmentManifest(
      DEFAULT_OWNED_SITE_ASSESSMENT_MANIFEST,
    );

    const siteKeys = new Set(manifest.targets.map((target) => target.siteKey));
    const environments = new Set(
      manifest.targets.map((target) => target.environment),
    );

    expect(siteKeys).toEqual(
      new Set([
        'collegevine',
        'campusreel',
        'niche',
        'parchment',
        'college-raptor',
        'appily',
        'prepscholar',
      ]),
    );
    expect(environments).toEqual(new Set(['prod', 'staging']));
  });

  it('includes at least one guest target and one privileged target per site', () => {
    const manifest = parseOwnedSiteAssessmentManifest(
      DEFAULT_OWNED_SITE_ASSESSMENT_MANIFEST,
    );

    for (const siteKey of [
      'collegevine',
      'campusreel',
      'niche',
      'parchment',
      'college-raptor',
      'appily',
      'prepscholar',
    ] as const) {
      const siteTargets = manifest.targets.filter(
        (target) => target.siteKey === siteKey,
      );
      expect(siteTargets.some((target) => target.role === 'guest')).toBe(true);
      expect(
        siteTargets.some(
          (target) =>
            target.role === 'institution_staff' || target.role === 'admin_ops',
        ),
      ).toBe(true);
    }
  });
});
