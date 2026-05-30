import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock react-i18next — t() echoes the key (or interpolates {{count}}/{{days}}/{{pct}}).
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: string | Record<string, unknown>) => {
      if (typeof opts === 'string') return opts;
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

// Mock API client
jest.mock('@/lib/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

// Mock stores
jest.mock('@/stores', () => ({
  useAuthStore: jest.fn(() => ({ user: null, isAuthenticated: false })),
  useThemeStore: jest.fn(() => ({ colorScheme: 'light' })),
}));

jest.mock('@/utils/case-helpers', () => ({
  getResultBadgeVariant: jest.fn(() => 'secondary'),
}));

// CircularProgress drives an svg + reanimated animation that the Jest runtime
// can't execute; stub it (this test verifies Home data-wiring, not the ring).
jest.mock('@/components/ui', () => ({
  ...jest.requireActual('@/components/ui'),
  CircularProgress: () => null,
}));

import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/stores';
import HomeScreen from '@/app/(tabs)/index';

/** Minimal valid DashboardSummary covering every field the Home reads. */
const mockDashboard = {
  user: { email: 'john@example.com', role: 'USER', points: 0, createdAt: '2026-01-01' },
  profile: {
    completeness: 80,
    hasTestScores: true,
    hasActivities: true,
    hasAwards: true,
    hasEducation: true,
    targetSchoolCount: 8,
    essayCount: 2,
    schoolTiers: { reach: 3, target: 3, safety: 2 },
    grade: null,
  },
  stats: { followers: 0, following: 0, cases: 0, predictions: 0 },
  pendingTasks: { total: 4, todayCount: 1, byType: [], profileGaps: [] },
  upcomingDeadlines: [
    { id: 'd1', schoolName: 'MIT', round: 'EA', deadline: '2099-01-01', daysLeft: 5 },
  ],
  upcomingPersonalEvents: [],
  recentActivity: [],
  workbench: {
    readiness: { score: 80, status: 'attention', items: [] },
    metrics: {
      due7: 1,
      due30: 2,
      overdueTasks: 0,
      missingTimelineCount: 0,
      balancedSchoolList: true,
    },
    priorityQueue: [],
    deadlineStream: [],
    pipeline: {
      notStarted: 5,
      inProgress: 1,
      submitted: 2,
      accepted: 0,
      rejected: 0,
      waitlisted: 0,
      withdrawn: 0,
      recentDecisions: [],
    },
  },
};

function mockGetByUrl() {
  (apiClient.get as jest.Mock).mockImplementation((url: string) => {
    if (url === '/users/me/dashboard') return Promise.resolve(mockDashboard);
    return Promise.resolve({ items: [], total: 0 });
  });
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetByUrl();
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: null,
      isAuthenticated: false,
    });
  });

  it('renders without crashing', () => {
    const { toJSON } = renderWithProviders(<HomeScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows guest welcome when not authenticated', () => {
    const { getByText } = renderWithProviders(<HomeScreen />);
    expect(getByText('home.guestWelcome')).toBeTruthy();
    expect(getByText('home.loginPrompt')).toBeTruthy();
  });

  it('shows the username from the dashboard when authenticated', async () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: { id: '1', email: 'john@example.com', role: 'USER' },
      isAuthenticated: true,
    });

    const { findByText } = renderWithProviders(<HomeScreen />);
    // Hero renders once the dashboard query resolves.
    expect(await findByText('john')).toBeTruthy();
  });

  it('renders the hero stat labels from real dashboard data when authenticated', async () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: { id: '1', email: 'john@example.com', role: 'USER' },
      isAuthenticated: true,
    });

    const { findByText } = renderWithProviders(<HomeScreen />);
    expect(await findByText('home.statTodayTasks')).toBeTruthy();
    expect(await findByText('home.statSubmitted')).toBeTruthy();
    expect(await findByText('home.statCompletion')).toBeTruthy();
  });

  it('loads schools and cases on mount', () => {
    renderWithProviders(<HomeScreen />);
    expect(apiClient.get).toHaveBeenCalledWith('/schools', expect.any(Object));
    expect(apiClient.get).toHaveBeenCalledWith('/cases', expect.any(Object));
  });

  it('uses the dashboard endpoint as the data source when authenticated', () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: { id: '1', email: 'john@example.com', role: 'USER' },
      isAuthenticated: true,
    });
    renderWithProviders(<HomeScreen />);
    expect(apiClient.get).toHaveBeenCalledWith('/users/me/dashboard');
  });

  it('renders quick action buttons', () => {
    const { getByText } = renderWithProviders(<HomeScreen />);
    expect(getByText('home.features.profile')).toBeTruthy();
    expect(getByText('home.features.prediction')).toBeTruthy();
    expect(getByText('home.features.ranking')).toBeTruthy();
  });
});
