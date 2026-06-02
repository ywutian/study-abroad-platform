import { SchoolPolicyDimension } from '@prisma/client';

import type {
  ApprovedPolicyEvidence,
  LoadedPrediction,
  LoadedProfile,
  LoadedSchoolListItem,
} from './profile-application-analysis-v2.helpers';
import {
  buildPolicyCard,
  buildPortfolioSummary,
} from './profile-application-analysis-v2.helpers';

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
  };
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

  it('uses raw school policy fields as a DERIVED-tier fallback (not as REVIEWED evidence)', () => {
    // Per docs/APPLICATION_ANALYSIS_WORKFLOW_SOP.md, the policy resolution order
    // is: (1) APPROVED SchoolPolicyEvidence -> 'REVIEWED', (2) backend-derived
    // from raw school fields -> 'DERIVED', (3) nothing -> 'UNKNOWN'.
    //
    // Before 2026-05-25, only roundContext implemented the DERIVED tier — both
    // testingPolicy and intlAidPolicy short-circuited to UNKNOWN whenever no
    // APPROVED evidence was found. That left 30/50 application-analysis gold
    // cases failing the governance gate. This test now verifies the corrected
    // behaviour: raw school fields produce DERIVED-tier values (NOT 'REVIEWED'
    // source quality, so downstream consumers can still distinguish reviewed
    // evidence from data-team-derived defaults), and `sources` / `evidenceIds`
    // remain empty.
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

    expect(card.testingPolicy).toBe('OPTIONAL');
    expect(card.intlAidPolicy).toBe('NEED_BLIND');
    expect(card.roundContext).toBe('RD');
    // Critical invariant: raw school fields must NOT count as REVIEWED evidence.
    expect(card.sources).toEqual([]);
    expect(card.evidenceIds).toEqual([]);
    expect(card.policySourceQuality).toBe('DERIVED');
    // Values were derived, so they are NOT in the `unknowns` audit list.
    expect(card.unknowns).not.toEqual(
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

function makePrediction(
  schoolId: string,
  tier: 'reach' | 'match' | 'safety',
  probability: number,
): LoadedPrediction {
  return {
    schoolId,
    probability,
    probabilityLow: null,
    probabilityHigh: null,
    tier,
    confidence: 'medium',
    applicationRound: null,
    confidenceReason: null,
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  } as unknown as LoadedPrediction;
}

function item(
  schoolId: string,
  storedTier: 'REACH' | 'TARGET' | 'SAFETY',
  tierSource: 'PREDICTED' | 'MANUAL',
  name: string,
): LoadedSchoolListItem {
  return makeSchoolListItem({
    id: `sli-${schoolId}`,
    schoolId,
    tier: storedTier,
    tierSource,
    round: 'RD',
    school: { id: schoolId, name, nameZh: null } as never,
  });
}

/**
 * The portfolio diagnosis must judge the list by the ENGINE's predicted tier,
 * not the student's self-assigned `SchoolListItem.tier` (which for the default
 * PREDICTED rows is just a stale placeholder). These guard the 2026-06 fix:
 * a list the student mislabels as "balanced" should be called what it is, and
 * the absence of a real safety floor must surface as a risk.
 */
describe('buildPortfolioSummary — list shape uses the engine tier, not the stored label', () => {
  const ready = 'ready' as never; // AnalysisState ready path

  it('counts the EFFECTIVE (predicted) tier, so 3 placeholder-TARGET rows that all predict reach are reachHeavy, not balanced', () => {
    const items = [
      item('a', 'TARGET', 'PREDICTED', 'A'),
      item('b', 'TARGET', 'PREDICTED', 'B'),
      item('c', 'TARGET', 'PREDICTED', 'C'),
    ];
    const predictions = new Map<string, LoadedPrediction>([
      ['a', makePrediction('a', 'reach', 0.08)],
      ['b', makePrediction('b', 'reach', 0.1)],
      ['c', makePrediction('c', 'reach', 0.12)],
    ]);

    const summary = buildPortfolioSummary(
      'en',
      ready,
      items,
      items,
      predictions,
    );

    expect(summary.balance).toBe('reachHeavy'); // stale logic would say 'balanced'
  });

  it('EXCLUDES a stale PREDICTED placeholder that has no prediction (it cannot fake the count)', () => {
    const items = [
      item('a', 'TARGET', 'PREDICTED', 'A'),
      item('b', 'TARGET', 'PREDICTED', 'B'),
      item('c', 'TARGET', 'PREDICTED', 'C'), // no prediction → excluded
    ];
    const predictions = new Map<string, LoadedPrediction>([
      ['a', makePrediction('a', 'safety', 0.9)],
      ['b', makePrediction('b', 'safety', 0.88)],
    ]);

    const summary = buildPortfolioSummary(
      'en',
      ready,
      items,
      items,
      predictions,
    );

    // Only 2 resolvable tiers remain → cannot judge the shape.
    expect(summary.balance).toBe('insufficient');
  });

  it('surfaces "no real safety floor" when nothing predicts as a safety', () => {
    const items = [
      item('a', 'TARGET', 'PREDICTED', 'A'),
      item('b', 'TARGET', 'PREDICTED', 'B'),
      item('c', 'TARGET', 'PREDICTED', 'C'),
    ];
    const predictions = new Map<string, LoadedPrediction>([
      ['a', makePrediction('a', 'reach', 0.2)],
      ['b', makePrediction('b', 'reach', 0.25)],
      ['c', makePrediction('c', 'match', 0.55)],
    ]);

    const summary = buildPortfolioSummary(
      'en',
      ready,
      items,
      items,
      predictions,
    );

    expect(
      summary.riskBoundaries.some((line) => /true safety/i.test(line)),
    ).toBe(true);
  });

  it('warns "no likely admit anywhere" when the top predicted probability is below ~50%', () => {
    const items = [
      item('a', 'REACH', 'PREDICTED', 'A'),
      item('b', 'REACH', 'PREDICTED', 'B'),
      item('c', 'TARGET', 'PREDICTED', 'C'),
    ];
    const predictions = new Map<string, LoadedPrediction>([
      ['a', makePrediction('a', 'reach', 0.1)],
      ['b', makePrediction('b', 'reach', 0.15)],
      ['c', makePrediction('c', 'reach', 0.42)],
    ]);

    const summary = buildPortfolioSummary(
      'en',
      ready,
      items,
      items,
      predictions,
    );

    expect(
      summary.riskBoundaries.some((line) =>
        /below ~50%|effectively a reach/i.test(line),
      ),
    ).toBe(true);
  });

  it('flags a MANUAL "safety" claim the engine predicts as a reach (your safety is not safe), and still counts it as the user claimed', () => {
    const items = [
      item('a', 'SAFETY', 'MANUAL', 'Reachy State'), // user insists it is a safety
      item('b', 'SAFETY', 'PREDICTED', 'B'),
      item('c', 'SAFETY', 'PREDICTED', 'C'),
    ];
    const predictions = new Map<string, LoadedPrediction>([
      ['a', makePrediction('a', 'reach', 0.07)],
      ['b', makePrediction('b', 'safety', 0.9)],
      ['c', makePrediction('c', 'safety', 0.91)],
    ]);

    const summary = buildPortfolioSummary(
      'en',
      ready,
      items,
      items,
      predictions,
    );

    expect(
      summary.riskBoundaries.some((line) =>
        /Reachy State.*reach territory|don't count on it as a fallback/i.test(
          line,
        ),
      ),
    ).toBe(true);
  });

  it('does NOT raise a mismatch warning for a PREDICTED row (no user claim to contradict)', () => {
    const items = [
      item('a', 'SAFETY', 'PREDICTED', 'A'), // placeholder SAFETY, not a claim
      item('b', 'SAFETY', 'PREDICTED', 'B'),
      item('c', 'SAFETY', 'PREDICTED', 'C'),
    ];
    const predictions = new Map<string, LoadedPrediction>([
      ['a', makePrediction('a', 'reach', 0.07)],
      ['b', makePrediction('b', 'safety', 0.9)],
      ['c', makePrediction('c', 'safety', 0.91)],
    ]);

    const summary = buildPortfolioSummary(
      'en',
      ready,
      items,
      items,
      predictions,
    );

    expect(
      summary.riskBoundaries.some((line) =>
        /fallback|reach territory/i.test(line),
      ),
    ).toBe(false);
  });
});
