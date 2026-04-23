import { admissionCaseToProfileInput } from './case-to-profile-input';

describe('admissionCaseToProfileInput', () => {
  const baseCase: any = {
    id: 'c1',
    userId: 'u1',
    schoolId: 's1',
    year: 2025,
    result: 'ADMITTED',
    major: 'Computer Science',
    gpa11: 3.85,
    gpaScale: 4.0,
    demographicTags: [],
    testScores: null,
    activities: null,
    awards: null,
  };

  it('prefers gpa11 over other GPA sources', () => {
    const p = admissionCaseToProfileInput({
      ...baseCase,
      gpa9: 3.5,
      gpa10: 3.6,
      gpa11: 3.85,
      gpa12: 3.95,
    });
    expect(p.gpa).toBe(3.85);
  });

  it('falls back to range midpoint when numeric GPAs absent', () => {
    const p = admissionCaseToProfileInput({
      ...baseCase,
      gpa9: null,
      gpa10: null,
      gpa11: null,
      gpa12: null,
      ucCappedGpa: null,
      ucUncappedGpa: null,
      gpaRange: '3.7-3.9',
    });
    expect(p.gpa).toBeCloseTo(3.8, 5);
  });

  it('parses test score range strings into midpoints', () => {
    const p = admissionCaseToProfileInput({
      ...baseCase,
      satRange: '1500-1550',
      actRange: '34-35',
      toeflRange: '108-112',
    });
    const sat = p.testScores.find((s) => s.type === 'SAT');
    const act = p.testScores.find((s) => s.type === 'ACT');
    const toefl = p.testScores.find((s) => s.type === 'TOEFL');
    expect(sat?.score).toBe(1525);
    expect(act?.score).toBe(34.5);
    expect(toefl?.score).toBe(110);
  });

  it('prefers structured testScores JSON over range strings', () => {
    const p = admissionCaseToProfileInput({
      ...baseCase,
      satRange: '1400-1500',
      testScores: [{ type: 'SAT', score: 1560 }],
    });
    const sat = p.testScores.find((s) => s.type === 'SAT');
    expect(sat?.score).toBe(1560);
  });

  it('reads demographic tags into isLegacy / isFirstGen / isInternational', () => {
    const p1 = admissionCaseToProfileInput({
      ...baseCase,
      demographicTags: ['legacy', 'first_gen'],
    });
    expect(p1.isLegacy).toBe(true);
    expect(p1.isFirstGen).toBe(true);

    const p2 = admissionCaseToProfileInput({
      ...baseCase,
      demographicTags: ['international'],
      nationality: 'China',
    });
    expect(p2.isInternational).toBe(true);

    const p3 = admissionCaseToProfileInput({
      ...baseCase,
      demographicTags: [],
      nationality: 'United States',
    });
    expect(p3.isInternational).toBe(false);
  });

  it('respects hsImpactEnabled=false to drop HS profile enrichment', () => {
    const p = admissionCaseToProfileInput({
      ...baseCase,
      highSchoolId: 'hs-1',
      highSchool: {
        id: 'hs-1',
        name: 'Low-Quality HS',
        tier: 5,
        hsImpactEnabled: false,
      },
    });
    expect(p.highSchoolId).toBeUndefined();
    expect(p.highSchoolTier).toBeUndefined();
    expect(p.highSchoolName).toBeUndefined();
  });

  it('parses line-delimited activityList when structured activities absent', () => {
    const p = admissionCaseToProfileInput({
      ...baseCase,
      activities: null,
      activityList:
        'Robotics - Captain\nDebate - President\nAMC 12 - Participant',
    });
    expect(p.activities).toHaveLength(3);
    expect(p.activities[0].name).toBe('Robotics - Captain');
  });
});
