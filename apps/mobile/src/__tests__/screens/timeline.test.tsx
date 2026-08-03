import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock react-i18next
jest.mock('react-i18next', () => {
  const { translateForTests } = require('../utils/i18n-test-utils');
  return {
    useTranslation: () => ({
      t: translateForTests,
      i18n: { language: 'en' },
    }),
  };
});

// Mock expo-router
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  Stack: {
    Screen: () => null,
  },
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
}));

// Mock API client
jest.mock('@/lib/api/client', () => ({
  apiClient: {
    get: jest.fn().mockResolvedValue([]),
    post: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
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

// Mock ConfirmDialog to simplify rendering
jest.mock('@/components/ui/ConfirmDialog', () => ({
  ConfirmDialog: () => null,
}));

// Mock shared routes
jest.mock('@study-abroad/shared', () => ({
  ...jest.requireActual('@study-abroad/shared'),
  API_ROUTES: {
    TIMELINES: '/timelines',
  },
}));

import { apiClient } from '@/lib/api/client';
import TimelinePage from '@/app/timeline';

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

describe('TimelinePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.get as jest.Mock).mockResolvedValue([]);
  });

  it('renders without crashing', () => {
    const { toJSON } = renderWithProviders(<TimelinePage />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows loading state while fetching timelines', () => {
    // Keep the promise pending to simulate loading
    (apiClient.get as jest.Mock).mockReturnValue(new Promise(() => {}));

    const { getByText } = renderWithProviders(<TimelinePage />);

    expect(getByText('Loading...')).toBeTruthy();
  });

  it('shows empty state when no school timelines exist', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue([]);

    const { getByText } = renderWithProviders(<TimelinePage />);

    await waitFor(() => {
      expect(getByText('No timelines yet')).toBeTruthy();
      expect(getByText('Add your target schools to start tracking')).toBeTruthy();
    });
  });

  it('renders school timeline cards when data is available', async () => {
    const mockTimelines = [
      {
        id: 'tl-1',
        schoolId: 's-1',
        schoolName: 'Harvard University',
        round: 'ED',
        deadline: '2026-11-01T00:00:00Z',
        status: 'IN_PROGRESS',
        progress: 40,
        priority: 1,
        notes: null,
        tasksTotal: 5,
        tasksCompleted: 2,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'tl-2',
        schoolId: 's-2',
        schoolName: 'Stanford University',
        round: 'RD',
        deadline: '2027-01-01T00:00:00Z',
        status: 'NOT_STARTED',
        progress: 0,
        priority: 2,
        notes: null,
        tasksTotal: 3,
        tasksCompleted: 0,
        createdAt: '2026-01-15T00:00:00Z',
      },
    ];

    (apiClient.get as jest.Mock).mockResolvedValue(mockTimelines);

    const { getByText } = renderWithProviders(<TimelinePage />);

    await waitFor(() => {
      expect(getByText('Harvard University')).toBeTruthy();
      expect(getByText('Stanford University')).toBeTruthy();
    });
  });

  it('loads inline tasks from the timeline detail endpoint when expanded', async () => {
    const timeline = {
      id: 'tl-1',
      schoolId: 's-1',
      schoolName: 'Harvard University',
      round: 'ED',
      deadline: '2026-11-01T00:00:00Z',
      status: 'IN_PROGRESS',
      progress: 40,
      priority: 1,
      notes: null,
      tasksTotal: 1,
      tasksCompleted: 0,
      createdAt: '2026-01-01T00:00:00Z',
    };
    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/timelines') return Promise.resolve([timeline]);
      if (url === '/timelines/tl-1') {
        return Promise.resolve({
          ...timeline,
          tasks: [
            {
              id: 'task-1',
              title: 'Submit recommendation request',
              type: 'RECOMMENDATION',
              completed: false,
            },
          ],
        });
      }
      return Promise.resolve([]);
    });

    const { getByLabelText, getByText } = renderWithProviders(<TimelinePage />);
    await waitFor(() => expect(getByText('Harvard University')).toBeTruthy());
    fireEvent.press(getByLabelText('Harvard University'));

    await waitFor(() => expect(getByText('Submit recommendation request')).toBeTruthy());
    expect(apiClient.get).toHaveBeenCalledWith('/timelines/tl-1');
    expect(apiClient.get).not.toHaveBeenCalledWith('/timelines/tl-1/tasks');
  });

  it('renders the segment tabs for schools, events, and overview', () => {
    const { getByText } = renderWithProviders(<TimelinePage />);

    expect(getByText('Schools')).toBeTruthy();
    expect(getByText('Events')).toBeTruthy();
    expect(getByText('Overview')).toBeTruthy();
  });
});
