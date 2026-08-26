import {
  normalizeSchoolAnalysis,
  normalizePortfolioSynthesis,
} from './profile-application-analysis-v2.service';

/**
 * The #393/#395 architectural contract: when the LLM returns rich content, the
 * SERVED analysis surfaces it over the deterministic floor — and falls back to the
 * floor only when the LLM is sparse/absent. The local LLM is dead (401), so the
 * CONTENT quality can't be verified here; this proves the WIRING delivers improved
 * output whenever the LLM works (the half of the gap that is credential-free), and
 * locks it against regression.
 */

// Minimal deterministic "floor" — the generic template the old served output was
// stuck on (only the fields the merge reads are populated).
const floorAssessment = {
  summary:
    'This estimate leans on broad school-level data because activities are incomplete (low support).',
  whyThisIsHard: ['floor: high selectivity'],
  compensatingStrengths: ['floor: SAT in band'],
  topGaps: ['floor: complete your profile'],
  nextActions: ['floor: add scores'],
  historicalSignals: [],
  hardStopRisks: [],
};
const floorSchool = {
  evidenceIds: ['ev-1', 'ev-2'],
  unknowns: ['floor: testing policy unresolved'],
  prediction: { probabilityLow: 0.02, probabilityHigh: 0.08 },
  assessment: floorAssessment,
} as never;

const richLlmSchool = {
  summary:
    'As an international CS applicant, MIT is a steep reach: your 1560 SAT sits mid-band, but the ~2% international admit rate dominates the math.',
  whyThisIsHard: [
    'llm: this school admits ~2% of international applicants vs ~5% overall',
    'llm: Computer Science is its most competitive major',
    'llm: no demonstrated research signal yet',
  ],
  compensatingStrengths: [
    'llm: 1560 SAT is top-quartile here',
    'llm: upward GPA trend',
  ],
  topGaps: ['llm: thin research portfolio'],
  nextActions: ['llm: land a faculty-mentored CS project this summer'],
  historicalSignals: ['llm: similar CN-intl CS profiles admitted near ~3%'],
  hardStopRisks: [],
  evidenceIds: ['ev-1'],
  unknowns: ['llm: financial-aid need unknown'],
};

describe('normalizeSchoolAnalysis — LLM surfaces over the deterministic floor', () => {
  it('uses the LLM summary + LLM-led lists when the LLM returns rich content', () => {
    const r = normalizeSchoolAnalysis(floorSchool, richLlmSchool);
    // summary: LLM wins (?? floor)
    expect(r.assessment.summary).toBe(richLlmSchool.summary);
    expect(r.assessment.summary).not.toContain('broad school-level data');
    // lists: LLM leads; a ≥2-item LLM list is served as-is (floor dropped)
    expect(r.assessment.whyThisIsHard.slice(0, 3)).toEqual(
      richLlmSchool.whyThisIsHard,
    );
    expect(r.assessment.whyThisIsHard).not.toContain('floor: high selectivity');
    expect(r.assessment.compensatingStrengths).toEqual(
      richLlmSchool.compensatingStrengths,
    );
    // evidence is still gated to the allowed set
    expect(r.assessment.summary.length).toBeGreaterThan(0);
    // Historical individual cases are outside the product methodology. Even a
    // model-supplied signal must not cross the normalization boundary.
    expect(r.assessment.historicalSignals).toEqual([]);
    expect(r.assessment.historicalSignals).not.toContain(
      richLlmSchool.historicalSignals[0],
    );
  });

  it('falls back to the floor when the LLM is sparse/empty (degradation safety net)', () => {
    const r = normalizeSchoolAnalysis(floorSchool, {});
    expect(r.assessment.summary).toBe(floorAssessment.summary);
    expect(r.assessment.whyThisIsHard).toEqual(floorAssessment.whyThisIsHard);
  });
});

const floorPortfolio = {
  verdict:
    'The current list is reasonably balanced and ready for school-level analysis.',
  balance: 'balanced',
  keyReasons: ['floor: the focus schools now have usable predictions'],
  riskBoundaries: [],
} as never;

const floorActionPlan = {
  now: ['floor: draft a narrative'],
  next90Days: ['floor: create 1-2 wins'],
  beforeSubmission: ['floor: re-check each school'],
} as never;

const richLlmPortfolio = {
  verdict:
    'Reach-heavy for an international applicant: MIT and Wisconsin both skew reach, leaving Arizona State as your only real safety.',
  balance: 'reachHeavy',
  keyReasons: [
    'llm: two of three focus schools are reaches for an intl CS applicant',
    'llm: the safety floor is thin',
  ],
  riskBoundaries: ['llm: add 2 true target schools (40–70% range)'],
  actionPlan: {
    now: ['llm: identify 2 target-fit schools this week'],
    next90Days: ['llm: deepen the research signal MIT/Wisconsin reward'],
    beforeSubmission: ['llm: confirm ED/EA strategy per school'],
  },
  unknowns: ['llm: budget constraints unknown'],
};

describe('normalizePortfolioSynthesis — LLM verdict/strategy surfaces over the floor', () => {
  it('uses the LLM verdict, balance, and LLM-led reasons/actions', () => {
    const r = normalizePortfolioSynthesis(
      floorPortfolio,
      floorActionPlan,
      richLlmPortfolio,
    );
    expect(r.portfolioSummary.verdict).toBe(richLlmPortfolio.verdict);
    expect(r.portfolioSummary.verdict).not.toContain('ready for school-level');
    expect(r.portfolioSummary.balance).toBe('reachHeavy');
    expect(r.portfolioSummary.keyReasons).toEqual(richLlmPortfolio.keyReasons);
    expect(r.portfolioSummary.riskBoundaries).toEqual(
      richLlmPortfolio.riskBoundaries,
    );
    // actionPlan.now carries a single LLM item, so the floor backfills BEHIND it
    // (LLM still leads — the anti-dilution rule only drops the floor at >=2 LLM
    // items; a lone LLM item keeps the safety-net floor).
    expect(r.actionPlan.now[0]).toBe(richLlmPortfolio.actionPlan.now[0]);
    expect(r.actionPlan.now).toContain(richLlmPortfolio.actionPlan.now[0]);
  });

  it('falls back to the deterministic portfolio when the LLM is empty', () => {
    const r = normalizePortfolioSynthesis(floorPortfolio, floorActionPlan, {});
    expect(r.portfolioSummary.verdict).toBe(floorPortfolio['verdict']);
    expect(r.actionPlan.now).toEqual(floorActionPlan['now']);
  });
});
