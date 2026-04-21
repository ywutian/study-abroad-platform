import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

// Mock API client
jest.mock('@/lib/api/client', () => ({
  apiClient: {
    get: jest.fn().mockResolvedValue({}),
    post: jest.fn().mockResolvedValue({}),
  },
}));

// Mock stores
jest.mock('@/stores', () => ({
  useAuthStore: jest.fn(() => ({
    user: { id: '1', email: 'test@example.com', role: 'USER' },
    isAuthenticated: true,
  })),
  useThemeStore: jest.fn(() => ({
    colorScheme: 'light',
  })),
}));

// Mock Toast
jest.mock('@/components/ui/Toast', () => ({
  useToast: () => ({
    show: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  }),
}));

// Mock Haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/stores';
import { router } from 'expo-router';
import PredictionScreen, { mapDashboardToPredictions } from '@/screens/prediction/PredictionScreen';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('PredictionScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.get as jest.Mock).mockResolvedValue({});
  });

  it('renders without crashing', () => {
    const { toJSON } = renderWithProviders(<PredictionScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows login required state when not authenticated', () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: null,
      isAuthenticated: false,
    });

    const { getByText } = renderWithProviders(<PredictionScreen />);

    expect(getByText('prediction.empty.loginRequired')).toBeTruthy();
    expect(getByText('prediction.empty.loginRequiredDesc')).toBeTruthy();
  });

  it('shows empty state when no predictions exist', async () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: { id: '1', email: 'test@example.com', role: 'USER' },
      isAuthenticated: true,
    });

    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/predictions/dashboard')) {
        return Promise.resolve({ totalSchools: 0, avgProbability: 0, predictions: [] });
      }
      if (url.includes('/profiles/me/ai-analysis')) {
        return Promise.resolve(null);
      }
      if (url.includes('/profiles/me/completeness')) {
        return Promise.resolve({ score: 50 });
      }
      if (url.includes('/profiles/me')) {
        return Promise.resolve({});
      }
      return Promise.resolve({});
    });

    renderWithProviders(<PredictionScreen />);

    await waitFor(() => {
      expect(screen.getByText('prediction.empty.title')).toBeTruthy();
      expect(screen.getByText('prediction.empty.description')).toBeTruthy();
    });
  });

  it('renders prediction results when data is available', async () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: { id: '1', email: 'test@example.com', role: 'USER' },
      isAuthenticated: true,
    });

    const mockDashboard = {
      totalSchools: 2,
      avgProbability: 0.65,
      predictions: [
        {
          schoolId: 's1',
          school: { name: 'MIT' },
          probability: 0.3,
          tier: 'reach',
          confidence: 'medium',
        },
        {
          schoolId: 's2',
          school: { name: 'UC Berkeley' },
          probability: 0.75,
          tier: 'safety',
          confidence: 'high',
        },
      ],
    };

    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/predictions/dashboard')) {
        return Promise.resolve(mockDashboard);
      }
      if (url.includes('/profiles/me/ai-analysis')) {
        return Promise.resolve(null);
      }
      if (url.includes('/profiles/me/completeness')) {
        return Promise.resolve({ score: 85 });
      }
      if (url.includes('/profiles/me')) {
        return Promise.resolve({});
      }
      return Promise.resolve({});
    });

    renderWithProviders(<PredictionScreen />);

    await waitFor(() => {
      expect(screen.getByText('MIT')).toBeTruthy();
      expect(screen.getByText('UC Berkeley')).toBeTruthy();
    });
  });

  it('shows contextual baseline copy when prediction has school rate context', async () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: { id: '1', email: 'test@example.com', role: 'USER' },
      isAuthenticated: true,
    });

    const mockDashboard = {
      totalSchools: 1,
      avgProbability: 0.41,
      predictions: [
        {
          schoolId: 's1',
          school: {
            name: 'USC',
            acceptanceRate: 9.7,
            intlAcceptanceRate: 5.1,
            needBlindInternational: true,
          },
          probability: 0.41,
          tier: 'match',
          confidence: 'medium',
          roundContext: 'EA',
        },
      ],
    };

    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/predictions/dashboard')) {
        return Promise.resolve(mockDashboard);
      }
      if (url.includes('/profiles/me/ai-analysis')) {
        return Promise.resolve(null);
      }
      if (url.includes('/profiles/me/completeness')) {
        return Promise.resolve({ score: 85 });
      }
      if (url.includes('/profiles/me')) {
        return Promise.resolve({ nationality: 'China' });
      }
      return Promise.resolve({});
    });

    renderWithProviders(<PredictionScreen />);

    await waitFor(() => {
      expect(screen.getByText('USC')).toBeTruthy();
      expect(screen.getByText('prediction.contextualBaselineWithRound')).toBeTruthy();
      expect(screen.getByText('prediction.baselineInternational')).toBeTruthy();
      expect(screen.getByText('prediction.roundAdjusted')).toBeTruthy();
      expect(screen.getByText('prediction.needBlind')).toBeTruthy();
      expect(screen.getByText('prediction.deltaAbove')).toBeTruthy();
    });
  });

  it('maps confidence reasoning and freshness metadata from dashboard payload', () => {
    const mockDashboard = {
      totalSchools: 1,
      avgProbability: 0.53,
      predictions: [
        {
          schoolId: 's1',
          school: { name: 'Northwestern' },
          probability: 0.53,
          tier: 'match' as const,
          confidence: 'high' as const,
          confidenceReason: 'Balanced historical and profile coverage',
          sourceSummary: [
            { label: 'Historical fit', detail: 'Strong cohort match' },
            { label: 'Course rigor', detail: 'Aligned with admits' },
          ],
          uncertaintyReasons: ['Essay quality is still self-reported'],
          updatedAt: '2026-04-08T18:30:00.000Z',
        },
      ],
    };

    const predictions = mapDashboardToPredictions(mockDashboard, false);

    expect(predictions).toHaveLength(1);
    expect(predictions[0].schoolName).toBe('Northwestern');
    expect(predictions[0].confidenceReason).toBe('Balanced historical and profile coverage');
    expect(predictions[0].sourceSummary?.map((item) => item.label)).toEqual([
      'Historical fit',
      'Course rigor',
    ]);
    expect(predictions[0].uncertaintyReasons).toEqual(['Essay quality is still self-reported']);
    expect(predictions[0].updatedAt).toBe('2026-04-08T18:30:00.000Z');
  });

  it('renders the header with title and subtitle', () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: { id: '1', email: 'test@example.com', role: 'USER' },
      isAuthenticated: true,
    });

    const { getByText } = renderWithProviders(<PredictionScreen />);

    expect(getByText('prediction.title')).toBeTruthy();
    expect(getByText('prediction.subtitle')).toBeTruthy();
  });

  it('shows the application-analysis CTA card and opens /profile/analysis', async () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: { id: '1', email: 'test@example.com', role: 'USER' },
      isAuthenticated: true,
    });

    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/predictions/dashboard')) {
        return Promise.resolve({ totalSchools: 0, avgProbability: 0, predictions: [] });
      }
      if (url.includes('/profiles/me/completeness')) {
        return Promise.resolve({ score: 75 });
      }
      if (url.includes('/profiles/me/ai-analysis')) {
        return Promise.resolve({
          status: 'fresh',
          meta: {
            traceId: 'trace-prediction-1',
            analysisVersion: 'application-analysis-v2',
            state: 'ready',
            dataQuality: 'high',
            targetSchoolCount: 2,
            focusSchoolCount: 1,
            schoolsWithPredictions: 1,
            generatedAt: '2026-04-10T12:00:00.000Z',
          },
          profileSummary: {
            applicantType: 'international',
            intendedMajors: ['Computer Science'],
            testStrategy: 'submit',
            contextFlags: ['needAid'],
            constraints: ['International aid need remains the hardest structural constraint.'],
          },
          portfolioSummary: {
            balance: 'balanced',
            verdict: 'The current list is ambitious but still defensible.',
            keyReasons: ['One focus school already has usable prediction coverage.'],
            riskBoundaries: ['International aid need narrows the margin.'],
          },
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
              },
              policyCard: {
                testingPolicy: 'OPTIONAL',
                intlAidPolicy: 'NEED_AWARE',
                roundContext: 'ED',
                policySourceQuality: 'REVIEWED',
                evidenceIds: ['evidence-1'],
                sources: [],
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
              evidenceIds: ['evidence-1'],
              unknowns: [],
            },
          ],
          actionPlan: {
            now: ['Tighten the flagship activity narrative.'],
            next90Days: ['Build one measurable leadership deliverable.'],
            beforeSubmission: ['Align essays to school-specific constraints.'],
          },
          unknowns: [],
        });
      }
      if (url.includes('/profiles/me')) {
        return Promise.resolve({});
      }
      return Promise.resolve({});
    });

    const { getByText } = renderWithProviders(<PredictionScreen />);

    await waitFor(() => {
      expect(getByText('applicationAnalysis.title')).toBeTruthy();
      expect(getByText('The current list is ambitious but still defensible.')).toBeTruthy();
    });

    fireEvent.press(getByText('prediction.analysisCard.open'));

    expect(router.push).toHaveBeenCalledWith('/profile/analysis');
  });

  it('shows explanation copy for estimate, data support, and tier semantics', async () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: { id: '1', email: 'test@example.com', role: 'USER' },
      isAuthenticated: true,
    });

    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/predictions/dashboard')) {
        return Promise.resolve({ totalSchools: 0, avgProbability: 0, predictions: [] });
      }
      if (url.includes('/profiles/me/completeness')) {
        return Promise.resolve({ score: 75 });
      }
      if (url.includes('/profiles/me')) {
        return Promise.resolve({});
      }
      return Promise.resolve({});
    });

    const { getByText } = renderWithProviders(<PredictionScreen />);

    await waitFor(() => {
      expect(getByText('prediction.probabilityVsRateDisclaimer')).toBeTruthy();
      expect(getByText('prediction.confidenceDisclaimer')).toBeTruthy();
      expect(getByText('prediction.tierDisclaimer')).toBeTruthy();
    });
  });
});
