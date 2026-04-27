import { Injectable, Logger, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';
import { PredictionTransformerService } from '../prediction-transformer.service';
import { CounselorEngineService } from './counselor-engine.service';
import type { ProfileInput, SchoolInput } from '../prediction.prompts';

/**
 * Counselor Backfill Service — one-shot rewrite of stored PredictionResult rows.
 *
 * Why this exists
 * ---------------
 * Counselor mode (PR-1/PR-2) went live with `prediction-counselor-mode-v1` flag
 * at 100%. NEW predictions go through counselor automatically. But two surfaces
 * still show legacy fusion data to users:
 *   1. Redis prediction cache (24h TTL) — holds fusion entries written before
 *      the flag flip. Users hit cache → see fusion number until cache expires.
 *   2. PredictionResult table — rows written before flag flip have fusion
 *      probability + factors. Re-rendering the prediction page reads from DB,
 *      shows fusion until the user manually re-runs the prediction.
 *
 * This service rewrites every PredictionResult row that hasn't yet been
 * computed by counselor (`servedTrace.engine` !== 'counselor'), and flushes
 * the prediction cache. After running it once, all users see counselor numbers
 * everywhere — prediction page, history view, admin dashboard, recommendations.
 *
 * Why "counselor-only" backfill (not full pipeline rerun)
 * -------------------------------------------------------
 * Calling `predictionService.predict()` for every row would re-trigger the AI
 * engine (LLM) + ML inference for each one. ~10K rows × 1 LLM call = $$$ +
 * many minutes. Counselor is deterministic math (~5ms per pair), no LLM.
 * The fusion shadow data stays in `servedTrace.shadow.fusion` from the
 * original prediction — that's still useful for retrospective Brier
 * comparison once outcome labels accumulate.
 *
 * Idempotent
 * ----------
 * Re-running with the same parameters is safe — already-counselor rows are
 * skipped via the `where servedTrace->>'engine' != 'counselor'` filter (when
 * `forceRecompute` is false). Tier 4 rows (insufficient school data) are also
 * skipped — counselor returns nothing useful, leave existing fusion result alone.
 */

export interface CounselorBackfillResult {
  dryRun: boolean;
  scanned: number;
  updated: number;
  skippedAlreadyCounselor: number;
  skippedTier4: number;
  skippedMissingProfile: number;
  errors: Array<{ predictionResultId: string; reason: string }>;
  cacheKeysDeleted: number;
  /** When more rows remain past the batch limit, pass this cursor on the next call. */
  nextCursor: string | null;
  durationMs: number;
}

interface BackfillOptions {
  dryRun?: boolean;
  /**
   * Max rows to process this call. Defaults to 1000. Larger values reduce
   * round-trips but increase risk of long-running HTTP request timeouts.
   * Cloud Run default request timeout is 5min — at ~5ms/row that's ~60K
   * rows max per call. We cap at 5000 by default to leave headroom.
   */
  batchSize?: number;
  /** PredictionResult.id cursor for pagination (resume after a previous batch). */
  cursor?: string | null;
  /**
   * If true, recompute even rows already showing counselor. Useful when
   * counselor math itself changed (PR-6 confidence dampening, etc.) and
   * we want all rows refreshed. Default false (only catches up legacy fusion rows).
   */
  forceRecompute?: boolean;
  /**
   * If true, skip cache flush. Useful for testing or when running multiple
   * batches in sequence (only flush after the last batch).
   */
  skipCacheFlush?: boolean;
}

const PREDICTION_CACHE_PREFIX = 'prediction:';
const DEFAULT_BATCH_SIZE = 1000;
const MAX_BATCH_SIZE = 5000;

@Injectable()
export class CounselorBackfillService {
  private readonly logger = new Logger(CounselorBackfillService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly counselor: CounselorEngineService,
    private readonly transformer: PredictionTransformerService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  async runBackfill(
    options: BackfillOptions = {},
  ): Promise<CounselorBackfillResult> {
    const startedAt = Date.now();
    const dryRun = options.dryRun ?? true;
    const batchSize = Math.min(
      Math.max(1, options.batchSize ?? DEFAULT_BATCH_SIZE),
      MAX_BATCH_SIZE,
    );
    const forceRecompute = options.forceRecompute ?? false;
    const cursor = options.cursor ?? null;

    // Cursor-paginated scan. Uses `id` ascending which is stable + indexed.
    // We pull `batchSize + 1` to detect "more pages" and emit nextCursor.
    const where: Prisma.PredictionResultWhereInput = cursor
      ? { id: { gt: cursor } }
      : {};

    const rows = await this.prisma.predictionResult.findMany({
      where,
      orderBy: { id: 'asc' },
      take: batchSize + 1,
      include: {
        profile: {
          include: {
            testScores: true,
            activities: { include: { activityTemplate: true } },
            awards: { include: { competition: true } },
            education: { include: { highSchool: true } },
          },
        },
      },
    });

    const hasMore = rows.length > batchSize;
    const batch = hasMore ? rows.slice(0, batchSize) : rows;
    const nextCursor = hasMore ? batch[batch.length - 1].id : null;

    // Look up all unique schools in one query to avoid N+1
    const schoolIds = Array.from(new Set(batch.map((r) => r.schoolId)));
    const schools = await this.prisma.school.findMany({
      where: { id: { in: schoolIds } },
    });
    const schoolById = new Map(schools.map((s) => [s.id, s]));

    const result: CounselorBackfillResult = {
      dryRun,
      scanned: batch.length,
      updated: 0,
      skippedAlreadyCounselor: 0,
      skippedTier4: 0,
      skippedMissingProfile: 0,
      errors: [],
      cacheKeysDeleted: 0,
      nextCursor,
      durationMs: 0,
    };

    // Batch the updates so we can use Prisma's `executeRaw` per chunk if needed.
    // For now: sequential updates — 1000 rows × 5ms compute + ~10ms write = 15s/batch.
    for (const row of batch) {
      // Skip rows already on counselor (unless forceRecompute)
      const trace = row.servedTrace as { engine?: string } | null;
      if (!forceRecompute && trace?.engine === 'counselor') {
        result.skippedAlreadyCounselor += 1;
        continue;
      }

      if (!row.profile) {
        result.skippedMissingProfile += 1;
        continue;
      }

      const school = schoolById.get(row.schoolId);
      if (!school) {
        result.errors.push({
          predictionResultId: row.id,
          reason: `school ${row.schoolId} not found in DB`,
        });
        continue;
      }

      let profileInput: ProfileInput;
      let schoolInput: SchoolInput;
      try {
        profileInput = this.transformer.profileToInput(row.profile as any);
        schoolInput = this.transformer.schoolToInput(school);
      } catch (err) {
        result.errors.push({
          predictionResultId: row.id,
          reason: `transformer failed: ${err instanceof Error ? err.message : String(err)}`,
        });
        continue;
      }

      let counselorResult;
      try {
        counselorResult = await this.counselor.compute(
          profileInput as any,
          {
            ...schoolInput,
            acceptanceRate: school.acceptanceRate
              ? Number(school.acceptanceRate)
              : undefined,
            state: school.state ?? undefined,
            isPrivate: school.isPrivate,
            needBlindInternational: school.needBlindInternational ?? false,
            intlAcceptanceRate: school.intlAcceptanceRate
              ? Number(school.intlAcceptanceRate)
              : undefined,
          } as any,
          row.applicationRound ?? undefined,
        );
      } catch (err) {
        result.errors.push({
          predictionResultId: row.id,
          reason: `counselor.compute() failed: ${err instanceof Error ? err.message : String(err)}`,
        });
        continue;
      }

      // Tier 4 = insufficient school data → leave existing fusion result alone
      if (counselorResult.tier === 4) {
        result.skippedTier4 += 1;
        continue;
      }

      if (dryRun) {
        result.updated += 1; // count what *would* be updated
        continue;
      }

      // Build new servedTrace: preserve any existing shadow.fusion + cohortKey,
      // overlay counselor metadata + engine label.
      const existingTrace = (row.servedTrace as any) ?? {};
      const newTrace = {
        ...existingTrace,
        engine: 'counselor',
        counselor: {
          anchor: counselorResult.anchor,
          anchorSource: counselorResult.anchorSource,
          tier: counselorResult.tier,
          modifiers: counselorResult.modifierResults,
          missingFields: counselorResult.missingFields ?? [],
          sourceContributions: counselorResult.sourceContributions ?? [],
          ruleVersion: counselorResult.ruleVersion,
          backfilledAt: new Date().toISOString(),
        },
        // Preserve fusion data in shadow if it wasn't already there.
        // (When PR-2 served a counselor result for the first time, it stashed
        // fusion under shadow.fusion. For pre-counselor rows being backfilled
        // here, the row's existing probability/factors ARE the fusion result —
        // capture them before overwriting.)
        shadow: {
          ...(existingTrace.shadow ?? {}),
          fusion: existingTrace.shadow?.fusion ?? {
            probability: Number(row.probability ?? 0),
            probabilityLow: row.probabilityLow
              ? Number(row.probabilityLow)
              : null,
            probabilityHigh: row.probabilityHigh
              ? Number(row.probabilityHigh)
              : null,
            confidence: row.confidence,
            // factors stored separately on the row, not duplicated here
            capturedDuringBackfill: true,
          },
        },
      };

      try {
        await this.prisma.predictionResult.update({
          where: { id: row.id },
          data: {
            probability: counselorResult.probability,
            probabilityLow: Math.max(0.02, counselorResult.probability - 0.05),
            probabilityHigh: Math.min(0.98, counselorResult.probability + 0.05),
            factors:
              counselorResult.factors as unknown as Prisma.InputJsonValue,
            confidence: 'medium',
            confidenceReason:
              "Cold-start rules-of-thumb estimate anchored on the school's published CDS admit rate. Will become more precise as we collect outcome data from your reports.",
            servedTrace: newTrace as Prisma.InputJsonValue,
          },
        });
        result.updated += 1;
      } catch (err) {
        result.errors.push({
          predictionResultId: row.id,
          reason: `prisma.update failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    // Cache flush — only after a real (non-dry) run with cache available.
    // When called in a multi-batch sequence, caller can pass skipCacheFlush
    // and call once at the very end.
    if (
      !dryRun &&
      !options.skipCacheFlush &&
      this.redis &&
      result.updated > 0
    ) {
      try {
        result.cacheKeysDeleted = await this.redis.delByPrefix(
          PREDICTION_CACHE_PREFIX,
        );
        this.logger.log(
          `Flushed ${result.cacheKeysDeleted} prediction cache keys`,
        );
      } catch (err) {
        this.logger.warn(
          `Cache flush failed (continuing): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    result.durationMs = Date.now() - startedAt;
    this.logger.log(
      `Counselor backfill ${dryRun ? '(dry-run)' : ''}: ` +
        `scanned=${result.scanned} updated=${result.updated} ` +
        `skippedCounselor=${result.skippedAlreadyCounselor} ` +
        `skippedTier4=${result.skippedTier4} ` +
        `errors=${result.errors.length} ` +
        `${result.nextCursor ? `(more rows; cursor=${result.nextCursor})` : '(complete)'}`,
    );
    return result;
  }
}
