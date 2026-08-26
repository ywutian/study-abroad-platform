import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  AgentSemanticSyntheticAccountService,
  isSemanticSyntheticEmail,
} from './agent-semantic-synthetic-account.service';

describe('AgentSemanticSyntheticAccountService', () => {
  const createService = (options?: {
    enabled?: boolean;
    email?: string;
    deactivatedCount?: number;
  }) => {
    const email =
      options?.email ?? 'agent-semantic-20260825010101-r1-s1@example.invalid';
    const tx = {
      user: {
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: options?.deactivatedCount ?? 1 })
          .mockResolvedValueOnce({ count: 1 }),
      },
      refreshToken: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'synthetic-1', email }),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const userData = {
      clearData: jest.fn().mockResolvedValue({
        cleared: {
          memories: 1,
          conversations: 2,
          entities: 3,
          preferencesReset: false,
        },
      }),
    };
    const harnessOperations = {
      isAcceptanceEnabled: jest.fn().mockReturnValue(options?.enabled ?? true),
    };
    return {
      service: new AgentSemanticSyntheticAccountService(
        prisma as any,
        userData as any,
        harnessOperations as any,
      ),
      prisma,
      tx,
      userData,
    };
  };

  it('accepts only the bounded semantic synthetic email format', () => {
    expect(
      isSemanticSyntheticEmail(
        'agent-semantic-20260825010101-r10-s99@example.invalid',
      ),
    ).toBe(true);
    expect(isSemanticSyntheticEmail('real-user@example.com')).toBe(false);
    expect(
      isSemanticSyntheticEmail(
        'agent-semantic-20260825010101-r11-s1@example.invalid',
      ),
    ).toBe(false);
    expect(
      isSemanticSyntheticEmail(
        'agent-semantic-20260825010101-r1-s100@example.invalid',
      ),
    ).toBe(false);
  });

  it('deactivates, clears, anonymizes, revokes sessions, and audits', async () => {
    const { service, tx, userData } = createService();

    const result = await service.cleanup({
      adminId: 'admin-1',
      targetUserId: 'synthetic-1',
      expectedEmail: 'agent-semantic-20260825010101-r1-s1@example.invalid',
    });

    expect(result).toEqual({
      cleaned: true,
      userHash: expect.stringMatching(/^[a-f0-9]{16}$/),
      refreshTokensRevoked: 2,
      cleared: { memories: 1, conversations: 2, entities: 3 },
    });
    expect(userData.clearData).toHaveBeenCalledWith('synthetic-1', {
      clearMemories: true,
      clearConversations: true,
      clearEntities: true,
      resetPreferences: false,
    });
    expect(tx.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'synthetic-1' },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'AI_AGENT_SEMANTIC_SYNTHETIC_ACCOUNT_CLEANED',
        resourceId: expect.stringMatching(/^[a-f0-9]{16}$/),
      }),
    });
    expect(JSON.stringify(tx.auditLog.create.mock.calls)).not.toContain(
      'example.invalid',
    );
  });

  it('fails closed when acceptance operations are disabled', async () => {
    const { service } = createService({ enabled: false });
    await expect(
      service.cleanup({
        adminId: 'admin-1',
        targetUserId: 'synthetic-1',
        expectedEmail: 'agent-semantic-20260825010101-r1-s1@example.invalid',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects non-synthetic and mismatched targets before deletion', async () => {
    const { service, prisma, userData } = createService({
      email: 'different@example.invalid',
    });
    await expect(
      service.cleanup({
        adminId: 'admin-1',
        targetUserId: 'synthetic-1',
        expectedEmail: 'agent-semantic-20260825010101-r1-s1@example.invalid',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(userData.clearData).not.toHaveBeenCalled();
  });
});
