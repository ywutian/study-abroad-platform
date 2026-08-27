import {
  compareVerificationNumber,
  parseVerificationFacts,
  verificationStatus,
} from './workflow-verification';

describe('Verification fails unknown, never silently passes', () => {
  it.each([
    'Rank is not 25',
    'Rank is at most 25',
    '排名不是25',
    '排名低于25',
    'Rank -25',
  ])('does not misread qualified claim %s as equality', (claim) => {
    expect(compareVerificationNumber(claim, 25)).toBe('unverified');
  });
  it.each([
    null,
    {},
    { facts: 'bad' },
    { facts: [{ claim: 'x', schoolName: 'x', field: '__proto__' }] },
  ])('rejects invalid fact extraction %j', (input) => {
    expect(parseVerificationFacts(input)).toBeUndefined();
  });
  it('distinguishes no facts from malformed extraction', () => {
    expect(parseVerificationFacts({ facts: [] })).toEqual([]);
    expect(verificationStatus(0, 0, 0)).toBe('not_applicable');
    expect(verificationStatus(0, 0, 1)).toBe('unverified');
  });
  it.each([undefined, null, 'N/A', {}, '2026-11-01'])(
    'does not certify missing or ambiguous values %j',
    (actual) => {
      expect(compareVerificationNumber('Tuition is 30000', actual)).toBe(
        'unverified',
      );
    },
  );
  it('requires exact comparable numbers and does not silently normalize units', () => {
    expect(compareVerificationNumber('Rank 25', 25)).toBe('verified');
    expect(compareVerificationNumber('Rank 25', 26)).toBe('conflict');
    expect(compareVerificationNumber('Rate 3.4%', 0.034)).toBe('unverified');
    expect(compareVerificationNumber('Rate 3.4%', '3.4%')).toBe('verified');
    expect(compareVerificationNumber('Rate 3.4%', '3.5%')).toBe('conflict');
    expect(compareVerificationNumber('Rank 25 in 2026', 25)).toBe('unverified');
  });
  it('never labels partially checked claims as all verified', () => {
    expect(verificationStatus(1, 0, 1)).toBe('unverified');
    expect(verificationStatus(1, 1, 1)).toBe('conflict');
    expect(verificationStatus(1, 0, 0)).toBe('verified');
  });
});
