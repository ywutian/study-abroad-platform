import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

// Mock expo-router with id param
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  Stack: {
    Screen: () => null,
  },
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'school-1' }),
  useSegments: () => [],
}));

// Mock API client
jest.mock('@/lib/api/client', () => ({
  apiClient: {
    get: jest.fn().mockResolvedValue(null),
    post: jest.fn(),
    delete: jest.fn(),
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

// Mock Toast (school detail uses useToast for the save-to-list action)
jest.mock('@/components/ui/Toast', () => ({
  useToast: () => ({
    show: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  }),
}));

// Mock Haptics
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

// Mock case-helpers
jest.mock('@/utils/case-helpers', () => ({
  getResultBadgeVariant: jest.fn(() => 'secondary'),
}));

// Mock format utility
jest.mock('@/utils/format', () => ({
  formatAcceptanceRate: jest.fn((v?: number) => (v ? `${(v * 100).toFixed(1)}%` : '-')),
}));

// Mock shared modules
jest.mock('@study-abroad/shared', () => ({
  ...jest.requireActual('@study-abroad/shared'),
  DATA_SOURCE_LABELS: {},
  API_ROUTES: {
    SCHOOLS: '/schools',
    SCHOOL_LISTS: '/school-lists',
    CASES: '/cases',
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
  schoolRoutes: {
    byId: (id: string) => `/schools/${id}`,
  },
  schoolListRoutes: {
    list: () => '/school-lists',
    byId: (id: string) => `/school-lists/${id}`,
  },
  caseRoutes: {
    list: () => '/cases',
  },
}));

jest.mock('@study-abroad/shared/utils', () => ({
  isSafeUrl: jest.fn(() => true),
}));

// Mock Tabs component to avoid deep rendering complexity
jest.mock('@/components/ui/Tabs', () => ({
  Tabs: ({ tabs }: { tabs: Array<{ key: string; label: string }> }) => {
    const { View, Text } = require('react-native');
    return (
      <View>
        {tabs.map((tab: { key: string; label: string }) => (
          <Text key={tab.key}>{tab.label}</Text>
        ))}
      </View>
    );
  },
}));

import { apiClient } from '@/lib/api/client';
import SchoolDetailScreen from '@/app/school/[id]';

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

describe('SchoolDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading skeleton while fetching', () => {
    // Return a promise that never resolves to stay in loading state
    (apiClient.get as jest.Mock).mockReturnValue(new Promise(() => {}));

    const { toJSON } = renderWithProviders(<SchoolDetailScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows error state when school is not found', async () => {
    (apiClient.get as jest.Mock).mockRejectedValue(new Error('Not found'));

    const { getByText } = renderWithProviders(<SchoolDetailScreen />);

    await waitFor(() => {
      expect(getByText('errors.notFound')).toBeTruthy();
    });
  });

  it('renders school details when data is loaded', async () => {
    const mockSchool = {
      id: 'school-1',
      name: 'Massachusetts Institute of Technology',
      nameZh: 'MIT zhong wen',
      city: 'Cambridge',
      state: 'MA',
      country: 'US',
      logoUrl: null,
      acceptanceRate: 0.038,
      tuition: 57986,
      avgSalary: 104700,
      totalEnrollment: 11934,
      usNewsRank: 1,
      qsRank: 1,
      description: 'A leading research university.',
      website: 'https://mit.edu',
      deadlines: [],
      essayPrompts: [],
      metadata: {},
    };

    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/schools/school-1') return Promise.resolve(mockSchool);
      return Promise.resolve({ items: [], total: 0 });
    });

    const { findByText } = renderWithProviders(<SchoolDetailScreen />);

    expect(
      await findByText('Massachusetts Institute of Technology', {}, { timeout: 3000 })
    ).toBeTruthy();
    expect(await findByText('MIT zhong wen', {}, { timeout: 3000 })).toBeTruthy();
    expect(await findByText('Cambridge, MA, US', {}, { timeout: 3000 })).toBeTruthy();
  }, 30_000);

  it('renders stat cards with formatted values', async () => {
    const mockSchool = {
      id: 'school-1',
      name: 'Stanford University',
      city: 'Stanford',
      state: 'CA',
      country: 'US',
      logoUrl: null,
      acceptanceRate: 0.038,
      tuition: 56169,
      avgSalary: 95000,
      totalEnrollment: 17381,
      usNewsRank: 3,
      deadlines: [],
      essayPrompts: [],
      metadata: {},
    };

    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/schools/school-1') return Promise.resolve(mockSchool);
      return Promise.resolve({ items: [], total: 0 });
    });

    const { findByText } = renderWithProviders(<SchoolDetailScreen />);

    expect(await findByText('Stanford University', {}, { timeout: 3000 })).toBeTruthy();
    expect(await findByText('$56,169', {}, { timeout: 3000 })).toBeTruthy();
    expect(await findByText('$95,000', {}, { timeout: 3000 })).toBeTruthy();
    expect(await findByText('17,381', {}, { timeout: 3000 })).toBeTruthy();
  });

  it('renders tab labels for overview, deadlines, essays, and cases', async () => {
    const mockSchool = {
      id: 'school-1',
      name: 'Harvard University',
      city: 'Cambridge',
      state: 'MA',
      country: 'US',
      logoUrl: null,
      acceptanceRate: 0.03,
      tuition: 57261,
      deadlines: [],
      essayPrompts: [],
      metadata: {},
    };

    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/schools/school-1') return Promise.resolve(mockSchool);
      return Promise.resolve({ items: [], total: 0 });
    });

    const { findByText } = renderWithProviders(<SchoolDetailScreen />);

    expect(await findByText('schools.detail.overview', {}, { timeout: 3000 })).toBeTruthy();
    expect(await findByText('schools.detail.deadlines', {}, { timeout: 3000 })).toBeTruthy();
    expect(await findByText('schools.detail.essayPrompts', {}, { timeout: 3000 })).toBeTruthy();
    expect(await findByText('schools.detail.relatedCases', {}, { timeout: 3000 })).toBeTruthy();
  });
});
