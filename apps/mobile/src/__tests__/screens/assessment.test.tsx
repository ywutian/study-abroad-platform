import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
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
    get: jest.fn().mockResolvedValue(null),
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

// Mock shared routes
jest.mock('@study-abroad/shared', () => ({
  ...jest.requireActual('@study-abroad/shared'),
  API_ROUTES: {
    ASSESSMENTS: '/assessments',
  },
  assessmentRoutes: {
    start: (type: string) => `/assessments/${type}`,
    submit: () => '/assessments',
    results: () => '/assessments/results',
  },
}));

import { apiClient } from '@/lib/api/client';
import AssessmentPage from '@/app/assessment';

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

describe('AssessmentPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.get as jest.Mock).mockResolvedValue(null);
  });

  it('renders without crashing', () => {
    const { toJSON } = renderWithProviders(<AssessmentPage />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows assessment type selection cards on initial render', () => {
    const { getByText } = renderWithProviders(<AssessmentPage />);

    expect(getByText('Choose an Assessment')).toBeTruthy();
    expect(getByText('MBTI Personality')).toBeTruthy();
    expect(getByText('Career Interest')).toBeTruthy();
    expect(getByText('Major Match')).toBeTruthy();
  });

  it('shows View History button in selection view', () => {
    const { getByText } = renderWithProviders(<AssessmentPage />);

    expect(getByText('Assessment History')).toBeTruthy();
  });

  it('shows loading state when quiz is loading after type selection', async () => {
    // Keep the quiz request pending
    (apiClient.get as jest.Mock).mockReturnValue(new Promise(() => {}));

    const { getByText, getAllByText } = renderWithProviders(<AssessmentPage />);

    const startButtons = getAllByText('Start Assessment');
    fireEvent.press(startButtons[0]);

    await waitFor(() => {
      expect(getByText('Loading...')).toBeTruthy();
    });
  });

  it('renders quiz questions after type selection and data load', async () => {
    const mockAssessment = {
      id: 'assess-1',
      type: 'MBTI',
      title: 'MBTI Personality Assessment',
      titleZh: 'MBTI ...',
      description: 'Discover your personality type',
      descriptionZh: '',
      questions: [
        {
          id: 'q1',
          text: 'Do you prefer working alone or in groups?',
          textZh: '',
          options: [
            { value: 'A', text: 'Alone', textZh: '' },
            { value: 'B', text: 'In groups', textZh: '' },
          ],
          dimension: 'E-I',
        },
        {
          id: 'q2',
          text: 'Do you focus on facts or possibilities?',
          textZh: '',
          options: [
            { value: 'A', text: 'Facts', textZh: '' },
            { value: 'B', text: 'Possibilities', textZh: '' },
          ],
          dimension: 'S-N',
        },
      ],
    };

    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/assessments/MBTI')) return Promise.resolve(mockAssessment);
      return Promise.resolve(null);
    });

    const { getByText, getAllByText } = renderWithProviders(<AssessmentPage />);

    const startButtons = getAllByText('Start Assessment');
    fireEvent.press(startButtons[0]);

    await waitFor(() => {
      expect(getByText('Do you prefer working alone or in groups?')).toBeTruthy();
      expect(getByText('Alone')).toBeTruthy();
      expect(getByText('In groups')).toBeTruthy();
    });
  });

  it('submits completed answers with the existing assessment DTO', async () => {
    const mockAssessment = {
      id: 'assess-1',
      type: 'MBTI',
      title: 'MBTI Personality Assessment',
      titleZh: '',
      description: 'Discover your personality type',
      descriptionZh: '',
      questions: [
        {
          id: 'q1',
          text: 'Do you prefer working alone?',
          textZh: '',
          options: [
            { value: 'A', text: 'Usually alone', textZh: '' },
            { value: 'B', text: 'Usually together', textZh: '' },
          ],
          dimension: 'E-I',
        },
      ],
    };
    const result = {
      id: 'result-1',
      type: 'MBTI',
      mbtiResult: {
        type: 'INTJ',
        title: 'Architect',
        titleZh: '',
        description: 'Strategic and independent.',
        descriptionZh: '',
        scores: { E: 20, I: 80, S: 40, N: 60, T: 70, F: 30, J: 65, P: 35 },
        strengths: ['Strategic thinking'],
        careers: ['Research engineer'],
        majors: ['Computer Science'],
      },
      completedAt: '2026-07-19T00:00:00.000Z',
    };
    (apiClient.get as jest.Mock).mockImplementation((url: string) =>
      url.includes('/assessments/MBTI') ? Promise.resolve(mockAssessment) : Promise.resolve(null)
    );
    (apiClient.post as jest.Mock).mockResolvedValue(result);

    const { getByText, getAllByText } = renderWithProviders(<AssessmentPage />);
    fireEvent.press(getAllByText('Start Assessment')[0]);
    await waitFor(() => expect(getByText('Usually alone')).toBeTruthy());
    fireEvent.press(getByText('Usually alone'));
    await waitFor(() => expect(getByText('Submit')).toBeTruthy());
    fireEvent.press(getByText('Submit'));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
    expect(apiClient.post).toHaveBeenCalledWith('/assessments', {
      type: 'MBTI',
      answers: [{ questionId: 'q1', answer: 'A' }],
    });
  });
});
