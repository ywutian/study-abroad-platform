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
    info: jest.fn(),
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
import type { PredictionDashboardData } from '@study-abroad/shared';
import { MAX_SCHOOLS_PER_BATCH } from '@study-abroad/shared';

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
    const mockDashboard: PredictionDashboardData = {
      totalSchools: 1,
      tierDistribution: { reach: 0, match: 1, safety: 0 },
      avgProbability: 0.53,
      confidenceBreakdown: { low: 0, medium: 0, high: 1 },
      predictions: [
        {
          schoolId: 's1',
          school: { id: 'sch_nw', name: 'Northwestern' },
          probability: 0.53,
          tier: 'match',
          confidence: 'high',
          factors: [],
          suggestions: [],
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

  it('shows the application-analysis CTA card without auto-fetching analysis and opens /profile/analysis', async () => {
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

    const { getAllByText, getByText } = renderWithProviders(<PredictionScreen />);

    await waitFor(() => {
      expect(getByText('applicationAnalysis.title')).toBeTruthy();
      expect(getByText('prediction.analysisCard.description')).toBeTruthy();
    });
    expect(apiClient.get).not.toHaveBeenCalledWith(
      expect.stringContaining('/profiles/me/ai-analysis'),
      expect.anything()
    );

    fireEvent.press(getAllByText('prediction.analysisCard.open')[0]);

    expect(router.push).toHaveBeenCalledWith('/profile/analysis');
  });

  it('navigates to login from the empty-state login button when unauthenticated', () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: null,
      isAuthenticated: false,
    });

    const { getByText } = renderWithProviders(<PredictionScreen />);
    fireEvent.press(getByText('prediction.empty.goLogin'));
    expect(router.push).toHaveBeenCalledWith('/(auth)/login');
  });

  it('routes "Add Prediction" to find-college when the target list is empty', async () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: { id: '1', email: 'test@example.com', role: 'USER' },
      isAuthenticated: true,
    });
    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/predictions/dashboard')) {
        return Promise.resolve({ totalSchools: 0, avgProbability: 0, predictions: [] });
      }
      if (url.includes('/school-lists')) return Promise.resolve([]);
      return Promise.resolve({});
    });

    const { getByText } = renderWithProviders(<PredictionScreen />);
    await waitFor(() => expect(getByText('prediction.addPrediction')).toBeTruthy());
    fireEvent.press(getByText('prediction.addPrediction'));
    expect(router.push).toHaveBeenCalledWith('/find-college');
  });

  it('blocks "Add Prediction" when the profile is not eligible (canRunPrediction=false)', async () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: { id: '1', email: 'test@example.com', role: 'USER' },
      isAuthenticated: true,
    });
    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/predictions/dashboard')) {
        return Promise.resolve({ totalSchools: 0, avgProbability: 0, predictions: [] });
      }
      if (url.includes('/profiles/me/completeness')) {
        // Known-ineligible profile (no GPA / no target school yet).
        return Promise.resolve({ score: 40, canRunPrediction: false });
      }
      if (url.includes('/school-lists')) return Promise.resolve([{ schoolId: 's1' }]);
      return Promise.resolve({});
    });

    const { getByText } = renderWithProviders(<PredictionScreen />);
    // Wait until the ineligible state resolves (the blocked hint renders).
    await waitFor(() => expect(getByText('prediction.predictionBlockedHint')).toBeTruthy());
    fireEvent.press(getByText('prediction.addPrediction'));

    // The gate stops the doomed request before it 412s — no predict POST is sent
    // (mirrors web, where the button is disabled when the profile is ineligible).
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('runs the full saved list when it is within the batch cap', async () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: { id: '1', email: 'test@example.com', role: 'USER' },
      isAuthenticated: true,
    });
    // 11 schools used to be truncated to 10 by the old client-side cap; with the
    // raised shared cap (MAX_SCHOOLS_PER_BATCH) the whole list is now predicted.
    const elevenSchools = Array.from({ length: 11 }, (_, i) => ({ schoolId: `s${i}` }));
    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/predictions/dashboard')) {
        return Promise.resolve({ totalSchools: 0, avgProbability: 0, predictions: [] });
      }
      if (url.includes('/school-lists')) return Promise.resolve(elevenSchools);
      return Promise.resolve({});
    });

    const { getByText } = renderWithProviders(<PredictionScreen />);
    // Wait for the school-list to resolve (empty state switches to "has schools").
    await waitFor(() => expect(getByText('prediction.empty.hasSchools')).toBeTruthy());
    fireEvent.press(getByText('prediction.addPrediction'));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
    const predictCall = (apiClient.post as jest.Mock).mock.calls.find((c) =>
      String(c[0]).includes('/predictions')
    );
    expect(predictCall?.[1]?.schoolIds).toHaveLength(11);
  });

  it('caps "Add Prediction" at MAX_SCHOOLS_PER_BATCH when the saved list is longer', async () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: { id: '1', email: 'test@example.com', role: 'USER' },
      isAuthenticated: true,
    });
    const tooManySchools = Array.from({ length: MAX_SCHOOLS_PER_BATCH + 1 }, (_, i) => ({
      schoolId: `s${i}`,
    }));
    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/predictions/dashboard')) {
        return Promise.resolve({ totalSchools: 0, avgProbability: 0, predictions: [] });
      }
      if (url.includes('/school-lists')) return Promise.resolve(tooManySchools);
      return Promise.resolve({});
    });

    const { getByText } = renderWithProviders(<PredictionScreen />);
    await waitFor(() => expect(getByText('prediction.empty.hasSchools')).toBeTruthy());
    fireEvent.press(getByText('prediction.addPrediction'));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
    const predictCall = (apiClient.post as jest.Mock).mock.calls.find((c) =>
      String(c[0]).includes('/predictions')
    );
    // Sliced to the cap — never sends the full over-limit list (which would 400).
    expect(predictCall?.[1]?.schoolIds).toHaveLength(MAX_SCHOOLS_PER_BATCH);
  });

  it('shows explanation copy for estimate, data support, and tier semantics', async () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: { id: '1', email: 'test@example.com', role: 'USER' },
      isAuthenticated: true,
    });

    // Disclaimers are gated behind having ≥1 prediction (we don't greet an empty
    // first-run with a wall of jargon), so seed one prediction.
    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/predictions/dashboard')) {
        return Promise.resolve({
          totalSchools: 1,
          avgProbability: 0.5,
          predictions: [
            {
              schoolId: 's1',
              school: { name: 'MIT' },
              probability: 0.5,
              tier: 'match',
              confidence: 'medium',
            },
          ],
        });
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
