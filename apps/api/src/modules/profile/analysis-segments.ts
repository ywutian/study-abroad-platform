import { createHash } from 'crypto';
import type {
  LLMOptions,
  LLMResponse,
  LLMService,
} from '../ai-agent/core/llm.service';
import type { AgentRunBudgetTracker } from '../ai-agent/core/agent-run-context';
import { ModelRoutingError } from '../ai-agent/routing/model-router.service';
import type { AnalysisSegment } from '../ai-agent/routing/model-routing.policy';
import { analysisSegmentPrompt } from './analysis-segments.prompts';
import {
  AnalysisTask,
  analysisResponseFormat,
  mergeAnalysisSegments,
  parseAnalysisSegment,
} from './analysis-segments.contract';
import {
  compactAnalysisInput,
  compactAnalysisPrompt,
  usesCompactAnalysis,
} from './analysis-compact';
import {
  buildPortfolioSystemPrompt,
  buildPortfolioUserPrompt,
  buildSchoolAnalystSystemPrompt,
  buildSchoolAnalystUserPrompt,
} from './profile-application-analysis-v2.prompts';

export interface AnalysisSegmentTrace {
  segment: AnalysisSegment | 'complete';
  model?: string;
  promptHash: string;
  latencyMs: number;
  status: 'completed' | 'failed';
  usage?: LLMResponse['usage'];
  /** Same promptHash identifies the shared transport; usage is allocated once. */
  batch?: { size: number; index: number };
}
export type AnalysisCallResult = LLMResponse & {
  segments?: AnalysisSegmentTrace[];
};
export class AnalysisSegmentError extends ModelRoutingError {
  constructor(
    error: unknown,
    readonly segments: AnalysisSegmentTrace[],
  ) {
    super(
      error instanceof ModelRoutingError
        ? error.code
        : error instanceof Error &&
            [
              'AGENT_TOKEN_BUDGET_EXCEEDED',
              'AGENT_DURATION_BUDGET_EXCEEDED',
            ].includes(error.message)
          ? error.message
          : 'ANALYSIS_SEGMENT_FAILED',
      error instanceof ModelRoutingError ? error.routing : undefined,
    );
  }
}

export function isSegmentedAnalysis(
  budget: AgentRunBudgetTracker | undefined,
  task: AnalysisTask,
  focusSchoolCount?: number,
): boolean {
  const route = budget?.limits.routing?.policy.routes[task];
  return (
    route?.execution === 'segmented' &&
    (route.segmentationMaxSchools === undefined ||
      (Number.isInteger(focusSchoolCount) &&
        focusSchoolCount! > 0 &&
        focusSchoolCount! <= route.segmentationMaxSchools))
  );
}

