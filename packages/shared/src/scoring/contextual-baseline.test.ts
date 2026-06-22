import { describe, expect, it } from 'vitest';

import {
  formatPercentValue,
  resolveContextualAcceptanceRate,
  resolveContextualBaseline,
} from './contextual-baseline';

describe('formatPercentValue', () => {
  it('renders a whole number with no decimal places', () => {
    expect(formatPercentValue(12)).toBe('12');
    expect(formatPercentValue(0)).toBe('0');
  });

  it('renders a fractional value rounded to one decimal place', () => {
    expect(formatPercentValue(12.34)).toBe('12.3');
    expect(formatPercentValue(12.36)).toBe('12.4');
  });

  it('drops a trailing .0 produced by rounding to an integer', () => {
    // 12.96 -> round(129.6)/10 = 13 -> integer -> no decimal
    expect(formatPercentValue(12.96)).toBe('13');
    // 11.99 -> round(119.9)/10 = 12 -> integer
    expect(formatPercentValue(11.99)).toBe('12');
  });

  it('rounds half upward at the tenths place', () => {
    // 12.05 -> 120.5 -> Math.round = 121 -> 12.1
    expect(formatPercentValue(12.05)).toBe('12.1');
  });

  it('handles negative values', () => {
    expect(formatPercentValue(-5)).toBe('-5');
    // Math.round rounds half toward +Infinity, so -5.25 -> -52.5 -> -52 -> -5.2
    expect(formatPercentValue(-5.25)).toBe('-5.2');
    expect(formatPercentValue(-5.26)).toBe('-5.3');
  });
});

describe('resolveContextualAcceptanceRate', () => {
  it('returns null when no school meta is available', () => {
    expect(
      resolveContextualAcceptanceRate({
        schoolMeta: null,
        isInternational: false,
      })
    ).toBeNull();
    expect(
      resolveContextualAcceptanceRate({
        schoolMeta: { acceptanceRate: null, intlAcceptanceRate: null },
        isInternational: true,
      })
    ).toBeNull();
  });

  it('uses the overall acceptance rate for a domestic applicant', () => {
    const result = resolveContextualAcceptanceRate({
      schoolMeta: { acceptanceRate: 10, intlAcceptanceRate: 4 },
      isInternational: false,
    });
    expect(result).not.toBeNull();
    expect(result!.baseType).toBe('overall');
    expect(result!.rawRate).toBe(10);
    expect(result!.rate).toBe(10);
  });

  it('prefers the international rate for an international applicant when present', () => {
    const result = resolveContextualAcceptanceRate({
      schoolMeta: { acceptanceRate: 10, intlAcceptanceRate: 4 },
      isInternational: true,
    });
    expect(result!.baseType).toBe('international');
    expect(result!.rawRate).toBe(4);
    expect(result!.rate).toBe(4);
  });

  it('falls back to the overall rate for an international applicant when intl rate is missing', () => {
    const result = resolveContextualAcceptanceRate({
      schoolMeta: { acceptanceRate: 10, intlAcceptanceRate: null },
      isInternational: true,
    });
    expect(result!.baseType).toBe('overall');
    expect(result!.rawRate).toBe(10);
  });

  it('defaults the round context to RD (no adjustment) when omitted or nullish', () => {
    const omitted = resolveContextualAcceptanceRate({
      schoolMeta: { acceptanceRate: 20 },
      isInternational: false,
    });
    expect(omitted!.roundContext).toBe('RD');
    expect(omitted!.roundAdjusted).toBe(false);
    expect(omitted!.rate).toBe(20);

    const nullRound = resolveContextualAcceptanceRate({
      schoolMeta: { acceptanceRate: 20 },
      isInternational: false,
      roundContext: null,
    });
    expect(nullRound!.roundContext).toBe('RD');
  });

  it('normalizes the round context to upper case', () => {
    const result = resolveContextualAcceptanceRate({
      schoolMeta: { acceptanceRate: 10 },
      isInternational: false,
      roundContext: 'ed',
    });
    expect(result!.roundContext).toBe('ED');
    expect(result!.roundAdjusted).toBe(true);
  });

  it('applies the ED round multiplier (1.35) and flags roundAdjusted', () => {
    const result = resolveContextualAcceptanceRate({
      schoolMeta: { acceptanceRate: 10 },
      isInternational: false,
      roundContext: 'ED',
    });
    // 10 * 1.35 = 13.5
    expect(result!.rate).toBe(13.5);
    expect(result!.roundAdjusted).toBe(true);
    // rawRate is preserved un-adjusted
    expect(result!.rawRate).toBe(10);
  });

  it('treats an unknown round as a 1.0 multiplier (no adjustment)', () => {
    const result = resolveContextualAcceptanceRate({
      schoolMeta: { acceptanceRate: 10 },
      isInternational: false,
      roundContext: 'WINTER',
    });
    expect(result!.rate).toBe(10);
    expect(result!.roundAdjusted).toBe(false);
  });

  it('clamps the adjusted rate to a maximum of 95', () => {
    const result = resolveContextualAcceptanceRate({
      schoolMeta: { acceptanceRate: 80 },
      isInternational: false,
      roundContext: 'ED', // 80 * 1.35 = 108 -> clamped to 95
    });
    expect(result!.rate).toBe(95);
  });

  it('clamps a negative raw rate up to 0', () => {
    const result = resolveContextualAcceptanceRate({
      schoolMeta: { acceptanceRate: -5 },
      isInternational: false,
    });
    expect(result!.rate).toBe(0);
  });

  it('rounds the adjusted rate to one decimal place', () => {
    const result = resolveContextualAcceptanceRate({
      schoolMeta: { acceptanceRate: 7 },
      isInternational: false,
      roundContext: 'EA', // 7 * 1.1 = 7.7
    });
    expect(result!.rate).toBe(7.7);
  });

  it('is monotonic: a higher raw rate yields a higher resolved rate (same round)', () => {
    const low = resolveContextualAcceptanceRate({
      schoolMeta: { acceptanceRate: 10 },
      isInternational: false,
      roundContext: 'EA',
    });
    const high = resolveContextualAcceptanceRate({
      schoolMeta: { acceptanceRate: 30 },
      isInternational: false,
      roundContext: 'EA',
    });
    expect(high!.rate).toBeGreaterThan(low!.rate);
  });

  it('treats acceptanceRate of 0 as a present value (not missing)', () => {
    const result = resolveContextualAcceptanceRate({
      schoolMeta: { acceptanceRate: 0 },
      isInternational: false,
    });
    expect(result).not.toBeNull();
    expect(result!.baseType).toBe('overall');
    expect(result!.rate).toBe(0);
  });
});

