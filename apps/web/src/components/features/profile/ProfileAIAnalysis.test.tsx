import type React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import type { AIAnalysisResult } from '@study-abroad/shared';
import { ProfileAIAnalysis } from './ProfileAIAnalysis';

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
    overallScore: 'Overall score',
    focusSchools: 'Focus schools',
    profileContext: 'Profile context',
    schoolListDiagnosis: 'School list diagnosis',
    foundationReview: 'Foundation review',
    riskBoundaries: 'Risk boundaries',
    missingPredictions: 'Missing predictions',
    missingRounds: 'Missing rounds',
    highlights: 'Highlights',
    improvements: 'Improvements',
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
    legacyTier: {
      top10: 'Top 10 legacy tier',
      top30: 'Top 30 legacy tier',
      top50: 'Top 50 legacy tier',
      top100: 'Top 100 legacy tier',
      other: 'Foundational tier',
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
    actions: {
      showFull: 'Show full analysis',
      hideFull: 'Hide details',
    },
    sections: {
      academic: 'Academic foundation',
      testScores: 'Testing position',
      activities: 'Activities & leadership',
      awards: 'Awards & validation',
    },
    sectionStatus: {
      green: 'Clear strength',
      yellow: 'Workable but exposed',
      red: 'Core gap',
    },
    schoolTier: {
      REACH: 'Reach',
      TARGET: 'Target',
      SAFETY: 'Safety',
    },
    schoolCards: {
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
      now: 'Now',
      next90Days: 'Next 90 days',
      beforeSubmission: 'Before submission',
    },
    recommendations: {
      title: 'Supplemental recommendations',
      majors: 'Major directions',
      competitions: 'Competitions',
      activities: 'Projects & activities',
      summerPrograms: 'Summer programs',
      timeline: 'Planning notes',
    },
    fairness: {
      title: 'Fairness disclosure',
      notes: 'Disclosure notes',
      appliesTo: 'Applies to',
      status: {
        clear: 'Clear',
        limited: 'Limited',
        blocked: 'Blocked',
      },
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
  overallScore: 88,
  tier: 'top30',
  summary: 'Strong candidacy with one visible leadership gap.',
  sections: {
    academic: { status: 'green', score: 8, feedback: 'Academic baseline is strong.' },
    testScores: { status: 'yellow', score: 6, feedback: 'Testing is usable but not decisive.' },
    activities: { status: 'yellow', score: 6, feedback: 'Activities need one stronger flagship.' },
    awards: { status: 'green', score: 8, feedback: 'Awards provide external validation.' },
  },
  suggestions: {
    majors: ['Computer Science'],
    competitions: ['USACO'],
    activities: ['Independent research project'],
    summerPrograms: ['MITES'],
    timeline: ['Lock one flagship theme before summer.'],
  },
  meta: {
    analysisVersion: 'application-analysis-v1',
    state: 'ready',
    dataQuality: 'high',
    targetSchoolCount: 3,
    focusSchoolCount: 1,
    schoolsWithPredictions: 1,
    generatedAt: '2026-04-09T12:00:00.000Z',
    experimentalVersions: [
      { capability: 'RECOURSE', version: 'recourse-v1', status: 'ACTIVE' },
      { capability: 'UNCERTAINTY', version: 'uncertainty-v1', status: 'CANARY' },
      { capability: 'FAIRNESS', version: 'fairness-v1', status: 'ACTIVE' },
    ],
  },
  profileContext: {
    applicantType: 'international',
    contextFlags: ['needAid', 'testSubmit'],
    testStrategy: 'submit',
    highSchoolContext: 'High School: Test High School (Tier 4)',
  },
  portfolioAnalysis: {
    strategyStatus: 'ready',
    balance: 'balanced',
    verdict: 'The current list is ambitious but still defensible.',
    reasons: ['One focus school already has usable prediction coverage.'],
    riskBoundaries: ['International aid need remains the hardest structural constraint.'],
    missingPredictionSchoolNames: [],
    missingRoundSchoolNames: [],
  },
  targetSchoolInsights: [
    {
      schoolId: 'school-1',
      schoolName: 'Example University',
      tier: 'REACH',
      round: 'ED',
      policyContext: {
        testingPolicy: 'OPTIONAL',
        intlAidPolicy: 'NEED_AWARE',
        roundContext: 'ED',
        policySourceQuality: 'DERIVED',
      },
      predictionSnapshot: {
        probability: 0.28,
        confidence: 'medium',
        roundContext: 'ED',
        updatedAt: '2026-04-09T12:00:00.000Z',
      },
      whyThisIsHard: ['This remains a reach school even with a strong transcript.'],
      compensatingStrengths: ['Academic baseline clears the first screen.'],
      topGaps: ['Leadership signal still needs sharper differentiation.'],
      nextActions: ['Turn one flagship activity into a measurable story.'],
      historicalSignals: ['Historical sample is thin, so the case signal is limited.'],
      hardStopRisks: ['International aid need narrows the margin.'],
      recourseGuidance: {
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
      strategyUncertainty: {
        probabilityLow: 0.2,
        probabilityHigh: 0.36,
        intervalLabel: 'balanced',
        reasons: ['Historical coverage is thin for this school.'],
      },
    },
  ],
  actionPlan: {
    now: ['Finalize the ED story.'],
    next90Days: ['Build one stronger proof point.'],
    beforeSubmission: ['Re-check the prediction after essay updates.'],
  },
  recommendedPrograms: {
    majors: ['Computer Science'],
    competitions: ['USACO'],
    activities: ['Independent research project'],
    summerPrograms: ['MITES'],
    timeline: ['Lock one flagship theme before summer.'],
  },
  fairnessDisclosure: {
    status: 'limited',
    notes: ['Fairness disclosure is still limited because subgroup coverage is incomplete.'],
    appliesTo: ['International applicants', 'Aid-seeking applicants'],
  },
};

describe('ProfileAIAnalysis', () => {
  it('renders school-level insights and summer programs from the canonical contract', () => {
    renderAnalysis(baseAnalysis);

    expect(screen.getByText('Example University')).toBeInTheDocument();
    expect(
      screen.getByText('Turn one flagship activity into a measurable story.')
    ).toBeInTheDocument();
    expect(screen.getByText('MITES')).toBeInTheDocument();
    expect(
      screen.getByText('The current list is ambitious but still defensible.')
    ).toBeInTheDocument();
    expect(screen.getByText('Test optional')).toBeInTheDocument();
    expect(screen.getByText('Intl aid need-aware')).toBeInTheDocument();
    expect(screen.getByText('Recourse guidance')).toBeInTheDocument();
    expect(screen.getByText('Strategy uncertainty')).toBeInTheDocument();
    expect(screen.getByText('Fairness disclosure')).toBeInTheDocument();
  });

  it('shows an explicit weak state when target schools are missing', () => {
    renderAnalysis({
      ...baseAnalysis,
      meta: {
        ...baseAnalysis.meta!,
        state: 'noTargetSchools',
        targetSchoolCount: 0,
        focusSchoolCount: 0,
        schoolsWithPredictions: 0,
      },
      portfolioAnalysis: {
        ...baseAnalysis.portfolioAnalysis!,
        strategyStatus: 'noTargetSchools',
        balance: 'insufficient',
        verdict: 'Target schools are still missing.',
      },
      targetSchoolInsights: [],
    });

    expect(screen.getAllByText('Needs target schools').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Add target schools first.').length).toBeGreaterThan(0);
  });

  it('shows the noPredictions weak state without school cards', () => {
    renderAnalysis({
      ...baseAnalysis,
      meta: {
        ...baseAnalysis.meta!,
        state: 'noPredictions',
        schoolsWithPredictions: 0,
      },
      portfolioAnalysis: {
        ...baseAnalysis.portfolioAnalysis!,
        strategyStatus: 'noPredictions',
        verdict: 'Predictions are still missing for the focus list.',
      },
      targetSchoolInsights: [],
    });

    expect(screen.getAllByText('Needs predictions').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Add predictions first.').length).toBeGreaterThan(0);
    expect(screen.queryByText('Example University')).not.toBeInTheDocument();
  });

  it('shows the insufficientProfileData weak state', () => {
    renderAnalysis({
      ...baseAnalysis,
      meta: {
        ...baseAnalysis.meta!,
        state: 'insufficientProfileData',
      },
      portfolioAnalysis: {
        ...baseAnalysis.portfolioAnalysis!,
        strategyStatus: 'insufficientProfileData',
        verdict: 'The current profile is too thin for school-level analysis.',
      },
      targetSchoolInsights: [],
    });

    expect(screen.getAllByText('Needs core evidence').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Complete the core profile.').length).toBeGreaterThan(0);
  });

  it('shows degraded status and analysisError weak state', () => {
    renderAnalysis({
      ...baseAnalysis,
      status: 'degraded',
      meta: {
        ...baseAnalysis.meta!,
        state: 'analysisError',
      },
      portfolioAnalysis: {
        ...baseAnalysis.portfolioAnalysis!,
        strategyStatus: 'analysisError',
        verdict: 'School-level analysis is temporarily unavailable.',
      },
      targetSchoolInsights: [],
    });

    expect(screen.getByText('Degraded')).toBeInTheDocument();
    expect(screen.getAllByText('Analysis unavailable').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Try again later.').length).toBeGreaterThan(0);
  });

  it('shows cached freshness badge', () => {
    renderAnalysis({
      ...baseAnalysis,
      status: 'cached',
    });

    expect(screen.getByText('Cached')).toBeInTheDocument();
  });

  it('keeps compact mode summary-first until expanded', () => {
    renderAnalysis(baseAnalysis, { compact: true });

    expect(screen.getByText('Show full analysis')).toBeInTheDocument();
    expect(screen.queryByText('Example University')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Show full analysis'));

    expect(screen.getByText('Hide details')).toBeInTheDocument();
    expect(screen.getByText('Example University')).toBeInTheDocument();
  });

  it('shows empty recommendation and action slots gracefully in weak data states', () => {
    renderAnalysis({
      ...baseAnalysis,
      recommendedPrograms: {
        majors: [],
        competitions: [],
        activities: [],
        summerPrograms: [],
        timeline: [],
      },
      actionPlan: {
        now: [],
        next90Days: [],
        beforeSubmission: [],
      },
    });

    expect(screen.getAllByText('No items yet').length).toBeGreaterThan(0);
  });
});
