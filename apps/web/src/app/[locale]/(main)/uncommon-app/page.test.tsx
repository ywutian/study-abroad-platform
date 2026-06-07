import type React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  API_ROUTES,
  profileRoutes,
  recommendationRoutes,
  schoolListRoutes,
} from '@study-abroad/shared';
import UncommonAppPage from './page';
import { apiClient } from '@/lib/api';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/components/layout', () => ({
  PageContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({
    title,
    description,
    actions,
  }: {
    title: string;
    description: string;
    actions?: React.ReactNode;
  }) => (
    <header>
      <h1>{title}</h1>
      <p>{description}</p>
      {actions}
    </header>
  ),
}));

vi.mock('@/components/features/ai-error-boundary', () => ({
  AIErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
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

// Authed queries now gate on useAuthReady() (isInitialized && accessToken) — the
// test store must be "ready" or the queries never fire.
vi.mock('@/stores/auth', () => ({
  useAuthStore: (
    selector: (state: {
      user: { id: string } | null;
      accessToken: string | null;
      isInitialized: boolean;
    }) => unknown
  ) => selector({ user: { id: 'user-1' }, accessToken: 'token-1', isInitialized: true }),
}));

const defaultProfile = {
  id: 'profile-1',
  gpa: 3.9,
  testScores: [{ type: 'SAT', score: 1520 }],
  activities: [{ id: 'activity-1', name: 'Research' }],
  awards: [],
};

const exampleSchool = {
  id: 'item-1',
  schoolId: 'school-1',
  tier: 'TARGET',
  round: 'RD',
  school: {
    id: 'school-1',
    name: 'Example University',
  },
  isAIRecommended: false,
  essayPromptCount: 2,
  deadlines: [
    {
      round: 'RD',
      applicationDeadline: '2026-01-01',
    },
  ],
};

describe('UncommonAppPage', () => {
  let mockSchoolList: unknown[];
  let mockProfile: Record<string, unknown>;
  let mockTimelines: unknown[];

  beforeEach(() => {
    vi.clearAllMocks();
    mockSchoolList = [];
    mockProfile = defaultProfile;
    mockTimelines = [];

    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path === schoolListRoutes.list()) {
        return Promise.resolve(mockSchoolList);
      }
      if (path === profileRoutes.me()) {
        return Promise.resolve(mockProfile);
      }
      if (path === API_ROUTES.TIMELINES) {
        return Promise.resolve(mockTimelines);
      }
      if (path === profileRoutes.aiAnalysis()) {
        return Promise.resolve({
          overallVerdict: 'canonical-analysis',
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

    return { invalidateSpy };
  }

  it('uses the canonical profile analysis endpoint only after explicit counselor advice', async () => {
    renderPage();

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(schoolListRoutes.list());
    });
    expect(apiClient.get).not.toHaveBeenCalledWith(profileRoutes.aiAnalysis(), expect.anything());

    const adviceButtons = screen.getAllByRole('button', {
      name: /workspace\.actions\.generate-advice/,
    });
    fireEvent.click(adviceButtons[adviceButtons.length - 1]);

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

  it('keeps candidate-school generation as a manual secondary action', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /workspace\.actions\.add-candidates/ }));

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

  it('invalidates application workspace data when a school is removed', async () => {
    mockSchoolList = [exampleSchool];
    const { invalidateSpy } = renderPage();

    await screen.findByText('Example University');
    fireEvent.click(screen.getByLabelText('workspace.schoolBoard.removeSchool'));

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
