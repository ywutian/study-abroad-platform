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
  const redis = { setNX: jest.fn() };
  const notifications = { createNotification: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.personalEvent.findMany.mockResolvedValue([]);
    prisma.applicationTimeline.findMany.mockResolvedValue([]);
    redis.setNX.mockResolvedValue(true);

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

  const runWindow = (days: number) =>
    (
      scheduler as unknown as { processWindow: (d: number) => Promise<number> }
    ).processWindow(days);

  it('includes un-submitted application deadlines in the reminder', async () => {
    prisma.applicationTimeline.findMany.mockResolvedValue([
      { id: 't1', schoolName: 'MIT', round: 'ED', userId: 'u1' },
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

  it('only scans application timelines that are still un-submitted', async () => {
    await runWindow(7);
    expect(prisma.applicationTimeline.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
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
      { id: 't1', schoolName: 'MIT', round: 'ED', userId: 'u1' },
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
      { id: 't1', schoolName: 'MIT', round: 'ED', userId: 'u1' },
    ]);
    redis.setNX.mockResolvedValue(false);

    const sent = await runWindow(3);

    expect(sent).toBe(0);
    expect(notifications.createNotification).not.toHaveBeenCalled();
  });
});
