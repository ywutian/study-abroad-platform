import {
  compareVerificationNumber,
  parseVerificationFacts,
  verificationStatus,
  verifySchoolFacts,
} from './workflow-verification';
import type { ConversationState } from '../types';

describe('Verification fails unknown, never silently passes', () => {
  it.each([
    ['lookup_failed', { success: false }],
    ['field_missing', { success: true, result: {} }],
    ['source_unusable', { success: true, result: { rank: { value: 25 } } }],
    ['claim_uncomparable', { success: true, result: { rank: '$25' } }],
  ])(
    'reports only the fixed reason %s without changing the verdict',
    async (reason, result) => {
      const observe = jest.fn();
      const verified = await verifySchoolFacts(
        [
          {
            claim: 'private-claim 25',
            schoolName: 'private-school',
            field: 'rank',
          },
        ],
        { execute: jest.fn().mockResolvedValue(result) },
        { userId: 'synthetic', context: {} } as ConversationState,
        'en',
        5,
        observe,
      );
      expect(verified.status).toBe('unverified');
      expect(observe.mock.calls).toEqual([[reason]]);
    },
  );
  it('distinguishes exhausted tool slots and thrown lookups', async () => {
    const observe = jest.fn();
    const fact = { claim: 'Rank 25', schoolName: 'Synthetic', field: 'rank' };
    await verifySchoolFacts(
      [fact, fact],
      { execute: jest.fn().mockRejectedValue(new Error('private-error')) },
      { userId: 'synthetic', context: {} } as ConversationState,
      'en',
      1,
      observe,
    );
    expect(observe.mock.calls).toEqual([['tool_limit'], ['tool_exception']]);
  });
  it.each([
    { source: null },
    { source: { isVerified: false, staleness: 'FRESH' } },
    { source: { isVerified: true, staleness: 'STALE' } },
    { consumerPolicy: 'hidden_until_field_provenance_exists' },
    { displayValue: '34%' },
    { value: null },
    { value: 120, displayValue: '120%' },
  ])(
    'does not unwrap untrusted or inconsistent percentage data %j',
    async (override) => {
      const acceptanceRate = {
        value: 3.4,
        displayValue: '3.4%',
        consumerPolicy: 'use_with_field_source',
        source: { isVerified: true, staleness: 'FRESH' },
        ...override,
      };
      const result = await verifySchoolFacts(
        [
          {
            claim: 'Rate 3.4%',
            schoolName: 'Synthetic',
            field: 'acceptanceRate',
          },
        ],
        {
          execute: jest
            .fn()
            .mockResolvedValue({ success: true, result: { acceptanceRate } }),
        },
        { userId: 'synthetic', context: {} } as ConversationState,
        'en',
        5,
      );
      expect(result.status).toBe('unverified');
      expect(result.verified).toBe(0);
      expect(result.corrections).toEqual([]);
    },
  );
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
