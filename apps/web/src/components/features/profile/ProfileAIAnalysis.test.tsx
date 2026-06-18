import type React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AIAnalysisResult } from '@study-abroad/shared';
import { ProfileAIAnalysis } from './ProfileAIAnalysis';
import { apiClient } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
  STALE_TIME: {
    MODERATE: 5 * 60 * 1000,
  },
}));

const messages = {
  applicationAnalysis: {
    title: 'Application Analysis',
    subtitle: 'School-aware admissions strategy',
    loading: {
      title: 'Loading',
      description: 'Loading description',
    },
    empty: {
      title: 'Empty',
      description: 'Empty description',
    },
    emptyList: 'No items yet',
    trace: 'Trace',
    unknowns: 'Unknowns',
    focusSchools: 'Focus schools',
    profileContext: 'Profile context',
    schoolListDiagnosis: 'School list diagnosis',
    riskBoundaries: 'Risk boundaries',
    topReasons: 'Top reasons',
    topRisks: 'Top risks',
    evidenceSummary: 'Evidence summary',
    confidenceSummary: 'Confidence summary',
    freshnessSummary: 'Freshness summary',
    highlights: 'Highlights',
    freshness: {
      fresh: 'Fresh',
      cached: 'Cached',
      degraded: 'Degraded',
    },
    dataQuality: {
      high: 'High evidence quality',
      medium: 'Moderate evidence quality',
      low: 'Limited evidence quality',
      insufficient: 'Insufficient evidence',
    },
    states: {
      ready: {
        label: 'School-ready',
        description: 'Enough evidence for school-level guidance.',
      },
      noTargetSchools: {
        label: 'Needs target schools',
        description: 'Add target schools first.',
      },
      noPredictions: {
        label: 'Needs predictions',
        description: 'Add predictions first.',
      },
      insufficientProfileData: {
        label: 'Needs core evidence',
        description: 'Complete the core profile.',
      },
      analysisError: {
        label: 'Analysis unavailable',
        description: 'Try again later.',
      },
    },
    portfolioBalance: {
      balanced: 'Balanced',
      reachHeavy: 'Reach-heavy',
      safetyHeavy: 'Safety-heavy',
      undermatch: 'Undermatch risk',
      insufficient: 'Not enough schools',
    },
    applicantType: {
      title: 'Applicant type',
      domestic: 'Domestic applicant',
      international: 'International applicant',
      unknown: 'Unknown applicant type',
    },
    contextFlags: {
      needAid: 'Needs financial aid',
      firstGeneration: 'First-generation',
      legacy: 'Legacy context present',
      gapYear: 'Gap year',
      testSubmit: 'Test-submit path',
      testOptional: 'Test-optional path',
    },
    testStrategy: {
      title: 'Testing strategy',
      submit: 'Test-submit',
      testOptional: 'Test-optional',
      unknown: 'Unknown',
    },
    confidence: {
      low: 'Low',
      medium: 'Medium',
      high: 'High',
    },
    schoolTier: {
      REACH: 'Reach',
      TARGET: 'Target',
      SAFETY: 'Safety',
    },
    schoolCards: {
      sourceBadge: 'From Chance Engine',
      addToTimeline: 'Add to timeline',
      addingToTimeline: 'Adding...',
      addedToTimeline: 'Added to timeline',
      timelineError: 'Could not add this action',
      reportOutcome: 'Report outcome',
      probability: 'Admission probability',
      probabilityUnavailable: 'Unavailable',
      confidence: 'Confidence',
      updated: 'Updated',
      whyHard: 'Why this is hard',
      strengths: 'Compensating strengths',
      gaps: 'Top gaps',
      nextActions: 'Next actions',
      historical: 'Historical signals',
      hardStops: 'Hard-stop risks',
      recourse: 'Recourse guidance',
      uncertainty: 'Strategy uncertainty',
      uncertaintyRange: 'Strategy range',
    },
    policy: {
      testing: {
        REQUIRED: 'Test required',
        OPTIONAL: 'Test optional',
        BLIND: 'Test blind',
        UNKNOWN: 'Testing policy unknown',
      },
      intlAid: {
        NEED_BLIND: 'Intl aid need-blind',
        NEED_AWARE: 'Intl aid need-aware',
        UNKNOWN: 'Intl aid policy unknown',
      },
    },
    actionPlan: {
      title: 'Action plan',
      addTopAction: 'Add top action to timeline',
      timelineEventTitle: 'Strategy Advisor actions',
      timelineEventDescription: 'Actions added from Strategy Advisor.',
      now: 'Now',
      next90Days: 'Next 90 days',
      beforeSubmission: 'Before submission',
    },
    error: {
      title: 'Error',
      description: 'Error description',
      retry: 'Retry',
    },
    actions: {
      refresh: 'Refresh',
    },
    feedback: {
      title: 'Was this structured analysis helpful?',
      helpful: 'Helpful',
      notHelpful: 'Not helpful',
      submitted: 'Feedback recorded. Thanks.',
    },
  },
};

