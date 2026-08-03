import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { recommendationRoutes } from '@study-abroad/shared';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

const mockToastSuccess = jest.fn();

jest.mock('@/components/ui/Toast', () => ({
  useToast: () => ({
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: jest.fn(),
  }),
}));

jest.mock('@/lib/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

import { apiClient } from '@/lib/api/client';
import { GenerateTab } from '@/screens/recommendation/GenerateTab';

describe('Recommendation generate closure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.get as jest.Mock).mockResolvedValue({
      canGenerate: true,
      points: 0,
      profileComplete: true,
      missingFields: [],
      profileSummary: { gpa: 3.9, testCount: 1, activityCount: 3 },
    });
    (apiClient.post as jest.Mock).mockResolvedValue({
      id: 'recommendation-1',
      recommendations: [
        {
          schoolId: 'school-1',
          schoolName: 'Example University',
          tier: 'match',
          estimatedProbability: 0.45,
          fitScore: 88,
          reasons: ['Strong academic fit'],
        },
      ],
      analysis: { strengths: ['Academics'], weaknesses: [], improvementTips: [] },
      summary: 'Balanced recommendation set',
      tokenUsed: 100,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('allows a complete profile with zero points to generate a recommendation', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <GenerateTab externalResult={null} onExternalResultConsumed={jest.fn()} />
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByText('recommendation.profileComplete')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('California'));
    fireEvent.press(screen.getByLabelText('10'));
    fireEvent.press(screen.getByText('recommendation.generate'));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith(recommendationRoutes.generate(), {
        schoolCount: 10,
        budget: 'medium',
        preferredRegions: ['California'],
        preferredMajors: undefined,
      })
    );
    await waitFor(() => expect(screen.getByText('Example University')).toBeTruthy());
    expect(mockToastSuccess).toHaveBeenCalledWith('recommendation.generateSuccess');
  });
});
