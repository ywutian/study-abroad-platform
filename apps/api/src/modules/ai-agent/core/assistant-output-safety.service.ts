import { Injectable, Logger, Optional } from '@nestjs/common';
import {
  ContentModerationService,
  ModerationAction,
} from '../security/content-moderation.service';
import { MetricsService } from '../infrastructure/observability/metrics.service';
import {
  AlertChannelService,
  AlertSeverity,
} from '../infrastructure/alerting/alert-channel.service';
import { AgentHarnessOperationsService } from './agent-harness-operations.service';
import type { AgentType } from '../types';

@Injectable()
export class AssistantOutputSafetyService {
  private readonly logger = new Logger(AssistantOutputSafetyService.name);

  constructor(
    private readonly moderation: ContentModerationService,
    @Optional() private readonly metrics?: MetricsService,
    @Optional() private readonly alerts?: AlertChannelService,
    @Optional()
    private readonly harnessOperations?: AgentHarnessOperationsService,
  ) {}

  async review(
    content: string,
    locale: string | undefined,
    agentType: AgentType,
  ): Promise<string> {
    try {
      const result = await this.moderation.moderate(content, {
        context: 'output',
        sanitize: true,
      });
      if (
        result.action === ModerationAction.SANITIZE &&
        result.sanitizedContent
      ) {
        return result.sanitizedContent;
      }
      if (result.action === ModerationAction.BLOCK) {
        this.logger.warn(
          `Output blocked by content moderation: ${result.details.map((detail) => detail.type).join(', ')}`,
        );
        return locale === 'en'
          ? 'I apologize, but I cannot provide that response.'
          : '抱歉，我无法提供该回复。';
      }
      return content;
    } catch (error) {
      this.logger.warn('Output moderation check failed', error);
      this.metrics?.recordError('output_moderation_unavailable', agentType);
      this.metrics?.recordHarnessEvent('output_moderation_fail_closed');
      void this.harnessOperations
        ?.recordEvent('output_moderation_fail_closed')
        .catch((evidenceError) =>
          this.logger.warn(
            `Failed to persist output moderation evidence: ${String(evidenceError)}`,
          ),
        );
      void this.alerts
        ?.send({
          alertId: 'ai-agent-output-moderation-unavailable',
          title: 'AI Agent output moderation unavailable',
          message:
            'An assistant response was replaced by the safe fallback because output moderation failed.',
          severity: AlertSeverity.CRITICAL,
          source: AssistantOutputSafetyService.name,
        })
        .catch((alertError) =>
          this.logger.warn(
            `Failed to enqueue output moderation alert: ${String(alertError)}`,
          ),
        );
      return locale === 'en'
        ? 'I cannot safely verify this response right now. Please try again later.'
        : '当前无法完成安全审核，请稍后再试。';
    }
  }
}
