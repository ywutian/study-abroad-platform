import { SchoolPolicyDimension } from '@prisma/client';

import type {
  ApprovedPolicyEvidence,
  LoadedProfile,
  LoadedSchoolListItem,
} from './profile-application-analysis-v2.helpers';
import { buildPolicyCard } from './profile-application-analysis-v2.helpers';

function makeSchoolListItem(
  overrides: Partial<LoadedSchoolListItem> = {},
): LoadedSchoolListItem {
  return {
    id: 'school-list-item-1',
    schoolId: 'school-1',
    profileId: 'profile-1',
    tier: 'TARGET',
    round: 'RD',
    notes: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    school: {
      id: 'school-1',
      name: 'Example University',
      nameZh: null,
      usNewsRank: null,
      acceptanceRate: null,
      sat25: null,
      sat75: null,
      satAvg: null,
      testingPolicy: null,
      testOptional: null,
      needBlindInternational: null,
      intlAcceptanceRate: null,
      metadata: null,
    },
    ...overrides,
  } as unknown as LoadedSchoolListItem;
}

function makeProfile(overrides: Partial<LoadedProfile> = {}): LoadedProfile {
  return {
    id: 'profile-1',
    citizenship: 'US',
    countryOfResidence: 'US',
    applicationRound: null,
    testScores: [],
    activities: [],
    awards: [],
    education: [],
    essays: [],
    semesterGpas: [],
    ...overrides,
  } as unknown as LoadedProfile;
}

function makeDeadlineEvidence(
  overrides: Partial<ApprovedPolicyEvidence> = {},
): ApprovedPolicyEvidence {
  return {
    id: 'deadline-evidence-1',
    schoolId: 'school-1',
    policyDimension: SchoolPolicyDimension.OTHER,
    policyValue: 'Regular Decision: January 5, 2027',
    sourceName: 'Admissions deadlines page',
    sourceUrl: 'https://example.edu/apply/deadlines',
    sourcePublishedAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-02T00:00:00Z'),
    metadata: null,
    ...overrides,
  } as ApprovedPolicyEvidence;
}

describe('buildPolicyCard', () => {
  it('preserves approved deadline evidence sources and evidenceIds', () => {
    const evidence = makeDeadlineEvidence();

    const { card } = buildPolicyCard(makeSchoolListItem(), makeProfile(), {
      OTHER: evidence,
    });

    expect(card.evidenceIds).toEqual(['deadline-evidence-1']);
    expect(card.sources).toEqual([
      {
        evidenceId: 'deadline-evidence-1',
        dimension: 'DEADLINE',
        label: 'Deadline',
        value: 'Regular Decision: January 5, 2027',
        sourceName: 'Admissions deadlines page',
        sourceUrl: 'https://example.edu/apply/deadlines',
        sourcePublishedAt: '2026-08-01T00:00:00.000Z',
      },
    ]);
    expect(card.policySourceQuality).toBe('REVIEWED');
  });

  it('uses approved deadline evidence before raw school metadata', () => {
    const item = makeSchoolListItem({
      school: {
        ...makeSchoolListItem().school,
        metadata: {
          standardDeadline: 'Regular Decision: January 1, 2027',
          regularDeadline: 'Regular Decision: January 2, 2027',
        },
      },
    });

    const { card } = buildPolicyCard(item, makeProfile(), {
      OTHER: makeDeadlineEvidence({
        policyValue: 'Regular Decision: January 5, 2027',
      }),
    });

    expect(card.standardDeadline).toBe('Regular Decision: January 5, 2027');
  });

  it('does not turn raw metadata deadlines into sourced policy facts', () => {
    const item = makeSchoolListItem({
      school: {
        ...makeSchoolListItem().school,
        metadata: {
          standardDeadline: 'Regular Decision: January 1, 2027',
          regularDeadline: 'Regular Decision: January 2, 2027',
          earlyDeadlinePolicy: 'Early Action: November 1, 2026',
          earlyActionPolicy: 'EA available',
        },
      },
    });

    const { card } = buildPolicyCard(item, makeProfile());

    expect(card.standardDeadline).toBeUndefined();
    expect(card.earlyDeadlinePolicy).toBeUndefined();
    expect(card.sources).toEqual([]);
    expect(card.evidenceIds).toEqual([]);
    expect(card.policySourceQuality).toBe('DERIVED');
  });

  it('does not treat raw school policy fields as reviewed external policy evidence', () => {
    const item = makeSchoolListItem({
      school: {
        ...makeSchoolListItem().school,
        testingPolicy: 'OPTIONAL',
        testOptional: true,
        needBlindInternational: true,
      },
    });

    const { card } = buildPolicyCard(
      item,
      makeProfile({
        citizenship: 'CN',
        countryOfResidence: 'CN',
      }),
    );

    expect(card.testingPolicy).toBe('UNKNOWN');
    expect(card.intlAidPolicy).toBe('UNKNOWN');
    expect(card.roundContext).toBe('RD');
    expect(card.sources).toEqual([]);
    expect(card.evidenceIds).toEqual([]);
    expect(card.policySourceQuality).toBe('DERIVED');
    expect(card.unknowns).toEqual(
      expect.arrayContaining(['testingPolicy', 'intlAidPolicy']),
    );
  });

  it('keeps raw fallback visibly unknown when no policy evidence or derived policy exists', () => {
    const { card } = buildPolicyCard(
      makeSchoolListItem({ round: null }),
      makeProfile(),
    );

    expect(card.sources).toEqual([]);
    expect(card.evidenceIds).toEqual([]);
    expect(card.policySourceQuality).toBe('UNKNOWN');
  });
});
