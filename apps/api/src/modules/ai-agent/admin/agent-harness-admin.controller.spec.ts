import { AgentHarnessAdminController } from './agent-harness-admin.controller';
import { EmbeddingAcceptanceService } from '../memory/embedding-acceptance.service';
import { Permission } from '../../../common/constants/permissions';
import { Role } from '@prisma/client';

describe('AgentHarnessAdminController', () => {
  it('requires admin and AI_CONFIG and delegates only synthetic IDs', async () => {
    expect(Reflect.getMetadata('roles', AgentHarnessAdminController)).toContain(
      Role.ADMIN,
    );
    expect(
      Reflect.getMetadata('required_permission', AgentHarnessAdminController),
    ).toContain(Permission.AI_CONFIG);
    const run = jest.fn().mockResolvedValue({ pass: true });
    const controller = new AgentHarnessAdminController(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { run } as unknown as EmbeddingAcceptanceService,
    );
    await controller.verifyEmbedding(
      { id: 'admin' },
      { targetUserId: 'a', isolationUserId: 'b' },
    );
    expect(run).toHaveBeenCalledWith('admin', 'a', 'b');
  });
  const createController = () => {
    const prisma = {
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const harnessOperations = {
      createGrant: jest.fn().mockResolvedValue({
        version: 1,
        grantId: 'grant-1',
        scenario: 'budget_exhaustion',
        expiresAt: '2026-08-21T00:05:00.000Z',
      }),
      getEvidence: jest.fn().mockResolvedValue({ days: [], totals: {} }),
    };
    const alerts = {
      getActiveAlerts: jest.fn().mockResolvedValue([
        {
          alertId: 'alert-1',
          title: 'Harness fallback',
          severity: 'WARNING',
          source: 'ConversationContextService',
          timestamp: '2026-08-21T00:00:00.000Z',
          message: 'must not leave the controller',
          metadata: { prompt: 'private' },
        },
      ]),
      getDeliveryLog: jest.fn().mockResolvedValue([
        {
          channel: 'redis_queue',
          status: 'success',
          durationMs: 4,
          timestamp: '2026-08-21T00:00:00.000Z',
          error: 'must not leave the controller',
        },
      ]),
      getStats: jest.fn().mockResolvedValue({
        pendingAlerts: 1,
        activeAlerts: 2,
        configuredChannels: ['redis_queue'],
        unavailableChannels: [],
      }),
      acknowledgeAlert: jest.fn().mockResolvedValue(undefined),
    };
    const semanticSyntheticAccounts = {
      cleanup: jest.fn().mockResolvedValue({
        cleaned: true,
        userHash: 'abc123',
        refreshTokensRevoked: 1,
        cleared: { memories: 0, conversations: 1, entities: 0 },
      }),
    };
    const controller = new AgentHarnessAdminController(
      harnessOperations as any,
      alerts as any,
      prisma as any,
      semanticSyntheticAccounts as any,
      { run: jest.fn() } as never,
    );
    return {
      controller,
      prisma,
      harnessOperations,
      alerts,
      semanticSyntheticAccounts,
    };
  };

  it('binds a one-shot grant to the authenticated admin and target user', async () => {
    const { controller, harnessOperations } = createController();

    await controller.createAcceptanceGrant(
      { id: 'admin-1' },
      {
        targetUserId: 'synthetic-1',
        scenario: 'budget_exhaustion',
        maxTokens: 1000,
        maxDurationMs: 10000,
      },
    );

    expect(harnessOperations.createGrant).toHaveBeenCalledWith({
      adminId: 'admin-1',
      targetUserId: 'synthetic-1',
      scenario: 'budget_exhaustion',
      maxTokens: 1000,
      maxDurationMs: 10000,
    });
  });

  it('delegates synthetic cleanup with the authenticated admin identity', async () => {
    const { controller, semanticSyntheticAccounts } = createController();

    await controller.cleanupSemanticSyntheticAccount(
      { id: 'admin-1' },
      {
        targetUserId: 'synthetic-1',
        expectedEmail: 'agent-semantic-20260825010101-r1-s1@example.invalid',
      },
    );

    expect(semanticSyntheticAccounts.cleanup).toHaveBeenCalledWith({
      adminId: 'admin-1',
      targetUserId: 'synthetic-1',
      expectedEmail: 'agent-semantic-20260825010101-r1-s1@example.invalid',
    });
  });

  it('exposes durable alert-channel readiness without message content', async () => {
    const { controller } = createController();

    await expect(controller.getAlertStatus()).resolves.toEqual({
      pendingAlerts: 1,
      activeAlerts: 2,
      configuredChannels: ['redis_queue'],
      unavailableChannels: [],
    });
  });

  it('removes alert messages, metadata, and delivery errors from responses', async () => {
    const { controller } = createController();

    const active = await controller.getAlerts(10);
    const delivery = await controller.getAlertDelivery('alert-1');

    expect(active).toEqual([
      expect.objectContaining({ alertId: 'alert-1', severity: 'WARNING' }),
    ]);
    expect(JSON.stringify(active)).not.toContain('private');
    expect(JSON.stringify(active)).not.toContain('must not leave');
    expect(JSON.stringify(delivery)).not.toContain('must not leave');
  });

  it('audits alert acknowledgement without persisting alert content', async () => {
    const { controller, prisma, alerts } = createController();

    await controller.acknowledgeAlert({ id: 'admin-1' }, 'alert-1', {
      notes: 'verified synthetic fallback',
    });

    expect(alerts.acknowledgeAlert).toHaveBeenCalledWith(
      'alert-1',
      'admin-1',
      'verified synthetic fallback',
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'AI_AGENT_ALERT_ACKNOWLEDGED',
          resourceId: 'alert-1',
        }),
      }),
    );
  });
});
