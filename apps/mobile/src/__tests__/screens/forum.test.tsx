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
    get: jest.fn().mockResolvedValue({ posts: [], total: 0, hasMore: false }),
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

// Mock FlashList as a FlatList-like component
jest.mock('@shopify/flash-list', () => {
  const { FlatList } = require('react-native');
  return {
    FlashList: FlatList,
  };
});

// Mock shared routes
jest.mock('@study-abroad/shared', () => ({
  API_ROUTES: {
    FORUMS: '/forums',
  },
  forumRoutes: {
    posts: () => '/forums/posts',
    post: (id: string) => `/forums/posts/${id}`,
    postLike: (id: string) => `/forums/posts/${id}/like`,
  },
}));

import { apiClient } from '@/lib/api/client';
import ForumPage from '@/app/forum';

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

describe('ForumPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ posts: [], total: 0, hasMore: false });

    const { toJSON } = renderWithProviders(<ForumPage />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows loading state while fetching posts', () => {
    (apiClient.get as jest.Mock).mockReturnValue(new Promise(() => {}));

    const { getByText } = renderWithProviders(<ForumPage />);

    expect(getByText('forum.loading')).toBeTruthy();
  });

  it('shows empty state when no posts exist', async () => {
    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/categories')) return Promise.resolve([]);
      if (url.includes('/stats'))
        return Promise.resolve({ totalPosts: 0, totalComments: 0, totalUsers: 0, todayPosts: 0 });
      return Promise.resolve({ posts: [], total: 0, hasMore: false });
    });

    const { getByText } = renderWithProviders(<ForumPage />);

    await waitFor(() => {
      expect(getByText('forum.noPosts')).toBeTruthy();
      expect(getByText('forum.noPostsDesc')).toBeTruthy();
    });
  });

  it('renders post cards when data is available', async () => {
    const mockPosts = {
      posts: [
        {
          id: 'post-1',
          categoryId: 'cat-1',
          category: {
            id: 'cat-1',
            name: 'Admissions',
            nameZh: '',
            description: '',
            descriptionZh: '',
            icon: 'school',
            color: '#3b82f6',
            postCount: 10,
          },
          author: {
            id: 'u-1',
            name: 'Alice',
            avatar: '',
            isVerified: true,
          },
          title: 'How to write a great personal statement?',
          content: 'Looking for advice on personal statement writing...',
          tags: ['essay', 'advice'],
          isTeamPost: false,
          teamSize: null,
          currentSize: null,
          requirements: null,
          teamDeadline: null,
          teamStatus: null,
          viewCount: 42,
          likeCount: 5,
          commentCount: 3,
          isPinned: false,
          isLocked: false,
          isLiked: false,
          createdAt: '2026-03-01T00:00:00Z',
          updatedAt: '2026-03-01T00:00:00Z',
        },
      ],
      total: 1,
      hasMore: false,
    };

    const mockCategories = [
      {
        id: 'cat-1',
        name: 'Admissions',
        nameZh: '',
        description: '',
        descriptionZh: '',
        icon: 'school',
        color: '#3b82f6',
        postCount: 10,
      },
    ];

    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/categories')) return Promise.resolve(mockCategories);
      if (url.includes('/stats'))
        return Promise.resolve({ totalPosts: 1, totalComments: 3, totalUsers: 5, todayPosts: 1 });
      return Promise.resolve(mockPosts);
    });

    const { getByText } = renderWithProviders(<ForumPage />);

    await waitFor(() => {
      expect(getByText('How to write a great personal statement?')).toBeTruthy();
    });
  });

  it('calls apiClient.get for categories, stats, and posts on mount', () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ posts: [], total: 0, hasMore: false });

    renderWithProviders(<ForumPage />);

    expect(apiClient.get).toHaveBeenCalledWith(
      expect.stringContaining('/forums'),
      expect.anything()
    );
  });
});
