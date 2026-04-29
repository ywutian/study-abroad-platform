import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TeamRecruitmentCardFrontDto } from '@study-abroad/shared';
import { RecruitmentSwipeCard } from './RecruitmentSwipeCard';

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    const labels: Record<string, string> = {
      'card.academics': 'Academics',
      'card.experience': 'Experience',
      'card.personality': 'Personality',
      'card.offer': 'Offer',
      'card.need': 'Need',
      'card.skills': 'Skills',
      'card.noHighlights': 'No confirmed profile highlights yet',
      'card.coordination': 'Coordination details',
      'card.detailExpand': 'Show full description',
      'card.detailCollapse': 'Show less',
      'swipeDeck.like': 'Like',
      'swipeDeck.pass': 'Pass',
      'status.LOOKING': 'Looking',
      'option.online': 'Online',
      'availability.FIVE_TO_TEN_HOURS': '5-10h/wk',
    };
    if (key === 'card.memberCount') return `${values?.current}/${values?.max} members`;
    return labels[key] ?? key;
  },
}));

function createCard(
  overrides: Partial<TeamRecruitmentCardFrontDto> = {}
): TeamRecruitmentCardFrontDto {
  return {
    id: 'card-1',
    recruitmentContextId: 'ctx-1',
    phase: 'PUBLISHED',
    status: 'LOOKING',
    version: 1,
    headline: 'Looking for a debate teammate',
    detailNote: 'Available after school.',
    offerRoles: ['Research'],
    needRoles: ['Speaker'],
    skillTags: ['Debate'],
    availabilityBand: 'FIVE_TO_TEN_HOURS',
    collaborationMode: 'ONLINE',
    timezone: 'UTC+8',
    city: 'Shanghai',
    languages: ['English'],
    intentMode: 'TEAM_UP',
    updatedAt: '2026-04-29T00:00:00.000Z',
    recruitmentContext: {
      id: 'ctx-1',
      name: 'Debate Cup',
      title: 'Debate Cup',
      rolePresets: [],
      minTeamSize: 2,
      maxTeamSize: 4,
      languages: ['English'],
      isActive: true,
      competition: {
        id: 'comp-1',
        name: 'Debate Cup',
        abbreviation: 'DC',
        category: 'Debate',
      },
    },
    team: {
      id: 'team-1',
      name: 'Team Alpha',
      currentSize: 1,
      targetSize: 3,
    },
    members: [
      {
        userId: 'user-1',
        role: 'OWNER',
        displayName: 'Angelina',
        school: 'Shanghai High',
        grade: '12th grade',
        showAcademics: true,
        showExperiences: true,
        showPersonality: true,
        highlights: {
          academics: [
            { label: 'SAT 1580', tone: 'neutral', source: 'TEST_SCORE', sourceId: 'sat-1' },
            { label: 'AP Lang 5', tone: 'success', source: 'TEST_SCORE', sourceId: 'ap-1' },
          ],
          experiences: [{ label: '2025 WUDC Semi-finalist', tone: 'neutral', source: 'AWARD' }],
          personality: [{ label: 'ENTP', tone: 'neutral', source: 'ASSESSMENT' }],
        },
      },
    ],
    ...overrides,
  };
}

describe('RecruitmentSwipeCard', () => {
  it('renders high-signal profile highlights and keeps coordination details collapsed', () => {
    render(<RecruitmentSwipeCard card={createCard()} />);

    expect(screen.getByText('Angelina')).toBeInTheDocument();
    expect(screen.getByText('Academics')).toBeInTheDocument();
    expect(screen.getByText('SAT 1580')).toBeInTheDocument();
    expect(screen.getByText('AP Lang 5')).toBeInTheDocument();
    expect(screen.getByText('Experience')).toBeInTheDocument();
    expect(screen.getByText('2025 WUDC Semi-finalist')).toBeInTheDocument();
    expect(screen.getByText('Personality')).toBeInTheDocument();
    expect(screen.getByText('ENTP')).toBeInTheDocument();
    expect(screen.queryByText('UTC+8')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Coordination details'));

    expect(screen.getByText('UTC+8')).toBeInTheDocument();
  });

  it('shows a neutral empty state when no member highlights are confirmed', () => {
    render(
      <RecruitmentSwipeCard
        card={createCard({
          members: [{ userId: 'user-1', role: 'OWNER', displayName: 'Angelina' }],
        })}
      />
    );

    expect(screen.getByText('No confirmed profile highlights yet')).toBeInTheDocument();
  });
});
