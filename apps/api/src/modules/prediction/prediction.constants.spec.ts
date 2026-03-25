import { classifyMajor, MAJOR_CATEGORY_PROGRAMS } from './prediction.constants';

describe('classifyMajor', () => {
  it('returns CS for computer science variants', () => {
    expect(classifyMajor('Computer Science')).toBe('CS');
    expect(classifyMajor('Computing')).toBe('CS');
    expect(classifyMajor('Software Engineering')).toBe('CS');
  });

  it('returns BUSINESS for economics/finance', () => {
    expect(classifyMajor('Economics')).toBe('BUSINESS');
    expect(classifyMajor('Finance')).toBe('BUSINESS');
    expect(classifyMajor('Business Administration')).toBe('BUSINESS');
  });

  it('returns HUMANITIES for literature/philosophy', () => {
    expect(classifyMajor('English Literature')).toBe('HUMANITIES');
    expect(classifyMajor('Philosophy')).toBe('HUMANITIES');
    expect(classifyMajor('History')).toBe('HUMANITIES');
  });

  it('returns PRE_MED for medical fields', () => {
    expect(classifyMajor('Pre-Med')).toBe('PRE_MED');
    expect(classifyMajor('Neuroscience')).toBe('PRE_MED');
  });

  it('returns ENGINEERING for engineering fields', () => {
    expect(classifyMajor('Mechanical Engineering')).toBe('ENGINEERING');
    expect(classifyMajor('Aerospace')).toBe('ENGINEERING');
  });

  it('returns ARTS for art/music/design', () => {
    expect(classifyMajor('Music')).toBe('ARTS');
    expect(classifyMajor('Film Studies')).toBe('ARTS');
  });

  it('returns SOCIAL_SCIENCE for psychology/political science', () => {
    expect(classifyMajor('Psychology')).toBe('SOCIAL_SCIENCE');
    expect(classifyMajor('Political Science')).toBe('SOCIAL_SCIENCE');
  });

  it('returns STEM for math/physics/biology', () => {
    expect(classifyMajor('Mathematics')).toBe('STEM');
    expect(classifyMajor('Physics')).toBe('STEM');
    expect(classifyMajor('Biology')).toBe('STEM');
  });

  it('returns GENERAL for undefined/empty/unknown', () => {
    expect(classifyMajor(undefined)).toBe('GENERAL');
    expect(classifyMajor('')).toBe('GENERAL');
    expect(classifyMajor('Undecided')).toBe('GENERAL');
  });
});

describe('MAJOR_CATEGORY_PROGRAMS', () => {
  it('has summer and competition arrays for all categories', () => {
    const categories = Object.keys(MAJOR_CATEGORY_PROGRAMS);
    expect(categories.length).toBe(9);
    for (const cat of categories) {
      const programs =
        MAJOR_CATEGORY_PROGRAMS[cat as keyof typeof MAJOR_CATEGORY_PROGRAMS];
      expect(programs.summer.length).toBeGreaterThan(0);
      expect(programs.competition.length).toBeGreaterThan(0);
      // Each entry has name and zh
      for (const p of [...programs.summer, ...programs.competition]) {
        expect(p.name).toBeTruthy();
        expect(p.zh).toBeTruthy();
      }
    }
  });
});
