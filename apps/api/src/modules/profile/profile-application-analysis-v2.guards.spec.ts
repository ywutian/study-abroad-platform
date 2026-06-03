import {
  filterAllowedEvidenceIds,
  normalizeBalanceValue,
} from './profile-application-analysis-v2.service';

/**
 * The V2 analysis merges LLM output over a deterministic skeleton. The
 * deterministic gold replay skips the LLM, so this LLM-merge path is otherwise
 * untested — yet it is exactly where a hallucinating model could inject ungrounded
 * data. These guards are the defenses: the model may only cite evidence the
 * deterministic layer produced, and may only emit a known portfolio-balance value.
 */
describe('filterAllowedEvidenceIds — evidence allow-list (anti-fabrication)', () => {
  it('keeps only allow-listed IDs and flags the ones the model invented', () => {
    const { evidenceIds, validationErrors } = filterAllowedEvidenceIds(
      ['ev-1', 'ev-2', 'ev-3'],
      ['ev-1', 'ev-FAKE', 'ev-3'], // ev-FAKE is not in the deterministic set
    );
    expect(evidenceIds).toEqual(['ev-1', 'ev-3']); // fabricated ID stripped
    expect(validationErrors).toContain(
      'school-analysis-evidence-id-not-allowed',
    );
  });

  it('strips everything and records BOTH errors when the model cites only fabricated IDs', () => {
    const { evidenceIds, validationErrors } = filterAllowedEvidenceIds(
      ['ev-1', 'ev-2'],
      ['ev-FAKE-1', 'ev-FAKE-2'],
    );
    expect(evidenceIds).toEqual([]);
    expect(validationErrors).toEqual(
      expect.arrayContaining([
        'school-analysis-evidence-id-not-allowed',
        'school-analysis-missing-evidence-binding',
      ]),
    );
  });

  it('flags a missing binding when the model cites no evidence but the deterministic layer has some', () => {
    const { evidenceIds, validationErrors } = filterAllowedEvidenceIds(
      ['ev-1'],
      [],
    );
    expect(evidenceIds).toEqual([]);
    expect(validationErrors).toEqual([
      'school-analysis-missing-evidence-binding',
    ]);
  });

  it('is clean when the model cites exactly the allowed IDs', () => {
    const { evidenceIds, validationErrors } = filterAllowedEvidenceIds(
      ['ev-1', 'ev-2'],
      ['ev-1', 'ev-2'],
    );
    expect(evidenceIds).toEqual(['ev-1', 'ev-2']);
    expect(validationErrors).toEqual([]);
  });

  it('is clean when there is no deterministic evidence and the model cites none', () => {
    const { evidenceIds, validationErrors } = filterAllowedEvidenceIds([], []);
    expect(evidenceIds).toEqual([]);
    expect(validationErrors).toEqual([]);
  });
});

describe('normalizeBalanceValue — portfolio-balance enum guard', () => {
  it('keeps a valid LLM balance with no error', () => {
    const { balance, validationErrors } = normalizeBalanceValue(
      'reachHeavy',
      'balanced',
    );
    expect(balance).toBe('reachHeavy');
    expect(validationErrors).toEqual([]);
  });

  it('rejects an invented balance, falls back, and records the error', () => {
    const { balance, validationErrors } = normalizeBalanceValue(
      'wildly-optimistic', // not a real balance value
      'reachHeavy',
    );
    expect(balance).toBe('reachHeavy'); // deterministic fallback wins
    expect(validationErrors).toEqual(['portfolio-balance-invalid']);
  });

  it('falls back silently when the LLM omits the balance', () => {
    const { balance, validationErrors } = normalizeBalanceValue(
      undefined,
      'safetyHeavy',
    );
    expect(balance).toBe('safetyHeavy');
    expect(validationErrors).toEqual([]);
  });
});
