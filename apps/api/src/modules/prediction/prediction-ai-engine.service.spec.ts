import { Test, TestingModule } from '@nestjs/testing';
import { LLMService } from '../ai-agent/core/llm.service';
import { PredictionAiEngine } from './prediction-ai-engine.service';
import { PredictionTransformerService } from './prediction-transformer.service';

describe('PredictionAiEngine', () => {
  let service: PredictionAiEngine;

  const mockLLMService = {
    chatSimpleGuarded: jest.fn(),
  };

  const mockTransformer = {
    extractSchoolMetrics: jest.fn().mockReturnValue({
      acceptanceRate: 10,
      satAvg: 1500,
      usNewsRank: 5,
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PredictionAiEngine,
        { provide: LLMService, useValue: mockLLMService },
        { provide: PredictionTransformerService, useValue: mockTransformer },
      ],
    }).compile();

    service = module.get<PredictionAiEngine>(PredictionAiEngine);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('computeSeed', () => {
    it('should return deterministic seed for same inputs', () => {
      const seed1 = service.computeSeed('profile-1', 'school-1');
      const seed2 = service.computeSeed('profile-1', 'school-1');
      expect(seed1).toBe(seed2);
    });

    it('should return different seeds for different inputs', () => {
      const seed1 = service.computeSeed('profile-1', 'school-1');
      const seed2 = service.computeSeed('profile-2', 'school-1');
      expect(seed1).not.toBe(seed2);
    });
  });

  describe('predictWithAI', () => {
    const mockProfile = {
      gpa: 3.9,
      testScores: [{ type: 'SAT', score: 1520 }],
      activities: [],
      awards: [],
      isInternational: false,
    } as any;

    const mockSchool = {
      id: 'school-1',
      name: 'Harvard',
      acceptanceRate: 3.5,
    } as any;

    it('should return parsed prediction on valid LLM response', async () => {
      mockLLMService.chatSimpleGuarded.mockResolvedValue(
        JSON.stringify({
          probability: 0.15,
          factors: [
            {
              name: 'GPA',
              impact: 'positive',
              weight: 0.3,
              detail: 'Strong GPA',
            },
          ],
          suggestions: ['Apply ED'],
          comparison: { gpaPercentile: 75 },
        }),
      );

      const result = await service.predictWithAI(
        mockProfile,
        mockSchool,
        { probability: 0.12 },
        [],
        'en',
      );

      expect(result).not.toBeNull();
      expect(result!.probability).toBeGreaterThanOrEqual(0.05);
      expect(result!.probability).toBeLessThanOrEqual(0.95);
      expect(result!.factors).toHaveLength(1);
      expect(result!.suggestions).toHaveLength(1);
    });

    it('should return null when LLM response is invalid JSON', async () => {
      mockLLMService.chatSimpleGuarded.mockResolvedValue('not valid json');

      const result = await service.predictWithAI(
        mockProfile,
        mockSchool,
        { probability: 0.12 },
        [],
        'en',
      );

      expect(result).toBeNull();
    });

    it('should return null when LLM call throws', async () => {
      mockLLMService.chatSimpleGuarded.mockRejectedValue(
        new Error('LLM timeout'),
      );

      const result = await service.predictWithAI(
        mockProfile,
        mockSchool,
        { probability: 0.12 },
        [],
        'en',
      );

      expect(result).toBeNull();
    });
  });

  describe('generateExplanation', () => {
    it('should return factors and suggestions', async () => {
      mockLLMService.chatSimpleGuarded.mockResolvedValue(
        JSON.stringify({
          factors: [
            {
              name: 'GPA',
              impact: 'positive',
              weight: 0.3,
              detail: 'Above median',
            },
          ],
          suggestions: ['Consider ED'],
        }),
      );

      const result = await service.generateExplanation(
        0.25,
        0.1,
        [{ hookType: 'sat', logOddsShift: 0.5, source: 'stats' }],
        { id: 's1', name: 'MIT' },
        'en',
      );

      expect(result).not.toBeNull();
      expect(result!.factors).toHaveLength(1);
      expect(result!.suggestions).toHaveLength(1);
    });

    it('should return null on LLM failure', async () => {
      mockLLMService.chatSimpleGuarded.mockRejectedValue(new Error('fail'));

      const result = await service.generateExplanation(
        0.25,
        0.1,
        [],
        { id: 's1', name: 'MIT' },
        'en',
      );

      expect(result).toBeNull();
    });
  });
});
