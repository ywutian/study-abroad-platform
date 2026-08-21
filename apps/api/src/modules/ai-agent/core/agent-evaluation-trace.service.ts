import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AgentResponse } from '../types';
import { SanitizeLevel, SanitizerService } from '../memory/sanitizer.service';
import { isRecord, toInputJson } from './agent-run-state';
import { MetricsService } from '../infrastructure/observability/metrics.service';
import {
  AlertChannelService,
  AlertSeverity,
} from '../infrastructure/alerting/alert-channel.service';

@Injectable()
export class AgentEvaluationTraceService {
  private readonly logger = new Logger(AgentEvaluationTraceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Optional() private readonly sanitizer?: SanitizerService,
    @Optional() private readonly metrics?: MetricsService,
    @Optional() private readonly alerts?: AlertChannelService,
  ) {}

  async persist(
    userId: string,
    runId: string,
    outcome: string,
    result?: AgentResponse,
    failure?: { errorCode: string },
  ): Promise<void> {
    if (!this.isEnabled()) return;

    try {
      const run = await this.prisma.agentRun.findFirst({
        where: { id: runId, userId },
        select: {
          id: true,
          agentType: true,
          budget: true,
          usage: true,
          contextSummary: true,
          startedAt: true,
          completedAt: true,
          approvals: {
            select: { toolName: true, status: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      if (!run) return;

      const workflow = isRecord(result?.data?.workflow)
        ? result.data.workflow
        : undefined;
      const steps = Array.isArray(workflow?.steps)
        ? workflow.steps.flatMap((step) =>
            isRecord(step)
              ? [
                  {
                    tool:
                      typeof step.tool === 'string'
                        ? step.tool.slice(0, 100)
                        : '',
                    status:
                      typeof step.status === 'string'
                        ? step.status.slice(0, 30)
                        : 'unknown',
                    duration:
                      typeof step.duration === 'number'
                        ? step.duration
                        : undefined,
                  },
                ]
              : [],
          )
        : [];
      const payload = {
        runId: run.id,
        harnessVersion: 1,
        contextVersion: 1,
        outcome,
        budget: run.budget,
        usage: run.usage,
        contextSummary: this.toContextSummary(run.contextSummary),
        toolsUsed: (result?.toolsUsed || []).slice(0, 16),
        steps,
        approvals: run.approvals,
        failure,
        elapsedMs: run.completedAt
          ? Math.max(0, run.completedAt.getTime() - run.startedAt.getTime())
          : undefined,
      };

      const sanitized = this.sanitizer?.sanitizeWithDetails(
        JSON.stringify(payload),
        { level: SanitizeLevel.FULL },
      );
      const safePayload = sanitized
        ? (JSON.parse(sanitized.sanitized) as Prisma.InputJsonValue)
        : toInputJson(payload);

      await this.prisma.agentEvaluationTrace.upsert({
        where: { runId },
        create: {
          runId,
          agentType: run.agentType,
          outcome,
          payload: safePayload,
          redactedTypes: sanitized?.detectedTypes ?? [],
        },
        update: {
          outcome,
          payload: safePayload,
          redactedTypes: sanitized?.detectedTypes ?? [],
        },
      });
      this.metrics?.recordHarnessEvent('evaluation_trace_persisted');
    } catch (error) {
      this.metrics?.recordHarnessEvent('evaluation_trace_persist_failed');
      this.logger.warn(
        `Failed to persist redacted evaluation trace for run ${runId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      void this.alerts
        ?.send({
          alertId: 'ai-agent-evaluation-trace-persist-failed',
          title: 'AI Agent evaluation trace persistence failed',
          message: 'A redacted Agent evaluation trace could not be persisted.',
          severity: AlertSeverity.WARNING,
          source: AgentEvaluationTraceService.name,
        })
        .catch((alertError) =>
          this.logger.warn(
            `Failed to enqueue evaluation trace alert: ${String(alertError)}`,
          ),
        );
    }
  }

  private isEnabled(): boolean {
    return (
      this.config.get<string>('AI_AGENT_HARNESS_V1') === 'true' &&
      this.config.get<string>('AI_AGENT_CONTEXT_V1') === 'true'
    );
  }

  private toContextSummary(value: Prisma.JsonValue | null): unknown {
    if (!isRecord(value)) return undefined;
    const refs = Array.isArray(value.toolResultRefs)
      ? value.toolResultRefs.flatMap((ref) =>
          isRecord(ref)
            ? [
                {
                  toolCallId:
                    typeof ref.toolCallId === 'string'
                      ? ref.toolCallId.slice(0, 100)
                      : '',
                  toolName:
                    typeof ref.toolName === 'string'
                      ? ref.toolName.slice(0, 100)
                      : '',
                  status:
                    typeof ref.status === 'string' ? ref.status : 'unknown',
                },
              ]
            : [],
        )
      : [];
    return {
      version: value.version,
      approvalState: value.approvalState,
      constraintCount: Array.isArray(value.constraints)
        ? value.constraints.length
        : 0,
      unfinishedStepCount: Array.isArray(value.unfinishedSteps)
        ? value.unfinishedSteps.length
        : 0,
      toolResultRefs: refs,
      hasFailure: isRecord(value.lastFailure),
    };
  }
}
