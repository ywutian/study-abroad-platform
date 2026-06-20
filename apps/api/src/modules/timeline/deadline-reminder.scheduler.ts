/**
 * Deadline Reminder Scheduler
 *
 * Runs daily at 8 AM (Asia/Shanghai). Scans both personal-event deadlines and
 * un-submitted application (school) deadlines in 1, 3, or 7 days and sends one
 * batched notification per user (merging both kinds).
 *
 * Deduplication: Redis SET NX with 24h TTL per (userId, days, date).
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { REDIS_TTL } from '../../common/redis/redis-ttl.constants';
import {
  NotificationService,
  NotificationType,
} from '../notification/notification.service';

@Injectable()
export class DeadlineReminderScheduler {
  private readonly logger = new Logger(DeadlineReminderScheduler.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    @Optional() private redis?: RedisService,
  ) {}

  @Cron('0 8 * * *', { timeZone: 'Asia/Shanghai' })
  async checkDeadlines() {
    this.logger.log('Starting deadline reminder scan...');
    const windows = [1, 3, 7];
    let totalSent = 0;

    for (const days of windows) {
      try {
        const sent = await this.processWindow(days);
        totalSent += sent;
      } catch (error) {
        this.logger.error(
          `Failed to process ${days}-day window: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    this.logger.log(
      `Deadline reminder scan complete: ${totalSent} notifications sent`,
    );
  }

  private async processWindow(days: number): Promise<number> {
    const now = new Date();
    const targetStart = new Date(now);
    targetStart.setDate(targetStart.getDate() + days);
    targetStart.setHours(0, 0, 0, 0);

    const targetEnd = new Date(targetStart);
    targetEnd.setHours(23, 59, 59, 999);

    // Both deadline kinds in this window: personal events + application (school)
    // deadlines. Application timelines only matter while still un-submitted.
    const [events, timelines] = await Promise.all([
      this.prisma.personalEvent.findMany({
        where: {
          deadline: { gte: targetStart, lte: targetEnd },
          status: { not: 'COMPLETED' },
        },
        select: { id: true, title: true, userId: true },
      }),
      this.prisma.applicationTimeline.findMany({
        where: {
          deadline: { gte: targetStart, lte: targetEnd },
          status: {
            notIn: [
              'SUBMITTED',
              'ACCEPTED',
              'REJECTED',
              'WAITLISTED',
              'WITHDRAWN',
            ],
          },
        },
        select: { id: true, schoolName: true, round: true, userId: true },
      }),
    ]);

    if (events.length === 0 && timelines.length === 0) return 0;

    // One reminder per user, merging both deadline kinds into a single label
    // list so a user gets a single batched notification per window.
    const grouped = new Map<string, string[]>();
    const pushLabel = (userId: string, label: string) => {
      const list = grouped.get(userId) ?? [];
      list.push(label);
      grouped.set(userId, list);
    };
    for (const event of events) pushLabel(event.userId, event.title);
    for (const tl of timelines) {
      pushLabel(tl.userId, `${tl.schoolName}（${tl.round}）`);
    }

    let sent = 0;
    const dateStr = targetStart.toISOString().slice(0, 10);

    for (const [userId, labels] of grouped) {
      try {
        // Redis dedup: one reminder per user per day-window per date.
        // setNX returns false only when the key already exists (already sent);
        // when Redis is down it fails open (true) so reminders still go out.
        const dedupKey = `deadline-reminded:${userId}:${days}:${dateStr}`;
        if (this.redis) {
          const firstSendToday = await this.redis.setNX(
            dedupKey,
            '1',
            REDIS_TTL.DEADLINE_DEDUP,
          );
          if (!firstSendToday) continue; // Already sent today
        }

        const content = labels.map((l) => `• ${l}`).join('\n');
        const title =
          labels.length === 1
            ? `${labels[0]} 截止还有 ${days} 天`
            : `${labels.length} 个截止日期还有 ${days} 天`;

        await this.notificationService.createNotification(
          userId,
          NotificationType.DEADLINE_REMINDER,
          {
            customTitle: title,
            customContent: content,
          },
        );
        sent++;
      } catch (error) {
        this.logger.warn(
          `Failed to send reminder to ${userId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return sent;
  }
}