function renderAnalysis(
  analysis: AIAnalysisResult,
  props?: Partial<React.ComponentProps<typeof ProfileAIAnalysis>>
) {
  const queryClient = new QueryClient();

  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <QueryClientProvider client={queryClient}>
        <ProfileAIAnalysis analysis={analysis} {...props} />
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

const baseAnalysis: AIAnalysisResult = {
  status: 'fresh',
  meta: {
    analysisVersion: 'application-analysis-v2',
    state: 'ready',
    dataQuality: 'high',
    targetSchoolCount: 3,
    focusSchoolCount: 1,
    schoolsWithPredictions: 1,
    generatedAt: '2026-04-09T12:00:00.000Z',
    traceId: 'trace-12345678',
  },
  profileSummary: {
    applicantType: 'international',
    intendedMajors: ['Computer Science'],
    testStrategy: 'submit',
    contextFlags: ['needAid', 'testSubmit'],
    constraints: ['Applying as an international student.'],
    highSchoolContext: 'High School: Test High School',
  },
  portfolioSummary: {
    verdict: 'The current list is ambitious but still defensible.',
    balance: 'balanced',
    keyReasons: ['One focus school already has usable prediction coverage.'],
    riskBoundaries: ['International aid need remains the hardest structural constraint.'],
  },
  overallVerdict: 'The current list is ambitious but still defensible.',
  schools: [
    {
      schoolId: 'school-1',
      schoolName: 'Example University',
      tier: 'REACH',
      round: 'ED',
      prediction: {
        probability: 0.28,
        confidence: 'medium',
        updatedAt: '2026-04-10T12:00:00.000Z',
        confidenceReason: 'Balanced historical and profile coverage',
      },
      policyCard: {
        testingPolicy: 'OPTIONAL',
        intlAidPolicy: 'NEED_AWARE',
        roundContext: 'ED',
        policySourceQuality: 'REVIEWED',
        standardDeadline: 'November 1',
        evidenceIds: ['evidence-1'],
        sources: [
          {
            evidenceId: 'evidence-1',
            dimension: 'TESTING',
            label: 'Testing policy',
            value: 'OPTIONAL',
            sourceName: 'Official admissions',
          },
        ],
        unknowns: [],
      },
      assessment: {
        summary: 'This remains a high-variance reach school.',
        whyThisIsHard: ['This remains a reach school even with a strong transcript.'],
        compensatingStrengths: ['Academic baseline clears the first screen.'],
        topGaps: ['Leadership signal still needs sharper differentiation.'],
        nextActions: ['Turn one flagship activity into a measurable story.'],
        historicalSignals: ['Historical sample is thin, so the case signal is limited.'],
        hardStopRisks: ['International aid need narrows the margin.'],
      },
      recourse: {
        goal: 'Improve actionable readiness for Example University',
        estimatedDirection: 'upside',
        constraints: ['Do not fabricate extracurricular depth.'],
        whyNotGuaranteed: 'This is strategy guidance, not a guarantee.',
        recommendedChanges: [
          {
            action: 'Lock the application round',
            rationale: 'Round context changes the strategic interpretation.',
            effort: 'low',
            timeHorizon: 'now',
          },
        ],
      },
      uncertainty: {
        probabilityLow: 0.2,
        probabilityHigh: 0.36,
        intervalLabel: 'balanced',
        reasons: ['Historical coverage is thin for this school.'],
      },
      evidenceIds: ['evidence-1'],
      unknowns: [],
    },
  ],
  schoolCards: [],
  topReasons: ['One focus school already has usable prediction coverage.'],
  topRisks: ['International aid need remains the hardest structural constraint.'],
  actionPlan: {
    now: ['Finalize the ED story.'],
    next90Days: ['Build one stronger proof point.'],
    beforeSubmission: ['Re-check the prediction after essay updates.'],
  },
  nextActions: ['Finalize the ED story.'],
  unknowns: [],
  evidenceSummary: [
    {
      type: 'PREDICTION_FACT',
      label: 'Example University prediction fact',
      detail: 'ED admit probability is about 28% with medium confidence.',
      schoolId: 'school-1',
      schoolName: 'Example University',
    },
  ],
  confidenceSummary: {
    level: 'medium',
    summary:
      'The current verdict is directionally usable, but the remaining unknowns should still be closed.',
    signals: ['Data quality: high'],
  },
  freshnessSummary: {
    status: 'fresh',
    summary: 'This is the latest fully generated analysis from 2026-04-09.',
    generatedAt: '2026-04-09T12:00:00.000Z',
  },
};

describe('ProfileAIAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the new v2 analysis contract', () => {
    renderAnalysis(baseAnalysis);

    expect(
      screen.getByText('The current list is ambitious but still defensible.')
    ).toBeInTheDocument();
    expect(screen.getByText('Example University')).toBeInTheDocument();
    expect(screen.getByText('Test optional')).toBeInTheDocument();
    expect(screen.getByText('Intl aid need-aware')).toBeInTheDocument();
    expect(screen.getByText('Finalize the ED story.')).toBeInTheDocument();
    expect(screen.getByText('Applying as an international student.')).toBeInTheDocument();
  });

  it('renders unknowns when the analysis is degraded', () => {
    renderAnalysis({
      ...baseAnalysis,
      status: 'degraded',
      meta: {
        ...baseAnalysis.meta,
        state: 'analysisError',
        degradedReason: 'schoolAnalysisFailed',
      },
      portfolioSummary: {
        ...baseAnalysis.portfolioSummary,
        verdict: 'School-level analysis is temporarily unavailable.',
      },
      overallVerdict: 'School-level analysis is temporarily unavailable.',
      schools: [],
      // The backend humanizes raw unknown codes at the serve boundary
      // (humanizeUnknownLabel), so the wire contract carries readable labels —
      // the component renders them verbatim. Raw camelCase like `testingPolicy`
      // must never reach the user.
      unknowns: ['standardized-test policy'],
    });

    expect(
      screen.getByText('School-level analysis is temporarily unavailable.')
    ).toBeInTheDocument();
    expect(screen.getByText('standardized-test policy')).toBeInTheDocument();
    expect(screen.queryByText('testingPolicy')).not.toBeInTheDocument();
  });

  it('does not fetch analysis when autoFetch is disabled', () => {
    const queryClient = new QueryClient();

    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <QueryClientProvider client={queryClient}>
          <ProfileAIAnalysis autoFetch={false} />
        </QueryClientProvider>
      </NextIntlClientProvider>
    );

    expect(screen.getByText('Empty')).toBeInTheDocument();
    expect(apiClient.get).not.toHaveBeenCalled();
  });
});
