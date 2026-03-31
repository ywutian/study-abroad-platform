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

// Mock API client
jest.mock('@/lib/api/client', () => ({
  apiClient: {
    get: jest.fn().mockResolvedValue({}),
    post: jest.fn().mockResolvedValue({}),
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

import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/stores';
import PredictionScreen from '@/screens/prediction/PredictionScreen';

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

describe('PredictionScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.get as jest.Mock).mockResolvedValue({});
  });

  it('renders without crashing', () => {
    const { toJSON } = renderWithProviders(<PredictionScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows login required state when not authenticated', () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: null,
      isAuthenticated: false,
    });

    const { getByText } = renderWithProviders(<PredictionScreen />);

    expect(getByText('prediction.empty.loginRequired')).toBeTruthy();
    expect(getByText('prediction.empty.loginRequiredDesc')).toBeTruthy();
  });

  it('shows empty state when no predictions exist', async () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: { id: '1', email: 'test@example.com', role: 'USER' },
      isAuthenticated: true,
    });

    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/predictions/dashboard')) {
        return Promise.resolve({ totalSchools: 0, avgProbability: 0, predictions: [] });
      }
      if (url.includes('/profiles/me')) {
        return Promise.resolve({ completeness: 50 });
      }
      return Promise.resolve({});
    });

    const { getByText } = renderWithProviders(<PredictionScreen />);

    await waitFor(() => {
      expect(getByText('prediction.empty.title')).toBeTruthy();
      expect(getByText('prediction.empty.description')).toBeTruthy();
    });
  });

  it('renders prediction results when data is available', async () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: { id: '1', email: 'test@example.com', role: 'USER' },
      isAuthenticated: true,
    });

    const mockDashboard = {
      totalSchools: 2,
      avgProbability: 0.65,
      predictions: [
        {
          schoolId: 's1',
          school: { name: 'MIT' },
          probability: 0.3,
          tier: 'reach',
          confidence: 'medium',
        },
        {
          schoolId: 's2',
          school: { name: 'UC Berkeley' },
          probability: 0.75,
          tier: 'safety',
          confidence: 'high',
        },
      ],
    };

    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/predictions/dashboard')) {
        return Promise.resolve(mockDashboard);
      }
      if (url.includes('/profiles/me')) {
        return Promise.resolve({ completeness: 85 });
      }
      return Promise.resolve({});
    });

    const { getByText } = renderWithProviders(<PredictionScreen />);

    await waitFor(() => {
      expect(getByText('MIT')).toBeTruthy();
      expect(getByText('UC Berkeley')).toBeTruthy();
    });
  });

  it('renders the header with title and subtitle', () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: { id: '1', email: 'test@example.com', role: 'USER' },
      isAuthenticated: true,
    });

    const { getByText } = renderWithProviders(<PredictionScreen />);

    expect(getByText('prediction.title')).toBeTruthy();
    expect(getByText('prediction.subtitle')).toBeTruthy();
  });
});
