import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  ResumeFamily,
  ResumeSectionType,
  ResumeStatus,
  ResumeType,
  ResumeVariantKind,
  resumeRoutes,
  type Resume,
} from '@study-abroad/shared';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'resume-1' }),
  router: { back: jest.fn() },
}));

jest.mock('@/lib/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    put: jest.fn(),
    post: jest.fn(),
  },
}));

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

jest.mock('@/components/ui/Toast', () => ({
  useToast: () => ({
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    info: jest.fn(),
    warning: jest.fn(),
  }),
}));

import { apiClient } from '@/lib/api/client';
import ResumeDetailScreen from '@/screens/resume/ResumeDetailScreen';

const resumeFixture = {
  id: 'resume-1',
  userId: 'user-1',
  title: 'Application resume',
  status: ResumeStatus.DRAFT,
  type: ResumeType.COLLEGE_APPLICATION,
  family: ResumeFamily.STUDY_ABROAD,
  variantKind: ResumeVariantKind.MASTER,
  templateId: 'classic',
  language: 'en',
  settings: {},
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  sections: [
    {
      id: 'section-education',
      resumeId: 'resume-1',
      type: ResumeSectionType.EDUCATION,
      title: 'Education',
      content: { school: 'Example High School' },
      isVisible: true,
      order: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'section-awards',
      resumeId: 'resume-1',
      type: ResumeSectionType.AWARDS,
      title: 'Awards',
      content: { items: ['National finalist'] },
      isVisible: true,
      order: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
} satisfies Resume;

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ResumeDetailScreen />
    </QueryClientProvider>
  );
}

describe('Resume detail closure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.get as jest.Mock).mockResolvedValue(resumeFixture);
    (apiClient.put as jest.Mock).mockResolvedValue(resumeFixture);
    (apiClient.post as jest.Mock).mockResolvedValue(resumeFixture);
  });

  it('loads the native preview and persists title, visibility, and order changes', async () => {
    renderScreen();

    await waitFor(() => expect(screen.getByText('Application resume')).toBeTruthy());
    expect(screen.getByText('Education')).toBeTruthy();
    expect(screen.getByText('Example High School')).toBeTruthy();
    expect(screen.getByText('Awards')).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('resume.name'), 'Updated resume');
    fireEvent.press(screen.getByText('common.save'));
    await waitFor(() =>
      expect(apiClient.put).toHaveBeenCalledWith(resumeRoutes.byId('resume-1'), {
        title: 'Updated resume',
        status: ResumeStatus.DRAFT,
      })
    );

    fireEvent(screen.getByLabelText('Education'), 'valueChange', false);
    await waitFor(() =>
      expect(apiClient.put).toHaveBeenCalledWith(
        resumeRoutes.section('resume-1', 'section-education'),
        { isVisible: false }
      )
    );

    fireEvent.press(screen.getAllByText('↓')[0]);
    await waitFor(() =>
      expect(apiClient.put).toHaveBeenCalledWith(resumeRoutes.reorderSections('resume-1'), {
        sectionIds: ['section-awards', 'section-education'],
      })
    );
    expect(mockToastError).not.toHaveBeenCalled();
  });
});
