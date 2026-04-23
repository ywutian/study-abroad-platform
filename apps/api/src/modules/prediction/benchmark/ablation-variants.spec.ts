import { ABLATION_VARIANTS, ALL_VARIANT_KEYS } from './ablation-variants';
import type { ProfileInput } from '../prediction.prompts';

function makeProfile(): ProfileInput {
  return {
    gpa: 3.85,
    gpaScale: 4.0,
    targetMajor: 'Computer Science',
    isInternational: true,
    nationality: 'China',
    highSchoolId: 'hs-1',
    highSchoolName: 'Example HS',
    highSchoolTier: 2,
    highSchoolRecognition: 8,
    highSchoolAcademicRigor: 9,
    highSchoolPlacementRecord: 8,
    highSchoolStudentQuality: 9,
    highSchoolResources: 8,
    highSchoolGradeInflation: 'LOW',
    highSchoolType: 'INTERNATIONAL' as any,
    highSchoolLocation: 'Beijing',
    testScores: [
      { type: 'SAT', score: 1500 },
      { type: 'TOEFL', score: 110 },
    ],
    activities: [
      { name: 'Robotics', category: 'STEM', role: 'Captain' },
      { name: 'Debate', category: 'LEADERSHIP', role: 'President' },
    ],
    awards: [
      { level: 'NATIONAL', name: 'AMC 12', tier: 2 },
      { level: 'INTERNATIONAL', name: 'ISEF', tier: 1 },
    ],
    assessment: { mbtiType: 'INTJ', hollandCodes: ['I', 'A'] },
    essayQualityScore: 8.5,
    isLegacy: false,
    isFirstGen: false,
    majorCompetitiveness: {
      name: 'Computer Science',
      level: 5,
      schoolEstimate: 0.04,
    },
  };
}

describe('ABLATION_VARIANTS', () => {
  it('exports all keys declared in ALL_VARIANT_KEYS', () => {
    for (const key of ALL_VARIANT_KEYS) {
      expect(ABLATION_VARIANTS[key]).toBeDefined();
      expect(ABLATION_VARIANTS[key].key).toBe(key);
    }
  });

  it('baseline is a clone, not a reference', () => {
    const p = makeProfile();
    const out = ABLATION_VARIANTS.baseline.apply(p);
    expect(out).not.toBe(p);
    expect(out.testScores).not.toBe(p.testScores);
    expect(out.activities).not.toBe(p.activities);
    expect(out.awards).not.toBe(p.awards);
    // Deep equality — baseline is identity
    expect(out).toEqual(p);
  });

  it.each(ALL_VARIANT_KEYS)(
    'variant %s does not mutate the input profile',
    (key) => {
      const p = makeProfile();
      const snapshot = JSON.parse(JSON.stringify(p));
      ABLATION_VARIANTS[key].apply(p);
      expect(p).toEqual(snapshot);
    },
  );

  it('academic-only strips activities, awards, HS, essay, major, assessment', () => {
    const p = makeProfile();
    const out = ABLATION_VARIANTS['academic-only'].apply(p);
    expect(out.activities).toEqual([]);
    expect(out.awards).toEqual([]);
    expect(out.essayQualityScore).toBeUndefined();
    expect(out.targetMajor).toBeUndefined();
    expect(out.majorCompetitiveness).toBeUndefined();
    expect(out.assessment).toBeUndefined();
    expect(out.highSchoolTier).toBeUndefined();
    expect(out.highSchoolRecognition).toBeUndefined();
    expect(out.highSchoolAcademicRigor).toBeUndefined();
    // Academic preserved
    expect(out.gpa).toBe(3.85);
    expect(out.testScores).toHaveLength(2);
  });

  it('no-essay strips only essayQualityScore', () => {
    const p = makeProfile();
    const out = ABLATION_VARIANTS['no-essay'].apply(p);
    expect(out.essayQualityScore).toBeUndefined();
    expect(out.activities).toHaveLength(2);
    expect(out.awards).toHaveLength(2);
    expect(out.highSchoolTier).toBe(2);
  });

  it('no-hs-profile strips HS fields only', () => {
    const p = makeProfile();
    const out = ABLATION_VARIANTS['no-hs-profile'].apply(p);
    expect(out.highSchoolId).toBeUndefined();
    expect(out.highSchoolTier).toBeUndefined();
    expect(out.highSchoolRecognition).toBeUndefined();
    expect(out.highSchoolAcademicRigor).toBeUndefined();
    expect(out.activities).toHaveLength(2);
    expect(out.awards).toHaveLength(2);
    expect(out.essayQualityScore).toBe(8.5);
  });

  it('no-awards and no-activities strip their respective arrays only', () => {
    const p = makeProfile();
    expect(ABLATION_VARIANTS['no-awards'].apply(p).awards).toEqual([]);
    expect(ABLATION_VARIANTS['no-awards'].apply(p).activities).toHaveLength(2);
    expect(ABLATION_VARIANTS['no-activities'].apply(p).activities).toEqual([]);
    expect(ABLATION_VARIANTS['no-activities'].apply(p).awards).toHaveLength(2);
  });

  it('no-major-cip strips targetMajor and majorCompetitiveness', () => {
    const p = makeProfile();
    const out = ABLATION_VARIANTS['no-major-cip'].apply(p);
    expect(out.targetMajor).toBeUndefined();
    expect(out.majorCompetitiveness).toBeUndefined();
  });
});
