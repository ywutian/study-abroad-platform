import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import {
  HS_CALIBRATION_DRIFT,
  HS_NEEDS_REVIEW,
  type HsCalibrationDriftPayload,
  type HsNeedsReviewPayload,
} from '../../common/events/high-school.events';

/**
 * Periodic calibration scheduler for high school evaluations.
 *
 * Part of the feedback pipeline: compares actual admission outcomes
 * (from AdmissionCase) against tier-expected rates. Schools with
 * significant drift are flagged for admin review.
 *
 * Runs weekly on Sunday at 4:00 AM.
 */
@Injectable()
export class HsCalibrationScheduler {
  private readonly logger = new Logger(HsCalibrationScheduler.name);

  /** Minimum number of cases required for calibration */
  private readonly MIN_CASES = 10;
  /** Drift threshold (percentage points) to trigger review */
  private readonly DRIFT_THRESHOLD = 15;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron('0 4 * * 0')
  async calibrateFromOutcomes(): Promise<void> {
    this.logger.log('Starting HS calibration from admission outcomes...');

    try {
      // Find all high schools with sufficient case data
      // governance: aggregate-only — nightly high-school calibration. Select is a single enum (`{ result: true }`) — no id, no userId, no free text — and the admit rate is derived from counts. Small-sample floor: `if (hs._count.cases < this.MIN_CASES) continue`, MIN_CASES = 10. Filters by highSchoolId only, NOT by `visibility`, so a PRIVATE case still counts toward its school's rate — the same open product question recorded for hall-verified-dashboard and prediction-historical
      const highSchools = await this.prisma.highSchool.findMany({
        where: {
          isActive: true,
          cases: { some: {} },
        },
        select: {
          id: true,
          name: true,
          tier: true,
          qualityGrade: true,
          _count: { select: { cases: true } },
        },
      });

      let reviewed = 0;
      let flagged = 0;

      for (const hs of highSchools) {
        if (hs._count.cases < this.MIN_CASES) continue;
        reviewed++;

        // Calculate actual admission rate from cases
        // governance: aggregate-only — nightly high-school calibration. Select is a single enum (`{ result: true }`) — no id, no userId, no free text — and the admit rate is derived from counts. Small-sample floor: `if (hs._count.cases < this.MIN_CASES) continue`, MIN_CASES = 10. Filters by highSchoolId only, NOT by `visibility`, so a PRIVATE case still counts toward its school's rate — the same open product question recorded for hall-verified-dashboard and prediction-historical
        const cases = await this.prisma.admissionCase.findMany({
          where: { highSchoolId: hs.id },
          select: { result: true },
        });

        const admitted = cases.filter((c) => c.result === 'ADMITTED').length;
        const actualRate = (admitted / cases.length) * 100;

        // Expected rate based on tier (rough baseline)
        const expectedRateByTier: Record<number, number> = {
          5: 45,
          4: 35,
          3: 25,
          2: 18,
          1: 12,
        };
        const expectedRate = expectedRateByTier[hs.tier] ?? 25;
        const drift = Math.abs(actualRate - expectedRate);

        if (drift > this.DRIFT_THRESHOLD) {
          flagged++;

          const driftPayload: HsCalibrationDriftPayload = {
            highSchoolId: hs.id,
            name: hs.name,
            currentTier: hs.tier,
            expectedAdmitRate: expectedRate,
            actualAdmitRate: Math.round(actualRate * 10) / 10,
            caseCount: cases.length,
            driftPercentage: Math.round(drift * 10) / 10,
          };
          this.eventEmitter.emit(HS_CALIBRATION_DRIFT, driftPayload);

          const reviewPayload: HsNeedsReviewPayload = {
            highSchoolId: hs.id,
            name: hs.name,
            reason: `Calibration drift: actual ${actualRate.toFixed(1)}% vs expected ${expectedRate}% (${drift.toFixed(1)}pp difference, ${cases.length} cases)`,
            currentGrade: hs.qualityGrade ?? 'unknown',
          };
          this.eventEmitter.emit(HS_NEEDS_REVIEW, reviewPayload);

          this.logger.warn(
            `Calibration drift for "${hs.name}" (Tier ${hs.tier}): ` +
              `actual ${actualRate.toFixed(1)}% vs expected ${expectedRate}% ` +
              `(${cases.length} cases)`,
          );
        }
      }

      this.logger.log(
        `HS calibration complete: ${reviewed} schools reviewed, ${flagged} flagged for review`,
      );
    } catch (error) {
      this.logger.error(
        'HS calibration failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
