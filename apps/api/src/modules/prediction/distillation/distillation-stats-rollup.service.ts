import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  DISTILLATION_LIVE_STAGE,
  DISTILLATION_SHADOW_STAGE,
  type DistillationCoverageTier,
} from './types';

const DISTILLATION_SOURCE_PREFIX = 'distillation:';
const BLEND_SOURCE_NAME = 'distillation:blend-v1';
const CHINA_COHORTS = [
  'CN__CHINA_LOCAL',
  'CN__CHINA_INTL',
  'CN__OVERSEAS_HS',
] as const;

type RollupFilters = {
  startDate: Date;
  endDate: Date;
  schoolId?: string;
  cohortKey?: string;
};

type RawObservation = {
  id: string;
  schoolId: string | null;
  cohortKey: string | null;
  observationStage: string;
  metricType: string;
  sourceName: string;
  observedAt: Date;
  observedProbability: any;
  observedWeight: any;
  selectivityBand: string | null;
  metadata: Record<string, unknown> | null;
  predictionSnapshot: {
    outcomeLabel: string | null;
  } | null;
};

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : typeof value === 'object' && value && 'toNumber' in value
          ? Number((value as { toNumber: () => number }).toNumber())
          : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveOutcomeLabel(
  outcomeLabel: string | null | undefined,
): number | null {
  if (outcomeLabel === 'ADMITTED') return 1;
  if (outcomeLabel === 'REJECTED' || outcomeLabel === 'WAITLISTED') return 0;
  return null;
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildBrier(probabilities: number[], labels: number[]): number | null {
  if (!probabilities.length || probabilities.length !== labels.length)
    return null;
  let total = 0;
  for (let index = 0; index < probabilities.length; index += 1) {
    total += (probabilities[index] - labels[index]) ** 2;
  }
  return total / probabilities.length;
}

function maxCoverageTier(
  current: DistillationCoverageTier,
  next: DistillationCoverageTier,
): DistillationCoverageTier {
  const rank: Record<DistillationCoverageTier, number> = {
    NONE: 0,
    BASELINE_ONLY: 1,
    CN_ENHANCED: 2,
  };
  return rank[next] > rank[current] ? next : current;
}

@Injectable()
export class DistillationStatsRollupService {
  private readonly logger = new Logger(DistillationStatsRollupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('13 * * * *')
  async recomputeRecentThreeDays(): Promise<void> {
    await this.recomputeWindow({
      startDate: addUtcDays(startOfUtcDay(new Date()), -3),
      endDate: new Date(),
    });
  }

  @Cron('17 2 * * *')
  async recomputeRecentThirtyDays(): Promise<void> {
    await this.recomputeWindow({
      startDate: addUtcDays(startOfUtcDay(new Date()), -30),
      endDate: new Date(),
    });
  }

  async refreshForOutcomeChange(input: {
    schoolId: string;
    cohortKey?: string | null;
    asOf?: Date;
    lookbackDays?: number;
  }): Promise<void> {
    const asOf = input.asOf ?? new Date();
    const lookbackDays = input.lookbackDays ?? 30;
    await this.recomputeWindow({
      startDate: addUtcDays(startOfUtcDay(asOf), -lookbackDays),
      endDate: asOf,
      schoolId: input.schoolId,
      cohortKey: input.cohortKey ?? undefined,
    });
  }

  async recomputeWindow(filters: RollupFilters): Promise<{
    dailyRows: number;
    schoolRows: number;
  }> {
    const startDate = startOfUtcDay(filters.startDate);
    const endDateExclusive = addUtcDays(startOfUtcDay(filters.endDate), 1);
    const observations =
      // governance: admin-scope — distillation rollups behind @Roles(Role.ADMIN, Role.SUPER_ADMIN)
      (await this.prisma.predictionSourceObservation.findMany({
        where: {
          sourceName: { startsWith: DISTILLATION_SOURCE_PREFIX },
          observationStage: {
            in: [DISTILLATION_SHADOW_STAGE, DISTILLATION_LIVE_STAGE],
          },
          observedAt: {
            gte: startDate,
            lt: endDateExclusive,
          },
          ...(filters.schoolId ? { schoolId: filters.schoolId } : {}),
          ...(filters.cohortKey ? { cohortKey: filters.cohortKey } : {}),
        },
        select: {
          id: true,
          schoolId: true,
          cohortKey: true,
          observationStage: true,
          metricType: true,
          sourceName: true,
          observedAt: true,
          observedProbability: true,
          observedWeight: true,
          selectivityBand: true,
          metadata: true,
          predictionSnapshot: {
            select: {
              outcomeLabel: true,
            },
          },
        },
      })) as RawObservation[];

    const dailyRows = this.buildDailyAggregateRows(observations);
    const schoolRows = this.buildSchoolDailyAggregateRows(observations);

    await this.prisma.$transaction(async (tx) => {
      await tx.distillationDailyAggregate.deleteMany({
        where: {
          date: {
            gte: startDate,
            lt: endDateExclusive,
          },
          ...(filters.cohortKey ? { cohortKey: filters.cohortKey } : {}),
        },
      });
      await tx.distillationSchoolDailyAggregate.deleteMany({
        where: {
          date: {
            gte: startDate,
            lt: endDateExclusive,
          },
          ...(filters.schoolId ? { schoolId: filters.schoolId } : {}),
          ...(filters.cohortKey ? { cohortKey: filters.cohortKey } : {}),
        },
      });

      if (dailyRows.length) {
        await tx.distillationDailyAggregate.createMany({ data: dailyRows });
      }
      if (schoolRows.length) {
        await tx.distillationSchoolDailyAggregate.createMany({
          data: schoolRows,
        });
      }
    });

    return {
      dailyRows: dailyRows.length,
      schoolRows: schoolRows.length,
    };
  }

  async isChinaCohortEligibleForLive(cohortKey: string): Promise<boolean> {
    const gate = await this.getChinaCohortGate(cohortKey);
    return gate.eligible;
  }

  async getOverview(days = 30) {
    // governance: admin-scope — distillation rollups behind @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    const latestDate = await this.prisma.distillationDailyAggregate.findFirst({
      orderBy: { date: 'desc' },
      select: { date: true },
    });

    const startDate = addUtcDays(startOfUtcDay(new Date()), -days);
    const [teacherDaily, schoolDaily] = await Promise.all([
      // governance: admin-scope — distillation rollups behind @Roles(Role.ADMIN, Role.SUPER_ADMIN)
      this.prisma.distillationDailyAggregate.findMany({
        where: { date: { gte: startDate } },
        orderBy: [
          { date: 'desc' },
          { teacherKey: 'asc' },
          { cohortKey: 'asc' },
        ],
      }),
      // governance: admin-scope — distillation rollups behind @Roles(Role.ADMIN, Role.SUPER_ADMIN)
      this.prisma.distillationSchoolDailyAggregate.findMany({
        where: { date: { gte: startDate } },
        orderBy: [{ date: 'desc' }, { schoolId: 'asc' }],
      }),
    ]);

    const latestDay = latestDate?.date ?? null;
    const latestTeacherRows = latestDay
      ? teacherDaily.filter(
          (row) => row.date.toISOString() === latestDay.toISOString(),
        )
      : [];
    const latestSchoolRows = latestDay
      ? schoolDaily.filter(
          (row) => row.date.toISOString() === latestDay.toISOString(),
        )
      : [];

    const coverageCounts = latestSchoolRows.reduce<
      Record<string, { count: number; schools: Set<string> }>
    >((acc, row) => {
      const key = `${row.stage}:${row.coverageTier}`;
      if (!acc[key]) {
        acc[key] = { count: 0, schools: new Set<string>() };
      }
      acc[key].count += row.predictionCount;
      acc[key].schools.add(row.schoolId);
      return acc;
    }, {});

    const chinaGates = await Promise.all(
      CHINA_COHORTS.map(async (cohortKey) =>
        this.getChinaCohortGate(cohortKey),
      ),
    );

    return {
      latestDate: latestDay,
      teacherStats: latestTeacherRows,
      schoolCoverage: Object.entries(coverageCounts).map(([key, value]) => {
        const [stage, coverageTier] = key.split(':');
        return {
          stage,
          coverageTier,
          predictionCount: value.count,
          schoolCount: value.schools.size,
        };
      }),
      chinaGates,
    };
  }

  async getDailyStats(query?: {
    days?: number;
    stage?: string;
    teacherKey?: string;
    cohortKey?: string;
  }) {
    const days = Math.max(1, Math.min(90, query?.days ?? 30));
    // governance: admin-scope — distillation rollups behind @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    return this.prisma.distillationDailyAggregate.findMany({
      where: {
        date: { gte: addUtcDays(startOfUtcDay(new Date()), -days) },
        ...(query?.stage ? { stage: query.stage } : {}),
        ...(query?.teacherKey ? { teacherKey: query.teacherKey } : {}),
        ...(query?.cohortKey ? { cohortKey: query.cohortKey } : {}),
      },
      orderBy: [{ date: 'desc' }, { teacherKey: 'asc' }, { cohortKey: 'asc' }],
    });
  }

  async getSchoolStats(query?: {
    date?: string;
    stage?: string;
    cohortKey?: string;
    coverageTier?: DistillationCoverageTier;
    limit?: number;
  }) {
    const date = query?.date ? startOfUtcDay(new Date(query.date)) : undefined;
    // governance: admin-scope — distillation rollups behind @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    return this.prisma.distillationSchoolDailyAggregate.findMany({
      where: {
        ...(date ? { date } : {}),
        ...(query?.stage ? { stage: query.stage } : {}),
        ...(query?.cohortKey ? { cohortKey: query.cohortKey } : {}),
        ...(query?.coverageTier ? { coverageTier: query.coverageTier } : {}),
      },
      orderBy: [{ date: 'desc' }, { lastObservedAt: 'desc' }],
      take: Math.max(1, Math.min(200, query?.limit ?? 50)),
      include: {
        school: {
          select: {
            id: true,
            name: true,
            nameZh: true,
            usNewsRank: true,
          },
        },
      },
    });
  }

  async getRawObservations(query?: {
    stage?: string;
    cohortKey?: string;
    schoolId?: string;
    sourceName?: string;
    limit?: number;
  }) {
    // governance: admin-scope — distillation rollups behind @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    return this.prisma.predictionSourceObservation.findMany({
      where: {
        sourceName: {
          startsWith: DISTILLATION_SOURCE_PREFIX,
          ...(query?.sourceName ? { equals: query.sourceName } : {}),
        },
        ...(query?.stage ? { observationStage: query.stage } : {}),
        ...(query?.cohortKey ? { cohortKey: query.cohortKey } : {}),
        ...(query?.schoolId ? { schoolId: query.schoolId } : {}),
      },
      orderBy: [{ observedAt: 'desc' }, { createdAt: 'desc' }],
      take: Math.max(1, Math.min(500, query?.limit ?? 100)),
      include: {
        school: {
          select: { id: true, name: true, nameZh: true, usNewsRank: true },
        },
      },
    });
  }

  async getChinaCohortGate(cohortKey: string) {
    const startDate = addUtcDays(startOfUtcDay(new Date()), -30);
    const [blendRows, topSchools] = await Promise.all([
      // governance: admin-scope — distillation rollups behind @Roles(Role.ADMIN, Role.SUPER_ADMIN)
      this.prisma.distillationDailyAggregate.findMany({
        where: {
          date: { gte: startDate },
          stage: DISTILLATION_SHADOW_STAGE,
          teacherKey: 'blend-v1',
          cohortKey,
        },
      }),
      // governance: admin-scope — distillation rollups behind @Roles(Role.ADMIN, Role.SUPER_ADMIN)
      this.prisma.school.findMany({
        where: {
          country: 'US',
          usNewsRank: { lte: 100 },
        },
        select: { id: true },
      }),
    ]);

    const resolvedOutcomeCount = blendRows.reduce(
      (sum, row) => sum + row.resolvedOutcomeCount,
      0,
    );
    const totalResolved = blendRows.reduce(
      (sum, row) => sum + row.resolvedOutcomeCount,
      0,
    );
    const brierBlendedNumerator = blendRows.reduce(
      (sum, row) =>
        sum +
        (row.brierBlended != null ? Number(row.brierBlended) : 0) *
          row.resolvedOutcomeCount,
      0,
    );
    const brierServedNumerator = blendRows.reduce(
      (sum, row) =>
        sum +
        (row.brierServed != null ? Number(row.brierServed) : 0) *
          row.resolvedOutcomeCount,
      0,
    );
    const brierBlended =
      totalResolved > 0 ? brierBlendedNumerator / totalResolved : null;
    const brierServed =
      totalResolved > 0 ? brierServedNumerator / totalResolved : null;

    const latestDate =
      // governance: admin-scope — distillation rollups behind @Roles(Role.ADMIN, Role.SUPER_ADMIN)
      await this.prisma.distillationSchoolDailyAggregate.findFirst({
        where: { cohortKey, stage: DISTILLATION_SHADOW_STAGE },
        orderBy: { date: 'desc' },
        select: { date: true },
      });
    const latestSchoolRows = latestDate
      ? // governance: admin-scope — distillation rollups behind @Roles(Role.ADMIN, Role.SUPER_ADMIN)
        await this.prisma.distillationSchoolDailyAggregate.findMany({
          where: {
            date: latestDate.date,
            cohortKey,
            stage: DISTILLATION_SHADOW_STAGE,
            schoolId: { in: topSchools.map((school) => school.id) },
          },
          select: { schoolId: true, coverageTier: true },
        })
      : [];
    const coveredTopSchools = latestSchoolRows.filter(
      (row) => row.coverageTier === 'CN_ENHANCED',
    ).length;
    const coverageRate =
      topSchools.length > 0 ? coveredTopSchools / topSchools.length : 0;

    const reasons: string[] = [];
    if (resolvedOutcomeCount < 50)
      reasons.push('resolved_outcomes_below_threshold');
    if (coverageRate < 0.6) reasons.push('top100_cn_coverage_below_threshold');
    if (
      brierBlended == null ||
      brierServed == null ||
      brierBlended > brierServed - 0.03
    ) {
      reasons.push('brier_improvement_below_threshold');
    }

    return {
      cohortKey,
      eligible: reasons.length === 0,
      resolvedOutcomeCount,
      top100CoverageRate: coverageRate,
      brierBlended,
      brierServed,
      reasons,
    };
  }

  private buildDailyAggregateRows(observations: RawObservation[]) {
    const grouped = new Map<
      string,
      {
        date: Date;
        stage: string;
        teacherKey: string;
        cohortKey: string;
        selectivityBand: string | null;
        predictionCount: number;
        activeSignalCount: number;
        resolvedOutcomeCount: number;
        teacherProbabilities: number[];
        observedWeights: number[];
        deltas: number[];
        absDeltas: number[];
        teacherBrierProbabilities: number[];
        teacherBrierLabels: number[];
        blendedBrierProbabilities: number[];
        blendedBrierLabels: number[];
        servedBrierProbabilities: number[];
        servedBrierLabels: number[];
        schoolIds: Set<string>;
      }
    >();

    for (const row of observations) {
      const teacherKey = row.sourceName.replace(DISTILLATION_SOURCE_PREFIX, '');
      const cohortKey = row.cohortKey ?? 'UNKNOWN';
      const date = startOfUtcDay(row.observedAt);
      const groupKey = [
        date.toISOString(),
        row.observationStage,
        teacherKey,
        cohortKey,
        row.selectivityBand ?? '',
      ].join('|');
      const metadata = row.metadata ?? {};
      const probability = toNumber(row.observedProbability);
      const observedWeight = toNumber(row.observedWeight);
      const outcome = resolveOutcomeLabel(row.predictionSnapshot?.outcomeLabel);
      const delta =
        toNumber(metadata.blendDelta) ?? toNumber(metadata.deltaVsOur) ?? null;
      const servedProbability = toNumber(metadata.servedProbability);
      const active =
        typeof metadata.active === 'boolean'
          ? metadata.active
          : typeof metadata.hasSignal === 'boolean'
            ? metadata.hasSignal
            : probability != null;

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          date,
          stage: row.observationStage,
          teacherKey,
          cohortKey,
          selectivityBand: row.selectivityBand,
          predictionCount: 0,
          activeSignalCount: 0,
          resolvedOutcomeCount: 0,
          teacherProbabilities: [],
          observedWeights: [],
          deltas: [],
          absDeltas: [],
          teacherBrierProbabilities: [],
          teacherBrierLabels: [],
          blendedBrierProbabilities: [],
          blendedBrierLabels: [],
          servedBrierProbabilities: [],
          servedBrierLabels: [],
          schoolIds: new Set<string>(),
        });
      }

      const aggregate = grouped.get(groupKey)!;
      aggregate.predictionCount += 1;
      if (active) aggregate.activeSignalCount += 1;
      if (row.schoolId) aggregate.schoolIds.add(row.schoolId);
      if (probability != null) aggregate.teacherProbabilities.push(probability);
      if (observedWeight != null)
        aggregate.observedWeights.push(observedWeight);
      if (delta != null) {
        aggregate.deltas.push(delta);
        aggregate.absDeltas.push(Math.abs(delta));
      }
      if (outcome != null) {
        aggregate.resolvedOutcomeCount += 1;
        if (probability != null) {
          aggregate.teacherBrierProbabilities.push(probability);
          aggregate.teacherBrierLabels.push(outcome);
        }
        if (row.sourceName === BLEND_SOURCE_NAME) {
          if (probability != null) {
            aggregate.blendedBrierProbabilities.push(probability);
            aggregate.blendedBrierLabels.push(outcome);
          }
          if (servedProbability != null) {
            aggregate.servedBrierProbabilities.push(servedProbability);
            aggregate.servedBrierLabels.push(outcome);
          }
        }
      }
    }

    return Array.from(grouped.values()).map((group) => ({
      date: group.date,
      stage: group.stage,
      teacherKey: group.teacherKey,
      cohortKey: group.cohortKey,
      selectivityBand: group.selectivityBand,
      predictionCount: group.predictionCount,
      activeSignalCount: group.activeSignalCount,
      resolvedOutcomeCount: group.resolvedOutcomeCount,
      avgTeacherProbability: mean(group.teacherProbabilities),
      avgObservedWeight: mean(group.observedWeights),
      avgBlendDelta: mean(group.deltas),
      avgAbsBlendDelta: mean(group.absDeltas),
      brierTeacher: buildBrier(
        group.teacherBrierProbabilities,
        group.teacherBrierLabels,
      ),
      brierBlended: buildBrier(
        group.blendedBrierProbabilities,
        group.blendedBrierLabels,
      ),
      brierServed: buildBrier(
        group.servedBrierProbabilities,
        group.servedBrierLabels,
      ),
      distinctSchoolCount: group.schoolIds.size,
    }));
  }

  private buildSchoolDailyAggregateRows(observations: RawObservation[]) {
    const blendRows = observations.filter(
      (row) => row.sourceName === BLEND_SOURCE_NAME,
    );
    const grouped = new Map<
      string,
      {
        date: Date;
        schoolId: string;
        cohortKey: string;
        stage: string;
        predictionCount: number;
        resolvedOutcomeCount: number;
        coverageTier: DistillationCoverageTier;
        activeTeacherKeys: Set<string>;
        deltas: number[];
        absDeltas: number[];
        blendedProbabilities: number[];
        blendedLabels: number[];
        servedProbabilities: number[];
        servedLabels: number[];
        lastObservedAt: Date;
      }
    >();

    for (const row of blendRows) {
      if (!row.schoolId) continue;
      const metadata = row.metadata ?? {};
      const cohortKey = row.cohortKey ?? 'UNKNOWN';
      const date = startOfUtcDay(row.observedAt);
      const groupKey = [
        date.toISOString(),
        row.schoolId,
        cohortKey,
        row.observationStage,
      ].join('|');
      const probability = toNumber(row.observedProbability);
      const servedProbability = toNumber(metadata.servedProbability);
      const delta = toNumber(metadata.blendDelta);
      const outcome = resolveOutcomeLabel(row.predictionSnapshot?.outcomeLabel);
      const coverageTier =
        (metadata.coverageTier as DistillationCoverageTier) ?? 'NONE';
      const teacherKeys = Array.isArray(metadata.activeTeacherKeys)
        ? metadata.activeTeacherKeys.filter(
            (value): value is string => typeof value === 'string',
          )
        : [];

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          date,
          schoolId: row.schoolId,
          cohortKey,
          stage: row.observationStage,
          predictionCount: 0,
          resolvedOutcomeCount: 0,
          coverageTier,
          activeTeacherKeys: new Set<string>(),
          deltas: [],
          absDeltas: [],
          blendedProbabilities: [],
          blendedLabels: [],
          servedProbabilities: [],
          servedLabels: [],
          lastObservedAt: row.observedAt,
        });
      }

      const aggregate = grouped.get(groupKey)!;
      aggregate.predictionCount += 1;
      aggregate.coverageTier = maxCoverageTier(
        aggregate.coverageTier,
        coverageTier,
      );
      if (row.observedAt > aggregate.lastObservedAt) {
        aggregate.lastObservedAt = row.observedAt;
      }
      teacherKeys.forEach((key) => aggregate.activeTeacherKeys.add(key));
      if (delta != null) {
        aggregate.deltas.push(delta);
        aggregate.absDeltas.push(Math.abs(delta));
      }
      if (outcome != null) {
        aggregate.resolvedOutcomeCount += 1;
        if (probability != null) {
          aggregate.blendedProbabilities.push(probability);
          aggregate.blendedLabels.push(outcome);
        }
        if (servedProbability != null) {
          aggregate.servedProbabilities.push(servedProbability);
          aggregate.servedLabels.push(outcome);
        }
      }
    }

    return Array.from(grouped.values()).map((group) => ({
      date: group.date,
      schoolId: group.schoolId,
      cohortKey: group.cohortKey,
      stage: group.stage,
      predictionCount: group.predictionCount,
      resolvedOutcomeCount: group.resolvedOutcomeCount,
      coverageTier: group.coverageTier,
      activeTeacherKeys: Array.from(group.activeTeacherKeys).sort(),
      avgBlendDelta: mean(group.deltas),
      avgAbsBlendDelta: mean(group.absDeltas),
      brierBlended: buildBrier(group.blendedProbabilities, group.blendedLabels),
      brierServed: buildBrier(group.servedProbabilities, group.servedLabels),
      lastObservedAt: group.lastObservedAt,
    }));
  }
}
