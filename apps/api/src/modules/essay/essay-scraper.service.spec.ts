import { Test, TestingModule } from '@nestjs/testing';
import { EssayScraperService } from './essay-scraper.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmScrapeStrategy } from './strategies/llm.strategy';
import { OfficialScrapeStrategy } from './strategies/official.strategy';
import { CollegeVineScrapeStrategy } from './strategies/collegevine.strategy';
import { CommonAppScrapeStrategy } from './strategies/commonapp.strategy';
import { AiValidatorService } from './ai-validator.service';
import { NotificationService } from '../notification/notification.service';
import { SourceType, EssayStatus } from '../../common/types/enums';
import { ScrapeResult } from './strategies/base.strategy';

describe('EssayScraperService', () => {
  let service: EssayScraperService;

  const mockPrisma = {
    school: {
      findUnique: jest.fn(),
    },
    essayPrompt: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    schoolEssaySource: {
      findMany: jest.fn(),
    },
  };

  const mockLlmStrategy = {
    scrape: jest.fn(),
    scrapeWithConfig: jest.fn(),
  };

  const mockOfficialStrategy = {
    scrape: jest.fn(),
    getConfiguredSchools: jest.fn().mockReturnValue([]),
  };

  const mockCollegevineStrategy = {
    scrape: jest.fn(),
    getConfiguredSchools: jest.fn().mockReturnValue([]),
  };

  const mockCommonAppStrategy = {
    scrape: jest.fn(),
  };

  const mockAiValidator = {
    validateAndEnhance: jest.fn(),
    compareMultipleSources: jest.fn(),
  };

  const mockNotificationService = {
    notifyNewEssayPrompts: jest.fn().mockResolvedValue(undefined),
    createNotification: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EssayScraperService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LlmScrapeStrategy, useValue: mockLlmStrategy },
        { provide: OfficialScrapeStrategy, useValue: mockOfficialStrategy },
        {
          provide: CollegeVineScrapeStrategy,
          useValue: mockCollegevineStrategy,
        },
        { provide: CommonAppScrapeStrategy, useValue: mockCommonAppStrategy },
        { provide: AiValidatorService, useValue: mockAiValidator },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get<EssayScraperService>(EssayScraperService);

    // Speed up tests by removing delays
    jest
      .spyOn(service as any, 'delay')
      .mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============ scrapeSchool ============

  describe('scrapeSchool', () => {
    const schoolName = 'MIT';
    const year = 2026;

    it('should succeed with LLM strategy when it returns essays', async () => {
      const llmResult: ScrapeResult = {
        schoolName: 'MIT',
        year: 2026,
        essays: [
          { prompt: 'Tell us about yourself', confidence: 0.9 },
          { prompt: 'Why MIT?', confidence: 0.85 },
        ],
        sourceUrl: 'https://mit.edu/apply',
        rawContent: 'raw html content',
      };

      mockLlmStrategy.scrape.mockResolvedValue(llmResult);
      mockAiValidator.compareMultipleSources.mockResolvedValue(
        llmResult.essays,
      );

      // saveEssays dependencies
      mockPrisma.school.findUnique.mockResolvedValue({
        id: 'school-1',
        nameNorm: 'mit',
      });
      mockPrisma.essayPrompt.findMany.mockResolvedValue([]); // no prior prompts
      mockAiValidator.validateAndEnhance.mockResolvedValue({
        isValid: true,
        confidence: 0.9,
        promptZh: '中文翻译',
        aiTips: 'some tips',
        aiCategory: 'personal',
      });
      mockPrisma.essayPrompt.findFirst.mockResolvedValue(null); // no duplicates
      mockPrisma.essayPrompt.create.mockResolvedValue({ id: 'essay-1' });

      const result = await service.scrapeSchool(schoolName, year);

      expect(result.success).toBe(true);
      expect(result.schoolName).toBe('MIT');
      expect(result.essaysFound).toBe(2);
      expect(mockLlmStrategy.scrape).toHaveBeenCalledWith('MIT', 2026);
      // Should not fallback to other strategies
      expect(mockOfficialStrategy.scrape).not.toHaveBeenCalled();
      expect(mockCollegevineStrategy.scrape).not.toHaveBeenCalled();
    });

    it('should fallback to regex strategies when LLM strategy fails', async () => {
      mockLlmStrategy.scrape.mockRejectedValue(new Error('LLM unavailable'));

      const officialResult: ScrapeResult = {
        schoolName: 'MIT',
        year: 2026,
        essays: [{ prompt: 'Describe a challenge', confidence: 0.7 }],
        sourceUrl: 'https://mit.edu/admissions',
      };

      mockOfficialStrategy.scrape.mockResolvedValue(officialResult);
      mockCollegevineStrategy.scrape.mockResolvedValue(null);
      mockAiValidator.compareMultipleSources.mockResolvedValue(
        officialResult.essays,
      );

      // saveEssays dependencies
      mockPrisma.school.findUnique.mockResolvedValue({
        id: 'school-1',
        nameNorm: 'mit',
      });
      mockPrisma.essayPrompt.findMany.mockResolvedValue([]);
      mockAiValidator.validateAndEnhance.mockResolvedValue({
        isValid: true,
        confidence: 0.7,
        promptZh: '翻译',
      });
      mockPrisma.essayPrompt.findFirst.mockResolvedValue(null);
      mockPrisma.essayPrompt.create.mockResolvedValue({ id: 'essay-2' });

      const result = await service.scrapeSchool(schoolName, year);

      expect(result.success).toBe(true);
      expect(result.essaysFound).toBe(1);
      expect(mockOfficialStrategy.scrape).toHaveBeenCalledWith('MIT', 2026);
    });

    it('should fallback when LLM returns empty essays', async () => {
      mockLlmStrategy.scrape.mockResolvedValue({
        schoolName: 'MIT',
        year: 2026,
        essays: [],
        sourceUrl: 'https://mit.edu',
      });

      const cvResult: ScrapeResult = {
        schoolName: 'MIT',
        year: 2026,
        essays: [{ prompt: 'What matters to you?', confidence: 0.75 }],
        sourceUrl: 'https://collegevine.com/mit',
      };

      mockOfficialStrategy.scrape.mockResolvedValue(null);
      mockCollegevineStrategy.scrape.mockResolvedValue(cvResult);
      mockAiValidator.compareMultipleSources.mockResolvedValue(cvResult.essays);

      // saveEssays dependencies
      mockPrisma.school.findUnique.mockResolvedValue({
        id: 'school-1',
        nameNorm: 'mit',
      });
      mockPrisma.essayPrompt.findMany.mockResolvedValue([]);
      mockAiValidator.validateAndEnhance.mockResolvedValue({
        isValid: true,
        confidence: 0.75,
      });
      mockPrisma.essayPrompt.findFirst.mockResolvedValue(null);
      mockPrisma.essayPrompt.create.mockResolvedValue({ id: 'essay-3' });

      const result = await service.scrapeSchool(schoolName, year);

      expect(result.success).toBe(true);
      expect(result.essaysFound).toBe(1);
      expect(mockCollegevineStrategy.scrape).toHaveBeenCalled();
    });

    it('should return failure when no source returns data', async () => {
      mockLlmStrategy.scrape.mockRejectedValue(new Error('LLM failed'));
      mockOfficialStrategy.scrape.mockResolvedValue(null);
      mockCollegevineStrategy.scrape.mockResolvedValue(null);

      const result = await service.scrapeSchool(schoolName, year);

      expect(result.success).toBe(false);
      expect(result.essaysFound).toBe(0);
      expect(result.error).toBe('No data found from any source');
    });

    it('should continue to next source when one regex strategy throws', async () => {
      mockLlmStrategy.scrape.mockRejectedValue(new Error('LLM error'));
      mockOfficialStrategy.scrape.mockRejectedValue(
        new Error('Network timeout'),
      );

      const cvResult: ScrapeResult = {
        schoolName: 'MIT',
        year: 2026,
        essays: [{ prompt: 'Essay prompt', confidence: 0.8 }],
        sourceUrl: 'https://collegevine.com/mit',
      };
      mockCollegevineStrategy.scrape.mockResolvedValue(cvResult);
      mockAiValidator.compareMultipleSources.mockResolvedValue(cvResult.essays);

      // saveEssays
      mockPrisma.school.findUnique.mockResolvedValue({
        id: 'school-1',
        nameNorm: 'mit',
      });
      mockPrisma.essayPrompt.findMany.mockResolvedValue([]);
      mockAiValidator.validateAndEnhance.mockResolvedValue({
        isValid: true,
        confidence: 0.8,
      });
      mockPrisma.essayPrompt.findFirst.mockResolvedValue(null);
      mockPrisma.essayPrompt.create.mockResolvedValue({ id: 'e1' });

      const result = await service.scrapeSchool(schoolName, year);

      expect(result.success).toBe(true);
      expect(result.essaysFound).toBe(1);
    });
  });

  // ============ saveEssays ============

  describe('saveEssays', () => {
    const scrapeResults: ScrapeResult[] = [
      {
        schoolName: 'Stanford',
        year: 2026,
        essays: [],
        sourceUrl: 'https://stanford.edu',
        rawContent: 'raw content',
      },
    ];

    it('should return 0 when school is not found', async () => {
      mockPrisma.school.findUnique.mockResolvedValue(null);

      const result = await service.saveEssays(
        'NonExistent University',
        2026,
        [{ prompt: 'Test prompt' }],
        scrapeResults,
      );

      expect(result).toBe(0);
    });

    it('should skip duplicate essays (dedup by exact prompt match)', async () => {
      mockPrisma.school.findUnique.mockResolvedValue({
        id: 'school-1',
        nameNorm: 'stanford',
      });
      mockPrisma.essayPrompt.findMany.mockResolvedValue([]); // no prior year

      // First essay: passes validation, already exists
      // Second essay: passes validation, does not exist
      mockAiValidator.validateAndEnhance
        .mockResolvedValueOnce({
          isValid: true,
          confidence: 0.9,
          promptZh: '翻译1',
        })
        .mockResolvedValueOnce({
          isValid: true,
          confidence: 0.85,
          promptZh: '翻译2',
        });

      mockPrisma.essayPrompt.findFirst
        .mockResolvedValueOnce({ id: 'existing-1' }) // duplicate
        .mockResolvedValueOnce(null); // not a duplicate

      mockPrisma.essayPrompt.create.mockResolvedValue({ id: 'new-1' });

      const result = await service.saveEssays(
        'Stanford',
        2026,
        [
          { prompt: 'Existing prompt', confidence: 0.9 },
          { prompt: 'New prompt', confidence: 0.85 },
        ],
        scrapeResults,
      );

      expect(result).toBe(1); // only the non-duplicate saved
      expect(mockPrisma.essayPrompt.create).toHaveBeenCalledTimes(1);
    });

    it('should skip essays that fail AI validation', async () => {
      mockPrisma.school.findUnique.mockResolvedValue({
        id: 'school-1',
        nameNorm: 'stanford',
      });
      mockPrisma.essayPrompt.findMany.mockResolvedValue([]);
      mockAiValidator.validateAndEnhance.mockResolvedValue({
        isValid: false,
        confidence: 0.2,
      });

      const result = await service.saveEssays(
        'Stanford',
        2026,
        [{ prompt: 'Invalid essay prompt' }],
        scrapeResults,
      );

      expect(result).toBe(0);
      expect(mockPrisma.essayPrompt.create).not.toHaveBeenCalled();
    });

    it('should assign VERIFIED status when confidence >= 0.8', async () => {
      mockPrisma.school.findUnique.mockResolvedValue({
        id: 'school-1',
        nameNorm: 'stanford',
      });
      mockPrisma.essayPrompt.findMany.mockResolvedValue([]);
      mockAiValidator.validateAndEnhance.mockResolvedValue({
        isValid: true,
        confidence: 0.9,
        promptZh: '翻译',
        aiTips: 'tips',
        aiCategory: 'personal',
      });
      mockPrisma.essayPrompt.findFirst.mockResolvedValue(null);
      mockPrisma.essayPrompt.create.mockResolvedValue({ id: 'e1' });

      await service.saveEssays(
        'Stanford',
        2026,
        [{ prompt: 'High confidence prompt', confidence: 0.9 }],
        scrapeResults,
      );

      expect(mockPrisma.essayPrompt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: EssayStatus.VERIFIED,
          }),
        }),
      );
    });

    it('should assign PENDING status when confidence < 0.8', async () => {
      mockPrisma.school.findUnique.mockResolvedValue({
        id: 'school-1',
        nameNorm: 'stanford',
      });
      mockPrisma.essayPrompt.findMany.mockResolvedValue([]);
      mockAiValidator.validateAndEnhance.mockResolvedValue({
        isValid: true,
        confidence: 0.5,
        promptZh: '翻译',
      });
      mockPrisma.essayPrompt.findFirst.mockResolvedValue(null);
      mockPrisma.essayPrompt.create.mockResolvedValue({ id: 'e1' });

      await service.saveEssays(
        'Stanford',
        2026,
        [{ prompt: 'Low confidence prompt', confidence: 0.5 }],
        scrapeResults,
      );

      expect(mockPrisma.essayPrompt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: EssayStatus.PENDING,
          }),
        }),
      );
    });

    it('should handle create errors gracefully and continue', async () => {
      mockPrisma.school.findUnique.mockResolvedValue({
        id: 'school-1',
        nameNorm: 'stanford',
      });
      mockPrisma.essayPrompt.findMany.mockResolvedValue([]);
      mockAiValidator.validateAndEnhance.mockResolvedValue({
        isValid: true,
        confidence: 0.9,
      });
      mockPrisma.essayPrompt.findFirst.mockResolvedValue(null);

      // First create fails, second succeeds
      mockPrisma.essayPrompt.create
        .mockRejectedValueOnce(new Error('DB constraint error'))
        .mockResolvedValueOnce({ id: 'e2' });

      const result = await service.saveEssays(
        'Stanford',
        2026,
        [
          { prompt: 'First prompt', confidence: 0.9 },
          { prompt: 'Second prompt', confidence: 0.9 },
        ],
        scrapeResults,
      );

      expect(result).toBe(1); // only the second one saved
      expect(mockPrisma.essayPrompt.create).toHaveBeenCalledTimes(2);
    });
  });

  // ============ testScrapeSchool ============

  describe('testScrapeSchool', () => {
    it('should return results without writing to DB', async () => {
      const schoolName = 'Harvard';

      mockPrisma.school.findUnique.mockResolvedValue({
        id: 'school-1',
        nameNorm: 'harvard',
        essaySources: [
          {
            isActive: true,
            priority: 1,
            url: 'https://harvard.edu/apply',
            scrapeGroup: 'IVY',
            scrapeConfig: null,
          },
        ],
      });

      const llmResult: ScrapeResult = {
        schoolName: 'Harvard',
        year: 2026,
        essays: [
          { prompt: 'Tell us about yourself', confidence: 0.9, wordLimit: 250 },
        ],
        sourceUrl: 'https://harvard.edu/apply',
        rawContent: 'Some raw HTML content for preview',
      };

      mockLlmStrategy.scrapeWithConfig.mockResolvedValue(llmResult);
      mockAiValidator.validateAndEnhance.mockResolvedValue({
        isValid: true,
        confidence: 0.9,
        promptZh: '请介绍你自己',
        aiTips: 'Be authentic',
        aiCategory: 'personal',
      });

      // No prior year prompts
      mockPrisma.essayPrompt.findMany.mockResolvedValue([]);

      const result = await service.testScrapeSchool(schoolName, 2026);

      expect(result.school).toBe('Harvard');
      expect(result.schoolId).toBe('school-1');
      expect(result.scrapeGroup).toBe('IVY');
      expect(result.essays).toHaveLength(1);
      expect(result.essays[0].promptZh).toBe('请介绍你自己');
      expect(result.essays[0].changeType).toBe('NEW');
      expect(result.rawContentPreview).toBe(
        'Some raw HTML content for preview',
      );

      // Verify no DB writes happened
      expect(mockPrisma.essayPrompt.create).not.toHaveBeenCalled();
    });

    it('should return empty results when no scrape data found', async () => {
      mockPrisma.school.findUnique.mockResolvedValue({
        id: 'school-1',
        nameNorm: 'unknown',
        essaySources: [
          {
            isActive: true,
            priority: 1,
            url: 'https://example.com',
            scrapeGroup: 'GENERIC',
            scrapeConfig: null,
          },
        ],
      });

      mockLlmStrategy.scrapeWithConfig.mockResolvedValue(null);
      mockOfficialStrategy.scrape.mockResolvedValue(null);
      mockCollegevineStrategy.scrape.mockResolvedValue(null);

      const result = await service.testScrapeSchool('Unknown School', 2026);

      expect(result.essays).toHaveLength(0);
      expect(result.rawContentPreview).toBe('');
    });

    it('should fallback through strategies when LLM returns nothing', async () => {
      mockPrisma.school.findUnique.mockResolvedValue({
        id: 'school-1',
        nameNorm: 'yale',
        essaySources: [
          {
            isActive: true,
            priority: 1,
            url: 'https://yale.edu',
            scrapeGroup: 'IVY',
            scrapeConfig: null,
          },
        ],
      });

      mockLlmStrategy.scrapeWithConfig.mockResolvedValue({
        schoolName: 'Yale',
        year: 2026,
        essays: [],
        sourceUrl: 'https://yale.edu',
      });

      const officialResult: ScrapeResult = {
        schoolName: 'Yale',
        year: 2026,
        essays: [{ prompt: 'Why Yale?', confidence: 0.8 }],
        sourceUrl: 'https://yale.edu/admissions',
        rawContent: 'Official page content',
      };

      mockOfficialStrategy.scrape.mockResolvedValue(officialResult);
      mockAiValidator.validateAndEnhance.mockResolvedValue({
        isValid: true,
        confidence: 0.8,
        promptZh: '为什么选择耶鲁？',
        aiTips: 'Be specific',
        aiCategory: 'why_school',
      });
      mockPrisma.essayPrompt.findMany.mockResolvedValue([]);

      const result = await service.testScrapeSchool('Yale', 2026);

      expect(result.essays).toHaveLength(1);
      expect(result.essays[0].prompt).toBe('Why Yale?');
      expect(mockOfficialStrategy.scrape).toHaveBeenCalled();
    });

    it('should filter out invalid essays from AI validation', async () => {
      mockPrisma.school.findUnique.mockResolvedValue({
        id: 'school-1',
        nameNorm: 'columbia',
        essaySources: [],
      });

      const officialResult: ScrapeResult = {
        schoolName: 'Columbia',
        year: 2026,
        essays: [
          { prompt: 'Valid essay prompt', confidence: 0.9 },
          { prompt: 'Invalid garbage text', confidence: 0.1 },
        ],
        sourceUrl: 'https://columbia.edu',
        rawContent: 'content',
      };

      // No essaySources, so LLM strategy is skipped (source is undefined)
      mockOfficialStrategy.scrape.mockResolvedValue(officialResult);
      mockAiValidator.validateAndEnhance
        .mockResolvedValueOnce({
          isValid: true,
          confidence: 0.9,
          promptZh: '有效题目',
        })
        .mockResolvedValueOnce({
          isValid: false,
          confidence: 0.1,
        });
      mockPrisma.essayPrompt.findMany.mockResolvedValue([]);

      const result = await service.testScrapeSchool('Columbia', 2026);

      expect(result.essays).toHaveLength(1);
      expect(result.essays[0].prompt).toBe('Valid essay prompt');
    });
  });

  // ============ detectChanges ============

  describe('detectChanges', () => {
    it('should mark all essays as NEW when no prior year prompts exist', async () => {
      mockPrisma.essayPrompt.findMany.mockResolvedValue([]);

      const newEssays = [
        { prompt: 'Brand new essay prompt', confidence: 0.9 },
        { prompt: 'Another new prompt', confidence: 0.8 },
      ];

      const result = await service.detectChanges('school-1', 2026, newEssays);

      expect(result).toHaveLength(2);
      expect(result[0].changeType).toBe('NEW');
      expect(result[1].changeType).toBe('NEW');
      expect(result[0].previousPromptId).toBeUndefined();
    });

    it('should mark essay as UNCHANGED when Jaccard similarity > 0.9', async () => {
      mockPrisma.essayPrompt.findMany.mockResolvedValue([
        {
          id: 'prior-1',
          prompt: 'Tell us about a meaningful experience in your life',
        },
      ]);

      // Nearly identical prompt (identical words)
      const newEssays = [
        {
          prompt: 'Tell us about a meaningful experience in your life',
          confidence: 0.9,
        },
      ];

      const result = await service.detectChanges('school-1', 2026, newEssays);

      expect(result[0].changeType).toBe('UNCHANGED');
      expect(result[0].previousPromptId).toBe('prior-1');
    });

    it('should mark essay as MODIFIED when Jaccard similarity is between 0.5 and 0.9', async () => {
      mockPrisma.essayPrompt.findMany.mockResolvedValue([
        {
          id: 'prior-1',
          prompt:
            'Tell us about an experience that changed your perspective on the world around you',
        },
      ]);

      // Shares most words but swaps a few — Jaccard should be between 0.5 and 0.9
      const newEssays = [
        {
          prompt:
            'Tell us about an experience that changed your perspective on the community around you',
          confidence: 0.8,
        },
      ];

      const result = await service.detectChanges('school-1', 2026, newEssays);

      expect(result[0].changeType).toBe('MODIFIED');
      expect(result[0].previousPromptId).toBe('prior-1');
    });

    it('should mark essay as NEW when Jaccard similarity <= 0.5', async () => {
      mockPrisma.essayPrompt.findMany.mockResolvedValue([
        {
          id: 'prior-1',
          prompt: 'Describe your favorite extracurricular activity',
        },
      ]);

      // Completely different topic
      const newEssays = [
        {
          prompt:
            'What scientific research question fascinates you the most and why?',
          confidence: 0.85,
        },
      ];

      const result = await service.detectChanges('school-1', 2026, newEssays);

      expect(result[0].changeType).toBe('NEW');
      expect(result[0].previousPromptId).toBeUndefined();
    });

    it('should match each new essay to the best prior prompt', async () => {
      mockPrisma.essayPrompt.findMany.mockResolvedValue([
        { id: 'prior-1', prompt: 'Why do you want to attend our school?' },
        { id: 'prior-2', prompt: 'Describe a community you belong to' },
      ]);

      const newEssays = [
        {
          prompt:
            'Why do you want to attend our school and what will you contribute?',
          confidence: 0.9,
        },
        {
          prompt: 'Describe a community you belong to and your role in it',
          confidence: 0.85,
        },
      ];

      const result = await service.detectChanges('school-1', 2026, newEssays);

      // First essay should be MODIFIED (similar to prior-1)
      expect(result[0].previousPromptId).toBe('prior-1');
      expect(['UNCHANGED', 'MODIFIED']).toContain(result[0].changeType);

      // Second essay should be MODIFIED (similar to prior-2)
      expect(result[1].previousPromptId).toBe('prior-2');
      expect(['UNCHANGED', 'MODIFIED']).toContain(result[1].changeType);
    });
  });

  // ============ textSimilarity (private, tested indirectly) ============

  describe('textSimilarity (via detectChanges)', () => {
    it('should return 1.0 for identical strings', async () => {
      mockPrisma.essayPrompt.findMany.mockResolvedValue([
        { id: 'prior-1', prompt: 'exactly the same prompt' },
      ]);

      const result = await service.detectChanges('school-1', 2026, [
        { prompt: 'exactly the same prompt' },
      ]);

      expect(result[0].changeType).toBe('UNCHANGED');
    });

    it('should handle empty prior prompts gracefully', async () => {
      mockPrisma.essayPrompt.findMany.mockResolvedValue([]);

      const result = await service.detectChanges('school-1', 2026, [
        { prompt: 'any prompt' },
      ]);

      expect(result[0].changeType).toBe('NEW');
    });
  });

  // ============ Error Handling ============

  describe('error handling', () => {
    it('should handle LLM strategy throwing and still attempt fallbacks', async () => {
      mockLlmStrategy.scrape.mockRejectedValue(
        new Error('API rate limit exceeded'),
      );

      // Official also fails
      mockOfficialStrategy.scrape.mockRejectedValue(
        new Error('Connection refused'),
      );

      // CollegeVine returns null
      mockCollegevineStrategy.scrape.mockResolvedValue(null);

      const result = await service.scrapeSchool('MIT', 2026);

      expect(result.success).toBe(false);
      expect(result.essaysFound).toBe(0);
      expect(result.error).toBe('No data found from any source');
    });

    it('should handle null returned from LLM strategy', async () => {
      mockLlmStrategy.scrape.mockResolvedValue(null);

      const officialResult: ScrapeResult = {
        schoolName: 'MIT',
        year: 2026,
        essays: [{ prompt: 'Test prompt', confidence: 0.8 }],
        sourceUrl: 'https://mit.edu',
      };

      mockOfficialStrategy.scrape.mockResolvedValue(officialResult);
      mockCollegevineStrategy.scrape.mockResolvedValue(null);
      mockAiValidator.compareMultipleSources.mockResolvedValue(
        officialResult.essays,
      );

      // saveEssays
      mockPrisma.school.findUnique.mockResolvedValue({
        id: 'school-1',
        nameNorm: 'mit',
      });
      mockPrisma.essayPrompt.findMany.mockResolvedValue([]);
      mockAiValidator.validateAndEnhance.mockResolvedValue({
        isValid: true,
        confidence: 0.8,
      });
      mockPrisma.essayPrompt.findFirst.mockResolvedValue(null);
      mockPrisma.essayPrompt.create.mockResolvedValue({ id: 'e1' });

      const result = await service.scrapeSchool('MIT', 2026);

      expect(result.success).toBe(true);
      expect(mockOfficialStrategy.scrape).toHaveBeenCalled();
    });

    it('should handle database errors during save gracefully', async () => {
      mockPrisma.school.findUnique.mockResolvedValue({
        id: 'school-1',
        nameNorm: 'mit',
      });
      mockPrisma.essayPrompt.findMany.mockResolvedValue([]);
      mockAiValidator.validateAndEnhance.mockResolvedValue({
        isValid: true,
        confidence: 0.9,
      });
      mockPrisma.essayPrompt.findFirst.mockResolvedValue(null);
      mockPrisma.essayPrompt.create.mockRejectedValue(
        new Error('Database connection lost'),
      );

      const result = await service.saveEssays(
        'MIT',
        2026,
        [{ prompt: 'Test', confidence: 0.9 }],
        [
          {
            schoolName: 'MIT',
            year: 2026,
            essays: [],
            sourceUrl: 'https://mit.edu',
          },
        ],
      );

      // Should not throw, returns 0
      expect(result).toBe(0);
    });
  });

  // ============ getConfiguredSchools ============

  describe('getConfiguredSchools', () => {
    it('should merge DB schools with hardcoded strategy schools', async () => {
      mockPrisma.schoolEssaySource.findMany.mockResolvedValue([
        { school: { name: 'MIT' } },
        { school: { name: 'Stanford' } },
      ]);
      mockOfficialStrategy.getConfiguredSchools.mockReturnValue([
        'Harvard',
        'MIT',
      ]);
      mockCollegevineStrategy.getConfiguredSchools.mockReturnValue([
        'Yale',
        'Stanford',
      ]);

      const result = await service.getConfiguredSchools();

      // Should be deduplicated
      expect(result).toContain('MIT');
      expect(result).toContain('Stanford');
      expect(result).toContain('Harvard');
      expect(result).toContain('Yale');
      // MIT and Stanford should not be duplicated
      expect(result.filter((s) => s === 'MIT')).toHaveLength(1);
      expect(result.filter((s) => s === 'Stanford')).toHaveLength(1);
    });
  });
});
