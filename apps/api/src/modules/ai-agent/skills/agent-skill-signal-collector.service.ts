import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { isRecord } from '../core/agent-run-state';

@Injectable()
export class AgentSkillSignalCollector {
  constructor(private readonly prisma: PrismaService) {}

  // governance: batch-operation — bounded consumption of redacted terminal traces.
  async collectSignals(): Promise<number> {
    const traces = await this.prisma.agentEvaluationTrace.findMany({
      where: {
        skillVersionId: { not: null },
        skillSignalConsumedAt: null,
        createdAt: { gte: new Date(Date.now() - 7 * 86400000) },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 1000,
      select: { id: true },
    });
    let collected = 0;
    for (const trace of traces) {
      collected += await this.prisma.$transaction(async (tx) => {
        const current = await tx.agentEvaluationTrace.findUnique({
          where: { id: trace.id },
        });
        if (!current || current.skillSignalConsumedAt !== null) return 0;
        // The conditional write serializes competing collectors. Both this
        // claim and all signal increments roll back if any write fails.
        const claim = await tx.agentEvaluationTrace.updateMany({
          where: { id: trace.id, skillSignalConsumedAt: null },
          data: { skillSignalConsumedAt: new Date() },
        });
        if (claim.count !== 1) return 0;
        const signals = this.signalTypes(current.outcome, current.payload);
        for (const signalType of signals) {
          await tx.agentSkillSignal.upsert({
            where: {
              agentType_clusterKey: {
                agentType: current.agentType,
                clusterKey: signalType,
              },
            },
            create: {
              agentType: current.agentType,
              clusterKey: signalType,
              signalType,
              payload: { attempt: 0 },
              lastObservedAt: current.createdAt,
            },
            update: {
              occurrenceCount: { increment: 1 },
              // Do not overwrite candidate-attempt metadata from another worker.
              lastObservedAt: current.createdAt,
            },
          });
        }
        return signals.length;
      });
    }
    return collected;
  }

  private signalTypes(outcome: string, payload: Prisma.JsonValue): string[] {
    if (!isRecord(payload)) return outcome === 'FAILED' ? ['RUN_FAILED'] : [];
    const signals = new Set<string>();
    const failure = isRecord(payload.failure) ? payload.failure : undefined;
    if (typeof failure?.errorCode === 'string')
      signals.add(failure.errorCode.slice(0, 80));
    const usage = isRecord(payload.usage) ? payload.usage : undefined;
    if (Number(usage?.supplementalRounds ?? 0) >= 2)
      signals.add('REPLAN_EXHAUSTED');
    if (Number(usage?.toolCalls ?? 0) >= 16)
      signals.add('TOOL_BUDGET_EXHAUSTED');
    const approvals = Array.isArray(payload.approvals) ? payload.approvals : [];
    if (
      approvals.some(
        (approval) => isRecord(approval) && approval.status === 'REJECTED',
      )
    ) {
      signals.add('APPROVAL_REJECTED');
    }
    const steps = Array.isArray(payload.steps) ? payload.steps : [];
    if (steps.some((step) => isRecord(step) && step.status === 'failed')) {
      signals.add('TOOL_EXECUTION_FAILED');
    }
    if (outcome === 'FAILED' && signals.size === 0) signals.add('RUN_FAILED');
    return [...signals];
  }
}
