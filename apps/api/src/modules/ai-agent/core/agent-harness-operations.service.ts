import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { RedisService } from '../../../common/redis/redis.service';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AgentRunBudgetV1 } from './agent-run-state';

export type HarnessAcceptanceScenario =
  'context_compression_failure' | 'budget_exhaustion';

export interface AcceptanceGrant {
  version: 1;
  grantId: string;
  scenario: HarnessAcceptanceScenario;
  targetUserId: string;
  expiresAt: string;
  budget?: AgentRunBudgetV1;
}

@Injectable()
export class AgentHarnessOperationsService {
  private static readonly GRANT_TTL_SECONDS = 300;
  private static readonly EVIDENCE_TTL_SECONDS = 90 * 24 * 60 * 60;

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  isAcceptanceEnabled(): boolean {
    return (
      this.config.get<string>('AI_AGENT_HARNESS_V1') === 'true' &&
      this.config.get<string>('AI_AGENT_ACCEPTANCE_V1') === 'true'
    );
  }

  async createGrant(input: {
    adminId: string;
    targetUserId: string;
    scenario: HarnessAcceptanceScenario;
    maxTokens?: number;
    maxDurationMs?: number;
  }): Promise<Omit<AcceptanceGrant, 'targetUserId' | 'budget'>> {
    if (!this.isAcceptanceEnabled()) {
      throw new ForbiddenException('Agent Harness acceptance is disabled');
    }

    const target = await this.prisma.user.findFirst({
      where: { id: input.targetUserId, deletedAt: null },
      select: { id: true, email: true },
    });
    if (
      !target ||
      !/^agent-harness-\d{14}@example\.invalid$/.test(target.email)
    ) {
      throw new BadRequestException('Synthetic target not found');
    }

    const grant: AcceptanceGrant = {
      version: 1,
      grantId: randomUUID(),
      scenario: input.scenario,
      targetUserId: target.id,
      expiresAt: new Date(
        Date.now() + AgentHarnessOperationsService.GRANT_TTL_SECONDS * 1000,
      ).toISOString(),
      ...(input.scenario === 'budget_exhaustion'
        ? { budget: this.restrictedBudget(input) }
        : {}),
    };

    await this.redis.set(
      this.grantKey(input.scenario, target.id),
      JSON.stringify(grant),
      AgentHarnessOperationsService.GRANT_TTL_SECONDS,
    );
    if (!(await this.redis.get(this.grantKey(input.scenario, target.id)))) {
      throw new ServiceUnavailableException(
        'Acceptance grant storage is unavailable',
      );
    }
    await this.prisma.auditLog.create({
      data: {
        userId: input.adminId,
        action: 'AI_AGENT_ACCEPTANCE_GRANT_CREATED',
        resource: 'agent_harness_acceptance',
        resourceId: grant.grantId,
        metadata: {
          scenario: grant.scenario,
          expiresAt: grant.expiresAt,
          ...(grant.budget
            ? {
                maxTokens: grant.budget.maxTokens,
                maxDurationMs: grant.budget.maxDurationMs,
              }
            : {}),
        },
      },
    });
    await this.recordEvent('acceptance_grant_created');

    return {
      version: grant.version,
      grantId: grant.grantId,
      scenario: grant.scenario,
      expiresAt: grant.expiresAt,
    };
  }

  consumeContextCompressionFailure(userId: string): Promise<boolean> {
    return this.consumeGrant('context_compression_failure', userId).then(
      Boolean,
    );
  }

  async consumeBudgetOverride(
    userId: string,
  ): Promise<AgentRunBudgetV1 | undefined> {
    const grant = await this.consumeGrant('budget_exhaustion', userId);
    return grant?.budget;
  }

  async recordEvent(event: string, amount = 1): Promise<void> {
    if (!/^[a-z0-9_]{1,80}$/.test(event) || amount <= 0) return;
    const key = this.evidenceKey(new Date());
    await this.redis.hincrby(key, event, amount);
    await this.redis.expire(
      key,
      AgentHarnessOperationsService.EVIDENCE_TTL_SECONDS,
    );
  }

  async getEvidence(days = 7): Promise<{
    days: Array<{ date: string; events: Record<string, number> }>;
    totals: Record<string, number>;
  }> {
    const boundedDays = Math.min(Math.max(Math.floor(days), 1), 30);
    const rows: Array<{ date: string; events: Record<string, number> }> = [];
    const totals: Record<string, number> = {};

    for (let offset = boundedDays - 1; offset >= 0; offset--) {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() - offset);
      const raw = await this.redis.hgetall(this.evidenceKey(date));
      const events = Object.fromEntries(
        Object.entries(raw).map(([event, value]) => [
          event,
          Number(value) || 0,
        ]),
      );
      for (const [event, value] of Object.entries(events)) {
        totals[event] = (totals[event] ?? 0) + value;
      }
      rows.push({ date: date.toISOString().slice(0, 10), events });
    }
    return { days: rows, totals };
  }

  private async consumeGrant(
    scenario: HarnessAcceptanceScenario,
    userId: string,
  ): Promise<AcceptanceGrant | undefined> {
    if (!this.isAcceptanceEnabled()) return undefined;
    const raw = await this.redis.getdel(this.grantKey(scenario, userId));
    if (!raw) return undefined;
    try {
      const grant = JSON.parse(raw) as AcceptanceGrant;
      if (
        grant.version !== 1 ||
        grant.scenario !== scenario ||
        grant.targetUserId !== userId ||
        new Date(grant.expiresAt).getTime() <= Date.now()
      ) {
        return undefined;
      }
      await this.recordEvent('acceptance_grant_consumed');
      return grant;
    } catch {
      return undefined;
    }
  }

  private restrictedBudget(input: {
    maxTokens?: number;
    maxDurationMs?: number;
  }): AgentRunBudgetV1 {
    const productionTokens = this.config.get<number>(
      'AI_AGENT_MAX_TOKENS_PER_RUN',
      24000,
    );
    const productionDuration = this.config.get<number>(
      'AI_AGENT_MAX_DURATION_MS',
      120000,
    );
    const maxTokens = input.maxTokens ?? 1000;
    const maxDurationMs = input.maxDurationMs ?? 10000;
    if (
      maxTokens < 1 ||
      maxDurationMs < 1 ||
      maxTokens >= productionTokens ||
      maxDurationMs >= productionDuration
    ) {
      throw new BadRequestException(
        'Acceptance budgets must be positive and stricter than production',
      );
    }
    return {
      version: 1,
      maxTokens,
      maxToolCalls: 16,
      maxSupplementalRounds: 2,
      maxDurationMs,
    };
  }

  private grantKey(
    scenario: HarnessAcceptanceScenario,
    userId: string,
  ): string {
    return `ai-agent:acceptance:${scenario}:${userId}`;
  }

  private evidenceKey(date: Date): string {
    return `ai-agent:harness:evidence:${date.toISOString().slice(0, 10)}`;
  }
}
