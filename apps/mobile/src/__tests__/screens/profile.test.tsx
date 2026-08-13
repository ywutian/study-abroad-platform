import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options?.percentage ? `${key}:${options.percentage}` : key,
    i18n: { language: 'en' },
  }),
}));

jest.mock('@/lib/api/client', () => ({
  apiClient: {
    get: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('@/components/ui', () => {
  const { Text, TouchableOpacity, View } = require('react-native');
  return {
    Button: ({ children, onPress }: { children?: React.ReactNode; onPress?: () => void }) => (
      <TouchableOpacity onPress={onPress}>
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
    Avatar: ({ name }: { name?: string }) => <Text>{name}</Text>,
    Badge: ({ children }: { children?: React.ReactNode }) => <Text>{children}</Text>,
    Loading: () => <Text>Loading</Text>,
    EmptyState: ({ title, description }: { title?: string; description?: string }) => (
      <View>
        <Text>{title}</Text>
        <Text>{description}</Text>
      </View>
    ),
    ConfirmDialog: () => null,
    Card: ({
      children,
      onPress,
      accessibilityLabel,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
      accessibilityLabel?: string;
    }) => (
      <TouchableOpacity onPress={onPress} accessibilityLabel={accessibilityLabel}>
        <View>{children}</View>
      </TouchableOpacity>
    ),
    CardContent: ({ children }: { children?: React.ReactNode }) => <View>{children}</View>,
    CardHeader: ({ children }: { children?: React.ReactNode }) => <View>{children}</View>,
    CardTitle: ({ children }: { children?: React.ReactNode }) => <Text>{children}</Text>,
  };
});

jest.mock('@/components/ui/ListItem', () => {
  const { Text, TouchableOpacity, View } = require('react-native');
  return {
    ListItem: ({
      title,
      onPress,
      rightElement,
    }: {
      title?: string;
      onPress?: () => void;
      rightElement?: React.ReactNode;
    }) => (
      <TouchableOpacity onPress={onPress}>
        <Text>{title}</Text>
        {rightElement}
      </TouchableOpacity>
    ),
    ListGroup: ({ children }: { children?: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock('@/components/ui/Progress', () => {
  const { Text } = require('react-native');
  return {
    CircularProgress: () => <Text>CircularProgress</Text>,
  };
});

jest.mock('@/stores', () => ({
  useAuthStore: jest.fn(() => ({
    user: { id: '1', email: 'test@example.com', role: 'USER' },
    isAuthenticated: true,
    logout: jest.fn(),
  })),
  useThemeStore: jest.fn(() => ({
    colorScheme: 'light',
  })),
}));

import { router } from 'expo-router';
import { apiClient } from '@/lib/api/client';
import ProfileScreen from '@/app/(tabs)/profile';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the application analysis summary card without auto-fetching AI analysis', async () => {
    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/verification/status')) {
        return Promise.resolve({ emailVerified: true, identityVerified: false });
      }
      if (url.includes('/profiles/me')) {
        return Promise.resolve({
          visibility: 'PRIVATE',
          testScores: [],
          activities: [],
          awards: [],
          education: [],
          essays: [],
        });
      }
      return Promise.resolve({});
    });

    const { findByText } = renderWithProviders(<ProfileScreen />);

    expect(await findByText('applicationAnalysis.summaryCard.title')).toBeTruthy();
    expect(await findByText('applicationAnalysis.empty.description')).toBeTruthy();
    expect(apiClient.get).not.toHaveBeenCalledWith(
      expect.stringContaining('/profiles/me/ai-analysis'),
      expect.anything()
    );
  }, 30_000);

  it('navigates to /profile/analysis from the summary card', async () => {
    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/verification/status')) {
        return Promise.resolve({ emailVerified: true, identityVerified: false });
      }
      if (url.includes('/profiles/me')) {
        return Promise.resolve({
          visibility: 'PRIVATE',
          testScores: [],
          activities: [],
          awards: [],
          education: [],
          essays: [],
        });
      }
      return Promise.resolve({});
    });

    const { findByLabelText } = renderWithProviders(<ProfileScreen />);

    fireEvent.press(await findByLabelText('applicationAnalysis.summaryCard.open'));

    expect(router.push).toHaveBeenCalledWith('/profile/analysis');
  });
});
