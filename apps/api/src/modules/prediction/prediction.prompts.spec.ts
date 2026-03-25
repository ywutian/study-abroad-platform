import { buildMissingDataGuidance, ProfileInput } from './prediction.prompts';

describe('buildMissingDataGuidance', () => {
  const baseProfile: ProfileInput = {
    targetMajor: 'Computer Science',
    activities: [],
    awards: [],
    testScores: [],
    essays: [],
  };

  it('returns empty string when activities are present', () => {
    const profile: ProfileInput = {
      ...baseProfile,
      activities: [{ name: 'Robotics Club', role: 'President' }],
    };
    expect(buildMissingDataGuidance(profile, false)).toBe('');
    expect(buildMissingDataGuidance(profile, true)).toBe('');
  });

  it('returns full guidance (English) when both activities and awards are empty', () => {
    const result = buildMissingDataGuidance(baseProfile, false);
    expect(result).toContain('Missing Data Guidance');
    expect(result).toContain('Do NOT reference "existing activities"');
    expect(result).toContain('Computer Science');
    // Should include specific program names from STEM category
    expect(result).toContain('Summer programs:');
    expect(result).toContain('Competitions:');
    // Verify at least one real program name is present
    expect(result).toMatch(/USACO|RSI|MITES|Google CSSI/);
  });

  it('returns full guidance (Chinese) when both activities and awards are empty', () => {
    const result = buildMissingDataGuidance(baseProfile, true);
    expect(result).toContain('数据缺失指导');
    expect(result).toContain('不要引用"现有活动"');
    expect(result).toContain('Computer Science');
    expect(result).toContain('暑期项目：');
    expect(result).toContain('竞赛：');
  });

  it('returns lighter guidance when activities empty but awards present', () => {
    const profile: ProfileInput = {
      ...baseProfile,
      awards: [{ level: 'National', name: 'USACO Gold' }],
    };
    const result = buildMissingDataGuidance(profile, false);
    expect(result).toContain('Missing Data Guidance');
    expect(result).toContain('has awards');
    expect(result).toContain('Summer programs:');
    // Should NOT contain the "prefix suggestions" instruction (that's only for fully empty)
    expect(result).not.toContain('Prefix suggestions');
  });

  it('returns lighter guidance (Chinese) when activities empty but awards present', () => {
    const profile: ProfileInput = {
      ...baseProfile,
      awards: [{ level: 'National', name: 'AMC 10' }],
    };
    const result = buildMissingDataGuidance(profile, true);
    expect(result).toContain('数据缺失指导');
    expect(result).toContain('但有获奖记录');
  });

  it('uses "Undecided" fallback when targetMajor is undefined', () => {
    const profile: ProfileInput = {
      ...baseProfile,
      targetMajor: undefined,
    };
    const resultEn = buildMissingDataGuidance(profile, false);
    expect(resultEn).toContain('Undecided');

    const resultZh = buildMissingDataGuidance(profile, true);
    expect(resultZh).toContain('未确定');
  });

  it('classifies different majors to appropriate program lists', () => {
    const artProfile: ProfileInput = {
      ...baseProfile,
      targetMajor: 'Fine Arts',
    };
    const result = buildMissingDataGuidance(artProfile, false);
    // Arts category should have different programs than STEM
    expect(result).not.toContain('USACO');
  });
});
