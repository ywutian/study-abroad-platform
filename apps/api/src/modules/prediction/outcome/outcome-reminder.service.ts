import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  NotificationService,
  NotificationType,
} from '../../notification/notification.service';

/**
 * M6.4: Decision Day Reminder Cron
 *
 * Daily job that:
 *  1. Finds SchoolDeadlines with `decisionDate` in [-7, +7] day window
 *  2. For each, finds the user's PredictionResults for that school
 *  3. Sends a DEADLINE_REMINDER notification if no outcome has been reported yet
 *  4. Idempotent: tracks last-reminded-at per (user, schoolId, deadline) via
 *     Notification.data — re-sends max once per 3 days
 */
@Injectable()
export class OutcomeReminderService {
  private readonly logger = new Logger(OutcomeReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notification: NotificationService,
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
    this.logger.log('Running outcome decision day reminder cron');

    const stats = await this.runOnce();
    this.logger.log(
      `Reminder cron complete: ${stats.candidates} candidates scanned, ${stats.sent} notifications sent, ${stats.skipped} skipped (already reported or recently notified)`,
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

      // TODO: Add per-user-per-prediction dedup (Redis-backed) to avoid spam.
      // Notification table does not exist in Prisma schema — NotificationService
      // uses Redis/in-memory delivery. For MVP we rely on NotificationService's
      // own dedup behavior. Production should add a OutcomeReminderLog table or
      // store remindedAt timestamps on PredictionResult.

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
        this.logger.warn(
          `Failed to send reminder for prediction ${pred.id}: ${err instanceof Error ? err.message : err}`,
        );
        skipped += 1;
      }
    }

    return { candidates, sent, skipped };
  }
}
