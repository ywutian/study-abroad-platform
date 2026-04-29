import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockTranslations: Record<string, string> = {
  'teams.title': 'Teams',
  'teams.recruitment.description': 'Competition recruitment matching workspace',
  'teams.recruitment.tab.match': 'Match',
  'teams.recruitment.tab.matches': 'Matches',
  'teams.recruitment.tab.myTeam': 'My Team',
  'teams.recruitment.swipeDeck.pass': 'Pass',
  'teams.recruitment.swipeDeck.like': 'Like',
  'teams.recruitment.empty.noCard': 'Create your card in My Team first',
  'teams.recruitment.empty.deckEmpty': 'No cards in the deck',
  'teams.recruitment.empty.noMatches': 'No matches yet',
  'teams.recruitment.editor.title': 'Recruitment Editor',
  'teams.recruitment.field.backingTeam': 'Backing team',
  'teams.recruitment.field.createSoloTeam': 'Create Solo Team',
  'teams.recruitment.field.competitionTrack': 'Competition track',
  'teams.recruitment.field.soloTeamName': 'Solo team name',
  'teams.recruitment.field.headline': 'Headline',
  'teams.recruitment.field.detailNote': 'Detail note',
  'teams.recruitment.field.offerRoles': 'Offer roles',
  'teams.recruitment.field.needRoles': 'Need roles',
  'teams.recruitment.field.skillTags': 'Skill tags',
  'teams.recruitment.field.targetSize': 'Target size',
  'teams.recruitment.action.saveCard': 'Save',
  'teams.recruitment.action.createCard': 'Create',
  'teams.recruitment.action.publish': 'Publish',
  'teams.recruitment.display.title': 'My display settings',
  'teams.recruitment.display.introLine': 'Intro line',
  'teams.recruitment.display.selectedResume': 'Selected resume',
  'teams.recruitment.display.noResume': 'No resume',
  'teams.recruitment.display.showAcademics': 'Show academics',
  'teams.recruitment.display.showExperiences': 'Show experience',
  'teams.recruitment.display.showPersonality': 'Show personality',
  'teams.recruitment.display.completeProfileHint':
    'Highlights are generated from Profile scores, awards, activities, resumes, and assessments.',
  'teams.recruitment.display.save': 'Save',
  'teams.recruitment.display.confirmConsent': 'Confirm consent',
  'teams.recruitment.card.teamFallback': 'TEAM',
  'teams.recruitment.card.offer': 'Offer',
  'teams.recruitment.card.need': 'Need',
  'teams.recruitment.card.skills': 'Skills',
  'teams.recruitment.card.academics': 'Academics',
  'teams.recruitment.card.experience': 'Experience',
  'teams.recruitment.card.personality': 'Personality',
  'teams.recruitment.card.noHighlights': 'No confirmed profile highlights yet',
  'teams.recruitment.card.memberCount': '{{current}}/{{max}} members',
  'teams.recruitment.card.coordination': 'Coordination details',
  'teams.recruitment.status.LOOKING': 'Looking',
  'teams.recruitment.matchKind.teamUp': 'Team up',
  'teams.recruitment.matchKind.networking': 'Networking',
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const value = mockTranslations[key] ?? key;
      return value
        .replace('{{current}}', String(options?.current ?? ''))
        .replace('{{max}}', String(options?.max ?? ''));
    },
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
        showAcademics: true,
        showExperiences: true,
        showPersonality: true,
        highlights: {
          academics: [{ label: 'SAT 1580', tone: 'neutral', source: 'TEST_SCORE' }],
          experiences: [{ label: '2025 WUDC Semi-finalist', tone: 'neutral', source: 'AWARD' }],
          personality: [{ label: 'ENTP', tone: 'neutral', source: 'ASSESSMENT' }],
        },
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
      expect(screen.getByDisplayValue('Alpha Team')).toBeTruthy();
    });
  });

  it('renders matches with recruitment context metadata', async () => {
    seedTeamsRuntime({ withMatches: true });
    const screen = renderWithProviders(<TeamsScreen />);

    fireEvent.press(screen.getByText('Matches'));

    await waitFor(() => {
      expect(screen.getByText('Beta Team')).toBeTruthy();
      expect(screen.getByText('IMMC / Math Modeling')).toBeTruthy();
      expect(screen.getByText('Team up')).toBeTruthy();
    });
  });

  it('renders recruitment highlights on the match card', async () => {
    const screen = renderWithProviders(<TeamsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Academics')).toBeTruthy();
      expect(screen.getByText('SAT 1580')).toBeTruthy();
      expect(screen.getByText('Experience')).toBeTruthy();
      expect(screen.getByText('2025 WUDC Semi-finalist')).toBeTruthy();
      expect(screen.getByText('Personality')).toBeTruthy();
      expect(screen.getByText('ENTP')).toBeTruthy();
    });
  });

  it('submits mobile display highlight consent settings', async () => {
    const screen = renderWithProviders(<TeamsScreen />);

    fireEvent.press(screen.getByText('My Team'));
    await waitFor(() => {
      expect(screen.getByText('My display settings')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Show academics'));
    fireEvent.press(screen.getByText('Show experience'));
    fireEvent.press(screen.getByText('Show personality'));
    fireEvent.press(screen.getByText('Confirm consent'));

    await waitFor(() => {
      expect(teamService.updateRecruitmentMemberProfile).toHaveBeenCalledWith(
        'mine',
        expect.objectContaining({
          showAcademics: false,
          showExperiences: false,
          showPersonality: false,
          consentConfirmed: true,
        })
      );
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
