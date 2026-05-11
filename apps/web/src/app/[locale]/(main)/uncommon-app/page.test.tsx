import type React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { profileRoutes, recommendationRoutes, schoolListRoutes } from '@study-abroad/shared';
import UncommonAppPage from './page';
import { apiClient } from '@/lib/api';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));

vi.mock('@/components/layout', () => ({
  PageContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/layout/page-header', () => ({
  PageHeader: () => <div>page-header</div>,
}));

vi.mock('@/components/features/ai-error-boundary', () => ({
  AIErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./_components/step-profile-grading', () => ({
  StepProfileGrading: ({ onGradeProfile }: { onGradeProfile: () => void }) => (
    <button onClick={onGradeProfile}>grade-profile</button>
  ),
}));

vi.mock('./_components/step-school-lists', () => ({
  StepSchoolLists: ({ onDelete }: { onDelete: (id: string) => void }) => (
    <button onClick={() => onDelete('item-1')}>delete-school</button>
  ),
}));

vi.mock('./_components/step-ai-recommendations', () => ({
  StepAIRecommendations: ({ onGetRecommendations }: { onGetRecommendations: () => void }) => (
    <button onClick={onGetRecommendations}>generate-recommendations</button>
  ),
}));

vi.mock('./_components/step-results', () => ({
  StepResults: ({ analysis }: { analysis: { summary?: string } | null }) => (
    <div>{analysis?.summary ?? 'analysis-pending'}</div>
  ),
}));

vi.mock('@/lib/api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('UncommonAppPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path === schoolListRoutes.list()) {
        return Promise.resolve([]);
      }
      if (path === profileRoutes.me()) {
        return Promise.resolve({
          id: 'profile-1',
          testScores: [],
          activities: [],
          awards: [],
        });
      }
      if (path === profileRoutes.aiAnalysis()) {
        return Promise.resolve({
          summary: 'canonical-analysis',
          overallScore: 80,
          tier: 'top30',
          sections: {
            academic: { status: 'green', score: 8, feedback: 'Academic' },
            testScores: { status: 'yellow', score: 6, feedback: 'Testing' },
            activities: { status: 'green', score: 8, feedback: 'Activities' },
            awards: { status: 'yellow', score: 5, feedback: 'Awards' },
          },
          suggestions: {
            majors: [],
            competitions: [],
            activities: [],
            summerPrograms: [],
            timeline: [],
          },
        });
      }
      if (path === recommendationRoutes.preflight()) {
        return Promise.resolve({
          canGenerate: true,
          points: 100,
          profileComplete: true,
          missingFields: [],
        });
      }
      if (path === recommendationRoutes.history()) {
        return Promise.resolve([]);
      }

      throw new Error(`Unexpected GET path: ${path}`);
    });
    vi.mocked(apiClient.post).mockResolvedValue({
      id: 'rec-1',
      summary: 'structured recommendations',
      recommendations: [
        {
          schoolName: 'Example College',
          tier: 'match',
          estimatedProbability: 0.42,
          fitScore: 84,
          reasons: ['Balanced fit'],
        },
      ],
      analysis: { strengths: [], weaknesses: [], improvementTips: [] },
      tokenUsed: 10,
      createdAt: '2026-05-10T00:00:00.000Z',
    });
    vi.mocked(apiClient.delete).mockResolvedValue({});
  });

  function renderPage() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    render(
      <QueryClientProvider client={queryClient}>
        <UncommonAppPage />
      </QueryClientProvider>
    );

    return { queryClient, invalidateSpy };
  }

  it('uses the canonical profile analysis endpoint only after explicit strategy generation', async () => {
    renderPage();

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(schoolListRoutes.list());
    });
    expect(apiClient.get).not.toHaveBeenCalledWith(profileRoutes.aiAnalysis(), expect.anything());

    fireEvent.click(screen.getByText('grade-profile'));

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        profileRoutes.aiAnalysis(),
        expect.objectContaining({
          timeout: expect.any(Number),
          directApi: true,
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText('canonical-analysis')).toBeInTheDocument();
    });
  });

  it('uses the structured recommendation endpoint instead of the chat agent parser', async () => {
    renderPage();

    fireEvent.click(screen.getByText('generate-recommendations'));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        recommendationRoutes.generate(),
        expect.objectContaining({ schoolCount: 8 }),
        expect.objectContaining({
          timeout: expect.any(Number),
          directApi: true,
        })
      );
    });
  });

  it('invalidates profile-ai-analysis when a school is removed', async () => {
    const { invalidateSpy } = renderPage();

    fireEvent.click(screen.getByText('delete-school'));

    await waitFor(() => {
      expect(apiClient.delete).toHaveBeenCalledWith(schoolListRoutes.byId('item-1'));
    });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['school-lists'] });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['profile-ai-analysis'],
      });
    });
  });
});
