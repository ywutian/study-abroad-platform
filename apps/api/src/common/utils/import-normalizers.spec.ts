import {
  normalizeSchoolName,
  normalizeResult,
  normalizeRound,
  normalizeEssayType,
  parseActivitiesText,
  parseAwardsText,
  parseTestScoresFromRanges,
  normalizeHighSchoolType,
  normalizeCurriculum,
  parseTags,
} from './import-normalizers';

describe('import-normalizers', () => {
  describe('normalizeSchoolName', () => {
    it('should normalize common abbreviations', () => {
      expect(normalizeSchoolName('mit')).toBe(
        'Massachusetts Institute of Technology',
      );
      expect(normalizeSchoolName('MIT')).toBe(
        'Massachusetts Institute of Technology',
      );
      expect(normalizeSchoolName('stanford')).toBe('Stanford University');
      expect(normalizeSchoolName('harvard')).toBe('Harvard University');
    });

    it('should return original name for unknown schools', () => {
      // normalizeSchoolName returns the trimmed original name if no mapping found
      expect(normalizeSchoolName('Unknown University')).toBe(
        'Unknown University',
      );
    });

    it('should be case-insensitive', () => {
      expect(normalizeSchoolName('CALTECH')).toBe(
        normalizeSchoolName('caltech'),
      );
    });
  });

  describe('normalizeResult', () => {
    it('should normalize English abbreviations', () => {
      expect(normalizeResult('admitted')).toBe('ADMITTED');
      expect(normalizeResult('ADMITTED')).toBe('ADMITTED');
      expect(normalizeResult('ad')).toBe('ADMITTED');
      expect(normalizeResult('rej')).toBe('REJECTED');
      expect(normalizeResult('wl')).toBe('WAITLISTED');
      expect(normalizeResult('deferred')).toBe('DEFERRED');
    });

    it('should normalize Chinese result values', () => {
      expect(normalizeResult('录取')).toBe('ADMITTED');
      expect(normalizeResult('拒绝')).toBe('REJECTED');
      expect(normalizeResult('候补')).toBe('WAITLISTED');
      expect(normalizeResult('延期')).toBe('DEFERRED');
    });

    it('should return null for unknown values', () => {
      expect(normalizeResult('unknown')).toBeNull();
      expect(normalizeResult('INVALID_RESULT')).toBeNull();
    });
  });

  describe('normalizeRound', () => {
    it('should normalize round abbreviations', () => {
      expect(normalizeRound('ED')).toBe('ED');
      expect(normalizeRound('ed')).toBe('ED');
      expect(normalizeRound('ED2')).toBe('ED2');
      expect(normalizeRound('EA')).toBe('EA');
      expect(normalizeRound('REA')).toBe('REA');
      expect(normalizeRound('RD')).toBe('RD');
    });

    it('should return empty string for empty input', () => {
      expect(normalizeRound('')).toBe('');
    });
  });

  describe('normalizeEssayType', () => {
    it('should normalize essay type aliases', () => {
      expect(normalizeEssayType('COMMON_APP')).toBe('COMMON_APP');
      expect(normalizeEssayType('commonapp')).toBe('COMMON_APP');
      expect(normalizeEssayType('SUP')).toBe('SUPPLEMENTAL');
      expect(normalizeEssayType('UC')).toBe('UC');
    });

    it('should return null for empty input', () => {
      expect(normalizeEssayType('')).toBeNull();
    });
  });

  describe('parseActivitiesText', () => {
    it('should parse semicolon-separated activities', () => {
      const result = parseActivitiesText(
        'Research assistant;Debate team captain',
      );
      expect(result).toHaveLength(2);
      expect(result[0].description).toBeTruthy();
      expect(result[1].description).toBeTruthy();
    });

    it('should infer categories from keywords', () => {
      const result = parseActivitiesText('Research in physics lab');
      expect(result).toHaveLength(1);
      expect(result[0].category?.toLowerCase()).toBe('research');
    });

    it('should return empty array for empty input', () => {
      expect(parseActivitiesText('')).toHaveLength(0);
    });
  });

  describe('parseAwardsText', () => {
    it('should parse semicolon-separated awards', () => {
      const result = parseAwardsText('USAMO Qualifier;Intel ISEF');
      expect(result).toHaveLength(2);
      expect(result[0].name).toBeTruthy();
    });

    it('should infer award levels', () => {
      const result = parseAwardsText('National Merit Scholar');
      expect(result).toHaveLength(1);
      expect(result[0].level).toBe('national');
    });

    it('should return empty array for empty input', () => {
      expect(parseAwardsText('')).toHaveLength(0);
    });
  });

  describe('parseTestScoresFromRanges', () => {
    it('should parse SAT range', () => {
      const result = parseTestScoresFromRanges(
        '1500-1550',
        undefined,
        undefined,
      );
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('SAT');
      expect(result[0].score).toBe(1525);
    });

    it('should parse single SAT score', () => {
      const result = parseTestScoresFromRanges('1550', undefined, undefined);
      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(1550);
    });

    it('should parse multiple test types', () => {
      const result = parseTestScoresFromRanges('1550', '35', '115');
      expect(result).toHaveLength(3);
      expect(result.find((t) => t.type === 'SAT')?.score).toBe(1550);
      expect(result.find((t) => t.type === 'ACT')?.score).toBe(35);
      expect(result.find((t) => t.type === 'TOEFL')?.score).toBe(115);
    });

    it('should return empty array when no scores provided', () => {
      expect(
        parseTestScoresFromRanges(undefined, undefined, undefined),
      ).toHaveLength(0);
    });
  });

  describe('normalizeHighSchoolType', () => {
    it('should normalize high school type strings', () => {
      const publicUs = normalizeHighSchoolType('PUBLIC_US');
      expect(publicUs).toBeTruthy();
    });

    it('should return null for empty input', () => {
      expect(normalizeHighSchoolType('')).toBeNull();
    });
  });

  describe('normalizeCurriculum', () => {
    it('should normalize curriculum types', () => {
      const ap = normalizeCurriculum('AP');
      expect(ap).toBeTruthy();
      const ib = normalizeCurriculum('IB');
      expect(ib).toBeTruthy();
    });

    it('should return null for empty input', () => {
      expect(normalizeCurriculum('')).toBeNull();
    });
  });

  describe('parseTags', () => {
    it('should parse semicolon-separated tags', () => {
      const result = parseTags('research;CS;international');
      expect(result).toEqual(['research', 'CS', 'international']);
    });

    it('should return empty array for empty input', () => {
      expect(parseTags('')).toHaveLength(0);
    });

    it('should trim whitespace', () => {
      const result = parseTags(' research ; CS ');
      expect(result).toEqual(['research', 'CS']);
    });
  });
});
