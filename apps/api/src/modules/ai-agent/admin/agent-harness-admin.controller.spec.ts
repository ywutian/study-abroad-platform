import { AgentHarnessAdminController } from './agent-harness-admin.controller';

describe('AgentHarnessAdminController', () => {
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
    const controller = new AgentHarnessAdminController(
      harnessOperations as any,
      alerts as any,
      prisma as any,
    );
    return { controller, prisma, harnessOperations, alerts };
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
