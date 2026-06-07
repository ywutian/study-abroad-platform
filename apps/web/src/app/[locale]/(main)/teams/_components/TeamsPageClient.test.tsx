import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resumeRoutes, teamRoutes, type TeamRecruitmentCardFrontDto } from '@study-abroad/shared';
import { TeamsPageClient } from './TeamsPageClient';

const { push, clipboardWriteText, toastSuccess, toastError, authState } = vi.hoisted(() => ({
  push: vi.fn(),
  clipboardWriteText: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  authState: {
    user: { id: 'user-1' } as { id: string } | null,
    accessToken: 'token-1' as string | null,
    isInitialized: true,
  },
}));

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: (
    selector: (state: {
      user: { id: string } | null;
      accessToken: string | null;
      isInitialized: boolean;
    }) => unknown
  ) => selector(authState),
}));

vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push }),
}));

vi.mock('@/lib/api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('@/components/layout', () => ({
  PageContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PageHeader: ({ title, description }: { title: string; description?: string }) => (
    <div>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
  ),
}));

vi.mock('@/components/ui/tabs', async () => {
  const React = await import('react');
  const TabsContext = React.createContext<{
    value: string;
    onValueChange?: (value: string) => void;
  }>({ value: '' });

  return {
    Tabs: ({
      value,
      onValueChange,
      children,
    }: {
      value: string;
      onValueChange?: (value: string) => void;
      children: ReactNode;
    }) => <TabsContext.Provider value={{ value, onValueChange }}>{children}</TabsContext.Provider>,
    TabsList: ({ children }: { children: ReactNode }) => <div role="tablist">{children}</div>,
    TabsTrigger: ({
      value,
      children,
      disabled,
    }: {
      value: string;
      children: ReactNode;
      disabled?: boolean;
    }) => {
      const context = React.useContext(TabsContext);
      return (
        <button
          role="tab"
          disabled={disabled}
          onClick={() => !disabled && context.onValueChange?.(value)}
        >
          {children}
        </button>
      );
    },
    TabsContent: ({ value, children }: { value: string; children: ReactNode }) => {
      const context = React.useContext(TabsContext);
      return context.value === value ? <div role="tabpanel">{children}</div> : null;
    },
  };
});

vi.mock('@/components/features/teams/RecruitmentSwipeDeck', () => ({
  RecruitmentSwipeDeck: ({ cards }: { cards: TeamRecruitmentCardFrontDto[] }) => (
    <div data-testid="swipe-deck">{cards.length}</div>
  ),
}));

import { apiClient } from '@/lib/api';

