import { Test, TestingModule } from '@nestjs/testing';
import { AblationRunnerService } from './ablation-runner.service';
import { PredictionService } from '../prediction.service';
import { PredictionTransformerService } from '../prediction-transformer.service';
import { PrismaService } from '../../../prisma/prisma.service';
import type { ProfileInput } from '../prediction.prompts';

function makeProfile(): ProfileInput {
  return {
    gpa: 3.9,
    gpaScale: 4.0,
    targetMajor: 'Computer Science',
    isInternational: true,
    testScores: [{ type: 'SAT', score: 1520 }],
    activities: [{ category: 'STEM', role: 'Captain', name: 'Robotics' }],
    awards: [{ level: 'NATIONAL', name: 'AMC 12', tier: 2 }],
    essayQualityScore: 8,
    highSchoolTier: 2,
    highSchoolRecognition: 8,
  };
}

describe('AblationRunnerService', () => {
  let service: AblationRunnerService;
  let prediction: { previewPredict: jest.Mock };

  beforeEach(async () => {
    prediction = {
      previewPredict: jest.fn(async (p: ProfileInput, schoolIds: string[]) => {
        // Synthesize deterministic probabilities: drop 5pp when essay stripped,
        // drop 10pp when awards stripped — so we can assert deltas flow through.
        const awardsPenalty = p.awards.length === 0 ? 0.1 : 0;
        const essayPenalty = p.essayQualityScore == null ? 0.05 : 0;
        return {
          dataCompleteness: 80,
          results: schoolIds.map((id, i) => ({
            schoolId: id,
            schoolName: `School ${id}`,
            probability: Math.max(
              0.05,
              0.5 - awardsPenalty - essayPenalty + i * 0.01,
            ),
            confidence: 'medium' as const,
            tier:
              0.5 - awardsPenalty - essayPenalty >= 0.45 ? 'match' : 'reach',
            factors: [],
            suggestions: [],
            comparison: '',
          })),
        };
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AblationRunnerService,
        { provide: PredictionService, useValue: prediction },
        {
          provide: PredictionTransformerService,
          useValue: {
            profileToInput: jest.fn(),
            enrichWithEssayQuality: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            profile: { findUnique: jest.fn() },
            assessmentResult: { findMany: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get(AblationRunnerService);
  });

  it('runs every variant and reports delta vs baseline', async () => {
    const out = await service.runForProfileInput(
      makeProfile(),
      ['s1', 's2'],
      ['baseline', 'no-essay', 'no-awards'],
    );

    expect(prediction.previewPredict).toHaveBeenCalledTimes(3);
    expect(out.summary).toHaveLength(2); // excludes baseline
    expect(out.rows).toHaveLength(6); // 3 variants × 2 schools

    const noAwards = out.summary.find((s) => s.variant === 'no-awards')!;
    const noEssay = out.summary.find((s) => s.variant === 'no-essay')!;
    // Our synthetic engine drops 10pp when awards gone, 5pp when essay gone
    expect(noAwards.meanDeltaPp).toBeCloseTo(-10, 1);
    expect(noEssay.meanDeltaPp).toBeCloseTo(-5, 1);
  });

  it('auto-injects baseline if omitted from requested variants', async () => {
    await service.runForProfileInput(makeProfile(), ['s1'], ['no-essay']);
    const calls = prediction.previewPredict.mock.calls;
    // Baseline + no-essay = 2 calls
    expect(calls.length).toBe(2);
  });

  it('reports tierChangedFromBaseline when delta flips the bucket', async () => {
    // Baseline at prob=0.5 → tier=match; no-awards (penalty 0.1) → 0.4 → tier=reach
    const out = await service.runForProfileInput(
      makeProfile(),
      ['s1'],
      ['baseline', 'no-awards'],
    );
    const noAwardsRow = out.rows.find(
      (r) => r.variant === 'no-awards' && r.schoolId === 's1',
    )!;
    expect(noAwardsRow.tierChangedFromBaseline).toBe(true);
  });

  it('does not mutate the input ProfileInput across variant runs', async () => {
    const p = makeProfile();
    const snapshot = JSON.parse(JSON.stringify(p));
    await service.runForProfileInput(
      p,
      ['s1'],
      ['baseline', 'academic-only', 'no-essay', 'no-awards'],
    );
    expect(p).toEqual(snapshot);
  });
});
