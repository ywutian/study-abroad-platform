import type { Logger } from '@nestjs/common';
import type { AgentConfig, ConversationState } from '../types';
import type { AgentRunBudgetTracker } from './agent-run-context';
import type { AgentRunUsageV1 } from './agent-run-state';
import { canAffordVerification } from './workflow-budget';
import type { LLMService } from './llm.service';
import type { ToolExecutorService } from './tool-executor.service';
import {
  buildVerificationPrompt,
  parseVerificationFacts,
  verifySchoolFacts,
} from './workflow-verification';
import { extractJsonFromLlm } from '../../../common/utils/llm-json.util';

const unchecked = () => ({
  allCorrect: false,
  status: 'unverified' as const,
  unverified: 1,
  verified: 0,
  toolCalls: 0,
  corrections: [],
});

/** Optional verification must not discard an answer that has already completed. */
export async function runWorkflowVerification(options: {
  config: AgentConfig;
  output: string;
  conversation: ConversationState;
  locale: string;
  budget?: AgentRunBudgetTracker;
  remainingToolCalls: number;
  llm: Pick<LLMService, 'call'>;
  executor: Pick<ToolExecutorService, 'execute'>;
  logger: Pick<Logger, 'log' | 'warn'>;
}): Promise<Awaited<ReturnType<typeof verifySchoolFacts>>> {
  const { budget, config, conversation, locale } = options;
  const prompt = buildVerificationPrompt(options.output, locale);
  const evidence: NonNullable<AgentRunUsageV1['verification']> = {
    attempted: false,
    remainingTokens: budget?.remainingTokens() ?? -1,
    requiredTokens: 0,
    outcome: 'failed',
    verified: 0,
    unverified: 1,
    toolCalls: 0,
    unverifiedReasons: {},
  };
  try {
    const check = canAffordVerification(budget, prompt);
    evidence.remainingTokens = check.decision.remainingTokens;
    evidence.requiredTokens = check.decision.requiredTokens;
    options.logger.log(`Workflow budget ${JSON.stringify(check.decision)}`);
    if (!check.affordable) {
      evidence.outcome = 'skip_insufficient_budget';
      return unchecked();
    }
    evidence.attempted = true;
    const extracted = await options.llm.call(prompt, [], {
      taskType: 'agent.verify',
      model: config.reflectionModel || 'gpt-5.4-mini',
      temperature: 0,
      maxTokens: 500,
      userId: 'system',
      agentType: `${config.type}_cove_extract`,
      providerOptions: { response_format: { type: 'json_object' } },
      runBudget: budget,
    });
    const facts = parseVerificationFacts(extractJsonFromLlm(extracted.content));
    const result = !facts
      ? unchecked()
      : !facts.length
        ? { ...unchecked(), status: 'not_applicable' as const, unverified: 0 }
        : await verifySchoolFacts(
            facts,
            options.executor,
            conversation,
            locale,
            options.remainingToolCalls,
            (reason) => {
              const counts = evidence.unverifiedReasons!;
              counts[reason] = (counts[reason] ?? 0) + 1;
            },
          );
    Object.assign(evidence, {
      outcome: result.status,
      verified: result.verified,
      unverified: result.unverified,
      toolCalls: result.toolCalls,
    });
    return result;
  } catch {
    options.logger.warn('CoVE unavailable; factual claims remain unverified');
    return unchecked();
  } finally {
    budget?.recordVerification(evidence);
  }
}