function createCard(
  id: string,
  context: TeamRecruitmentCardFrontDto['recruitmentContext']
): TeamRecruitmentCardFrontDto {
  return {
    id,
    recruitmentContextId: context?.id,
    phase: 'PUBLISHED',
    status: 'LOOKING',
    version: 1,
    headline: `${id} headline`,
    offerRoles: ['Research'],
    needRoles: ['Design'],
    skillTags: ['Pitch'],
    languages: ['English'],
    intentMode: 'TEAM_UP',
    updatedAt: '2026-04-19T00:00:00.000Z',
    recruitmentContext: context,
    team: {
      id: `team-${id}`,
      name: `Team ${id}`,
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
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TeamsPageClient />
    </QueryClientProvider>
  );
}

describe('TeamsPageClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = { id: 'user-1' };
    authState.accessToken = 'token-1';
    window.history.replaceState({}, '', 'http://localhost:3000/teams');
    Object.assign(navigator, {
      clipboard: {
        writeText: clipboardWriteText,
      },
    });

    const officialContext = {
      id: 'ctx-official-1',
      name: 'Entrepreneurship Challenge',
      title: 'Entrepreneurship Challenge',
      subtitle: 'NEC / 2026',
      sourceType: 'OFFICIAL',
      rolePresets: ['Research', 'Pitch'],
      minTeamSize: 2,
      maxTeamSize: 4,
      languages: ['English'],
      isActive: true,
      isPublished: true,
      competitionId: 'comp-1',
      competition: {
        id: 'comp-1',
        name: 'National Economics Challenge',
        abbreviation: 'NEC',
        category: 'ECON',
      },
      edition: {
        id: 'edition-1',
        seasonLabel: '2026',
        status: 'ACTIVE',
      },
    } as const;

    const communityContext = {
      id: 'ctx-community-1',
      name: 'Startup Weekend SF',
      title: 'Startup Weekend SF',
      subtitle: 'Hybrid / San Francisco',
      sourceType: 'COMMUNITY',
      moderationStatus: 'APPROVED',
      rolePresets: ['Captain', 'Builder'],
      minTeamSize: 2,
      maxTeamSize: 4,
      languages: ['English'],
      isActive: true,
      isPublished: true,
      locationMode: 'HYBRID',
      locationText: 'San Francisco',
    } as const;

    const myCard = createCard('my-card', officialContext);
    const otherCard = {
      ...createCard('other-card', communityContext),
      members: [
        {
          userId: 'invitee-1',
          role: 'MEMBER',
          displayName: 'Bob',
        },
      ],
    };

    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === teamRoutes.matchPools()) {
        return Promise.resolve({
          items: [{ id: 'pool-1', name: 'Popular Main Competitions', description: null }],
        });
      }
      if (url === teamRoutes.matchPoolById('pool-1')) {
        return Promise.resolve({
          id: 'pool-1',
          name: 'Popular Main Competitions',
          entries: [
            {
              id: 'entry-1',
              entryType: 'OFFICIAL_COMPETITION',
              competitionId: 'comp-1',
              competition: {
                id: 'comp-1',
                name: 'National Economics Challenge',
                abbreviation: 'NEC',
                category: 'ECON',
              },
            },
          ],
        });
      }
      if (
        url ===
        teamRoutes.recruitmentContextsBySourceTypeAndCompetitionId({
          sourceType: 'OFFICIAL',
          competitionId: 'comp-1',
        })
      ) {
        return Promise.resolve({ items: [officialContext] });
      }
      if (url === teamRoutes.communityContexts()) {
        return Promise.resolve({ items: [] });
      }
      if (url === teamRoutes.myRecruitments()) {
        return Promise.resolve({
          items: [
            {
              team: {
                id: 'team-my-card',
                name: 'Founders',
                memberCount: 1,
                maxMembers: 4,
                myRole: 'OWNER',
                visibility: 'PRIVATE',
              },
              recruitmentCards: [myCard],
            },
          ],
        });
      }
      if (url === resumeRoutes.list()) {
        return Promise.resolve([]);
      }
      if (url === teamRoutes.matches()) {
        return Promise.resolve({
          items: [
            {
              id: 'match-1',
              matchKind: 'TEAM_UP',
              createdAt: '2026-04-19T00:00:00.000Z',
              conversationId: 'conv-1',
              canInvite: true,
              myCard,
              otherCard,
            },
          ],
        });
      }
      if (url === teamRoutes.recruitmentDeck()) {
        return Promise.resolve({
          sourceCard: myCard,
          items: [otherCard],
        });
      }
      if (url === teamRoutes.recruitmentDeckPreview()) {
        return Promise.resolve({
          sourceCard: null,
          items: [otherCard],
        });
      }

      return Promise.resolve({ items: [] });
    });

    vi.mocked(apiClient.post).mockImplementation((url: string) => {
      if (url === teamRoutes.communityContexts()) {
        return Promise.resolve({
          id: 'ctx-community-new',
          name: 'Startup Weekend SF',
          title: 'Startup Weekend SF',
          subtitle: 'Hybrid / San Francisco',
          sourceType: 'COMMUNITY',
          moderationStatus: 'PENDING_REVIEW',
          rolePresets: ['Captain', 'Builder'],
          minTeamSize: 2,
          maxTeamSize: 4,
          languages: ['English'],
          isActive: true,
          isPublished: false,
        });
      }
      if (url === teamRoutes.matchInviteMembers('match-1')) {
        return Promise.resolve({
          invitations: [
            {
              inviteeId: 'invitee-1',
              status: 'SENT',
              notificationSent: false,
              inviteUrl: '/teams/join?token=token-1',
            },
          ],
        });
      }

      return Promise.resolve({});
    });

    vi.mocked(apiClient.patch).mockResolvedValue({});
    clipboardWriteText.mockResolvedValue(undefined);
  });

  it('loads the first public pool and shows the canonical recruitment context summary', async () => {
    renderPage();

    expect(await screen.findByText('Popular Main Competitions')).toBeInTheDocument();
    expect((await screen.findAllByText('Entrepreneurship Challenge')).length).toBeGreaterThan(0);
    expect(await screen.findByText('recruitment.copy.officialBadge')).toBeInTheDocument();

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        teamRoutes.recruitmentContextsBySourceTypeAndCompetitionId({
          sourceType: 'OFFICIAL',
          competitionId: 'comp-1',
        })
      );
    });
  }, 20_000);

  it('creates a community context from the private tab using the canonical payload', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('tab', { name: 'recruitment.copy.privateTab' }));

    const titleInput = screen.getAllByRole('textbox')[0];
    fireEvent.change(titleInput, { target: { value: 'Startup Weekend SF' } });
    fireEvent.click(screen.getByRole('button', { name: 'recruitment.copy.createContext' }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(teamRoutes.communityContexts(), {
        title: 'Startup Weekend SF',
        titleZh: undefined,
        description: undefined,
        sourceUrl: undefined,
        registrationCloseAt: undefined,
        eventStartAt: undefined,
        eventEndAt: undefined,
        locationMode: undefined,
        locationText: undefined,
        rolePresets: [],
        minTeamSize: 2,
        maxTeamSize: 4,
        languages: ['English'],
      });
    });
  }, 20_000);

  it('shows invite delivery fallback UI and copies invite links from the matches tab', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('tab', { name: 'recruitment.copy.matchesTab' }));
    fireEvent.click(await screen.findByRole('button', { name: 'recruitment.inviteToTeam' }));

    const copyButton = await screen.findByRole('button', { name: 'inviteResults.copyLink' });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(
        'http://localhost:3000/teams/join?token=token-1'
      );
    });
    expect(toastSuccess).toHaveBeenCalledWith('toast.linkCopied');
  });

  it('submits profile highlight consent settings from My Team', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('tab', { name: 'recruitment.copy.myTeamTab' }));
    fireEvent.click(await screen.findByText('recruitment.display.showAcademics'));
    fireEvent.click(screen.getByText('recruitment.display.showExperiences'));
    fireEvent.click(screen.getByText('recruitment.display.showPersonality'));
    fireEvent.click(screen.getByRole('button', { name: 'recruitment.display.confirmConsent' }));

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith(
        teamRoutes.recruitmentMemberProfile('my-card'),
        expect.objectContaining({
          showAcademics: true,
          showExperiences: true,
          showPersonality: true,
          consentConfirmed: true,
        })
      );
    });
  });

  it('loads public browse data for guests and blocks private tabs', async () => {
    authState.user = null;
    authState.accessToken = null;

    renderPage();

    expect(await screen.findByText('Popular Main Competitions')).toBeInTheDocument();
    expect(await screen.findByText('recruitment.guest.title')).toBeInTheDocument();
    expect(await screen.findByTestId('swipe-deck')).toHaveTextContent('1');

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(teamRoutes.matchPools());
      expect(apiClient.get).toHaveBeenCalledWith(teamRoutes.matchPoolById('pool-1'));
      expect(apiClient.get).toHaveBeenCalledWith(
        teamRoutes.recruitmentContextsBySourceTypeAndCompetitionId({
          sourceType: 'OFFICIAL',
          competitionId: 'comp-1',
        })
      );
      expect(apiClient.get).toHaveBeenCalledWith(teamRoutes.recruitmentDeckPreview(), {
        params: { recruitmentContextId: 'ctx-official-1' },
      });
    });

    expect(screen.getByRole('tab', { name: 'recruitment.copy.privateTab' })).toBeDisabled();
    expect(screen.getByRole('tab', { name: 'recruitment.copy.matchesTab' })).toBeDisabled();
    expect(screen.getByRole('tab', { name: 'recruitment.copy.myTeamTab' })).toBeDisabled();
  });
});
