import {
  buildMemberHighlights,
  getApHighlightTone,
  getVisibleDisplaySettings,
} from './team-recruitment-highlights';

describe('team recruitment highlights', () => {
  const memberUser = {
    profile: {
      testScores: [
        { id: 'sat-1', type: 'SAT', score: 1580 },
        { id: 'ap-1', type: 'AP', subject: 'Lang', score: 5 },
        { id: 'ap-2', type: 'AP', subject: 'Statistics', score: 3 },
        { id: 'ap-3', type: 'AP', subject: 'Calc BC', score: 2 },
      ],
      awards: [
        {
          id: 'school-award',
          name: 'School Debate Award',
          level: 'SCHOOL',
          year: 2024,
        },
        {
          id: 'intl-award',
          name: 'WUDC Semi-finalist',
          level: 'INTERNATIONAL',
          year: 2025,
        },
      ],
      activities: [{ id: 'activity-1', name: 'Debate Club', role: 'Captain' }],
    },
    assessmentResults: [
      { id: 'mbti-1', assessment: { type: 'MBTI' }, result: { type: 'entp' } },
      {
        id: 'holland-1',
        assessment: { type: 'HOLLAND' },
        result: { codes: ['E', 'A', 'S'] },
      },
    ],
  };

  const memberProfile = {
    showAcademics: true,
    showExperiences: true,
    showPersonality: true,
    consentConfirmedAt: new Date('2026-04-29T00:00:00.000Z'),
    selectedResume: {
      sections: [
        {
          id: 'resume-scores',
          type: 'TEST_SCORES',
          content: {
            items: [
              { id: 'resume-ap', type: 'AP', subject: 'Micro', score: 4 },
            ],
          },
        },
        {
          id: 'resume-activity',
          type: 'PROJECTS',
          content: {
            items: [{ id: 'resume-project', title: 'AI Debate Prep Tool' }],
          },
        },
      ],
    },
  };

  it('extracts academics, experiences, and personality from profile sources', () => {
    const result = buildMemberHighlights(memberUser, memberProfile, {
      requireConsent: true,
    });

    expect(result.academics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'SAT 1580', tone: 'neutral' }),
        expect.objectContaining({ label: 'AP Lang 5', tone: 'success' }),
        expect.objectContaining({ label: 'AP Statistics 3', tone: 'warning' }),
        expect.objectContaining({ label: 'AP Calc BC 2', tone: 'danger' }),
      ]),
    );
    expect(result.experiences[0]).toEqual(
      expect.objectContaining({
        label: '2025 WUDC Semi-finalist',
        source: 'AWARD',
      }),
    );
    expect(result.personality).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'ENTP' }),
        expect.objectContaining({ label: 'Holland EAS' }),
      ]),
    );
  });

  it('requires confirmed consent when serializing for public decks', () => {
    const unconfirmedProfile = {
      ...memberProfile,
      consentConfirmedAt: null,
    };

    expect(
      buildMemberHighlights(memberUser, unconfirmedProfile, {
        requireConsent: true,
      }),
    ).toEqual({
      academics: [],
      experiences: [],
      personality: [],
    });
    expect(
      buildMemberHighlights(memberUser, unconfirmedProfile, {
        requireConsent: false,
      }).academics,
    ).not.toEqual([]);
    expect(
      getVisibleDisplaySettings(unconfirmedProfile, { requireConsent: true }),
    ).toEqual({
      showAcademics: false,
      showExperiences: false,
      showPersonality: false,
    });
  });

  it('returns empty arrays when a category is not authorized or no data exists', () => {
    expect(
      buildMemberHighlights(
        {},
        { showAcademics: true, showExperiences: false },
        {},
      ),
    ).toEqual({
      academics: [],
      experiences: [],
      personality: [],
    });
  });

  it('keeps the AP tone thresholds stable', () => {
    expect(getApHighlightTone(5)).toBe('success');
    expect(getApHighlightTone(4)).toBe('success');
    expect(getApHighlightTone(3)).toBe('warning');
    expect(getApHighlightTone(2)).toBe('danger');
    expect(getApHighlightTone(1)).toBe('danger');
    expect(getApHighlightTone(undefined)).toBe('neutral');
  });
});
