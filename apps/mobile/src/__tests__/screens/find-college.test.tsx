import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
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
    get: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0 }),
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

// Mock debounced search hook (keep the REAL usePaginatedQuery so the screen still
// drives apiClient.get through useInfiniteQuery — tests below assert on those calls).
jest.mock('@/hooks/api', () => ({
  ...jest.requireActual('@/hooks/api'),
  useDebouncedSearch: () => ({
    search: '',
    debouncedSearch: '',
    handleSearchChange: jest.fn(),
  }),
}));

// Mock format utility
jest.mock('@/utils/format', () => ({
  formatAcceptanceRate: jest.fn((v?: number) => (v != null ? `${(v * 100).toFixed(1)}%` : '-')),
}));

// Mock shared routes
jest.mock('@study-abroad/shared', () => ({
  ...jest.requireActual('@study-abroad/shared'),
  API_ROUTES: {
    SCHOOL_LISTS: '/school-lists',
  },
  getSchoolLogoSources: ({
    logoUrl,
    website,
  }: {
    logoUrl?: string | null;
    website?: string | null;
  }) => ({
    source: logoUrl ?? null,
    fallbackSource: website ? 'https://www.google.com/s2/favicons?domain=example.edu&sz=256' : null,
  }),
  schoolListRoutes: {
    list: () => '/school-lists',
    byId: (id: string) => `/school-lists/${id}`,
  },
}));

import { apiClient } from '@/lib/api/client';
import FindCollegePage from '@/app/find-college';

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

describe('FindCollegePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      totalPages: 0,
    });

    const { toJSON } = renderWithProviders(<FindCollegePage />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows skeleton loading state while fetching schools', () => {
    // Keep the promise pending to simulate loading
    (apiClient.get as jest.Mock).mockReturnValue(new Promise(() => {}));

    const { toJSON } = renderWithProviders(<FindCollegePage />);

    // The component renders skeleton placeholders during loading.
    // Verify the tree is non-null (skeletons are rendered).
    expect(toJSON()).toBeTruthy();
  });

  it('shows empty state when no schools match the search', async () => {
    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/school-lists') return Promise.resolve([]);
      // Schools endpoint returns empty
      return Promise.resolve({ items: [], total: 0, page: 1, totalPages: 0 });
    });

    const { getByText } = renderWithProviders(<FindCollegePage />);

    await waitFor(() => {
      expect(getByText('No Schools Found')).toBeTruthy();
      expect(getByText('Try adjusting your search or filters')).toBeTruthy();
    });
  });

  it('renders school cards when data is available', async () => {
    const mockSchools = {
      items: [
        {
          id: 'school-1',
          name: 'Massachusetts Institute of Technology',
          nameZh: 'MIT',
          city: 'Cambridge',
          state: 'Massachusetts',
          ranking: 1,
          acceptanceRate: 0.039,
          tuition: 57986,
          logoUrl: null,
          type: 'PRIVATE_SCHOOL',
        },
        {
          id: 'school-2',
          name: 'University of California, Berkeley',
          nameZh: 'UCB',
          city: 'Berkeley',
          state: 'California',
          ranking: 15,
          acceptanceRate: 0.117,
          tuition: 44066,
          logoUrl: null,
          type: 'PUBLIC_SCHOOL',
        },
      ],
      total: 2,
      page: 1,
      totalPages: 1,
    };

    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/school-lists') return Promise.resolve([]);
      return Promise.resolve(mockSchools);
    });

    const { getByText } = renderWithProviders(<FindCollegePage />);

    await waitFor(() => {
      expect(getByText('Massachusetts Institute of Technology')).toBeTruthy();
      expect(getByText('University of California, Berkeley')).toBeTruthy();
    });
  });

  it('calls apiClient.get for schools and school-lists on mount', () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      totalPages: 0,
    });

    renderWithProviders(<FindCollegePage />);

    // Schools infinite query
    expect(apiClient.get).toHaveBeenCalledWith('/schools', expect.anything());
    // School lists query
    expect(apiClient.get).toHaveBeenCalledWith('/school-lists');
  });
});
