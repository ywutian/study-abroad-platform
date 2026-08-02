import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * closure-v2 Continuous Closure Engine — Tier 1 scheduler.
 *
 * A non-pausing maintenance loop. On a fixed interval it:
 *   1. syncs the `ClosureTarget` work queue against the live DB — newly
 *      imported School / HighSchool rows get their targets enqueued, and any
 *      PENDING target whose field has since gained a value flips to CLOSED;
 *   2. re-opens CLOSED targets whose data has gone stale (older than the
 *      freshness window) so the engine refreshes them;
 *   3. logs the current closure rate.
 *
 * Bounded and idempotent — a failed tick never throws (the next tick resumes),
 * and overlapping ticks are skipped. Gated by `CLOSURE_ENGINE_ENABLED` (default
 * off) so it never auto-runs without an explicit opt-in.
 *
 * Actual data collection for PENDING targets is performed by the closure
 * collection agents (`scripts/closure-agents/*`); this loop keeps the queue
 * correct and surfaces outstanding work — it is the never-pause backbone.
 */

interface FieldSpec {
  wave: string;
  weight: number;
}

/** School fields the engine closes — mirrors scripts/closure-agents/seed-closure-targets.ts. */
const SCHOOL_FIELDS: Record<string, FieldSpec> = {
  acceptanceRate: { wave: 'wave-0', weight: 1.0 },
  intlAcceptanceRate: { wave: 'wave-0', weight: 0.95 },
  oosAcceptanceRate: { wave: 'wave-6.1', weight: 0.5 },
  transferAcceptanceRate: { wave: 'wave-1.5', weight: 0.3 },
  edAcceptanceRate: { wave: 'wave-6.1', weight: 0.7 },
  eaAcceptanceRate: { wave: 'wave-6.1', weight: 0.6 },
  ed2AcceptanceRate: { wave: 'wave-6.1', weight: 0.5 },
  yieldRate: { wave: 'wave-6.1', weight: 0.6 },
  hasRestrictiveEa: { wave: 'wave-6.1', weight: 0.4 },
  sat25: { wave: 'wave-0', weight: 0.95 },
  sat75: { wave: 'wave-0', weight: 0.95 },
  satAvg: { wave: 'wave-0', weight: 0.5 },
  act25: { wave: 'wave-1.4', weight: 0.5 },
  act75: { wave: 'wave-1.4', weight: 0.5 },
  actAvg: { wave: 'wave-1.4', weight: 0.4 },
  gpaDistribution: { wave: 'wave-1.3', weight: 0.85 },
  needBlindInternational: { wave: 'wave-1.2', weight: 0.9 },
  graduationRate: { wave: 'wave-6.1', weight: 0.45 },
  retentionRate: { wave: 'wave-6.1', weight: 0.4 },
  percentNeedMet: { wave: 'wave-6.1', weight: 0.45 },
  averageNetPrice: { wave: 'wave-6.1', weight: 0.4 },
  studentFacultyRatio: { wave: 'wave-6.7', weight: 0.3 },
  description: { wave: 'wave-6.7', weight: 0.25 },
  descriptionZh: { wave: 'wave-6.7', weight: 0.25 },
  totalEnrollment: { wave: 'wave-6.7', weight: 0.3 },
  nicheOverallGrade: { wave: 'wave-6.7', weight: 0.3 },
};

/** HighSchool evaluation + curriculum fields. */
const HS_FIELDS: Record<string, FieldSpec> = {
  tier: { wave: 'wave-5.1', weight: 0.7 },
  recognition: { wave: 'wave-5.1', weight: 0.6 },
  academicRigor: { wave: 'wave-5.1', weight: 0.6 },
  placementRecord: { wave: 'wave-5.1', weight: 0.65 },
  studentQuality: { wave: 'wave-5.1', weight: 0.55 },
  resources: { wave: 'wave-5.1', weight: 0.5 },
  curriculumSystem: { wave: 'wave-5.2', weight: 0.6 },
};

interface ClosureStats {
  total: number;
  closed: number;
  pending: number;
  pct: number;
}

