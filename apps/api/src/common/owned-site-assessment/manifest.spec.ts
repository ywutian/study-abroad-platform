import {
  defaultTargetSessionPath,
  filterOwnedSiteAssessmentTargets,
  parseOwnedSiteAssessmentManifest,
  resolveOwnedSiteAssessmentManifestTemplates,
  validateOwnedSiteAssessmentTargetJourneys,
} from './manifest';

describe('owned-site-assessment manifest helpers', () => {
  const manifest = parseOwnedSiteAssessmentManifest({
    version: 1,
    journeyCatalog: [
      {
        journeyId: 'collegevine.discovery',
        siteKey: 'collegevine',
        label: 'Discovery',
        category: 'discovery',
        entryUrl: '${COLLEGEVINE_DISCOVERY_URL}',
        requiresAuth: false,
        defaultMutationBudget: 'read-only',
        desktopPriority: 90,
      },
    ],
    targets: [
      {
        targetId: 'collegevine.prod.guest',
        siteKey: 'collegevine',
        environment: 'prod',
        role: 'guest',
        loginUrl: 'https://example.com/login',
        homeUrl: 'https://example.com',
        journeys: ['collegevine.discovery'],
        mutationBudget: 'read-only',
        accountLabel: 'guest',
        accountOwner: 'owner',
      },
    ],
    privilegeTransitions: [],
  });

  it('resolves environment templates inside the manifest', () => {
    const resolved = resolveOwnedSiteAssessmentManifestTemplates(manifest, {
      COLLEGEVINE_DISCOVERY_URL:
        'https://www.collegevine.com/admissions-calculator/',
    });

    expect(resolved.unresolvedEnvVars).toEqual([]);
    expect(resolved.manifest.journeyCatalog[0]?.entryUrl).toBe(
      'https://www.collegevine.com/admissions-calculator/',
    );
  });

  it('keeps unresolved placeholders while reporting them', () => {
    const resolved = resolveOwnedSiteAssessmentManifestTemplates(manifest, {});

    expect(resolved.unresolvedEnvVars).toEqual(['COLLEGEVINE_DISCOVERY_URL']);
    expect(resolved.manifest.journeyCatalog[0]?.entryUrl).toBe(
      '${COLLEGEVINE_DISCOVERY_URL}',
    );
  });

  it('filters targets by site, environment, and role', () => {
    const filtered = filterOwnedSiteAssessmentTargets(manifest, {
      siteKeys: ['collegevine'],
      environments: ['prod'],
      roles: ['guest'],
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.targetId).toBe('collegevine.prod.guest');
  });

  it('reports unknown journey references', () => {
    const withUnknownJourney = parseOwnedSiteAssessmentManifest({
      ...manifest,
      targets: [
        {
          ...manifest.targets[0],
          journeys: ['unknown.journey'],
        },
      ],
    });

    expect(
      validateOwnedSiteAssessmentTargetJourneys(withUnknownJourney),
    ).toEqual([
      'Target collegevine.prod.guest references unknown journeyId unknown.journey.',
    ]);
  });

  it('builds the default storage state path for a target', () => {
    expect(
      defaultTargetSessionPath(
        {
          siteKey: 'collegevine',
          environment: 'prod',
          role: 'profiled_consumer',
        },
        '/tmp/owned-site-assessment',
      ),
    ).toBe(
      '/tmp/owned-site-assessment/collegevine.prod.profiled_consumer.storageState.json',
    );
  });
});
