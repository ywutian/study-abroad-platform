import { ConfigService } from '@nestjs/config';
import {
  MODEL_TASKS,
  routingPolicySchema,
} from '../src/modules/ai-agent/routing/model-routing.policy';
import { analysisResponseFormat } from '../src/modules/profile/analysis-segments.contract';
import { segmentExamples as ex } from '../src/modules/profile/analysis-segments.fixtures';
import type {
  LLMChatRequest,
  LLMChatResponse,
} from '../src/modules/ai-agent/providers/llm-provider.types';
type Execution = 'single' | 'segmented' | 'shared';
export function policy(execution: Execution) {
  return routingPolicySchema.parse({
    version: 1,
    revision: `compact-v1-${execution}`,
    provider: 'openai',
    models: {
      'gpt-5.4': {
        capabilities: ['text', 'json'],
        contextWindow: 32000,
        maxOutputTokens: 3000,
        reasoningEfforts: ['none'],
      },
    },
    routes: Object.fromEntries(
      MODEL_TASKS.map((task) => [
        task,
        {
          models: ['gpt-5.4'],
          requires: ['text', 'json'],
          timeoutMs: 30000,
          maxOutputTokens:
            execution === 'shared' && task === 'analysis.school' ? 3000 : 1500,
          reasoningEffort: 'none',
          ...(task.startsWith('analysis.')
            ? {
                execution: execution === 'shared' ? 'single' : execution,
                analysisOptimization:
                  execution === 'shared' && task === 'analysis.school'
                    ? 'shared-v1'
                    : 'compact-v1',
              }
            : {}),
        },
      ]),
    ),
  });
}
export function config(key: string, execution: Execution) {
  return new ConfigService({
    LLM_PROVIDER: 'openai',
    OPENAI_MODEL: 'gpt-5.4',
    OPENAI_API_KEY: key,
    OPENAI_BASE_URL: 'https://claude-relay.liziqiao.com/openai/v1',
    AI_AGENT_MODEL_ROUTING_V1: 'true',
    AI_AGENT_MODEL_ROUTING_CONFIG: JSON.stringify(policy(execution)),
    AI_AGENT_MAX_TOKENS_PER_RUN: 24000,
    AI_AGENT_MAX_DURATION_MS: 120000,
  });
}
export function mockResponse(request: LLMChatRequest): LLMChatResponse {
  const input = JSON.parse(request.messages[0].content ?? '{}');
  const format = request.providerOptions?.response_format as ReturnType<
    typeof analysisResponseFormat
  >;
  const school = format.json_schema.name.includes('school');
  const complete = format.json_schema.name.includes('complete');
  const actions = format.json_schema.name.includes('actions');
  const value = format.json_schema.name.includes('shared')
    ? {
        schools: input.schools.map(
          (s: { schoolId: string; allowedEvidenceIds: string[] }) => ({
            schoolId: s.schoolId,
            analysis: {
              ...ex.schoolAssessment,
              ...ex.schoolActions,
              evidenceIds: s.allowedEvidenceIds,
            },
          }),
        ),
      }
    : school
      ? {
          ...(complete
            ? { ...ex.schoolAssessment, ...ex.schoolActions }
            : actions
              ? ex.schoolActions
              : ex.schoolAssessment),
          evidenceIds: input.allowedEvidenceIds,
        }
      : complete
        ? { ...ex.portfolioAssessment, ...ex.portfolioActions }
        : actions
          ? ex.portfolioActions
          : ex.portfolioAssessment;
  const content = JSON.stringify(value);
  const promptTokens = Math.ceil(JSON.stringify(request).length / 3),
    completionTokens = Math.ceil(content.length / 3);
  return {
    model: request.model,
    content,
    finishReason: 'stop',
    usage: {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    },
  };
}
