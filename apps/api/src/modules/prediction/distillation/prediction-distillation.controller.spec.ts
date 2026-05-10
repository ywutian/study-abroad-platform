import { Test, TestingModule } from '@nestjs/testing';

import { CaseAggregateBackfillService } from './case-aggregate-backfill.service';
import { CdsBandsIngestionService } from './cds-bands-ingestion.service';
import { DistillationStatsRollupService } from './distillation-stats-rollup.service';
import { PredictionDistillationController } from './prediction-distillation.controller';
import { PredictionService } from '../prediction.service';
import { CounselorBackfillService } from '../counselor/counselor-backfill.service';

/**
 * Coverage for the admin "synthetic prediction" endpoint added in PR #60.
 *
 * The endpoint's job is small: hand the body's profile + schoolIds to
 * PredictionService.previewPredict() with shadow-distillation enabled. The
 * tests mock the service and assert the wiring — what arguments flow,
 * what locale/round defaults apply, and that the response is passed
 * through verbatim. Heavier integration coverage (does shadow distillation
 * actually populate servedTrace?) lives in compliant-distillation.spec.
 */
describe('PredictionDistillationController.dryRunPrediction', () => {
  let controller: PredictionDistillationController;
  let prediction: { previewPredict: jest.Mock };

  const sampleResult = {
    results: [
      {
        schoolId: 'cml-uc-merced',
        schoolName: 'University of California, Merced',
        probability: 0.88,
        probabilityLow: 0.78,
        probabilityHigh: 0.94,
        confidence: 'medium' as const,
        tier: 'match' as const,
        factors: [],
        suggestions: [],
        comparison: '',
        servedTrace: {
          distillation: {
            activeTeacherKeys: ['scorecard-v1', 'cohort-prior-v1'],
            teacherSummaries: [
              { key: 'scorecard-v1', effectiveWeight: 0.18 },
              { key: 'cohort-prior-v1', effectiveWeight: 0.12 },
            ],
          },
        },
      },
    ],
    dataCompleteness: 70,
  };

  beforeEach(async () => {
    prediction = {
      previewPredict: jest.fn().mockResolvedValue(sampleResult),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PredictionDistillationController],
      providers: [
        { provide: DistillationStatsRollupService, useValue: {} },
        { provide: CdsBandsIngestionService, useValue: {} },
        { provide: CaseAggregateBackfillService, useValue: {} },
        { provide: PredictionService, useValue: prediction },
        // PR-7 added counselor backfill to the controller — mock here to keep
        // the dry-run prediction tests focused on the previewPredict wiring.
        {
          provide: CounselorBackfillService,
          useValue: { runBackfill: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(PredictionDistillationController);
  });

  it('forwards the body to previewPredict with shadow distillation ON', async () => {
    const body = {
      profile: {
        gpa: 3.9,
        gpaScale: 4,
        nationality: 'US',
        testScores: [{ type: 'SAT', score: 1500 }],
        activities: [],
        awards: [],
      },
      schoolIds: ['cml-uc-merced'],
    } as any;

    await controller.dryRunPrediction(body);

    expect(prediction.previewPredict).toHaveBeenCalledTimes(1);
    const [profileArg, schoolIdsArg, optionsArg] =
      prediction.previewPredict.mock.calls[0];
    expect(profileArg.gpa).toBe(3.9);
    expect(profileArg.testScores).toEqual([{ type: 'SAT', score: 1500 }]);
    expect(schoolIdsArg).toEqual(['cml-uc-merced']);
    expect(optionsArg.includeShadowDistillation).toBe(true);
    expect(optionsArg.locale).toBe('en'); // defaults to en when unset
  });

  it('coerces missing arrays so the engine does not blow up on undefined', async () => {
    // ProfileInput requires testScores/activities/awards as arrays — DTO
    // declares them optional, so the controller must defensively default.
    await controller.dryRunPrediction({
      profile: { gpa: 3.5 },
      schoolIds: ['s1'],
    });

    const profileArg = prediction.previewPredict.mock.calls[0][0];
    expect(profileArg.testScores).toEqual([]);
    expect(profileArg.activities).toEqual([]);
    expect(profileArg.awards).toEqual([]);
  });

  it('passes locale + applicationRound when provided', async () => {
    await controller.dryRunPrediction({
      profile: { gpa: 3.5 },
      schoolIds: ['s1'],
      locale: 'zh',
      applicationRound: 'ED',
    });

    const optionsArg = prediction.previewPredict.mock.calls[0][2];
    expect(optionsArg.locale).toBe('zh');
    expect(optionsArg.applicationRound).toBe('ED');
  });

  it('returns the upstream service result verbatim (servedTrace included)', async () => {
    const result = await controller.dryRunPrediction({
      profile: { gpa: 3.9 },
      schoolIds: ['cml-uc-merced'],
    });

    expect(result).toEqual(sampleResult);
    // Critical: the trace must reach the operator unchanged so they can
    // see which teacher keys are active. If a future refactor strips the
    // trace, this test catches it.
    expect(
      (result.results[0] as any).servedTrace.distillation.activeTeacherKeys,
    ).toContain('scorecard-v1');
  });
});
