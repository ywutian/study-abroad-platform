import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { runWithCronLock } from '../../../common/redis/cron-lock.util';
import { REDIS_TTL } from '../../../common/redis/redis-ttl.constants';
import { RedisService } from '../../../common/redis/redis.service';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  NotificationService,
  NotificationType,
} from '../../notification/notification.service';

const OUTCOME_REMINDER_LOCK_KEY = 'outcome-reminder:cron-lock';

/**
 * M6.4: Decision Day Reminder Cron
 *
 * Daily job that:
 *  1. Finds SchoolDeadlines with `decisionDate` in [-7, +7] day window
 *  2. For each, finds the user's PredictionResults for that school
 *  3. Sends a DEADLINE_REMINDER notification if no outcome has been reported yet
 *
 * Multi-instance safety: a Redis single-flight lock (setNXStrict) ensures only
 * one Cloud Run replica runs the daily scan. De-dup: a per-(user, prediction)
 * Redis key (REDIS_TTL.OUTCOME_REMINDER_DEDUP) caps re-sends to once per window,
 * claimed before send and released on failure so a transient error retries on
 * the next run. (Without these, every replica re-sent every eligible user a
 * reminder every day across the 14-day window — the bug this cron's old
 * "idempotent" docstring falsely claimed was handled.)
 */
@Injectable()
export class OutcomeReminderService {
  private readonly logger = new Logger(OutcomeReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notification: NotificationService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  /**
   * Runs every day at 8 AM UTC. Set via cron expression to give users morning
   * reminders that "your X school decision is due today / soon — remember to
   * tell us your result".
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM, {
    name: 'outcome-decision-day-reminder',
    timeZone: 'UTC',
  })
  async sendDecisionDayReminders(): Promise<void> {
    // Single-flight across replicas: every Cloud Run instance fires this cron at
    // 8AM, so without the lock each eligible user gets N duplicate reminders.
    // (See runWithCronLock for the TTL-as-window / fail-closed semantics.)
    const _ran = await runWithCronLock(
      this.redis,
      OUTCOME_REMINDER_LOCK_KEY,
      REDIS_TTL.OUTCOME_REMINDER_CRON_LOCK,
      async () => {
        this.logger.log('Running outcome decision day reminder cron');
        const stats = await this.runOnce();
        this.logger.log(
          `Reminder cron complete: ${stats.candidates} candidates scanned, ${stats.sent} notifications sent, ${stats.skipped} skipped (already reported or recently notified)`,
        );
      },
      this.logger,
    );
  }

  /**
   * Exposed for manual / admin invocation and testing.
   * Returns counts of candidates, sent reminders, and skipped.
   */
  async runOnce(): Promise<{
    candidates: number;
    sent: number;
    skipped: number;
  }> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Find SchoolDeadlines with decisionDate in the window
    const deadlines = await this.prisma.schoolDeadline.findMany({
      where: {
        decisionDate: {
          gte: windowStart,
          lte: windowEnd,
        },
      },
      select: { schoolId: true, round: true, decisionDate: true, year: true },
    });

    if (deadlines.length === 0) {
      return { candidates: 0, sent: 0, skipped: 0 };
    }

    const schoolIds = [...new Set(deadlines.map((d) => d.schoolId))];

    // Find all predictions for these schools that don't have an outcome from
    // the reporting user yet.
    const predictions = await this.prisma.predictionResult.findMany({
      where: {
        schoolId: { in: schoolIds },
        source: 'prediction', // only authoritative predictions
      },
      include: {
        profile: { select: { userId: true } },
        outcomeLabelRecords: {
          select: { id: true, reportedBy: true, status: true },
        },
      },
    });

    // Fetch school names for notification content
    const schools = await this.prisma.school.findMany({
      where: { id: { in: schoolIds } },
      select: { id: true, name: true, nameZh: true },
    });
    const schoolMap = new Map(schools.map((s) => [s.id, s]));

    // Map deadlines by schoolId for quick lookup
    const deadlineByKey = new Map<string, (typeof deadlines)[number]>();
    for (const d of deadlines) {
      const key = `${d.schoolId}:${d.round}`;
      if (!deadlineByKey.has(key)) deadlineByKey.set(key, d);
    }

    let sent = 0;
    let skipped = 0;
    const candidates = predictions.length;

    for (const pred of predictions) {
      const userId = pred.profile.userId;

      // Skip if outcome already reported by this user for this prediction
      const reportedByUser = pred.outcomeLabelRecords.some(
        (r) => r.reportedBy === userId,
      );
      if (reportedByUser) {
        skipped += 1;
        continue;
      }

      // Find matching deadline (prefer match by round, else any)
      const matchingDeadline =
        deadlineByKey.get(
          `${pred.schoolId}:${pred.applicationRound ?? 'RD'}`,
        ) ?? deadlines.find((d) => d.schoolId === pred.schoolId);

      if (!matchingDeadline) {
        skipped += 1;
        continue;
      }

      const school = schoolMap.get(pred.schoolId);
      if (!school) {
        skipped += 1;
        continue;
      }

      const daysFromNow = matchingDeadline.decisionDate
        ? Math.round(
            (matchingDeadline.decisionDate.getTime() - now.getTime()) /
              (24 * 60 * 60 * 1000),
          )
        : 0;

      const timingText =
        daysFromNow > 1
          ? `${daysFromNow} 天后 / in ${daysFromNow} days`
          : daysFromNow === 0
            ? '今天 / today'
            : daysFromNow === 1
              ? '明天 / tomorrow'
              : `${Math.abs(daysFromNow)} 天前已截止 / ${Math.abs(daysFromNow)} days ago`;

      // Per-(user, prediction) dedup: claim BEFORE sending so concurrent or
      // repeat runs within the window don't re-spam; released on failure below so
      // a transient error retries next run. Fails open when Redis is down.
      const dedupKey = `outcome-reminded:${userId}:${pred.id}`;
      if (this.redis) {
        const firstSend = await this.redis.setNX(
          dedupKey,
          '1',
          REDIS_TTL.OUTCOME_REMINDER_DEDUP,
        );
        if (!firstSend) {
          skipped += 1;
          continue; // already reminded within the dedup window
        }
      }

      try {
        await this.notification.createNotification(
          userId,
          NotificationType.DEADLINE_REMINDER,
          {
            relatedId: pred.id,
            relatedType: 'PredictionResult',
            customTitle: `${school.name} ${matchingDeadline.round} decision ${timingText}`,
            customContent: `你的 ${school.nameZh ?? school.name} ${matchingDeadline.round} 申请放榜日是 ${timingText}。记得回来报告你的录取结果，给学弟学妹留下宝贵案例。`,
            data: {
              predictionResultId: pred.id,
              schoolId: pred.schoolId,
              round: matchingDeadline.round,
              decisionDate: matchingDeadline.decisionDate?.toISOString() ?? '',
              source: 'outcome-reminder-cron',
            },
          },
        );
        sent += 1;
      } catch (err) {
        // Release the claim so the next run retries this user (we claimed before
        // sending; the send failed, so don't suppress for the dedup window).
        if (this.redis) {
          await this.redis.del(dedupKey).catch(() => undefined);
        }
        this.logger.warn(
          `Failed to send reminder for prediction ${pred.id}: ${err instanceof Error ? err.message : 'unknown error'}`,
        );
        skipped += 1;
      }
    }

    return { candidates, sent, skipped };
  }
}