/** Sequential stages share a deadline and budget; outer school concurrency is unchanged. */
export async function callApplicationAnalysis(
  llm: Pick<LLMService, 'call'>,
  task: AnalysisTask,
  input: Record<string, unknown>,
  locale: string,
  options: LLMOptions,
  focusSchoolCount?: number,
): Promise<AnalysisCallResult> {
  const school = task === 'analysis.school';
  const configuredRoute =
    options.runBudget?.limits.routing?.policy.routes[task];
  const compact = usesCompactAnalysis(options.runBudget, task);
  const allowed = Array.isArray(input.allowedEvidenceIds)
    ? input.allowedEvidenceIds.filter(
        (id): id is string => typeof id === 'string',
      )
    : [];
  if (!isSegmentedAnalysis(options.runBudget, task, focusSchoolCount)) {
    if (compact) {
      const system = compactAnalysisPrompt(task, 'complete', locale);
      const content = JSON.stringify(
        compactAnalysisInput(task, input, 'complete'),
      );
      const responseFormat = analysisResponseFormat(task, 'complete');
      const started = Date.now();
      const trace: AnalysisSegmentTrace = {
        segment: 'complete',
        status: 'failed',
        latencyMs: 0,
        promptHash: createHash('sha256')
          .update(`${system}\n${content}${JSON.stringify(responseFormat)}`)
          .digest('hex'),
      };
      try {
        const result = await llm.call(
          system,
          [
            {
              id: 'analysis-complete',
              role: 'user',
              timestamp: new Date(),
              content,
            },
          ],
          {
            ...options,
            taskType: task,
            timeoutMs: Math.min(
              configuredRoute!.timeoutMs,
              options.runBudget!.remainingDurationMs(),
            ),
            providerOptions: {
              ...options.providerOptions,
              response_format: responseFormat,
            },
            validateOutput: (response) =>
              !response.toolCalls?.length &&
              !!parseAnalysisSegment(
                task,
                'complete',
                response.content,
                allowed,
              ) &&
              options.validateOutput?.(response) !== false,
          },
        );
        trace.model = result.routing?.model ?? result.usage?.model;
        trace.usage = result.usage;
        if (
          result.finishReason !== 'stop' ||
          result.toolCalls?.length ||
          !parseAnalysisSegment(task, 'complete', result.content, allowed) ||
          options.validateOutput?.(result) === false
        )
          throw new ModelRoutingError(
            'ANALYSIS_COMPACT_OUTPUT_INVALID',
            result.routing,
          );
        trace.status = 'completed';
        trace.latencyMs = Date.now() - started;
        return { ...result, segments: [trace] };
      } catch (error) {
        trace.latencyMs = Date.now() - started;
        throw new AnalysisSegmentError(error, [trace]);
      }
    }
    return llm.call(
      school
        ? buildSchoolAnalystSystemPrompt(locale)
        : buildPortfolioSystemPrompt(locale),
      [
        {
          id: school ? `school-${input.schoolId}` : 'portfolio-synthesizer',
          role: 'user',
          timestamp: new Date(),
          content: school
            ? buildSchoolAnalystUserPrompt(input, locale)
            : buildPortfolioUserPrompt(input, locale),
        },
      ],
      {
        ...options,
        taskType: task,
        ...(configuredRoute?.execution
          ? {
              timeoutMs: Math.min(
                configuredRoute.timeoutMs,
                options.runBudget!.remainingDurationMs(),
              ),
            }
          : {}),
      },
    );
  }
  const budget = options.runBudget!;
  const route = budget.limits.routing!.policy.routes[task]!;
  const outputBudget = Math.min(
    options.maxTokens ?? (school ? 1500 : 1000),
    school ? 1500 : 1000,
  );
  // The shared router requires at least 256 reserved output tokens per call.
  if (outputBudget < 512)
    throw new ModelRoutingError('ANALYSIS_SEGMENT_OUTPUT_BUDGET_INVALID');
  const assessmentTokens = Math.max(
    256,
    Math.min(
      outputBudget - 256,
      Math.floor(outputBudget * (school ? 8 / 15 : 0.5)),
    ),
  );
  const deadline =
    Date.now() + Math.min(route.timeoutMs, budget.remainingDurationMs());
  const traces: AnalysisSegmentTrace[] = [];
  let merged: Record<string, unknown> = {};
  let last: LLMResponse | undefined;
  let pending: AnalysisSegmentTrace | undefined;
  let pendingStarted = 0;
  try {
    for (const segment of ['assessment', 'actions'] as const) {
      const timeoutMs = deadline - Date.now();
      if (timeoutMs <= 0)
        throw new ModelRoutingError('ANALYSIS_SEGMENT_DEADLINE_EXCEEDED');
      const system = compact
        ? compactAnalysisPrompt(task, segment, locale)
        : analysisSegmentPrompt(task, segment, locale);
      const content = JSON.stringify(
        compact
          ? compactAnalysisInput(task, input, segment, merged)
          : segment === 'actions'
            ? { ...input, priorStage: merged }
            : input,
      );
      const responseFormat = compact
        ? analysisResponseFormat(task, segment)
        : undefined;
      const started = Date.now();
      pendingStarted = started;
      pending = {
        segment,
        promptHash: createHash('sha256')
          .update(
            `${system}\n${content}${responseFormat ? JSON.stringify(responseFormat) : ''}`,
          )
          .digest('hex'),
        latencyMs: 0,
        status: 'failed',
      };
      const result = await llm.call(
        system,
        [
          {
            id: `analysis-${segment}`,
            role: 'user',
            timestamp: new Date(),
            content,
          },
        ],
        {
          ...options,
          taskType: task,
          segment,
          ...(responseFormat
            ? {
                providerOptions: {
                  ...options.providerOptions,
                  response_format: responseFormat,
                },
              }
            : {}),
          timeoutMs,
          maxTokens:
            segment === 'assessment'
              ? assessmentTokens
              : outputBudget - assessmentTokens,
          validateOutput: (response) =>
            !response.toolCalls?.length &&
            !!parseAnalysisSegment(task, segment, response.content, allowed),
        },
      );
      traces.push({
        segment,
        model: result.routing?.model ?? result.usage?.model,
        promptHash: pending.promptHash,
        latencyMs: Date.now() - started,
        usage: result.usage,
        status: 'completed',
      });
      pending = undefined;
      const parsed = parseAnalysisSegment(
        task,
        segment,
        result.content,
        allowed,
      );
      if (
        !parsed ||
        result.toolCalls?.length ||
        result.finishReason !== 'stop'
      ) {
        traces[traces.length - 1].status = 'failed';
        throw new ModelRoutingError(
          'ANALYSIS_SEGMENT_OUTPUT_INVALID',
          result.routing,
        );
      }
      merged =
        segment === 'assessment'
          ? parsed
          : mergeAnalysisSegments(merged, parsed);
      last = result;
    }
    const content = JSON.stringify(merged);
    if (
      options.validateOutput &&
      !options.validateOutput({ content, finishReason: 'stop' })
    ) {
      throw new ModelRoutingError(
        'ANALYSIS_SEGMENT_MERGE_INVALID',
        last?.routing,
      );
    }
    const usage = traces.every((t) => t.usage)
      ? {
          model: [...new Set(traces.map((t) => t.model))].join(','),
          promptTokens: traces.reduce(
            (sum, t) => sum + t.usage!.promptTokens,
            0,
          ),
          completionTokens: traces.reduce(
            (sum, t) => sum + t.usage!.completionTokens,
            0,
          ),
          totalTokens: traces.reduce((sum, t) => sum + t.usage!.totalTokens, 0),
          estimatedCost: traces.reduce(
            (sum, t) => sum + (t.usage!.estimatedCost ?? 0),
            0,
          ),
        }
      : undefined;
    return {
      content,
      finishReason: 'stop',
      usage,
      segments: traces,
      ...(last?.routing ? { routing: last.routing } : {}),
    };
  } catch (error) {
    if (pending)
      traces.push({
        ...pending,
        latencyMs: Date.now() - pendingStarted,
        model:
          error instanceof ModelRoutingError ? error.routing?.model : undefined,
      });
    throw new AnalysisSegmentError(error, traces);
  }
}
