import { Test } from '@nestjs/testing';
import { AssistantOutputSafetyService } from './assistant-output-safety.service';
import {
  ContentModerationService,
  ModerationAction,
} from '../security/content-moderation.service';
import { MetricsService } from '../infrastructure/observability/metrics.service';
import { AlertChannelService } from '../infrastructure/alerting/alert-channel.service';
import { AgentHarnessOperationsService } from './agent-harness-operations.service';
import { AgentType } from '../types';

describe('AssistantOutputSafetyService', () => {
  let service: AssistantOutputSafetyService;
  const moderation = { moderate: jest.fn() };
  const metrics = { recordError: jest.fn(), recordHarnessEvent: jest.fn() };
  const alerts = { send: jest.fn() };
  const operations = { recordEvent: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    alerts.send.mockResolvedValue(undefined);
    operations.recordEvent.mockResolvedValue(undefined);
    const module = await Test.createTestingModule({
      providers: [
        AssistantOutputSafetyService,
        { provide: ContentModerationService, useValue: moderation },
        { provide: MetricsService, useValue: metrics },
        { provide: AlertChannelService, useValue: alerts },
        { provide: AgentHarnessOperationsService, useValue: operations },
      ],
    }).compile();
    service = module.get(AssistantOutputSafetyService);
  });

  it('returns sanitized content', async () => {
    moderation.moderate.mockResolvedValue({
      action: ModerationAction.SANITIZE,
      sanitizedContent: 'sanitized',
      details: [{ type: 'pii' }],
    });
    await expect(service.review('raw', 'en', AgentType.ESSAY)).resolves.toBe(
      'sanitized',
    );
  });

  it('returns a localized refusal when moderation blocks', async () => {
    moderation.moderate.mockResolvedValue({
      action: ModerationAction.BLOCK,
      details: [{ type: 'harmful' }],
    });
    await expect(service.review('raw', 'zh', AgentType.ESSAY)).resolves.toBe(
      '抱歉，我无法提供该回复。',
    );
  });

  it('passes allowed content through', async () => {
    moderation.moderate.mockResolvedValue({
      action: ModerationAction.ALLOW,
      details: [],
    });
    await expect(service.review('safe', 'en', AgentType.ESSAY)).resolves.toBe(
      'safe',
    );
  });

  it('fails closed and emits durable evidence plus a critical alert', async () => {
    moderation.moderate.mockRejectedValue(new Error('moderation down'));
    await expect(
      service.review('raw', 'zh', AgentType.ORCHESTRATOR),
    ).resolves.toBe('当前无法完成安全审核，请稍后再试。');
    expect(metrics.recordError).toHaveBeenCalledWith(
      'output_moderation_unavailable',
      AgentType.ORCHESTRATOR,
    );
    expect(metrics.recordHarnessEvent).toHaveBeenCalledWith(
      'output_moderation_fail_closed',
    );
    expect(operations.recordEvent).toHaveBeenCalledWith(
      'output_moderation_fail_closed',
    );
    expect(alerts.send).toHaveBeenCalledWith(
      expect.objectContaining({
        alertId: 'ai-agent-output-moderation-unavailable',
        severity: 'critical',
        source: AssistantOutputSafetyService.name,
      }),
    );
  });

  it('localizes the fail-closed response in English', async () => {
    moderation.moderate.mockRejectedValue(new Error('moderation down'));
    await expect(
      service.review('raw', 'en', AgentType.ORCHESTRATOR),
    ).resolves.toBe(
      'I cannot safely verify this response right now. Please try again later.',
    );
  });
});
