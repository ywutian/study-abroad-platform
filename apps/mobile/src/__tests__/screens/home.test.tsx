import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) => {
      if (typeof fallback === 'string') return fallback;
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

// Mock API client
jest.mock('@/lib/api/client', () => ({
  apiClient: {
    get: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    post: jest.fn(),
  },
}));

// Mock stores
jest.mock('@/stores', () => ({
  useAuthStore: jest.fn(() => ({
    user: null,
    isAuthenticated: false,
  })),
  useThemeStore: jest.fn(() => ({
    colorScheme: 'light',
  })),
}));

// Mock case-helpers
jest.mock('@/utils/case-helpers', () => ({
  getResultBadgeVariant: jest.fn(() => 'secondary'),
}));

import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/stores';
import HomeScreen from '@/app/(tabs)/index';

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

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.get as jest.Mock).mockResolvedValue({ items: [], total: 0 });
  });

  it('renders without crashing', () => {
    const { toJSON } = renderWithProviders(<HomeScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows guest welcome when not authenticated', () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: null,
      isAuthenticated: false,
    });

    const { getByText } = renderWithProviders(<HomeScreen />);

    expect(getByText('home.guestWelcome')).toBeTruthy();
    expect(getByText('home.loginPrompt')).toBeTruthy();
  });

  it('shows user welcome when authenticated', () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: { id: '1', email: 'john@example.com', role: 'USER' },
      isAuthenticated: true,
    });

    const { getByText } = renderWithProviders(<HomeScreen />);

    expect(getByText('home.welcomeBack')).toBeTruthy();
    expect(getByText('john')).toBeTruthy();
  });

  it('calls apiClient.get for cases and schools on mount', () => {
    renderWithProviders(<HomeScreen />);

    expect(apiClient.get).toHaveBeenCalledWith('/cases', expect.any(Object));
    expect(apiClient.get).toHaveBeenCalledWith('/schools', expect.any(Object));
  });

  it('displays stats section with placeholder values', () => {
    const { getByText, getAllByText } = renderWithProviders(<HomeScreen />);

    // Stats section
    expect(getByText('home.stats.schools')).toBeTruthy();
    // home.stats.cases may appear in multiple sections — verify at least one exists
    expect(getAllByText('home.stats.cases').length).toBeGreaterThanOrEqual(1);
  });

  it('renders quick action buttons', () => {
    const { getByText } = renderWithProviders(<HomeScreen />);

    expect(getByText('home.features.profile')).toBeTruthy();
    expect(getByText('home.features.prediction')).toBeTruthy();
    expect(getByText('home.features.ranking')).toBeTruthy();
  });
});
