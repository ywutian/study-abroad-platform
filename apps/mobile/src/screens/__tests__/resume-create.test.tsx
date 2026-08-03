import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ResumeFamily, ResumeType, ResumeVariantKind, resumeRoutes } from '@study-abroad/shared';

const mockPush = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock('@/lib/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
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
import ResumeScreen from '@/screens/resume/ResumeScreen';

describe('Resume create closure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.get as jest.Mock).mockResolvedValue([]);
    (apiClient.post as jest.Mock).mockResolvedValue({ id: 'resume-created' });
  });

  it('creates a profile-backed resume and navigates to its native detail screen', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <ResumeScreen />
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getAllByText('resume.create').length).toBeGreaterThan(0));
    fireEvent.press(screen.getAllByText('resume.create')[0]);
    fireEvent.changeText(screen.getByLabelText('resume.name'), 'Common App master');
    fireEvent.press(screen.getAllByText('resume.create').at(-1)!);

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith(resumeRoutes.list(), {
        title: 'Common App master',
        type: ResumeType.COLLEGE_APPLICATION,
        family: ResumeFamily.STUDY_ABROAD,
        variantKind: ResumeVariantKind.MASTER,
        importFromProfile: true,
      })
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/resume/resume-created'));
  });
});
