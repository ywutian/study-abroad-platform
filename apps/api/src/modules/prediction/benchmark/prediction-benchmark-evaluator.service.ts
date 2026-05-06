import { Injectable, NotFoundException } from '@nestjs/common';
import type { BenchmarkProfileInput } from '@study-abroad/shared';
import {
  calculateConfidence,
  calculateTier,
} from '@study-abroad/shared/scoring';
import { PrismaService } from '../../../prisma/prisma.service';
import { PredictionMlPrimaryService } from '../prediction-ml-primary.service';
import { PredictionStatisticalEngine } from '../prediction-statistical-engine.service';
import { PredictionTransformerService } from '../prediction-transformer.service';
import type { ProfileInput } from '../prediction.prompts';

export type BenchmarkEvaluation = {
  probability: number;
  tier: string;
  confidence: string;
  modelVersion: string;
};

@Injectable()
export class PredictionBenchmarkEvaluatorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transformer: PredictionTransformerService,
    private readonly mlPrimaryService: PredictionMlPrimaryService,
    private readonly statisticalEngine: PredictionStatisticalEngine,
  ) {}

  normalizeProfileInput(input: BenchmarkProfileInput): BenchmarkProfileInput {
    return {
      ...input,
      testScores: Array.isArray(input.testScores) ? input.testScores : [],
      activities: Array.isArray(input.activities) ? input.activities : [],
      awards: Array.isArray(input.awards) ? input.awards : [],
      legacySchools: Array.isArray(input.legacySchools)
        ? input.legacySchools
        : [],
      assessment: input.assessment ?? undefined,
    };
  }

  async evaluateSchool(
    profileInputRaw: BenchmarkProfileInput,
    schoolId: string,
    locale = 'en',
  ): Promise<BenchmarkEvaluation> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });
    if (!school) {
      throw new NotFoundException(
        `School ${schoolId} not found for benchmark evaluation`,
      );
    }

    const profileInput = this.normalizeProfileInput(
      profileInputRaw,
    ) as ProfileInput;
    const applicationRound = profileInputRaw.applicationRound ?? 'RD';
    const schoolInput = this.transformer.schoolToInput(school as never);
    schoolInput.applicationRound = applicationRound;

    const profileMetrics = this.transformer.extractProfileMetrics(profileInput);
    const schoolMetrics = this.transformer.extractSchoolMetrics(schoolInput);

    try {
      const mlResult = await this.mlPrimaryService.predictForSchool(
        `benchmark:${schoolId}`,
        school,
        profileInput,
        schoolInput,
        profileMetrics,
        schoolMetrics,
        applicationRound,
        locale,
      );

      return {
        probability: mlResult.probability ?? 0,
        tier: mlResult.tier,
        confidence: mlResult.confidence,
        modelVersion: mlResult.modelVersion ?? 'v5-ml-primary',
      };
    } catch {
      const statsResult = this.statisticalEngine.predictWithStats(
        profileInput,
        schoolInput,
        undefined,
        locale,
      );
      return {
        probability: statsResult.probability,
        tier: calculateTier(statsResult.probability, schoolMetrics),
        confidence: calculateConfidence(profileMetrics, schoolMetrics),
        modelVersion: 'v3-benchmark-fallback',
      };
    }
  }
}
