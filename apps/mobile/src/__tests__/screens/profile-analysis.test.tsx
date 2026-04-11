import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

jest.mock('@/lib/api/client', () => ({
  apiClient: {
    get: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('@/stores', () => ({
  useAuthStore: jest.fn(() => ({
    user: { id: '1', email: 'test@example.com', role: 'USER' },
    isAuthenticated: true,
  })),
  useThemeStore: jest.fn(() => ({
    colorScheme: 'light',
  })),
}));

import { apiClient } from '@/lib/api/client';
import ProfileAnalysisScreen from '@/screens/profile/ProfileAnalysisScreen';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('ProfileAnalysisScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders school-level insight, policy badges, and action plan', async () => {
    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/profiles/me/ai-analysis')) {
        return Promise.resolve({
          status: 'fresh',
          overallScore: 88,
          summary: 'Strong candidacy with one visible leadership gap.',
          sections: {
            academic: { status: 'green', score: 8, feedback: 'Academic baseline is strong.' },
            testScores: { status: 'yellow', score: 6, feedback: 'Testing is usable.' },
            activities: {
              status: 'yellow',
              score: 6,
              feedback: 'Activities need one stronger flagship.',
            },
            awards: { status: 'green', score: 8, feedback: 'Awards provide validation.' },
          },
          tier: 'top30',
          suggestions: {
            majors: ['Computer Science'],
            competitions: ['USACO'],
            activities: ['Research'],
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
            generatedAt: '2026-04-10T12:00:00.000Z',
            experimentalVersions: [
              { capability: 'RECOURSE', version: 'recourse-v1', status: 'ACTIVE' },
              { capability: 'FAIRNESS', version: 'fairness-v1', status: 'ACTIVE' },
            ],
          },
          profileContext: {
            applicantType: 'international',
            contextFlags: ['needAid', 'testSubmit'],
            testStrategy: 'submit',
            highSchoolContext: 'High School: Test High School',
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
                updatedAt: '2026-04-10T12:00:00.000Z',
                confidenceReason: 'Balanced historical and profile coverage',
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
            activities: ['Research'],
            summerPrograms: ['MITES'],
            timeline: ['Lock one flagship theme before summer.'],
          },
          fairnessDisclosure: {
            status: 'limited',
            notes: [
              'Fairness disclosure is still limited because subgroup coverage is incomplete.',
            ],
            appliesTo: ['International applicants', 'Aid-seeking applicants'],
          },
        });
      }
      return Promise.resolve({});
    });

    const { getByText } = renderWithProviders(<ProfileAnalysisScreen />);

    await waitFor(() => {
      expect(getByText('Example University')).toBeTruthy();
      expect(getByText('applicationAnalysis.policy.testing.OPTIONAL')).toBeTruthy();
      expect(getByText('applicationAnalysis.policy.intlAid.NEED_AWARE')).toBeTruthy();
      expect(getByText('Finalize the ED story.')).toBeTruthy();
      expect(getByText('MITES')).toBeTruthy();
      expect(getByText('applicationAnalysis.schoolCards.recourse')).toBeTruthy();
      expect(getByText('applicationAnalysis.schoolCards.uncertainty')).toBeTruthy();
      expect(getByText('applicationAnalysis.fairness.title')).toBeTruthy();
    });
  });

  it('renders weak-state copy when school insights are unavailable', async () => {
    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/profiles/me/ai-analysis')) {
        return Promise.resolve({
          status: 'degraded',
          overallScore: 60,
          summary: 'School-level analysis is temporarily unavailable.',
          sections: {
            academic: { status: 'green', score: 8, feedback: 'Academic baseline is strong.' },
            testScores: { status: 'yellow', score: 6, feedback: 'Testing is usable.' },
            activities: {
              status: 'yellow',
              score: 6,
              feedback: 'Activities need one stronger flagship.',
            },
            awards: { status: 'green', score: 8, feedback: 'Awards provide validation.' },
          },
          tier: 'top100',
          suggestions: {
            majors: [],
            competitions: [],
            activities: [],
            summerPrograms: [],
            timeline: [],
          },
          meta: {
            analysisVersion: 'application-analysis-v1',
            state: 'analysisError',
            dataQuality: 'low',
            targetSchoolCount: 2,
            focusSchoolCount: 0,
            schoolsWithPredictions: 0,
            generatedAt: '2026-04-10T12:00:00.000Z',
          },
          profileContext: {
            applicantType: 'international',
            contextFlags: [],
            testStrategy: 'unknown',
          },
          portfolioAnalysis: {
            strategyStatus: 'analysisError',
            balance: 'insufficient',
            verdict: 'School-level analysis is temporarily unavailable.',
            reasons: [],
            riskBoundaries: [],
            missingPredictionSchoolNames: [],
            missingRoundSchoolNames: [],
          },
          targetSchoolInsights: [],
          actionPlan: { now: [], next90Days: [], beforeSubmission: [] },
          recommendedPrograms: {
            majors: [],
            competitions: [],
            activities: [],
            summerPrograms: [],
            timeline: [],
          },
        });
      }
      return Promise.resolve({});
    });

    const { getAllByText } = renderWithProviders(<ProfileAnalysisScreen />);

    await waitFor(() => {
      expect(getAllByText('applicationAnalysis.states.analysisError.label').length).toBeGreaterThan(
        0
      );
      expect(
        getAllByText('applicationAnalysis.states.analysisError.description').length
      ).toBeGreaterThan(0);
    });
  });
});
