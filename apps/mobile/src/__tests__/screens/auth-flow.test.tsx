import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockLogin = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockToastSuccess = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
    back: (...args: unknown[]) => mockBack(...args),
  },
}));

jest.mock('@/stores', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ login: (...args: unknown[]) => mockLogin(...args) }),
}));

jest.mock('@/components/ui/Toast', () => ({
  useToast: () => ({
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: jest.fn(),
  }),
}));

jest.mock('@/lib/api/client', () => ({
  apiClient: { post: jest.fn() },
}));

import { authRoutes } from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import LoginScreen from '@/app/(auth)/login';
import ForgotPasswordScreen from '@/app/(auth)/forgot-password';

describe('Mobile authentication closure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogin.mockResolvedValue(undefined);
    (apiClient.post as jest.Mock).mockResolvedValue({ ok: true });
  });

  it('validates credentials and completes login through the auth store', async () => {
    render(<LoginScreen />);

    fireEvent.press(screen.getByText('auth.login.loginButton'));
    expect(screen.getByText('auth.errors.emailRequired')).toBeTruthy();
    expect(screen.getByText('auth.errors.passwordRequired')).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('auth.login.email'), 'student@example.com');
    fireEvent.changeText(screen.getByLabelText('auth.login.password'), 'ValidPass1!');
    fireEvent.press(screen.getByText('auth.login.loginButton'));

    await waitFor(() =>
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'student@example.com',
        password: 'ValidPass1!',
      })
    );
    expect(mockToastSuccess).toHaveBeenCalledWith('auth.login.loginSuccess');
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });

  it('submits a valid forgot-password request and renders the sent state', async () => {
    render(<ForgotPasswordScreen />);

    fireEvent.changeText(screen.getByLabelText('auth.login.email'), 'student@example.com');
    fireEvent.press(screen.getByText('auth.resetPassword.sendLink'));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith(
        authRoutes.forgotPassword(),
        { email: 'student@example.com' },
        { skipAuth: true }
      )
    );
    expect(screen.getByText('auth.verifyEmail.description')).toBeTruthy();
    expect(mockToastSuccess).toHaveBeenCalledWith('auth.resetPassword.sent');
  });
});
