import type { ApplicationAnalysisRenderFixture } from '../types/application-analysis-render';

export const applicationAnalysisRenderFixture04: ApplicationAnalysisRenderFixture = {
  caseId: '004-no-predictions-en',
  locale: 'en',
  tags: ['deterministic', 'no-predictions', 'render-smoke', 'nightly-live'],
  analysis: {
    status: 'degraded',
    meta: {
      analysisVersion: 'application-analysis-v2',
      state: 'noPredictions',
      dataQuality: 'high',
      targetSchoolCount: 1,
      focusSchoolCount: 1,
      schoolsWithPredictions: 0,
      generatedAt: '2026-08-26T17:10:06.697Z',
      predictionContext: {
        source: 'prediction-engine',
        generatedAt: '2026-08-26T17:10:06.697Z',
        predictionResultIds: [],
        missingSchoolIds: ['stanford'],
        staleSchoolIds: [],
      },
      traceId: 'qa000000-fixture-trace-id',
      degradedReason: 'predictionUnavailable',
    },
    profileSummary: {
      applicantType: 'domestic',
      intendedMajors: ['Biology', 'Biology'],
      testStrategy: 'submit',
      contextFlags: ['testSubmit'],
      constraints: [],
      grade: 'SENIOR',
      educationSystem: 'US',
      nationality: 'United States',
      citizenship: 'US',
      countryOfResidence: 'US',
      highSchoolContext:
        'High School: Regional High School (Tier 3 — Strong School, US_PUBLIC, CA)',
    },
    portfolioSummary: {
      verdict: 'Refresh prediction facts before relying on school-level advice.',
      balance: 'insufficient',
      keyReasons: [],
      riskBoundaries: [],
    },
    overallVerdict: 'Refresh prediction facts before relying on school-level advice.',
    schools: [],
    schoolCards: [],
    topReasons: [],
    topRisks: ['Still unresolved: admission prediction'],
    actionPlan: {
      now: [
        'Refresh prediction facts for the current schools before reviewing school-level guidance.',
      ],
      next90Days: [],
      beforeSubmission: [],
    },
    nextActions: [
      'Refresh prediction facts for the current schools before reviewing school-level guidance.',
    ],
    unknowns: ['admission prediction'],
    evidenceSummary: [
      {
        type: 'UNKNOWN',
        label: 'Unknown',
        detail: 'Still requires confirmation: admission prediction',
      },
    ],
    confidenceSummary: {
      level: 'low',
      summary:
        'The current verdict should be treated as a conservative reference until the key missing inputs are filled in and rerun.',
      signals: ['Data quality: high', 'Focus schools: 0', 'Unknowns: 1'],
    },
    freshnessSummary: {
      status: 'degraded',
      summary:
        'This result was degraded (predictionUnavailable) and only keeps conservative conclusions plus data-completion advice.',
      generatedAt: '2026-08-26T17:10:06.697Z',
    },
  },
  expectedSections: [
    'profileContext',
    'schoolListDiagnosis',
    'focusSchools',
    'actionPlan',
    'unknowns',
  ],
  expectedSchoolOrder: [],
  forbiddenKeywords: [],
  maskSelectors: [
    '[data-testid="analysis-trace-id"]',
    '[data-testid^="analysis-school-updated-at-"]',
    '[data-testid="analysis-freshness-summary"]',
  ],
};
