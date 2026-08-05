import { Test, TestingModule } from '@nestjs/testing';
import { OutcomeReminderService } from './outcome-reminder.service';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  NotificationService,
  NotificationType,
} from '../../notification/notification.service';
import { RedisService } from '../../../common/redis/redis.service';

const mockPrisma = {
  schoolDeadline: { findMany: jest.fn() },
  predictionResult: { findMany: jest.fn() },
  school: { findMany: jest.fn() },
};

const mockNotification = {
  createNotification: jest.fn().mockResolvedValue({ id: 'notif1' }),
};

const mockRedis = {
  setNX: jest.fn(),
  setNXStrict: jest.fn(),
  tryAcquireLock: jest.fn().mockResolvedValue({ acquired: true }),
  del: jest.fn(),
};

describe('OutcomeReminderService', () => {
  let service: OutcomeReminderService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRedis.setNX.mockResolvedValue(true);
    mockRedis.setNXStrict.mockResolvedValue(true);
    mockRedis.tryAcquireLock.mockResolvedValue({ acquired: true });
    mockRedis.del.mockResolvedValue(undefined);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutcomeReminderService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationService, useValue: mockNotification },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();
    service = module.get(OutcomeReminderService);
  });

  it('sends reminders to users without outcome reports', async () => {
    mockPrisma.schoolDeadline.findMany.mockResolvedValue([
      {
        schoolId: 's1',
        round: 'EA',
        decisionDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
        year: 2026,
      },
    ]);
    mockPrisma.predictionResult.findMany.mockResolvedValue([
      {
        id: 'p1',
        schoolId: 's1',
        applicationRound: 'EA',
        profile: { userId: 'u1' },
        outcomeLabelRecords: [],
      },
    ]);
    mockPrisma.school.findMany.mockResolvedValue([
      { id: 's1', name: 'Stanford', nameZh: '斯坦福' },
    ]);

    const stats = await service.runOnce();

    expect(stats.candidates).toBe(1);
    expect(stats.sent).toBe(1);
    expect(stats.skipped).toBe(0);
    expect(mockNotification.createNotification).toHaveBeenCalledWith(
      'u1',
      NotificationType.DEADLINE_REMINDER,
      expect.objectContaining({
        relatedId: 'p1',
        relatedType: 'PredictionResult',
      }),
    );
  });

  it('skips users who already reported outcome', async () => {
    mockPrisma.schoolDeadline.findMany.mockResolvedValue([
      {
        schoolId: 's1',
        round: 'ED',
        decisionDate: new Date(),
        year: 2026,
      },
    ]);
    mockPrisma.predictionResult.findMany.mockResolvedValue([
      {
        id: 'p1',
        schoolId: 's1',
        applicationRound: 'ED',
        profile: { userId: 'u1' },
        outcomeLabelRecords: [
          { id: 'out1', reportedBy: 'u1', status: 'SELF_REPORTED' },
        ],
      },
    ]);
    mockPrisma.school.findMany.mockResolvedValue([
      { id: 's1', name: 'Yale', nameZh: '耶鲁' },
    ]);

    const stats = await service.runOnce();

    expect(stats.candidates).toBe(1);
    expect(stats.sent).toBe(0);
    expect(stats.skipped).toBe(1);
    expect(mockNotification.createNotification).not.toHaveBeenCalled();
  });

  it('skips when no deadlines in window', async () => {
    mockPrisma.schoolDeadline.findMany.mockResolvedValue([]);

    const stats = await service.runOnce();

    expect(stats.candidates).toBe(0);
    expect(stats.sent).toBe(0);
    expect(mockPrisma.predictionResult.findMany).not.toHaveBeenCalled();
  });

  it('continues processing if one notification fails', async () => {
    mockPrisma.schoolDeadline.findMany.mockResolvedValue([
      {
        schoolId: 's1',
        round: 'EA',
        decisionDate: new Date(),
        year: 2026,
      },
      {
        schoolId: 's2',
        round: 'EA',
        decisionDate: new Date(),
        year: 2026,
      },
    ]);
    mockPrisma.predictionResult.findMany.mockResolvedValue([
      {
        id: 'p1',
        schoolId: 's1',
        applicationRound: 'EA',
        profile: { userId: 'u1' },
        outcomeLabelRecords: [],
      },
      {
        id: 'p2',
        schoolId: 's2',
        applicationRound: 'EA',
        profile: { userId: 'u2' },
        outcomeLabelRecords: [],
      },
    ]);
    mockPrisma.school.findMany.mockResolvedValue([
      { id: 's1', name: 'Stanford', nameZh: null },
      { id: 's2', name: 'MIT', nameZh: null },
    ]);

    mockNotification.createNotification
      .mockRejectedValueOnce(new Error('rate limit'))
      .mockResolvedValueOnce({ id: 'notif2' });

    const stats = await service.runOnce();

    expect(stats.candidates).toBe(2);
    expect(stats.sent).toBe(1);
    expect(stats.skipped).toBe(1);
  });

  it('skips the whole cron when the single-flight lock is held (multi-instance)', async () => {
    mockRedis.setNXStrict.mockResolvedValue(false);
    mockRedis.tryAcquireLock.mockResolvedValue({
      acquired: false,
      reason: 'held',
    });

    await service.sendDecisionDayReminders();

    expect(mockPrisma.schoolDeadline.findMany).not.toHaveBeenCalled();
    expect(mockNotification.createNotification).not.toHaveBeenCalled();
  });

  it('skips a user already reminded within the dedup window (Redis dedup)', async () => {
    mockPrisma.schoolDeadline.findMany.mockResolvedValue([
      {
        schoolId: 's1',
        round: 'EA',
        decisionDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        year: 2026,
      },
    ]);
    mockPrisma.predictionResult.findMany.mockResolvedValue([
      {
        id: 'p1',
        schoolId: 's1',
        applicationRound: 'EA',
        profile: { userId: 'u1' },
        outcomeLabelRecords: [],
      },
    ]);
    mockPrisma.school.findMany.mockResolvedValue([
      { id: 's1', name: 'Stanford', nameZh: '斯坦福' },
    ]);
    mockRedis.setNX.mockResolvedValue(false); // already reminded this window

    const stats = await service.runOnce();

    expect(stats.sent).toBe(0);
    expect(stats.skipped).toBe(1);
    expect(mockNotification.createNotification).not.toHaveBeenCalled();
  });

  it('releases the dedup claim when the send fails (retry next run)', async () => {
    mockPrisma.schoolDeadline.findMany.mockResolvedValue([
      { schoolId: 's1', round: 'EA', decisionDate: new Date(), year: 2026 },
    ]);
    mockPrisma.predictionResult.findMany.mockResolvedValue([
      {
        id: 'p1',
        schoolId: 's1',
        applicationRound: 'EA',
        profile: { userId: 'u1' },
        outcomeLabelRecords: [],
      },
    ]);
    mockPrisma.school.findMany.mockResolvedValue([
      { id: 's1', name: 'MIT', nameZh: null },
    ]);
    mockNotification.createNotification.mockRejectedValueOnce(
      new Error('downstream blip'),
    );

    const stats = await service.runOnce();

    expect(stats.sent).toBe(0);
    expect(stats.skipped).toBe(1);
    expect(mockRedis.del).toHaveBeenCalledWith(
      expect.stringContaining('outcome-reminded:u1:p1'),
    );
  });
});
