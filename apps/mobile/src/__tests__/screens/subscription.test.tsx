import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
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
    get: jest.fn().mockResolvedValue(null),
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
  subscriptionRoutes: {
    plans: () => '/subscriptions/plans',
    current: () => '/subscriptions/me',
    invoices: () => '/subscriptions/billing-history',
    subscribe: () => '/subscriptions/subscribe',
    cancel: () => '/subscriptions/cancel',
  },
}));

import { apiClient } from '@/lib/api/client';
import SubscriptionPage from '@/app/subscription';

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

describe('SubscriptionPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    (apiClient.get as jest.Mock).mockResolvedValue(null);

    const { toJSON } = renderWithProviders(<SubscriptionPage />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows loading state while fetching plans and subscription', () => {
    (apiClient.get as jest.Mock).mockReturnValue(new Promise(() => {}));

    const { getByText } = renderWithProviders(<SubscriptionPage />);

    expect(getByText('Loading subscription...')).toBeTruthy();
  });

  it('renders plan cards when plans data is loaded', async () => {
    const mockPlans = [
      {
        id: 'plan-free',
        name: 'Free',
        price: 0,
        currency: 'USD',
        period: 'monthly',
        features: ['Basic access', 'Community forum'],
      },
      {
        id: 'plan-pro',
        name: 'Pro',
        price: 999,
        currency: 'USD',
        period: 'monthly',
        features: ['All free features', 'AI predictions', 'Essay review'],
      },
      {
        id: 'plan-premium',
        name: 'Premium',
        price: 1999,
        currency: 'USD',
        period: 'monthly',
        features: ['All pro features', 'Priority support', 'Unlimited AI'],
      },
    ];

    const mockSub = {
      userId: '1',
      plan: 'free',
      planDetails: mockPlans[0],
      startDate: '2026-01-01T00:00:00Z',
      endDate: null,
      isActive: true,
      autoRenew: false,
    };

    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/plans')) return Promise.resolve(mockPlans);
      if (url.includes('/me')) return Promise.resolve(mockSub);
      if (url.includes('/billing-history')) return Promise.resolve([]);
      return Promise.resolve(null);
    });

    const { getAllByText, getByText } = renderWithProviders(<SubscriptionPage />);

    await waitFor(() => {
      // "Free" may appear multiple times (plan name + price label), so use getAllByText
      expect(getAllByText('Free').length).toBeGreaterThanOrEqual(1);
      expect(getByText('Pro')).toBeTruthy();
      expect(getByText('Premium')).toBeTruthy();
    });
  });

  it('renders period toggle with Monthly and Yearly options', async () => {
    const mockPlans = [
      {
        id: 'plan-free',
        name: 'Free',
        price: 0,
        currency: 'USD',
        period: 'monthly',
        features: ['Basic access'],
      },
    ];

    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/plans')) return Promise.resolve(mockPlans);
      if (url.includes('/me'))
        return Promise.resolve({
          userId: '1',
          plan: 'free',
          planDetails: mockPlans[0],
          startDate: '2026-01-01T00:00:00Z',
          endDate: null,
          isActive: true,
          autoRenew: false,
        });
      return Promise.resolve(null);
    });

    const { getByText } = renderWithProviders(<SubscriptionPage />);

    await waitFor(() => {
      expect(getByText('Monthly')).toBeTruthy();
      expect(getByText('Yearly')).toBeTruthy();
    });
  });

  it('renders hero section with title and subtitle', async () => {
    const mockPlans = [
      {
        id: 'plan-free',
        name: 'Free',
        price: 0,
        currency: 'USD',
        period: 'monthly',
        features: ['Basic access'],
      },
    ];

    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/plans')) return Promise.resolve(mockPlans);
      if (url.includes('/me'))
        return Promise.resolve({
          userId: '1',
          plan: 'free',
          planDetails: mockPlans[0],
          startDate: '2026-01-01T00:00:00Z',
          endDate: null,
          isActive: true,
          autoRenew: false,
        });
      return Promise.resolve(null);
    });

    const { getByText } = renderWithProviders(<SubscriptionPage />);

    await waitFor(() => {
      expect(getByText('Choose the plan that fits your needs')).toBeTruthy();
    });
  });
});
