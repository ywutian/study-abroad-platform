import type { ApplicationAnalysisRenderFixture } from '../types/application-analysis-render';

export const applicationAnalysisRenderFixture01: ApplicationAnalysisRenderFixture = {
  caseId: '001-uc-berkeley-blind-en',
  locale: 'en',
  tags: ['deterministic', 'uc-test-blind', 'render-smoke', 'nightly-live'],
  analysis: {
    status: 'fresh',
    meta: {
      analysisVersion: 'application-analysis-v2',
      state: 'ready',
      dataQuality: 'high',
      targetSchoolCount: 1,
      focusSchoolCount: 1,
      schoolsWithPredictions: 1,
      generatedAt: '2026-08-26T17:10:06.688Z',
      predictionContext: {
        source: 'prediction-engine',
        generatedAt: '2026-08-26T17:10:06.688Z',
        predictionResultIds: [],
        missingSchoolIds: [],
        staleSchoolIds: ['ucb'],
      },
      traceId: 'qa000000-fixture-trace-id',
      debugEnabled: true,
    },
    profileSummary: {
      applicantType: 'international',
      intendedMajors: ['Computer Science', 'Computer Science'],
      testStrategy: 'testOptional',
      contextFlags: ['needAid', 'testOptional'],
      constraints: [
        'Applying as an international student.',
        'Needs financial aid support.',
        'Currently has no SAT/ACT score.',
      ],
      grade: 'JUNIOR',
      educationSystem: 'AP',
      nationality: 'China',
      citizenship: 'China',
      countryOfResidence: 'China',
      highSchoolContext:
        'High School: Global Academy (Tier 4 — Well-Known Prestigious School, China International, China)',
    },
    portfolioSummary: {
      verdict: 'There are still too few schools to judge the list shape reliably.',
      balance: 'insufficient',
      keyReasons: ['The focus schools now have usable predictions and policy cards.'],
      riskBoundaries: [],
    },
    schools: [
      {
        schoolId: 'ucb',
        schoolName: 'University of California, Berkeley',
        tier: 'REACH',
        round: 'UC',
        prediction: {
          probability: 0.27,
          probabilityLow: 0.22,
          probabilityHigh: 0.33,
          tier: 'reach',
          confidence: 'medium',
          updatedAt: '2026-04-09T12:20:00.000Z',
          roundContext: 'UC',
          confidenceReason: 'Governance gold case prediction baseline.',
        },
        policyCard: {
          testingPolicy: 'BLIND',
          intlAidPolicy: 'NEED_AWARE',
          roundContext: 'UC',
          policySourceQuality: 'DERIVED',
          evidenceIds: [],
          sources: [],
          unknowns: [],
        },
        assessment: {
          summary: 'Governance gold case prediction baseline.',
          whyThisIsHard: [
            'University of California, Berkeley remains a high-variance school for this profile.',
          ],
          compensatingStrengths: [
            'The GPA baseline is strong.',
            'There is external validation from awards or recognition.',
            'There is already a narratable activity spine.',
          ],
          topGaps: ['Keep the UC plan aligned with University of California, Berkeley.'],
          nextActions: ['Keep the UC plan aligned with University of California, Berkeley.'],
          historicalSignals: [],
          hardStopRisks: [
            'International aid need materially tightens the admit window at this school.',
          ],
        },
        evidenceIds: [],
        unknowns: [],
      },
    ],
    actionPlan: {
      now: [
        'Keep the UC plan aligned with University of California, Berkeley.',
        'Decide quickly whether you are pursuing a test-submit or test-optional route.',
      ],
      next90Days: [
        'Create 1-2 verifiable wins that directly address the biggest school-level gaps.',
      ],
      beforeSubmission: [
        'Before submission, re-check each focus school’s probability, round, and policy card.',
      ],
    },
    unknowns: [],
    debug: {
      stepIds: [
        'virtual:evidence_collector:7b1d1b39-c6b2-4b8f-bb5b-4ba25d262d7d',
        'virtual:policy_normalizer:454a497d-29c2-4117-945f-30ddbfc86930',
        'virtual:school_analyst:ucb:8c67bfea-d552-4ec5-83ba-3d4ef63ebb95',
        'virtual:portfolio_synthesizer:af3ccf4a-2a4c-44bb-9d6e-96d6157b2ceb',
      ],
      stepTimingsMs: {
        evidence_collector: 0,
        policy_normalizer: 1,
        'school_analyst:ucb': 0,
        portfolio_synthesizer: 0,
      },
      validationErrors: [],
      promptHashes: {
        'school:ucb': '821a7ed6cc5f6041cb278783cbc91d5ad02a9b6410da37240438a68f49961746',
        portfolio_synthesizer: 'd65a1b2bf7cff45100091f093dc075c06530bd8cfb35e29921c8accf3def8d0e',
      },
    },
    overallVerdict: 'There are still too few schools to judge the list shape reliably.',
    schoolCards: [
      {
        schoolId: 'ucb',
        schoolName: 'University of California, Berkeley',
        tier: 'REACH',
        round: 'UC',
        prediction: {
          probability: 0.27,
          probabilityLow: 0.22,
          probabilityHigh: 0.33,
          tier: 'reach',
          confidence: 'medium',
          updatedAt: '2026-04-09T12:20:00.000Z',
          roundContext: 'UC',
          confidenceReason: 'Governance gold case prediction baseline.',
        },
        policyCard: {
          testingPolicy: 'BLIND',
          intlAidPolicy: 'NEED_AWARE',
          roundContext: 'UC',
          policySourceQuality: 'DERIVED',
          evidenceIds: [],
          sources: [],
          unknowns: [],
        },
        assessment: {
          summary: 'Governance gold case prediction baseline.',
          whyThisIsHard: [
            'University of California, Berkeley remains a high-variance school for this profile.',
          ],
          compensatingStrengths: [
            'The GPA baseline is strong.',
            'There is external validation from awards or recognition.',
            'There is already a narratable activity spine.',
          ],
          topGaps: ['Keep the UC plan aligned with University of California, Berkeley.'],
          nextActions: ['Keep the UC plan aligned with University of California, Berkeley.'],
          historicalSignals: [],
          hardStopRisks: [
            'International aid need materially tightens the admit window at this school.',
          ],
        },
        evidenceIds: [],
        unknowns: [],
      },
    ],
    topReasons: [
      'The focus schools now have usable predictions and policy cards.',
      'The GPA baseline is strong.',
      'There is external validation from awards or recognition.',
      'There is already a narratable activity spine.',
    ],
    topRisks: ['International aid need materially tightens the admit window at this school.'],
    nextActions: [
      'Keep the UC plan aligned with University of California, Berkeley.',
      'Decide quickly whether you are pursuing a test-submit or test-optional route.',
    ],
    evidenceSummary: [
      {
        type: 'PREDICTION_FACT',
        label: 'University of California, Berkeley prediction fact',
        detail: 'UC admit probability is about 27% with medium confidence.',
        schoolId: 'ucb',
        schoolName: 'University of California, Berkeley',
      },
      {
        type: 'DERIVED_JUDGMENT',
        label: 'University of California, Berkeley derived judgment',
        detail: 'Governance gold case prediction baseline.',
        schoolId: 'ucb',
        schoolName: 'University of California, Berkeley',
      },
    ],
    confidenceSummary: {
      level: 'high',
      summary:
        'The current verdict is backed strongly enough to be used directly as a counselor copilot card.',
      signals: [
        'Data quality: high',
        'Focus schools: 1',
        'No additional unknowns are currently blocking the analysis.',
      ],
    },
    freshnessSummary: {
      status: 'fresh',
      summary: 'This is the latest fully generated analysis from 2026-08-26.',
      generatedAt: '2026-08-26T17:10:06.688Z',
    },
  },
  expectedSections: ['profileContext', 'schoolListDiagnosis', 'focusSchools', 'actionPlan'],
  expectedSchoolOrder: ['University of California, Berkeley'],
  forbiddenKeywords: ['SAT', 'ACT'],
  maskSelectors: [
    '[data-testid="analysis-trace-id"]',
    '[data-testid^="analysis-school-updated-at-"]',
    '[data-testid="analysis-freshness-summary"]',
  ],
};
