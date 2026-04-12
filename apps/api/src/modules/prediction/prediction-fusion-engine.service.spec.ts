import { Test, TestingModule } from '@nestjs/testing';
import { PredictionFusionEngine } from './prediction-fusion-engine.service';

describe('PredictionFusionEngine', () => {
  let service: PredictionFusionEngine;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PredictionFusionEngine],
    }).compile();

    service = module.get<PredictionFusionEngine>(PredictionFusionEngine);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('fusePredictions', () => {
    it('should return stats-only when no other engines available', () => {
      const result = service.fusePredictions(0.3, null, null, 0, 'medium');

      expect(result.probability).toBeCloseTo(0.3, 2);
      expect(result.engineScores.fusionMethod).toBe('stats_only');
      expect(result.crossEngineConsistency).toBe(1);
    });

    it('should fuse stats and AI with consistency weighting', () => {
      const result = service.fusePredictions(0.3, 0.35, null, 0, 'medium');

      expect(result.probability).toBeGreaterThan(0.29);
      expect(result.probability).toBeLessThan(0.36);
      expect(result.engineScores.fusionMethod).toContain('stats_ai');
    });

    it('should fuse all three engines when historical data available', () => {
      const result = service.fusePredictions(
        0.3,
        0.35,
        { probability: 0.4, sampleCount: 50, confidence: 0.8 },
        0,
        'high',
      );

      expect(result.probability).toBeGreaterThanOrEqual(0.05);
      expect(result.probability).toBeLessThanOrEqual(0.95);
      expect(result.engineScores.fusionMethod).toContain('hist');
    });

    it('should apply memory adjustment', () => {
      const withoutMemory = service.fusePredictions(
        0.3,
        null,
        null,
        0,
        'medium',
      );
      const withMemory = service.fusePredictions(
        0.3,
        null,
        null,
        0.02,
        'medium',
      );

      expect(withMemory.probability).toBeCloseTo(
        withoutMemory.probability + 0.02,
        2,
      );
    });

    it('should clamp probability to [0.05, 0.95]', () => {
      const result = service.fusePredictions(0.98, null, null, 0, 'medium');

      expect(result.probability).toBeLessThanOrEqual(0.95);
    });

    it('should include ML engine when provided', () => {
      const result = service.fusePredictions(0.3, 0.35, null, 0, 'medium', 0.4);

      expect(result.probability).toBeGreaterThan(0.29);
      expect(result.engineScores.ml).toBe(0.4);
      expect(result.engineScores.fusionMethod).toContain('ml');
    });

    it('should compute confidence interval based on confidence level', () => {
      const highConf = service.fusePredictions(0.5, null, null, 0, 'high');
      const lowConf = service.fusePredictions(0.5, null, null, 0, 'low');

      const highWidth = highConf.probabilityHigh - highConf.probabilityLow;
      const lowWidth = lowConf.probabilityHigh - lowConf.probabilityLow;

      expect(lowWidth).toBeGreaterThan(highWidth);
    });
  });
});
