import { Injectable } from '@nestjs/common';
import type { BenchmarkProfileInput } from '@study-abroad/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { StaticTeacherRegistryService } from './static-teacher-registry.service';
import type {
  StaticTeacherEvaluation,
  StaticTeacherLookupJson,
  StaticTeacherSchoolRef,
} from './static-teacher.interface';

export type TeacherSignal = {
  sourceKey: string;
  sourceLabel: string;
  probability: number;
  weight: number;
  /** Informational in Phase 1. Confidence does not yet down-weight the blend. */
  confidence: 'low' | 'medium' | 'high';
  kind: 'static' | 'profile';
  rawPayload: unknown;
};

export type BlendDecision = {
  teacherSignals: TeacherSignal[];
  teacherEnsemble: number | null;
  pairwiseMae: number | null;
  disagreementFactor: number;
  effectiveW: number;
  blendedPrePlatt: number;
  hasSignal: boolean;
};

export type BlendDiagnostics = BlendDecision & {
  baselineServed: number;
  candidateServedPrePlatt: number;
  candidateServedPostPlatt: number;
  deltaServedPrePlatt: number;
  deltaServedPostPlatt: number;
};

export type HarvestStaticTeacherInput = {
  sourceKey: string;
  top?: number;
  schoolIds?: string[];
};

export type HarvestStaticTeacherResult = {
  sourceKey: string;
  processed: number;
  successCount: number;
  failedCount: number;
  rows: Array<{
    schoolId: string;
    schoolName: string;
    slug?: string | null;
    status: 'COMPLETED' | 'FAILED';
    errorMsg?: string;
  }>;
};

const DEFAULT_BASE_BLEND_WEIGHT = 0.2;
const DEFAULT_SINGLE_TEACHER_CAP = 0.4;
const DEFAULT_DISAGREEMENT_FULL_WEIGHT_MAE = 0.05;
const DEFAULT_DISAGREEMENT_ZERO_WEIGHT_MAE = 0.15;

