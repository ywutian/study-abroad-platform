import { describe, expect, it } from 'vitest';

import { detectInternationalStatus } from './international';

describe('detectInternationalStatus', () => {
  describe('empty / domestic profiles', () => {
    it('returns a domestic, low-confidence result with no signals for an empty profile', () => {
      const result = detectInternationalStatus({});
      expect(result).toEqual({ isInternational: false, confidence: 'low', signals: [] });
    });

    it('treats a fully US profile as domestic', () => {
      const result = detectInternationalStatus({
        nationality: 'US',
        countryOfResidence: 'USA',
        citizenship: 'UNITED STATES',
      });
      expect(result.isInternational).toBe(false);
      expect(result.confidence).toBe('low');
      expect(result.signals).toEqual([]);
    });

    it('ignores null / undefined fields (no signal contributed)', () => {
      const result = detectInternationalStatus({
        nationality: null,
        countryOfResidence: undefined,
        citizenship: null,
        educationSystem: null,
        currentSchoolType: undefined,
      });
      expect(result.isInternational).toBe(false);
      expect(result.signals).toEqual([]);
    });
  });

  describe('US code recognition (case-insensitive)', () => {
    it('recognizes lowercase / mixed-case US variants as domestic', () => {
      expect(detectInternationalStatus({ nationality: 'us' }).isInternational).toBe(false);
      expect(detectInternationalStatus({ nationality: 'usa' }).isInternational).toBe(false);
      expect(detectInternationalStatus({ nationality: 'united states' }).isInternational).toBe(
        false
      );
      expect(detectInternationalStatus({ nationality: 'Us' }).isInternational).toBe(false);
    });

    it('treats any non-US nationality string as an international signal', () => {
      const result = detectInternationalStatus({ nationality: 'China' });
      expect(result.signals).toContain('nationality_non_us');
      expect(result.isInternational).toBe(true);
    });
  });

  describe('nationality signal => high confidence', () => {
    it('marks a single non-US nationality as high confidence', () => {
      const result = detectInternationalStatus({ nationality: 'IN' });
      expect(result.isInternational).toBe(true);
      expect(result.signals).toEqual(['nationality_non_us']);
      expect(result.confidence).toBe('high');
    });
  });

  describe('single non-nationality signal => medium confidence', () => {
    it('marks a single non-US residence (no nationality) as medium confidence', () => {
      const result = detectInternationalStatus({ countryOfResidence: 'Canada' });
      expect(result.isInternational).toBe(true);
      expect(result.signals).toEqual(['residence_non_us']);
      expect(result.confidence).toBe('medium');
    });

    it('marks a single non-US citizenship (no nationality) as medium confidence', () => {
      const result = detectInternationalStatus({ citizenship: 'UK' });
      expect(result.signals).toEqual(['citizenship_non_us']);
      expect(result.confidence).toBe('medium');
    });

    it('marks a single intl education system as medium confidence', () => {
      const result = detectInternationalStatus({ educationSystem: 'GAOKAO' });
      expect(result.signals).toEqual(['education_system_intl']);
      expect(result.confidence).toBe('medium');
      expect(result.isInternational).toBe(true);
    });

    it('marks a single intl school type as medium confidence', () => {
      const result = detectInternationalStatus({ currentSchoolType: 'INTERNATIONAL' });
      expect(result.signals).toEqual(['school_type_intl']);
      expect(result.confidence).toBe('medium');
    });
  });

  describe('education system matching (exact, case-sensitive)', () => {
    it.each(['GAOKAO', 'A_LEVEL', 'IB', 'CANADIAN', 'AUSTRALIAN'])(
      'recognizes the intl education system %s',
      (system) => {
        const result = detectInternationalStatus({ educationSystem: system });
        expect(result.signals).toContain('education_system_intl');
      }
    );

    it('does NOT match a lowercase education system (case-sensitive set lookup)', () => {
      const result = detectInternationalStatus({ educationSystem: 'gaokao' });
      expect(result.signals).not.toContain('education_system_intl');
      expect(result.isInternational).toBe(false);
    });

    it('does NOT treat a US-style education system as a signal', () => {
      const result = detectInternationalStatus({ educationSystem: 'AP' });
      expect(result.signals).not.toContain('education_system_intl');
      expect(result.isInternational).toBe(false);
    });
  });

  describe('school type matching (exact, case-sensitive)', () => {
    it.each(['INTERNATIONAL', 'INTL_CN', 'INTL_OTHER'])(
      'recognizes the intl school type %s',
      (schoolType) => {
        const result = detectInternationalStatus({ currentSchoolType: schoolType });
        expect(result.signals).toContain('school_type_intl');
      }
    );

    it('does NOT match a lowercase school type (case-sensitive set lookup)', () => {
      const result = detectInternationalStatus({ currentSchoolType: 'international' });
      expect(result.signals).not.toContain('school_type_intl');
      expect(result.isInternational).toBe(false);
    });
  });

  describe('multi-signal => high confidence', () => {
    it('upgrades two non-nationality signals to high confidence', () => {
      const result = detectInternationalStatus({
        countryOfResidence: 'Canada',
        educationSystem: 'A_LEVEL',
      });
      expect(result.signals).toEqual(['residence_non_us', 'education_system_intl']);
      expect(result.confidence).toBe('high');
    });

    it('collects all five signals in declaration order for a fully international profile', () => {
      const result = detectInternationalStatus({
        nationality: 'China',
        countryOfResidence: 'China',
        citizenship: 'China',
        educationSystem: 'GAOKAO',
        currentSchoolType: 'INTL_CN',
      });
      expect(result.signals).toEqual([
        'nationality_non_us',
        'residence_non_us',
        'citizenship_non_us',
        'education_system_intl',
        'school_type_intl',
      ]);
      expect(result.confidence).toBe('high');
      expect(result.isInternational).toBe(true);
    });
  });

  describe('mixed US/non-US fields', () => {
    it('flags a US national living abroad as international (medium, residence-only signal)', () => {
      const result = detectInternationalStatus({
        nationality: 'US',
        countryOfResidence: 'Singapore',
      });
      expect(result.signals).toEqual(['residence_non_us']);
      expect(result.confidence).toBe('medium');
      expect(result.isInternational).toBe(true);
    });

    it('keeps nationality_non_us high even when residence is US', () => {
      const result = detectInternationalStatus({
        nationality: 'Brazil',
        countryOfResidence: 'US',
      });
      expect(result.signals).toEqual(['nationality_non_us']);
      expect(result.confidence).toBe('high');
    });
  });

  describe('edge cases', () => {
    it('treats an empty-string field as falsy (no signal)', () => {
      const result = detectInternationalStatus({
        nationality: '',
        countryOfResidence: '',
      });
      expect(result.isInternational).toBe(false);
      expect(result.signals).toEqual([]);
    });

    it('never returns isInternational:true with an empty signals array', () => {
      const result = detectInternationalStatus({ nationality: 'France' });
      expect(result.isInternational).toBe(result.signals.length > 0);
    });
  });
});