describe('resolveContextualBaseline', () => {
  it('returns null when the acceptance rate cannot be resolved', () => {
    expect(
      resolveContextualBaseline({
        schoolMeta: null,
        isInternational: false,
        probability: 0.5,
      })
    ).toBeNull();
  });

  it('computes deltaPoints as probability-points minus contextual rate', () => {
    const result = resolveContextualBaseline({
      schoolMeta: { acceptanceRate: 10 },
      isInternational: false,
      probability: 0.2, // 20 points - 10 rate = +10
    });
    expect(result).not.toBeNull();
    expect(result!.deltaPoints).toBe(10);
    expect(result!.rate).toBe(10);
  });

  it('produces a negative delta when probability is below the contextual rate', () => {
    const result = resolveContextualBaseline({
      schoolMeta: { acceptanceRate: 40 },
      isInternational: false,
      probability: 0.1, // 10 points - 40 rate = -30
    });
    expect(result!.deltaPoints).toBe(-30);
  });

  it('measures delta against the round-adjusted rate, not the raw rate', () => {
    const result = resolveContextualBaseline({
      schoolMeta: { acceptanceRate: 10 },
      isInternational: false,
      roundContext: 'ED', // adjusted rate = 13.5
      probability: 0.2, // 20 - 13.5 = 6.5
    });
    expect(result!.rate).toBe(13.5);
    expect(result!.deltaPoints).toBe(6.5);
  });

  it('forwards all fields from the resolved acceptance rate', () => {
    const result = resolveContextualBaseline({
      schoolMeta: { acceptanceRate: 10, intlAcceptanceRate: 4 },
      isInternational: true,
      roundContext: 'ea',
      probability: 0.5,
    });
    expect(result!.baseType).toBe('international');
    expect(result!.rawRate).toBe(4);
    expect(result!.roundContext).toBe('EA');
    expect(result!.roundAdjusted).toBe(true);
  });

  it('rounds deltaPoints to one decimal place', () => {
    const result = resolveContextualBaseline({
      schoolMeta: { acceptanceRate: 10 },
      isInternational: false,
      probability: 0.123, // 12.3 - 10 = 2.3
    });
    expect(result!.deltaPoints).toBe(2.3);
  });
});
