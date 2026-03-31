import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'en' },
  }),
}));

// Mock expo-router (override the global setup to provide id param)
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  Stack: {
    Screen: ({ options }: { options: Record<string, unknown> }) => null,
  },
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'conv-1' }),
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
    user: { id: 'user-1', email: 'me@example.com', role: 'USER' },
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
  }),
}));

// Mock Haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success' },
}));

// Mock useChatSocket
jest.mock('@/hooks/useChatSocket', () => ({
  useChatSocket: () => ({
    isConnected: true,
    sendMessage: jest.fn().mockResolvedValue({ id: 'msg-1', content: 'test' }),
    joinConversation: jest.fn(),
    markRead: jest.fn(),
    sendTyping: jest.fn(),
    getTypingUsers: jest.fn(() => []),
    isUserOnline: jest.fn(() => false),
  }),
}));

// Mock date-fns (avoid import issues)
jest.mock('date-fns', () => ({
  format: jest.fn((_date: Date, fmt: string) => '12:00'),
  isToday: jest.fn(() => true),
  isYesterday: jest.fn(() => false),
  isSameDay: jest.fn(() => true),
}));

import { apiClient } from '@/lib/api/client';
import ChatScreen from '@/app/chat/[id]';

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

describe('ChatScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing when conversation is loading', () => {
    // API returns a promise that never resolves (simulates loading)
    (apiClient.get as jest.Mock).mockReturnValue(new Promise(() => {}));

    const { toJSON } = renderWithProviders(<ChatScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows error state when conversation is not found', async () => {
    (apiClient.get as jest.Mock).mockRejectedValue(new Error('Not found'));

    const { getByText } = renderWithProviders(<ChatScreen />);

    await waitFor(() => {
      expect(getByText('errors.notFound')).toBeTruthy();
    });
  });

  it('renders empty conversation message when no messages', async () => {
    const mockConversation = {
      id: 'conv-1',
      participants: [
        { userId: 'user-1', user: { id: 'user-1', email: 'me@example.com' } },
        { userId: 'user-2', user: { id: 'user-2', email: 'other@example.com' } },
      ],
      messages: [],
    };

    (apiClient.get as jest.Mock).mockResolvedValue(mockConversation);

    const { getByText } = renderWithProviders(<ChatScreen />);

    await waitFor(() => {
      expect(getByText('chat.noMessages')).toBeTruthy();
    });
  });

  it('renders messages when conversation has data', async () => {
    const mockConversation = {
      id: 'conv-1',
      participants: [
        { userId: 'user-1', user: { id: 'user-1', email: 'me@example.com' } },
        { userId: 'user-2', user: { id: 'user-2', email: 'other@example.com' } },
      ],
      messages: [
        {
          id: 'msg-1',
          senderId: 'user-2',
          content: 'Hello there!',
          createdAt: '2026-03-30T10:00:00Z',
          read: false,
        },
        {
          id: 'msg-2',
          senderId: 'user-1',
          content: 'Hi! How are you?',
          createdAt: '2026-03-30T10:01:00Z',
          read: true,
        },
      ],
    };

    (apiClient.get as jest.Mock).mockResolvedValue(mockConversation);

    const { getByText } = renderWithProviders(<ChatScreen />);

    await waitFor(() => {
      expect(getByText('Hello there!')).toBeTruthy();
      expect(getByText('Hi! How are you?')).toBeTruthy();
    });
  });

  it('renders the text input area', async () => {
    const mockConversation = {
      id: 'conv-1',
      participants: [
        { userId: 'user-1', user: { id: 'user-1', email: 'me@example.com' } },
        { userId: 'user-2', user: { id: 'user-2', email: 'other@example.com' } },
      ],
      messages: [],
    };

    (apiClient.get as jest.Mock).mockResolvedValue(mockConversation);

    const { getByPlaceholderText } = renderWithProviders(<ChatScreen />);

    await waitFor(() => {
      expect(getByPlaceholderText('chat.typeMessage')).toBeTruthy();
    });
  });
});
