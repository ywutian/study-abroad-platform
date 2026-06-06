import { Test, TestingModule } from '@nestjs/testing';
import { AuditService, AuditAction, AuditStatus } from './audit.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';
import { AlertChannelService } from '../infrastructure/alerting/alert-channel.service';

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: PrismaService,
          useValue: {
            auditLog: {
              create: jest.fn(),
              createMany: jest.fn(),
              findMany: jest.fn().mockResolvedValue([]),
              count: jest.fn().mockResolvedValue(0),
            },
            agentSecurityEvent: {
              create: jest.fn().mockResolvedValue({ id: 'se-1' }),
              findMany: jest.fn().mockResolvedValue([]),
              findUnique: jest.fn(),
              update: jest.fn(),
              count: jest.fn().mockResolvedValue(0),
              groupBy: jest.fn().mockResolvedValue([]),
            },
            $transaction: jest.fn((cb: any) => cb()),
          },
        },
        {
          provide: RedisService,
          useValue: {
            getClient: jest.fn().mockReturnValue(null),
            connected: false,
            lpush: jest.fn().mockResolvedValue(0),
            ltrim: jest.fn().mockResolvedValue(undefined),
            hincrby: jest.fn().mockResolvedValue(0),
            expire: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AlertChannelService,
          useValue: {
            send: jest.fn(),
            sendImmediate: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AuditService);
  });

  afterEach(async () => {
    // Clean up the flush interval
    await service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should accept audit log entries', async () => {
    await service.log({
      action: AuditAction.CHAT_MESSAGE,
      status: AuditStatus.SUCCESS,
      userId: 'user-1',
      details: { message: 'test' },
    } as any);
    // Should not throw
  });

  it('should log security events', async () => {
    const eventId = await service.logSecurityEvent({
      type: 'PROMPT_INJECTION',
      severity: 'high',
      userId: 'user-1',
      details: { input: 'malicious' },
    } as any);
    expect(eventId).toBeDefined();
  });
});
