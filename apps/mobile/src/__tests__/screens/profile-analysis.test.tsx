import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getApplicationAnalysisRenderFixturesByTag } from '@study-abroad/shared';

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
  const renderFixtures = getApplicationAnalysisRenderFixturesByTag('render-smoke');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(renderFixtures)(
    'renders the canonical application-analysis contract for $caseId',
    async (fixture) => {
      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/profiles/me/ai-analysis')) {
          return Promise.resolve(fixture.analysis);
        }
        return Promise.resolve({});
      });

      const screen = renderWithProviders(<ProfileAnalysisScreen />);

      await waitFor(() => {
        expect(screen.getByText(fixture.analysis.overallVerdict)).toBeTruthy();
      });

      if (fixture.analysis.schoolCards.length === 0) {
        expect(
          screen.queryByText(fixture.analysis.schoolCards[0]?.schoolName ?? '__missing__')
        ).toBeNull();
      } else {
        // School names are unique per fixture, so getByText still works for them.
        // Testing-policy labels CAN repeat (e.g. two schools both UNKNOWN), so
        // count expected occurrences per policy and assert the page surfaces at
        // least that many — getByText would throw "Found multiple elements" on
        // duplicates (regression seen with fixture 008-berkeley-columbia-balanced).
        const policyCounts = new Map<string, number>();
        for (const school of fixture.analysis.schoolCards) {
          expect(screen.getByText(school.schoolName)).toBeTruthy();
          const policyKey = `applicationAnalysis.policy.testing.${school.policyCard.testingPolicy}`;
          policyCounts.set(policyKey, (policyCounts.get(policyKey) ?? 0) + 1);
        }
        for (const [policyKey, expectedCount] of policyCounts) {
          expect(screen.getAllByText(policyKey).length).toBeGreaterThanOrEqual(expectedCount);
        }
      }

      if (fixture.analysis.nextActions.length > 0) {
        expect(screen.queryAllByText(fixture.analysis.nextActions[0]).length).toBeGreaterThan(0);
      }

      if (fixture.analysis.unknowns.length === 0) {
        expect(screen.queryByText('Unknowns')).toBeNull();
      }
    }
  );
});
