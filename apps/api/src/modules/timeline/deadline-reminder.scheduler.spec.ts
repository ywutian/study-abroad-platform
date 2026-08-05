import { Test } from '@nestjs/testing';
import { DeadlineReminderScheduler } from './deadline-reminder.scheduler';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import {
  NotificationService,
  NotificationType,
} from '../notification/notification.service';

describe('DeadlineReminderScheduler', () => {
  let scheduler: DeadlineReminderScheduler;
  const prisma = {
    personalEvent: { findMany: jest.fn() },
    applicationTimeline: { findMany: jest.fn() },
  };
  const redis = {
    setNX: jest.fn(),
    setNXStrict: jest.fn(),
    tryAcquireLock: jest.fn().mockResolvedValue({ acquired: true }),
    del: jest.fn(),
  };
  const notifications = { createNotification: jest.fn() };

  // Fixed "now" so the 1/3/7-day windows are deterministic.
  const FIXED_NOW = new Date('2026-06-20T12:00:00Z');

  // A deadline whose effective (rolled) date lands `days` from FIXED_NOW.
  // `yearsAgo` lets a test store a PAST deadline that must roll forward (#436).
  const deadlineForWindow = (days: number, yearsAgo = 0) => {
    const d = new Date(FIXED_NOW);
    d.setDate(d.getDate() + days);
    d.setHours(12, 0, 0, 0);
    d.setFullYear(d.getFullYear() - yearsAgo);
    return d;
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(FIXED_NOW);
    prisma.personalEvent.findMany.mockResolvedValue([]);
    prisma.applicationTimeline.findMany.mockResolvedValue([]);
    redis.setNX.mockResolvedValue(true);
    redis.setNXStrict.mockResolvedValue(true);
    redis.tryAcquireLock.mockResolvedValue({ acquired: true });
    redis.del.mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        DeadlineReminderScheduler,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: NotificationService, useValue: notifications },
      ],
    }).compile();
    scheduler = moduleRef.get(DeadlineReminderScheduler);
  });

  afterEach(() => jest.useRealTimers());

  const runWindow = (days: number) =>
    (
      scheduler as unknown as { processWindow: (d: number) => Promise<number> }
    ).processWindow(days);

  it('includes un-submitted application deadlines in the reminder', async () => {
    prisma.applicationTimeline.findMany.mockResolvedValue([
      {
        id: 't1',
        schoolName: 'MIT',
        round: 'ED',
        userId: 'u1',
        deadline: deadlineForWindow(3),
      },
    ]);

    const sent = await runWindow(3);

    expect(sent).toBe(1);
    expect(notifications.createNotification).toHaveBeenCalledWith(
      'u1',
      NotificationType.DEADLINE_REMINDER,
      expect.objectContaining({
        customContent: expect.stringContaining('MIT（ED）'),
      }),
    );
  });

  it('rolls a past stored application deadline forward into the window (#436 consistency)', async () => {
    // Stored deadline sits a year in the past (the drift case #436 fixes for the
    // UI); its rolled next-occurrence lands 7 days out, so the reminder must fire.
    prisma.applicationTimeline.findMany.mockResolvedValue([
      {
        id: 't1',
        schoolName: 'Yale',
        round: 'RD',
        userId: 'u1',
        deadline: deadlineForWindow(7, 1),
      },
    ]);

    const sent = await runWindow(7);

    expect(sent).toBe(1);
    expect(notifications.createNotification).toHaveBeenCalledWith(
      'u1',
      NotificationType.DEADLINE_REMINDER,
      expect.objectContaining({
        customContent: expect.stringContaining('Yale（RD）'),
      }),
    );
  });

  it('ignores timelines whose effective deadline is outside the window or undated', async () => {
    prisma.applicationTimeline.findMany.mockResolvedValue([
      {
        id: 't1',
        schoolName: 'Stanford',
        round: 'REA',
        userId: 'u1',
        deadline: deadlineForWindow(20), // effective date 20 days out, not 3
      },
      {
        id: 't2',
        schoolName: 'NoDate',
        round: 'RD',
        userId: 'u1',
        deadline: null,
      },
    ]);

    const sent = await runWindow(3);

    expect(sent).toBe(0);
    expect(notifications.createNotification).not.toHaveBeenCalled();
  });

  it('only scans application timelines that are still un-submitted', async () => {
    await runWindow(7);
    expect(prisma.applicationTimeline.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deadline: { not: null },
          status: {
            notIn: [
              'SUBMITTED',
              'ACCEPTED',
              'REJECTED',
              'WAITLISTED',
              'WITHDRAWN',
            ],
          },
        }),
      }),
    );
  });

  it('merges a personal event and an application deadline into one notification', async () => {
    prisma.personalEvent.findMany.mockResolvedValue([
      { id: 'e1', title: 'TOEFL', userId: 'u1' },
    ]);
    prisma.applicationTimeline.findMany.mockResolvedValue([
      {
        id: 't1',
        schoolName: 'MIT',
        round: 'ED',
        userId: 'u1',
        deadline: deadlineForWindow(1),
      },
    ]);

    const sent = await runWindow(1);

    expect(sent).toBe(1);
    const [, , payload] = notifications.createNotification.mock.calls[0];
    expect(payload.customTitle).toContain('2 个截止日期');
    expect(payload.customContent).toContain('TOEFL');
    expect(payload.customContent).toContain('MIT（ED）');
  });

  it('skips a user already reminded today (Redis dedup)', async () => {
    prisma.applicationTimeline.findMany.mockResolvedValue([
      {
        id: 't1',
        schoolName: 'MIT',
        round: 'ED',
        userId: 'u1',
        deadline: deadlineForWindow(3),
      },
    ]);
    redis.setNX.mockResolvedValue(false);

    const sent = await runWindow(3);

    expect(sent).toBe(0);
    expect(notifications.createNotification).not.toHaveBeenCalled();
  });

  it('skips the whole scan when the cron lock is held (multi-instance single-flight)', async () => {
    redis.setNXStrict.mockResolvedValue(false);
    redis.tryAcquireLock.mockResolvedValue({ acquired: false, reason: 'held' });
    prisma.applicationTimeline.findMany.mockResolvedValue([
      {
        id: 't1',
        schoolName: 'MIT',
        round: 'ED',
        userId: 'u1',
        deadline: deadlineForWindow(3),
      },
    ]);

    await scheduler.checkDeadlines();

    expect(prisma.applicationTimeline.findMany).not.toHaveBeenCalled();
    expect(notifications.createNotification).not.toHaveBeenCalled();
  });

  it('releases the dedup claim when the send fails (claim-on-success retry)', async () => {
    prisma.applicationTimeline.findMany.mockResolvedValue([
      {
        id: 't1',
        schoolName: 'MIT',
        round: 'ED',
        userId: 'u1',
        deadline: deadlineForWindow(3),
      },
    ]);
    notifications.createNotification.mockRejectedValueOnce(
      new Error('downstream blip'),
    );

    const sent = await runWindow(3);

    expect(sent).toBe(0);
    // The pre-send claim is released so tomorrow's run retries this user.
    expect(redis.del).toHaveBeenCalledWith(
      expect.stringContaining('deadline-reminded:u1:3:'),
    );
  });
});
