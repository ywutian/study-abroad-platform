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

// Mock API client
jest.mock('@/lib/api/client', () => ({
  apiClient: {
    get: jest.fn().mockResolvedValue([]),
    post: jest.fn().mockResolvedValue({}),
    put: jest.fn().mockResolvedValue({}),
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

// Mock ConfirmDialog to simplify rendering
jest.mock('@/components/ui/ConfirmDialog', () => ({
  ConfirmDialog: () => null,
}));

import { apiClient } from '@/lib/api/client';
import ScoresScreen from '@/app/profile/scores';

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

describe('ScoresScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue([]);

    const { toJSON } = renderWithProviders(<ScoresScreen />);

    await waitFor(() => {
      expect(toJSON()).toBeTruthy();
    });
  });

  it('shows empty state when no scores exist', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue([]);

    const { getByText } = renderWithProviders(<ScoresScreen />);

    await waitFor(() => {
      expect(getByText('profile.noScores')).toBeTruthy();
      expect(getByText('profileEdit.noScoresDesc')).toBeTruthy();
    });
  });

  it('shows add score button in empty state', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue([]);

    const { getByText } = renderWithProviders(<ScoresScreen />);

    await waitFor(() => {
      expect(getByText('profile.addScore')).toBeTruthy();
    });
  });

  it('renders score cards when scores exist', async () => {
    const mockScores = [
      {
        id: 'score-1',
        type: 'SAT',
        score: 1520,
        testDate: '2025-10-01',
        subScores: { readingEBRW: 760, math: 760 },
      },
      {
        id: 'score-2',
        type: 'TOEFL',
        score: 115,
        testDate: '2025-09-15',
        subScores: { reading: 30, listening: 29, speaking: 28, writing: 28 },
      },
      {
        id: 'score-3',
        type: 'AP',
        score: 5,
        testDate: null,
        subScores: { subject: 'Calculus BC' },
      },
    ];

    (apiClient.get as jest.Mock).mockResolvedValue(mockScores);

    const { getByText } = renderWithProviders(<ScoresScreen />);

    await waitFor(() => {
      expect(getByText('1520')).toBeTruthy();
      expect(getByText('115')).toBeTruthy();
      expect(getByText('5')).toBeTruthy();
    });
  });

  it('displays AP subject name when available', async () => {
    const mockScores = [
      {
        id: 'score-1',
        type: 'AP',
        score: 5,
        testDate: null,
        subScores: { subject: 'Physics C: Mechanics' },
      },
    ];

    (apiClient.get as jest.Mock).mockResolvedValue(mockScores);

    const { getByText } = renderWithProviders(<ScoresScreen />);

    await waitFor(() => {
      expect(getByText('Physics C: Mechanics')).toBeTruthy();
    });
  });
});
