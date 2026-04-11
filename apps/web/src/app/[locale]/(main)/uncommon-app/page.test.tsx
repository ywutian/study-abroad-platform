import type React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { profileRoutes, schoolListRoutes } from '@study-abroad/shared';
import UncommonAppPage from './page';
import { apiClient } from '@/lib/api';
import { callAIAgent } from './_components/utils';

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
  StepAIRecommendations: () => <div>ai-recommendations</div>,
}));

vi.mock('./_components/step-results', () => ({
  StepResults: ({ analysis }: { analysis: { summary?: string } | null }) => (
    <div>{analysis?.summary ?? 'analysis-pending'}</div>
  ),
}));

vi.mock('@/lib/api', () => ({
  apiClient: {
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('./_components/utils', () => ({
  callAIAgent: vi.fn(),
  parseSchoolRecommendations: vi.fn(() => ({
    reach: [],
    target: [],
    safety: [],
  })),
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
      if (path === '/profiles/me') {
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

      throw new Error(`Unexpected GET path: ${path}`);
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

  it('uses the canonical profile analysis endpoint instead of the profile agent flow', async () => {
    renderPage();

    fireEvent.click(screen.getByText('grade-profile'));

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        profileRoutes.aiAnalysis(),
        expect.objectContaining({
          timeout: 45000,
          directApi: true,
        })
      );
    });
    expect(callAIAgent).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByText('canonical-analysis')).toBeInTheDocument();
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
