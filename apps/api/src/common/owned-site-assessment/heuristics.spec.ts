import {
  buildCoverageMatrix,
  buildDefenseBacklog,
  buildDesktopProbePlan,
  classifyJourneyFeasibility,
  inferExtractionPreference,
  inferPaginationBehavior,
} from './heuristics';
import type { OwnedSiteJourneyObservation } from '@study-abroad/shared';

describe('owned-site-assessment heuristics', () => {
  it('prefers browser extraction when structured surfaces are available', () => {
    expect(
      inferExtractionPreference({
        dataSurfaces: ['rest', 'dom'],
        authSatisfied: true,
        challengePoints: [],
      }),
    ).toBe('browser');
  });

  it('classifies blocked journeys when auth is required but unsatisfied', () => {
    expect(
      classifyJourneyFeasibility({
        mutationBudget: 'read-only',
        authRequired: true,
        authSatisfied: false,
        httpStatus: 401,
        dataSurfaces: [],
        visibleFields: [],
        hiddenNetworkFields: [],
        challengePoints: [],
      }),
    ).toBe('blocked');
  });

  it('classifies dangerous-write journeys as mutation-risk', () => {
    expect(
      classifyJourneyFeasibility({
        mutationBudget: 'dangerous-write',
        authRequired: true,
        authSatisfied: true,
        httpStatus: 200,
        dataSurfaces: ['dom'],
        visibleFields: ['First Name'],
        hiddenNetworkFields: [],
        challengePoints: [],
      }),
    ).toBe('mutation-risk');
  });

  it('infers load-more pagination patterns', () => {
    expect(
      inferPaginationBehavior({
        hasNextLink: false,
        hasLoadMore: true,
        infiniteScrollTriggered: false,
      }),
    ).toBe('load-more');
  });

  it('builds coverage and defense backlog summaries', () => {
    const observation: OwnedSiteJourneyObservation = {
      targetId: 'niche.prod.guest',
      siteKey: 'niche',
      environment: 'prod',
      role: 'guest',
      accountLabel: 'guest',
      pass: 'public',
      journeyId: 'niche.chances',
      journeyLabel: 'Admissions calculator',
      journeyCategory: 'chances',
      entryUrl: 'https://www.niche.com/colleges/admissions-calculator/',
      finalUrl: 'https://www.niche.com/colleges/admissions-calculator/',
      authRequired: false,
      authSatisfied: true,
      httpStatus: 200,
      pageTitle: 'Niche College Admissions Calculator',
      dataSurfaces: ['dom', 'rest'],
      visibleFields: ['GPA', 'SAT', 'ACT'],
      hiddenNetworkFields: ['applicantStatus', 'major'],
      endpointInventory: [],
      authSession: {
        cookieNames: [],
        localStorageKeys: [],
        sessionStorageKeys: [],
        tokenStorageRisks: [],
      },
      paginationBehavior: 'none',
      exportDownloadSurfaces: [],
      uiRoleGuards: [],
      apiRoleGuards: [],
      challengePoints: [],
      agentFeasibility: 'reliable',
      extractionPreference: 'browser',
      riskNotes: [],
    };

    const coverage = buildCoverageMatrix({
      targets: [
        {
          targetId: 'niche.prod.guest',
          siteKey: 'niche',
          environment: 'prod',
          role: 'guest',
          accountLabel: 'guest',
          journeys: ['niche.chances'],
          missingSession: false,
          unresolvedConfig: false,
        },
      ],
      observations: [observation],
    });

    expect(coverage[0]?.status).toBe('complete');

    const backlog = buildDefenseBacklog([observation]);
    expect(backlog[0]?.title).toBe('Reduce guest-visible structured payloads');
  });

  it('builds a desktop probe plan from journey priority and browser findings', () => {
    const plan = buildDesktopProbePlan({
      journeys: [
        {
          journeyId: 'collegevine.chances',
          siteKey: 'collegevine',
          label: 'Chances',
          category: 'chances',
          entryUrl: 'https://www.collegevine.com/admissions-calculator/',
          requiresAuth: false,
          defaultMutationBudget: 'read-only',
          desktopPriority: 95,
        },
      ],
      observations: [
        {
          targetId: 'collegevine.prod.profiled_consumer',
          siteKey: 'collegevine',
          environment: 'prod',
          role: 'profiled_consumer',
          accountLabel: 'collegevine-prod-profiled',
          pass: 'browser',
          journeyId: 'collegevine.chances',
          journeyLabel: 'Chances',
          journeyCategory: 'chances',
          entryUrl: 'https://www.collegevine.com/admissions-calculator/',
          authRequired: true,
          authSatisfied: true,
          dataSurfaces: ['graphql'],
          visibleFields: ['GPA'],
          hiddenNetworkFields: ['intendedMajor'],
          endpointInventory: [],
          authSession: {
            cookieNames: [],
            localStorageKeys: [],
            sessionStorageKeys: [],
            tokenStorageRisks: [],
          },
          paginationBehavior: 'none',
          exportDownloadSurfaces: [],
          uiRoleGuards: [],
          apiRoleGuards: [],
          challengePoints: [],
          agentFeasibility: 'reliable',
          extractionPreference: 'browser',
          riskNotes: [],
        } as OwnedSiteJourneyObservation,
      ],
      targets: [
        {
          targetId: 'collegevine.prod.profiled_consumer',
          siteKey: 'collegevine',
          environment: 'prod',
          role: 'profiled_consumer',
          journeys: ['collegevine.chances'],
        },
      ],
    });

    expect(plan).toHaveLength(1);
    expect(plan[0]?.browserFindingExcerpt).toContain('reliable');
  });
});
