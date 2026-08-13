import { describe, it, expect } from 'vitest';

import { categorizeSuggestion } from './SuggestionsPanel';

describe('categorizeSuggestion', () => {
  // ---------------------------------------------------------------------------
  // summer_program
  // ---------------------------------------------------------------------------
  describe('summer_program category', () => {
    it.each([
      ['Consider applying to a summer research program', 'summer'],
      ['RSI is highly competitive but worth applying', 'RSI'],
      ['MOSTEC provides great opportunities', 'MOSTEC'],
      ['SAMS at Carnegie Mellon is excellent', 'SAMS'],
      ['LaunchX entrepreneurship program', 'LaunchX'],
      ['Apply to YYGS at Yale', 'YYGS'],
      ['SSP astronomy program', 'SSP'],
      ['PROMYS at Boston University', 'PROMYS'],
      ['SUMaC at Stanford', 'SUMaC'],
      ['MITES at MIT', 'MITES'],
      ['TASP by the Telluride Association', 'TASP'],
      ['Telluride Association Summer Program', 'Telluride'],
      ["Apply to Governor's School", 'Governor'],
      ['Try a pre-college course at Harvard', 'pre-college'],
      ['Apply to Clark Scholars', 'Clark Scholars'],
    ])('matches English keyword "%s" (keyword: %s)', (text: string) => {
      expect(categorizeSuggestion(text)).toBe('summer_program');
    });

    it.each([
      ['建议参加暑期科研项目', '暑期'],
      ['可以考虑申请夏校', '夏校'],
      ['参加一个夏令营会有帮助', '夏令营'],
      ['考虑参与暑假项目', '暑假项目'],
    ])('matches Chinese keyword "%s" (keyword: %s)', (text: string) => {
      expect(categorizeSuggestion(text)).toBe('summer_program');
    });
  });

  // ---------------------------------------------------------------------------
  // competition
  // ---------------------------------------------------------------------------
  describe('competition category', () => {
    it.each([
      ['Participate in a math competition', 'competition'],
      ['Train for the olympiad', 'olympiad'],
      ['Enter a science contest', 'contest'],
      ['Aim for USAMO qualification', 'USAMO'],
      ['Start with AMC 10', 'AMC'],
      ['Qualify for AIME', 'AIME'],
      ['Join DECA for business', 'DECA'],
      ['FBLA is a great leadership competition', 'FBLA'],
      ['Compete in Science Bowl', 'Science Bowl'],
      ['Try Science Olympiad events', 'Science Olympiad'],
      ['Submit your project to ISEF', 'ISEF'],
      ['Apply for Regeneron STS', 'Regeneron'],
      ['Siemens competition is now Regeneron', 'Siemens'],
      ['Practice MATHCOUNTS problems', 'MATHCOUNTS'],
      ['Prepare for USABO biology', 'USABO'],
      ['USACO programming contests', 'USACO'],
      ['Study for USAPHO', 'USAPHO'],
      ['Take the Physics Bowl exam', 'Physics Bowl'],
    ])('matches English keyword "%s" (keyword: %s)', (text: string) => {
      expect(categorizeSuggestion(text)).toBe('competition');
    });

    it.each([
      ['建议参加数学竞赛', '竞赛'],
      ['准备物理奥赛', '奥赛'],
      ['国际奥林匹克竞赛是最高荣誉', '奥林匹克'],
    ])('matches Chinese keyword "%s" (keyword: %s)', (text: string) => {
      expect(categorizeSuggestion(text)).toBe('competition');
    });
  });

  // ---------------------------------------------------------------------------
  // research
  // ---------------------------------------------------------------------------
  describe('research category', () => {
    it.each([
      ['Conduct independent research in biology', 'research'],
      ['Work in a college lab', 'lab'],
      ['Write and submit a paper', 'paper'],
      ['Try to publish your findings', 'publish'],
      ['MIT PRIMES math research', 'PRIMES'],
      ['SPARK program at Stanford', 'SPARK'],
      ['Find a mentor in your field', 'mentor'],
      ['Reach out to a professor', 'professor'],
      ['Write an undergraduate thesis', 'thesis'],
      ['Submit to an academic journal', 'journal'],
    ])('matches English keyword "%s" (keyword: %s)', (text: string) => {
      expect(categorizeSuggestion(text)).toBe('research');
    });

    it.each([
      ['建议做一些科研项目', '科研'],
      ['尝试发表一篇论文', '论文'],
      ['去大学实验室实习', '实验室'],
      ['开展独立研究课题', '研究'],
      ['参与一个课题项目', '课题'],
    ])('matches Chinese keyword "%s" (keyword: %s)', (text: string) => {
      expect(categorizeSuggestion(text)).toBe('research');
    });
  });

  // ---------------------------------------------------------------------------
  // general (fallback)
  // ---------------------------------------------------------------------------
  describe('general category (fallback)', () => {
    it('returns general for text with no matching keywords', () => {
      expect(categorizeSuggestion('Improve your GPA this semester')).toBe('general');
    });

    it('returns general for an empty string', () => {
      expect(categorizeSuggestion('')).toBe('general');
    });

    it('returns general for generic advice', () => {
      expect(categorizeSuggestion('Focus on building strong relationships with teachers')).toBe(
        'general'
      );
    });

    it('returns general for unrelated Chinese text', () => {
      expect(categorizeSuggestion('提高你的GPA成绩')).toBe('general');
    });
  });

  // ---------------------------------------------------------------------------
  // case insensitivity
  // ---------------------------------------------------------------------------
  describe('case insensitivity', () => {
    it('matches SUMMER in uppercase', () => {
      expect(categorizeSuggestion('APPLY TO A SUMMER PROGRAM')).toBe('summer_program');
    });

    it('matches Competition in mixed case', () => {
      expect(categorizeSuggestion('Join a COMPETITION')).toBe('competition');
    });

    it('matches Research in title case', () => {
      // Note: avoid "university" which contains "rsi" (RSI keyword substring match)
      expect(categorizeSuggestion('Do Research at a local college')).toBe('research');
    });

    it('matches rsi in lowercase', () => {
      expect(categorizeSuggestion('apply to rsi next year')).toBe('summer_program');
    });

    it('matches usamo in lowercase', () => {
      expect(categorizeSuggestion('prepare for usamo')).toBe('competition');
    });
  });

  // ---------------------------------------------------------------------------
  // priority when multiple keywords match
  // ---------------------------------------------------------------------------
  describe('priority when multiple category keywords appear', () => {
    it('returns summer_program when summer and competition keywords both appear', () => {
      // summer_program is checked before competition in Object.entries order
      const result = categorizeSuggestion('This summer, prepare for the math competition');
      expect(result).toBe('summer_program');
    });

    it('returns summer_program when summer and research keywords both appear', () => {
      const result = categorizeSuggestion("Do summer research in a professor's lab");
      expect(result).toBe('summer_program');
    });

    it('returns competition when competition and research keywords both appear', () => {
      // competition is checked before research
      const result = categorizeSuggestion('Write a research paper for the science competition');
      expect(result).toBe('competition');
    });

    it('returns the first matching category for text with all three categories', () => {
      const result = categorizeSuggestion('This summer, join a competition and do research');
      expect(result).toBe('summer_program');
    });
  });

  // ---------------------------------------------------------------------------
  // edge cases
  // ---------------------------------------------------------------------------
  describe('edge cases', () => {
    it('matches keyword embedded in a longer word', () => {
      // "lab" is inside "collaborate" — this matches because .includes() is substring-based
      expect(categorizeSuggestion('Collaborate with peers')).toBe('research');
    });

    it('matches keyword surrounded by punctuation', () => {
      expect(categorizeSuggestion('Try: research!')).toBe('research');
    });

    it('handles very long text', () => {
      const longText = 'a'.repeat(10000) + ' summer ' + 'b'.repeat(10000);
      expect(categorizeSuggestion(longText)).toBe('summer_program');
    });

    it('handles text with only whitespace', () => {
      expect(categorizeSuggestion('   ')).toBe('general');
    });

    it('handles text with special characters', () => {
      expect(categorizeSuggestion('<script>alert("competition")</script>')).toBe('competition');
    });
  });
});
