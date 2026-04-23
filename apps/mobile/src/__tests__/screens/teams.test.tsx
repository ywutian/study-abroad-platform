import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

jest.mock('@/stores', () => ({
  useThemeStore: jest.fn(() => ({
    colorScheme: 'light',
  })),
}));

jest.mock('@/components/ui/Toast', () => ({
  useToast: () => ({
    show: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  }),
}));

jest.mock('@/lib/api/client', () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

jest.mock('@/lib/api/services/team', () => ({
  teamService: {
    getRecruitmentContexts: jest.fn(),
    getMyRecruitments: jest.fn(),
    getRecruitmentDeck: jest.fn(),
    getMatches: jest.fn(),
    createRecruitment: jest.fn(),
    updateRecruitment: jest.fn(),
    publishRecruitment: jest.fn(),
    updateRecruitmentMemberProfile: jest.fn(),
    swipeRecruitment: jest.fn(),
  },
}));

import { apiClient } from '@/lib/api/client';
import { teamService } from '@/lib/api/services/team';
import TeamsScreen from '@/screens/teams/TeamsScreen';

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

function createOfficialContext() {
  return {
    id: 'ctx-1',
    name: 'Math Modeling',
    title: 'Math Modeling',
    titleZh: null,
    sourceType: 'OFFICIAL',
    rolePresets: ['Research', 'Design'],
    minTeamSize: 2,
    maxTeamSize: 4,
    languages: ['English'],
    isActive: true,
    isPublished: true,
    competition: {
      id: 'comp-1',
      name: 'IMMC',
      nameZh: null,
      abbreviation: 'IMMC',
    },
  } as const;
}

function createRecruitmentCard(id: string, teamName: string) {
  const context = createOfficialContext();

  return {
    id,
    recruitmentContextId: context.id,
    phase: 'PUBLISHED',
    status: 'LOOKING',
    version: 1,
    headline: `${teamName} headline`,
    detailNote: null,
    offerRoles: ['Research'],
    needRoles: ['Design'],
    skillTags: ['Python'],
    languages: ['English'],
    intentMode: 'TEAM_UP',
    updatedAt: '2026-04-19T00:00:00.000Z',
    recruitmentContext: context,
    team: {
      id: `team-${id}`,
      name: teamName,
      currentSize: 1,
      targetSize: 4,
    },
    members: [
      {
        userId: 'user-1',
        role: 'OWNER',
        displayName: 'Alice',
      },
    ],
  } as const;
}

function seedTeamsRuntime(options?: { withCurrentCard?: boolean; withMatches?: boolean }) {
  const currentCard = createRecruitmentCard('mine', 'Alpha Team');
  const deckCard = createRecruitmentCard('deck', 'Beta Team');

  (teamService.getRecruitmentContexts as jest.Mock).mockResolvedValue({
    items: [createOfficialContext()],
  });
  (teamService.getMyRecruitments as jest.Mock).mockResolvedValue({
    items:
      options?.withCurrentCard === false
        ? []
        : [
            {
              team: {
                id: 'team-mine',
                name: 'Alpha Team',
                memberCount: 1,
                maxMembers: 4,
                myRole: 'OWNER',
              },
              recruitmentCards: [currentCard],
            },
          ],
  });
  (teamService.getRecruitmentDeck as jest.Mock).mockResolvedValue({
    sourceCard: options?.withCurrentCard === false ? null : currentCard,
    items: options?.withCurrentCard === false ? [] : [deckCard],
  });
  (teamService.getMatches as jest.Mock).mockResolvedValue({
    items: options?.withMatches
      ? [
          {
            id: 'match-1',
            matchKind: 'TEAM_UP',
            otherCard: deckCard,
          },
        ]
      : [],
  });
  (apiClient.get as jest.Mock).mockResolvedValue([]);
}

describe('TeamsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    seedTeamsRuntime();
  });

  it('renders the official recruitment context in the My Team editor', async () => {
    const screen = renderWithProviders(<TeamsScreen />);

    fireEvent.press(screen.getByText('My Team'));

    await waitFor(() => {
      expect(screen.getByText('Recruitment Editor')).toBeTruthy();
      expect(screen.getAllByText('IMMC / Math Modeling').length).toBeGreaterThan(0);
      expect(screen.getByText('Alpha Team')).toBeTruthy();
    });
  });

  it('renders matches with recruitment context metadata', async () => {
    seedTeamsRuntime({ withMatches: true });
    const screen = renderWithProviders(<TeamsScreen />);

    fireEvent.press(screen.getByText('Matches'));

    await waitFor(() => {
      expect(screen.getByText('Beta Team')).toBeTruthy();
      expect(screen.getByText('IMMC / Math Modeling')).toBeTruthy();
      expect(screen.getByText('TEAM_UP')).toBeTruthy();
    });
  });

  it('shows the empty-account guidance when no recruitment card exists', async () => {
    seedTeamsRuntime({ withCurrentCard: false });
    const screen = renderWithProviders(<TeamsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Create your card in My Team first')).toBeTruthy();
    });
  });
});