const DEFAULT_TEACHER_WEIGHTS: Record<string, number> = {
  collegevine: 0.6,
  'campusreel-static': 0.3,
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampProbability(value: number): number {
  return Math.max(0.05, Math.min(0.95, value));
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function meanAbsolutePairwiseError(values: number[]): number | null {
  if (values.length < 2) return null;
  const diffs: number[] = [];
  for (let i = 0; i < values.length; i += 1) {
    for (let j = i + 1; j < values.length; j += 1) {
      diffs.push(Math.abs(values[i] - values[j]));
    }
  }
  return diffs.length > 0 ? average(diffs) : null;
}

function toSchoolMetadataRecord(
  value: unknown,
): Record<string, unknown> | null | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

/**
 * DistillationService centralizes teacher-signal loading and the exact Phase 1
 * blending math.
 *
 * Phase 1 blend formula:
 * - teacherEnsemble = Σ(w_i * t_i) / Σ(w_i) over teachers with signal
 * - disagreementFactor = clamp01((0.15 - MAE) / 0.10)
 * - effectiveW = BASE_BLEND_WEIGHT × disagreementFactor
 * - if exactly one teacher has signal: effectiveW = min(effectiveW, SINGLE_TEACHER_CAP)
 * - blendedPrePlatt = (1 - effectiveW) × ourProbPrePlatt + effectiveW × teacherEnsemble
 *
 * Phase 1 serving scope:
 * - `getPhase1LiveTeacherSignals()` intentionally returns only directly-computable
 *   static teacher signals (`campusreel-static`).
 * - Profile-scoped teachers such as CollegeVine remain offline-only and are used by
 *   diagnostics via `getBenchmarkTeacherSignals()`.
 *
 * `buildBlendDiagnostics()` also computes the dry-run post-Platt candidate:
 * - candidateServedPostPlatt = (1 - effectiveW) × baselineServed + effectiveW × teacherEnsemble
 */
@Injectable()
export class DistillationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly staticTeacherRegistry: StaticTeacherRegistryService,
  ) {}

  getBaseBlendWeight(): number {
    return this.readWeight(
      'DISTILLATION_BLEND_WEIGHT',
      DEFAULT_BASE_BLEND_WEIGHT,
    );
  }

  getSingleTeacherCap(): number {
    return DEFAULT_SINGLE_TEACHER_CAP;
  }

  getDisagreementFullWeightMae(): number {
    return DEFAULT_DISAGREEMENT_FULL_WEIGHT_MAE;
  }

  getDisagreementZeroWeightMae(): number {
    return DEFAULT_DISAGREEMENT_ZERO_WEIGHT_MAE;
  }

  getTeacherWeight(sourceKey: string): number {
    const envKey = `DISTILLATION_TEACHER_WEIGHT_${sourceKey
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')}`;
    return this.readWeight(envKey, DEFAULT_TEACHER_WEIGHTS[sourceKey] ?? 0);
  }

  async harvestStaticTeacherSnapshots(
    input: HarvestStaticTeacherInput,
  ): Promise<HarvestStaticTeacherResult> {
    const top = input.top ?? 50;
    const teacher = this.staticTeacherRegistry.getTeacherOrThrow(
      input.sourceKey,
    );
    const source = await this.staticTeacherRegistry.getSourceOrThrow(
      input.sourceKey,
    );

    const schools = await this.prisma.school.findMany({
      where: input.schoolIds?.length
        ? { id: { in: input.schoolIds } }
        : undefined,
      orderBy: input.schoolIds?.length
        ? undefined
        : [{ usNewsRank: 'asc' }, { acceptanceRate: 'asc' }, { name: 'asc' }],
      take: input.schoolIds?.length ? undefined : top,
      select: {
        id: true,
        name: true,
        metadata: true,
      },
    });

    const rows: HarvestStaticTeacherResult['rows'] = [];
    let successCount = 0;
    let failedCount = 0;

    for (const school of schools) {
      const schoolRef: StaticTeacherSchoolRef = {
        id: school.id,
        name: school.name,
        metadata: toSchoolMetadataRecord(school.metadata),
      };

      try {
        const harvested = await teacher.harvestSchool(schoolRef);
        successCount += 1;
        rows.push({
          schoolId: school.id,
          schoolName: school.name,
          slug: harvested.slug,
          status: 'COMPLETED',
        });

        await this.prisma.staticTeacherSnapshot.upsert({
          where: {
            sourceId_schoolId: {
              sourceId: source.id,
              schoolId: school.id,
            },
          },
          update: {
            slug: harvested.slug,
            lookupJson: harvested.lookupJson as never,
            status: 'COMPLETED',
            errorMsg: null,
            fetchedAt: new Date(),
          },
          create: {
            sourceId: source.id,
            schoolId: school.id,
            slug: harvested.slug,
            lookupJson: harvested.lookupJson as never,
            status: 'COMPLETED',
            errorMsg: null,
          },
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        failedCount += 1;
        const slug = teacher.resolveSlug(schoolRef);
        rows.push({
          schoolId: school.id,
          schoolName: school.name,
          slug,
          status: 'FAILED',
          errorMsg,
        });

        await this.prisma.staticTeacherSnapshot.upsert({
          where: {
            sourceId_schoolId: {
              sourceId: source.id,
              schoolId: school.id,
            },
          },
          update: {
            slug,
            lookupJson: { sat: [], gpa: [] } as never,
            status: 'FAILED',
            errorMsg,
            fetchedAt: new Date(),
          },
          create: {
            sourceId: source.id,
            schoolId: school.id,
            slug,
            lookupJson: { sat: [], gpa: [] } as never,
            status: 'FAILED',
            errorMsg,
          },
        });
      }
    }

    return {
      sourceKey: input.sourceKey,
      processed: schools.length,
      successCount,
      failedCount,
      rows,
    };
  }

  async getPhase1LiveTeacherSignals(
    profile: BenchmarkProfileInput,
    schoolId: string,
  ): Promise<TeacherSignal[]> {
    return this.getStaticTeacherSignals(profile, schoolId, [
      'campusreel-static',
    ]);
  }

  async getBenchmarkTeacherSignals(
    profileId: string,
    schoolId: string,
    profile?: BenchmarkProfileInput,
  ): Promise<TeacherSignal[]> {
    const [storedSignals, staticSignals] = await Promise.all([
      this.getStoredCompetitorSignals(profileId, schoolId, ['collegevine']),
      profile
        ? this.getStaticTeacherSignals(profile, schoolId, ['campusreel-static'])
        : Promise.resolve([]),
    ]);
    return [...storedSignals, ...staticSignals];
  }

  async getStoredCompetitorSignals(
    profileId: string,
    schoolId: string,
    sourceKeys: string[],
  ): Promise<TeacherSignal[]> {
    if (sourceKeys.length === 0) return [];

    const rows = await this.prisma.competitorPrediction.findMany({
      where: {
        profileId,
        schoolId,
        status: 'COMPLETED',
        probability: { not: null },
        source: { key: { in: sourceKeys } },
      },
      include: {
        source: {
          select: {
            key: true,
            label: true,
          },
        },
      },
      orderBy: { fetchedAt: 'desc' },
    });

    const seen = new Set<string>();
    const signals: TeacherSignal[] = [];

    for (const row of rows) {
      if (seen.has(row.source.key)) continue;
      seen.add(row.source.key);
      const weight = this.getTeacherWeight(row.source.key);
      if (weight <= 0) continue;
      signals.push({
        sourceKey: row.source.key,
        sourceLabel: row.source.label,
        probability: Number(row.probability),
        weight,
        confidence: 'medium',
        kind: 'profile',
        rawPayload: row.rawPayload,
      });
    }

    return signals;
  }

  async getStaticTeacherSignals(
    profile: BenchmarkProfileInput,
    schoolId: string,
    sourceKeys: string[],
  ): Promise<TeacherSignal[]> {
    if (sourceKeys.length === 0) return [];

    await this.staticTeacherRegistry.ensureSourcesSynced();

    const snapshots = await this.prisma.staticTeacherSnapshot.findMany({
      where: {
        schoolId,
        status: 'COMPLETED',
        source: { key: { in: sourceKeys } },
      },
      include: {
        source: {
          select: {
            key: true,
            label: true,
          },
        },
        school: {
          select: {
            id: true,
            name: true,
            metadata: true,
          },
        },
      },
      orderBy: { fetchedAt: 'desc' },
    });

    const seen = new Set<string>();
    const signals: TeacherSignal[] = [];

    for (const snapshot of snapshots) {
      if (seen.has(snapshot.source.key)) continue;
      seen.add(snapshot.source.key);

      const weight = this.getTeacherWeight(snapshot.source.key);
      if (weight <= 0) continue;

      const teacher = this.staticTeacherRegistry.getTeacherOrThrow(
        snapshot.source.key,
      );
      const schoolRef: StaticTeacherSchoolRef = {
        id: snapshot.school.id,
        name: snapshot.school.name,
        metadata: toSchoolMetadataRecord(snapshot.school.metadata),
      };

      const evaluation = teacher.evaluateProfile(
        profile,
        schoolRef,
        snapshot.lookupJson as unknown as StaticTeacherLookupJson,
      );

      if (!evaluation) continue;

      signals.push(
        this.toTeacherSignal(
          snapshot.source.key,
          snapshot.source.label,
          weight,
          evaluation,
        ),
      );
    }

    return signals;
  }

  computeBlendDecision(
    ourProbPrePlatt: number,
    teacherSignals: TeacherSignal[],
    baseBlendWeight = this.getBaseBlendWeight(),
  ): BlendDecision {
    if (teacherSignals.length === 0) {
      return {
        teacherSignals: [],
        teacherEnsemble: null,
        pairwiseMae: null,
        disagreementFactor: 0,
        effectiveW: 0,
        blendedPrePlatt: ourProbPrePlatt,
        hasSignal: false,
      };
    }

    const totalWeight = teacherSignals.reduce(
      (sum, signal) => sum + signal.weight,
      0,
    );
    const teacherEnsemble =
      totalWeight > 0
        ? teacherSignals.reduce(
            (sum, signal) => sum + signal.weight * signal.probability,
            0,
          ) / totalWeight
        : null;

    if (teacherEnsemble == null) {
      return {
        teacherSignals,
        teacherEnsemble: null,
        pairwiseMae: null,
        disagreementFactor: 0,
        effectiveW: 0,
        blendedPrePlatt: ourProbPrePlatt,
        hasSignal: false,
      };
    }

    const mae = meanAbsolutePairwiseError(
      teacherSignals.map((signal) => signal.probability),
    );
    const disagreementWindow =
      this.getDisagreementZeroWeightMae() - this.getDisagreementFullWeightMae();
    const disagreementFactor =
      mae == null
        ? 1
        : disagreementWindow <= 0
          ? 0
          : clamp01(
              (this.getDisagreementZeroWeightMae() - mae) / disagreementWindow,
            );
    let effectiveW = baseBlendWeight * disagreementFactor;
    if (teacherSignals.length === 1) {
      effectiveW = Math.min(effectiveW, this.getSingleTeacherCap());
    }

    return {
      teacherSignals,
      teacherEnsemble,
      pairwiseMae: mae,
      disagreementFactor,
      effectiveW,
      blendedPrePlatt: clampProbability(
        (1 - effectiveW) * ourProbPrePlatt + effectiveW * teacherEnsemble,
      ),
      hasSignal: true,
    };
  }

  buildBlendDiagnostics(
    ourProbPrePlatt: number,
    baselineServed: number,
    teacherSignals: TeacherSignal[],
    baseBlendWeight = this.getBaseBlendWeight(),
  ): BlendDiagnostics {
    const decision = this.computeBlendDecision(
      ourProbPrePlatt,
      teacherSignals,
      baseBlendWeight,
    );

    const teacherEnsemble = decision.teacherEnsemble ?? baselineServed;
    const candidateServedPrePlatt = decision.hasSignal
      ? decision.blendedPrePlatt
      : baselineServed;
    const candidateServedPostPlatt = decision.hasSignal
      ? clampProbability(
          (1 - decision.effectiveW) * baselineServed +
            decision.effectiveW * teacherEnsemble,
        )
      : baselineServed;

    return {
      ...decision,
      baselineServed,
      candidateServedPrePlatt,
      candidateServedPostPlatt,
      deltaServedPrePlatt: candidateServedPrePlatt - baselineServed,
      deltaServedPostPlatt: candidateServedPostPlatt - baselineServed,
    };
  }

  private readWeight(envKey: string, fallback: number): number {
    const value = process.env[envKey];
    if (!value) return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return clamp01(parsed);
  }

  private toTeacherSignal(
    sourceKey: string,
    sourceLabel: string,
    weight: number,
    evaluation: StaticTeacherEvaluation,
  ): TeacherSignal {
    return {
      sourceKey,
      sourceLabel,
      probability: evaluation.probability,
      weight,
      confidence: evaluation.confidence,
      kind: 'static',
      rawPayload: evaluation.rawPayload,
    };
  }
}
