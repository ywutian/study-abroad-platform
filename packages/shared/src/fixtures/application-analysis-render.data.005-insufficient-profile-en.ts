import type { ApplicationAnalysisRenderFixture } from '../types/application-analysis-render';

export const applicationAnalysisRenderFixture05: ApplicationAnalysisRenderFixture = {
  caseId: '005-insufficient-profile-en',
  locale: 'en',
  tags: ['deterministic', 'insufficient-profile', 'render-smoke'],
  analysis: {
    status: 'degraded',
    meta: {
      analysisVersion: 'application-analysis-v2',
      state: 'insufficientProfileData',
      dataQuality: 'insufficient',
      targetSchoolCount: 1,
      focusSchoolCount: 1,
      schoolsWithPredictions: 0,
      generatedAt: '2026-08-26T17:10:06.697Z',
      predictionContext: {
        source: 'prediction-engine',
        generatedAt: '2026-08-26T17:10:06.697Z',
        predictionResultIds: [],
        missingSchoolIds: ['mit'],
        staleSchoolIds: [],
      },
      traceId: 'qa000000-fixture-trace-id',
      degradedReason: 'insufficientProfileData',
    },
    profileSummary: {
      applicantType: 'domestic',
      intendedMajors: ['Undecided', 'Undecided'],
      testStrategy: 'testOptional',
      contextFlags: ['testOptional'],
      constraints: ['Currently has no SAT/ACT score.'],
      grade: 'JUNIOR',
      educationSystem: 'US',
      nationality: 'United States',
      citizenship: 'US',
      countryOfResidence: 'US',
      highSchoolContext:
        'High School: Regional High School (Tier 3 — Strong School, US_PUBLIC, CA)',
    },
    portfolioSummary: {
      verdict: 'Complete the core profile before relying on school-level analysis.',
      balance: 'insufficient',
      keyReasons: [],
      riskBoundaries: [],
    },
    overallVerdict: 'Complete the core profile before relying on school-level analysis.',
    schools: [],
    schoolCards: [],
    topReasons: [],
    topRisks: ['Still unresolved: core profile information'],
    actionPlan: {
      now: ['Complete the core profile and target-school list first.'],
      next90Days: [],
      beforeSubmission: [],
    },
    nextActions: ['Complete the core profile and target-school list first.'],
    unknowns: ['core profile information'],
    evidenceSummary: [
      {
        type: 'UNKNOWN',
        label: 'Unknown',
        detail: 'Still requires confirmation: core profile information',
      },
    ],
    confidenceSummary: {
      level: 'low',
      summary:
        'The current verdict should be treated as a conservative reference until the key missing inputs are filled in and rerun.',
      signals: ['Data quality: insufficient', 'Focus schools: 0', 'Unknowns: 1'],
    },
    freshnessSummary: {
      status: 'degraded',
      summary:
        'This result was degraded (insufficientProfileData) and only keeps conservative conclusions plus data-completion advice.',
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
