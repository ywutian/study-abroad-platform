import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockSetMode = jest.fn();
const mockUpdatePreferences = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'zh', changeLanguage: jest.fn() },
  }),
}));

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), replace: jest.fn() },
}));

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('expo-store-review', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(false),
  requestReview: jest.fn(),
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn().mockResolvedValue(false),
  isEnrolledAsync: jest.fn().mockResolvedValue(false),
  authenticateAsync: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('@/stores', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1', email: 'student@example.com' },
    isAuthenticated: true,
    logout: jest.fn(),
  }),
}));

jest.mock('@/stores/theme', () => ({
  useThemeStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = {
      colorScheme: 'light',
      colorPalette: 'cobalt-saas',
      setMode: (...args: unknown[]) => mockSetMode(...args),
    };
    return selector ? selector(state) : state;
  },
}));

jest.mock('@/hooks/useNotifications', () => ({
  useNotificationPreferences: () => ({
    preferences: { readiness: { remotePush: false } },
    updatePreferences: (...args: unknown[]) => mockUpdatePreferences(...args),
  }),
}));

jest.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));

jest.mock('@/lib/api/client', () => ({
  apiClient: { delete: jest.fn() },
}));

import SettingsScreen from '@/screens/settings/SettingsScreen';

describe('Settings screen closure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdatePreferences.mockResolvedValue(undefined);
  });

  it('exposes labeled settings without a retired subscription badge', async () => {
    render(<SettingsScreen />);

    await waitFor(() => expect(screen.getByText('settings.accountSecurity')).toBeTruthy());
    expect(screen.getByLabelText('settings.darkMode')).toBeTruthy();
    expect(screen.getByLabelText('settings.pushNotification')).toBeTruthy();
    expect(screen.queryByText('VIP')).toBeNull();
  });

  it('navigates to account security and persists user-controlled toggles', async () => {
    render(<SettingsScreen />);

    fireEvent.press(screen.getByText('settings.accountSecurity'));
    expect(mockPush).toHaveBeenCalledWith('/security');

    fireEvent(screen.getByLabelText('settings.darkMode'), 'valueChange', true);
    expect(mockSetMode).toHaveBeenCalledWith('dark');

    fireEvent(screen.getByLabelText('settings.pushNotification'), 'valueChange', true);
    await waitFor(() =>
      expect(mockUpdatePreferences).toHaveBeenCalledWith({ readinessRemotePush: true })
    );
  });
});
