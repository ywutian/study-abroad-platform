import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PredictionService } from '../prediction.service';
import { PredictionTransformerService } from '../prediction-transformer.service';
import type { ProfileInput } from '../prediction.prompts';
import type { PredictionResultDto } from '../dto';
import {
  ABLATION_VARIANTS,
  ALL_VARIANT_KEYS,
  type AblationVariantKey,
} from './ablation-variants';

export interface AblationRowResult {
  variant: AblationVariantKey;
  schoolId: string;
  schoolName: string;
  probability: number;
  probabilityLow?: number;
  probabilityHigh?: number;
  tier: string;
  confidence: string;
  /** Absolute percentage-point delta vs baseline for the same school. */
  deltaVsBaselinePp?: number;
  tierChangedFromBaseline?: boolean;
}

export interface AblationSummary {
  variant: AblationVariantKey;
  schoolsEvaluated: number;
  meanDeltaPp: number;
  meanAbsDeltaPp: number;
  maxAbsDeltaPp: number;
  tierFlipRate: number; // 0..1
}

export interface AblationRunOutput {
  profileId?: string;
  variantCount: number;
  schoolCount: number;
  rows: AblationRowResult[];
  summary: AblationSummary[];
}

/**
 * Runs the prediction pipeline against a base profile multiple times, each
 * time with a specific signal removed (ablation). Used to quantify the
 * marginal contribution of each feature group (essay, HS profile, awards,
 * activities, major) to the served probability.
 *
 * The runner bypasses caching, persistence, memory writes, and points
 * charging via `PredictionService.previewPredict`.
 */
@Injectable()
export class AblationRunnerService {
  private readonly logger = new Logger(AblationRunnerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly prediction: PredictionService,
    private readonly transformer: PredictionTransformerService,
  ) {}

  /**
   * Run ablation for a Profile currently in the DB.
   * Loads the profile, materializes a ProfileInput via the normal
   * transformer path, then dispatches to `runForProfileInput`.
   */
  async runForProfileId(
    profileId: string,
    schoolIds: string[],
    variants: AblationVariantKey[] = ALL_VARIANT_KEYS,
    locale = 'zh',
  ): Promise<AblationRunOutput> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: profileId },
      include: {
        testScores: true,
        activities: {
          orderBy: { order: 'asc' },
          include: { activityTemplate: true },
        },
        awards: { include: { competition: true } },
        education: { include: { highSchool: true } },
      },
    });
    if (!profile)
      throw new NotFoundException(`Profile not found: ${profileId}`);

    const assessmentResults = await this.prisma.assessmentResult.findMany({
      where: { userId: profile.userId },
      include: { assessment: { select: { type: true } } },
      orderBy: { completedAt: 'desc' },
    });
    const mbti = assessmentResults.find((r) => r.assessment.type === 'MBTI');
    const holland = assessmentResults.find(
      (r) => r.assessment.type === 'HOLLAND',
    );
    const assessmentData =
      mbti || holland
        ? {
            mbtiType: (mbti?.result as any)?.mbtiType,
            hollandCodes: (holland?.result as any)?.hollandCodes,
          }
        : undefined;

    const profileInput = this.transformer.profileToInput(
      profile as any,
      assessmentData,
    );
    await this.transformer.enrichWithEssayQuality(profileInput, profile.id);

    const output = await this.runForProfileInput(
      profileInput,
      schoolIds,
      variants,
      locale,
    );
    output.profileId = profileId;
    return output;
  }

  /**
   * Run ablation directly against a caller-built ProfileInput.
   * Useful for synthetic/benchmark profiles that don't exist in the DB.
   */
  async runForProfileInput(
    profileInput: ProfileInput,
    schoolIds: string[],
    variants: AblationVariantKey[] = ALL_VARIANT_KEYS,
    locale = 'zh',
  ): Promise<AblationRunOutput> {
    if (!variants.includes('baseline')) variants = ['baseline', ...variants];

    // Run each variant sequentially (DB contention + determinism > throughput here)
    const variantResults = new Map<AblationVariantKey, PredictionResultDto[]>();
    for (const key of variants) {
      const def = ABLATION_VARIANTS[key];
      if (!def) {
        this.logger.warn(`Unknown variant: ${key}`);
        continue;
      }
      const mutated = def.apply(profileInput);
      const { results } = await this.prediction.previewPredict(
        mutated,
        schoolIds,
        { locale },
      );
      variantResults.set(key, results);
      this.logger.log(
        `variant=${key} schools=${results.length} avgProb=${this.avgProb(results)}`,
      );
    }

    const baseline = variantResults.get('baseline') ?? [];
    const baselineBySchool = new Map(baseline.map((r) => [r.schoolId, r]));

    const rows: AblationRowResult[] = [];
    for (const key of variants) {
      const rs = variantResults.get(key) ?? [];
      for (const r of rs) {
        const base = baselineBySchool.get(r.schoolId);
        const row: AblationRowResult = {
          variant: key,
          schoolId: r.schoolId,
          schoolName: r.schoolName,
          probability: r.probability,
          probabilityLow: r.probabilityLow,
          probabilityHigh: r.probabilityHigh,
          tier: r.tier,
          confidence: r.confidence,
        };
        if (base && key !== 'baseline') {
          row.deltaVsBaselinePp = (r.probability - base.probability) * 100;
          row.tierChangedFromBaseline = r.tier !== base.tier;
        }
        rows.push(row);
      }
    }

    const summary: AblationSummary[] = variants
      .filter((v) => v !== 'baseline')
      .map((key) => {
        const rs = (variantResults.get(key) ?? []).map((r) => {
          const base = baselineBySchool.get(r.schoolId);
          return {
            delta: base ? (r.probability - base.probability) * 100 : 0,
            flipped: base ? r.tier !== base.tier : false,
          };
        });
        const n = rs.length || 1;
        const meanDelta = rs.reduce((s, x) => s + x.delta, 0) / n;
        const meanAbs = rs.reduce((s, x) => s + Math.abs(x.delta), 0) / n;
        const maxAbs = rs.reduce((m, x) => Math.max(m, Math.abs(x.delta)), 0);
        const flipRate = rs.reduce((s, x) => s + (x.flipped ? 1 : 0), 0) / n;
        return {
          variant: key,
          schoolsEvaluated: rs.length,
          meanDeltaPp: meanDelta,
          meanAbsDeltaPp: meanAbs,
          maxAbsDeltaPp: maxAbs,
          tierFlipRate: flipRate,
        };
      });

    return {
      variantCount: variants.length,
      schoolCount: baseline.length,
      rows,
      summary,
    };
  }

  private avgProb(results: PredictionResultDto[]): string {
    if (results.length === 0) return '0';
    const avg = results.reduce((s, r) => s + r.probability, 0) / results.length;
    return avg.toFixed(3);
  }
}
