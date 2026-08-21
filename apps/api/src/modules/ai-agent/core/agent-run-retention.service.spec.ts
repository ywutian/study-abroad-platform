import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AgentRunStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AgentRunRetentionService } from './agent-run-retention.service';

describe('AgentRunRetentionService', () => {
  it('deletes only bounded batches of old traces and terminal runs', async () => {
    const prisma = {
      agentEvaluationTrace: {
        findMany: jest.fn().mockResolvedValue([{ id: 'trace-1' }]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      agentRun: {
        findMany: jest.fn().mockResolvedValue([{ id: 'run-1' }]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const config = {
      get: jest.fn((_key: string, fallback: number) => fallback),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AgentRunRetentionService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    const service = moduleRef.get(AgentRunRetentionService);

    await service.cleanupRetainedData();

    expect(prisma.agentEvaluationTrace.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 500 }),
    );
    expect(prisma.agentRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 200,
        where: expect.objectContaining({
          status: {
            in: [
              AgentRunStatus.COMPLETED,
              AgentRunStatus.FAILED,
              AgentRunStatus.CANCELLED,
              AgentRunStatus.EXPIRED,
            ],
          },
        }),
      }),
    );

    await moduleRef.close();
  });
});
