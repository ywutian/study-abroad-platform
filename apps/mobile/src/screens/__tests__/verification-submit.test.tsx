import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VERIFICATION_PROOF_TYPE, verificationRoutes } from '@study-abroad/shared';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  EncodingType: { Base64: 'base64' },
  readAsStringAsync: jest.fn(),
  getInfoAsync: jest.fn(),
}));

jest.mock('@/lib/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
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

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { apiClient } from '@/lib/api/client';
import VerificationScreen from '@/screens/verification/VerificationScreen';

describe('Verification submit closure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url === verificationRoutes.status()) {
        return Promise.resolve({ identityVerified: false, status: 'UNVERIFIED' });
      }
      if (url === verificationRoutes.my()) return Promise.resolve([]);
      if (url === '/cases/me') {
        return Promise.resolve([
          {
            id: 'case-1',
            year: 2026,
            school: { name: 'Stanford University' },
          },
        ]);
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///proof.pdf',
          name: 'offer.pdf',
          size: 1024,
          mimeType: 'application/pdf',
        },
      ],
    });
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('cHJvb2Y=');
    (apiClient.post as jest.Mock).mockResolvedValue({ id: 'verification-1', status: 'PENDING' });
  });

  it('selects the user case, reads the file, and submits the existing DTO', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <VerificationScreen />
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByLabelText('verification.case')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('verification.case'));
    fireEvent.press(screen.getByText('Stanford University · 2026'));
    fireEvent.press(screen.getByText('verification.chooseFile'));
    await waitFor(() => expect(screen.getByText('offer.pdf')).toBeTruthy());
    fireEvent.press(screen.getByText('verification.submit'));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith(verificationRoutes.submit(), {
        caseId: 'case-1',
        proofType: VERIFICATION_PROOF_TYPE.OFFER_LETTER,
        proofData: 'data:application/pdf;base64,cHJvb2Y=',
      })
    );
    expect(FileSystem.readAsStringAsync).toHaveBeenCalledWith('file:///proof.pdf', {
      encoding: FileSystem.EncodingType.Base64,
    });
  });
});