@Injectable()
export class ClosureSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClosureSchedulerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;

  private readonly enabled = process.env.CLOSURE_ENGINE_ENABLED === 'true';
  private readonly intervalMs =
    Number(process.env.CLOSURE_ENGINE_INTERVAL_MS) || 30 * 60 * 1000;
  private readonly freshnessDays =
    Number(process.env.CLOSURE_FRESHNESS_DAYS) || 365;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.log(
        'Closure engine disabled — set CLOSURE_ENGINE_ENABLED=true to enable the tick loop',
      );
      return;
    }
    this.logger.log(
      `Closure engine enabled — tick every ${Math.round(this.intervalMs / 60000)}min, freshness ${this.freshnessDays}d`,
    );
    // Delay the first tick so it never blocks app startup.
    setTimeout(() => void this.tick(), 30_000);
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * One bounded, idempotent maintenance tick. Public so it can also be invoked
   * manually (admin endpoint / test). Never throws.
   */
  async tick(): Promise<ClosureStats | null> {
    if (this.ticking) {
      this.logger.warn('tick skipped — previous tick still running');
      return null;
    }
    this.ticking = true;
    const started = Date.now();
    try {
      const synced = await this.syncQueue();
      const reopened = await this.reopenStale();
      const stats = await this.closureStats();
      this.logger.log(
        `tick ${Date.now() - started}ms — synced ${synced}, reopened ${reopened} stale; ` +
          `closure ${stats.closed}/${stats.total} (${stats.pct}%), ${stats.pending} pending`,
      );
      return stats;
    } catch (e) {
      // Never throw — a bad tick must not crash the app; the next tick resumes.
      this.logger.error(`tick failed: ${(e as Error).message}`);
      return null;
    } finally {
      this.ticking = false;
    }
  }

  /**
   * Upsert one ClosureTarget per (entity, field). Creates targets for newly
   * imported entities; flips a PENDING target to CLOSED once its field has a
   * real value. Never clobbers engine-set FAILED / UNAVAILABLE / NEEDS_REVIEW.
   */
  private async syncQueue(): Promise<number> {
    // governance: batch-operation — cron that walks every school/high-school to build closure targets
    const existing = await this.prisma.closureTarget.findMany({
      select: { entityType: true, entityId: true, field: true, status: true },
    });
    const statusByKey = new Map(
      existing.map((t) => [
        `${t.entityType}|${t.entityId}|${t.field}`,
        t.status,
      ]),
    );
    let changed = 0;

    // governance: batch-operation — cron that walks every school/high-school to build closure targets
    const schools = await this.prisma.school.findMany();
    for (const s of schools) {
      const rankWeight = s.usNewsRank
        ? Math.max(0.2, 1 - s.usNewsRank / 300)
        : 0.3;
      for (const [field, cfg] of Object.entries(SCHOOL_FIELDS)) {
        if (field === 'oosAcceptanceRate' && s.isPrivate) continue;
        changed += await this.upsertTarget(
          statusByKey,
          'School',
          s.id,
          s.name,
          field,
          cfg.wave,
          cfg.weight * rankWeight,
          (s as Record<string, unknown>)[field],
        );
      }
    }

    // governance: batch-operation — cron that walks every school/high-school to build closure targets
    const highSchools = await this.prisma.highSchool.findMany();
    for (const h of highSchools) {
      for (const [field, cfg] of Object.entries(HS_FIELDS)) {
        changed += await this.upsertTarget(
          statusByKey,
          'HighSchool',
          h.id,
          h.name,
          field,
          cfg.wave,
          cfg.weight,
          (h as Record<string, unknown>)[field],
        );
      }
    }
    return changed;
  }

  /** Returns 1 if a row was created or flipped to CLOSED, else 0. */
  private async upsertTarget(
    statusByKey: Map<string, string>,
    entityType: string,
    entityId: string,
    entityName: string,
    field: string,
    wave: string,
    priority: number,
    value: unknown,
  ): Promise<number> {
    const key = `${entityType}|${entityId}|${field}`;
    const isNull = value == null;
    const existingStatus = statusByKey.get(key);
    if (existingStatus === undefined) {
      // governance: batch-operation — cron that walks every school/high-school to build closure targets
      await this.prisma.closureTarget.create({
        data: {
          wave,
          entityType,
          entityId,
          entityName,
          field,
          status: isNull ? 'PENDING' : 'CLOSED',
          priority: isNull ? priority : 0,
          tier: isNull ? null : 'OFFICIAL',
        },
      });
      return 1;
    }
    if (!isNull && existingStatus === 'PENDING') {
      // governance: batch-operation — cron that walks every school/high-school to build closure targets
      await this.prisma.closureTarget.updateMany({
        where: { entityType, entityId, field },
        data: { status: 'CLOSED' },
      });
      return 1;
    }
    return 0;
  }

  /**
   * Re-open CLOSED targets whose data has gone stale (last updated before the
   * freshness window). UNAVAILABLE rows are left alone — verified-not-published
   * does not expire on the same cadence.
   */
  private async reopenStale(): Promise<number> {
    const cutoff = new Date(Date.now() - this.freshnessDays * 86_400_000);
    // governance: batch-operation — cron that walks every school/high-school to build closure targets
    const res = await this.prisma.closureTarget.updateMany({
      where: { status: 'CLOSED', updatedAt: { lt: cutoff } },
      data: { status: 'PENDING' },
    });
    return res.count;
  }

  /** Current closure rate — CLOSED + UNAVAILABLE are terminal-success. */
  async closureStats(): Promise<ClosureStats> {
    const grouped = await this.prisma.closureTarget.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    let total = 0;
    let closed = 0;
    let pending = 0;
    for (const g of grouped) {
      const n = g._count._all;
      total += n;
      if (g.status === 'CLOSED' || g.status === 'UNAVAILABLE') closed += n;
      if (g.status === 'PENDING') pending += n;
    }
    return {
      total,
      closed,
      pending,
      pct: total === 0 ? 0 : Math.round((closed / total) * 1000) / 10,
    };
  }
}
