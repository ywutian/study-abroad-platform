import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VaultItemType } from '@study-abroad/shared';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(),
}));

jest.mock('@/lib/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('@/components/ui/Toast', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  }),
}));

import { apiClient } from '@/lib/api/client';
import VaultScreen from '@/screens/vault/VaultScreen';

describe('Vault sensitive state closure', () => {
  let appStateListener: ((state: AppStateStatus) => void) | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    appStateListener = undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, listener) => {
      if (event === 'change') appStateListener = listener;
      return { remove: jest.fn() };
    });

    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/vaults/stats') {
        return Promise.resolve({
          totalItems: 1,
          credentialCount: 1,
          documentCount: 0,
          categories: ['testing'],
        });
      }
      if (url === '/vaults') {
        return Promise.resolve([
          {
            id: 'vault-1',
            type: VaultItemType.CREDENTIAL,
            title: 'Closure Credential',
            category: 'testing',
            updatedAt: '2026-07-19T00:00:00.000Z',
          },
        ]);
      }
      if (url === '/vaults/vault-1') {
        return Promise.resolve({
          id: 'vault-1',
          type: VaultItemType.CREDENTIAL,
          title: 'Closure Credential',
          category: 'testing',
          data: 'super-secret-value',
          updatedAt: '2026-07-19T00:00:00.000Z',
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('clears decrypted detail when the application leaves the foreground', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <VaultScreen />
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByText('Closure Credential')).toBeTruthy());
    fireEvent.press(screen.getByText('Closure Credential'));
    await waitFor(() => expect(screen.getByText('super-secret-value')).toBeTruthy());

    expect(appStateListener).toBeDefined();
    act(() => appStateListener?.('background'));

    expect(screen.queryByText('super-secret-value')).toBeNull();
  });

  it('creates a real vault item instead of injecting demo data', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({ id: 'vault-created' });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <VaultScreen />
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByText('Closure Credential')).toBeTruthy());
    fireEvent.press(screen.getByText('vault.add'));
    fireEvent.changeText(screen.getByLabelText('vault.itemTitle'), 'Visa portal');
    fireEvent.changeText(screen.getByLabelText('vault.category'), 'immigration');
    fireEvent.changeText(screen.getByLabelText('vault.content'), 'secret-value');
    fireEvent.press(screen.getByText('common.save'));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith('/vaults', {
        title: 'Visa portal',
        category: 'immigration',
        data: 'secret-value',
        type: VaultItemType.CREDENTIAL,
      })
    );
  });
});
