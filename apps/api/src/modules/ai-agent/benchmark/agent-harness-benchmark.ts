import type { ConfigService } from '@nestjs/config';
import { TOOLS } from '../config/tools.config';
import type { LLMOptions, LLMResponse, StreamChunk } from '../core/llm.service';
import { ToolPolicyService } from '../core/tool-policy.service';
import { canonicalize } from '../core/workflow-contract';
import { WorkflowEngineService } from '../core/workflow-engine.service';
import type { ToolExecutionResult } from '../core/types';
import type {
  AgentConfig,
  ConversationState,
  Message,
  ToolCall,
} from '../types';
import { AGENT_HARNESS_BENCHMARK_FIXTURES as FIXTURES } from './agent-harness-benchmark.fixtures';
import { getAgentHarnessBenchmarkCoverage } from './agent-harness-benchmark.dataset';
import {
  aggregateBenchmarkMode,
  evaluateBenchmarkGate,
} from './agent-harness-benchmark.metrics';
import type {
  AgentHarnessBenchmarkCaseResult,
  AgentHarnessBenchmarkReport,
  BenchmarkFixture,
  BenchmarkMode,
  DeterministicResponse,
} from './agent-harness-benchmark.types';
import {
  BENCHMARK_RUNS_PER_FIXTURE,
  DATASET_VERSION,
  MAX_TOOL_CALLS_PER_CASE,
} from './agent-harness-benchmark.types';

export type {
  AgentHarnessBenchmarkCaseResult,
  AgentHarnessBenchmarkModeResult,
  AgentHarnessBenchmarkReport,
} from './agent-harness-benchmark.types';

interface RecordedUsage {
  promptTokens: number;
  completionTokens: number;
  modeledLatencyMs: number;
}

interface ExecutionRecord {
  fingerprint: string;
  modeledLatencyMs: number;
  success: boolean;
}

function fingerprint(call: ToolCall): string {
  return `${call.name}:${JSON.stringify(canonicalize(call.arguments))}`;
}

class DeterministicLlm {
  readonly usage: RecordedUsage[] = [];
  private supplementalIndex = 0;

  constructor(private readonly fixture: BenchmarkFixture) {}

  get supplementalRounds(): number {
    return this.supplementalIndex;
  }

  call(
    systemPrompt: string,
    _messages: Message[],
    _options?: LLMOptions,
  ): Promise<LLMResponse> {
    const isSupplemental =
      systemPrompt.includes('Supplemental Planning Round') ||
      systemPrompt.includes('补充规划第');
    const selected = isSupplemental
      ? (this.fixture.supplemental[this.supplementalIndex++] ?? {
          content: '',
          promptTokens: 70,
          completionTokens: 10,
          modeledLatencyMs: 8,
        })
      : this.fixture.initial;
    this.record(selected);
    return Promise.resolve(this.toResponse(selected));
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- the LLM contract is an async generator even for deterministic offline chunks.
  async *callStream(
    _systemPrompt: string,
    _messages: Message[],
    _options?: LLMOptions,
  ): AsyncGenerator<StreamChunk> {
    this.record(this.fixture.solve);
    if (this.fixture.solve.content) {
      yield { type: 'content', content: this.fixture.solve.content };
    }
    yield { type: 'done' };
  }

  private record(selected: DeterministicResponse): void {
    this.usage.push({
      promptTokens: selected.promptTokens,
      completionTokens: selected.completionTokens,
      modeledLatencyMs: selected.modeledLatencyMs,
    });
  }

  private toResponse(selected: DeterministicResponse): LLMResponse {
    return {
      content: selected.content,
      toolCalls: selected.toolCalls,
      finishReason: selected.toolCalls?.length ? 'tool_calls' : 'stop',
      usage: {
        promptTokens: selected.promptTokens,
        completionTokens: selected.completionTokens,
        totalTokens: selected.promptTokens + selected.completionTokens,
        estimatedCost: 0,
        model: 'deterministic-offline',
      },
    };
  }
}

class DeterministicTools {
  readonly executions: ExecutionRecord[] = [];

  private readonly remainingFailures: Map<string, number>;

  constructor(fixture: BenchmarkFixture) {
    this.remainingFailures = new Map(
      (fixture.failurePlan ?? []).map((item) => [
        fingerprint(item.call),
        item.failures,
      ]),
    );
  }

  execute(call: ToolCall): Promise<ToolExecutionResult> {
    const modeledLatencyMs = 4;
    const callFingerprint = fingerprint(call);
    const remainingFailures = this.remainingFailures.get(callFingerprint) ?? 0;
    const success = remainingFailures === 0;
    if (!success) {
      this.remainingFailures.set(callFingerprint, remainingFailures - 1);
    }
    this.executions.push({
      fingerprint: callFingerprint,
      modeledLatencyMs,
      success,
    });
    return Promise.resolve(
      success
        ? {
            success: true,
            result: { synthetic: true },
            duration: modeledLatencyMs,
          }
        : {
            success: false,
            error: 'SYNTHETIC_RECOVERABLE_TOOL_FAILURE',
            errorCode: 'SYNTHETIC_RECOVERABLE_TOOL_FAILURE',
            duration: modeledLatencyMs,
          },
    );
  }
}

class DeterministicMemory {
  addMessage(
    conversation: ConversationState,
    message: Omit<Message, 'id' | 'timestamp'>,
  ): Message {
    const fullMessage: Message = {
      ...message,
      id: `synthetic-message-${conversation.messages.length + 1}`,
      timestamp: new Date(0),
    };
    conversation.messages.push(fullMessage);
    return fullMessage;
  }

  getRecentMessages(conversation: ConversationState): Message[] {
    return conversation.messages;
  }

  getContextSummary(): string {
    return '';
  }
}

function createConversation(fixture: BenchmarkFixture): ConversationState {
  return {
    id: `synthetic-conversation-${fixture.id}`,
    userId: 'synthetic-benchmark-user',
    messages: [
      ...fixture.contextMessages.map((message, index) => ({
        id: `synthetic-context-${fixture.id}-${index + 1}`,
        role: message.role,
        content: message.content,
        timestamp: new Date(index),
      })),
      {
        id: `synthetic-input-${fixture.id}`,
        role: 'user',
        content: fixture.input,
        timestamp: new Date(0),
      },
    ],
    context: { userId: 'synthetic-benchmark-user' },
    metadata: { locale: fixture.locale },
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

function createConfig(fixture: BenchmarkFixture): AgentConfig {
  const names = new Set([
    ...(fixture.initial.toolCalls?.map((call) => call.name) ?? []),
    ...fixture.supplemental.flatMap(
      (item) => item.toolCalls?.map((call) => call.name) ?? [],
    ),
  ]);
  const authorizedNames = fixture.authorizedToolNames ?? [...names];
  return {
    type: fixture.agentType,
    name: 'Deterministic Benchmark Agent',
    description: 'Offline synthetic benchmark agent',
    systemPrompt: 'Use only the deterministic synthetic benchmark input.',
    systemPromptEn: 'Use only the deterministic synthetic benchmark input.',
    tools: [...authorizedNames],
    canDelegate: [],
    model: 'deterministic-offline',
    temperature: 0,
    maxTokens: 1024,
    enableReflection: false,
  };
}

function multisetScore(
  expected: string[],
  actual: string[],
): {
  correct: number;
  unexpected: number;
  missed: number;
} {
  const remaining = new Map<string, number>();
  for (const value of expected) {
    remaining.set(value, (remaining.get(value) ?? 0) + 1);
  }
  let correct = 0;
  let unexpected = 0;
  for (const value of actual) {
    const count = remaining.get(value) ?? 0;
    if (count > 0) {
      correct += 1;
      remaining.set(value, count - 1);
    } else {
      unexpected += 1;
    }
  }
  return {
    correct,
    unexpected,
    missed: [...remaining.values()].reduce((sum, count) => sum + count, 0),
  };
}

function duplicateCount(values: string[]): number {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.values()].reduce(
    (total, count) => total + Math.max(0, count - 1),
    0,
  );
}

async function runFixture(
  fixture: BenchmarkFixture,
  mode: BenchmarkMode,
  repetition: number,
): Promise<AgentHarnessBenchmarkCaseResult> {
  const llm = new DeterministicLlm(fixture);
  const tools = new DeterministicTools(fixture);
  const memory = new DeterministicMemory();
  const config = {
    get: <T>(key: string, fallback?: T): T | undefined => {
      if (key === 'AI_AGENT_HARNESS_V1') {
        return (mode === 'harness_v1' ? 'true' : 'false') as T;
      }
      if (key === 'AI_AGENT_CONTEXT_V1') return 'false' as T;
      if (key === 'AI_AGENT_HARNESS_MODE') return fixture.harnessMode as T;
      return fallback;
    },
  };
  const engine = new WorkflowEngineService(
    llm,
    tools,
    memory,
    undefined,
    undefined,
    undefined,
    new ToolPolicyService(),
    config as ConfigService,
    undefined,
  );
  Object.defineProperty(engine, 'logger', {
    value: {
      log: () => undefined,
      warn: () => undefined,
      error: () => undefined,
      debug: () => undefined,
    },
  });
  const agentConfig = createConfig(fixture);
  const allowedDefinitions = TOOLS.filter((definition) =>
    agentConfig.tools.includes(definition.name),
  );
  const startedAt = Date.now();
  const result = await engine.run(
    fixture.agentType,
    agentConfig,
    createConversation(fixture),
    allowedDefinitions,
  );
  const observedLatencyMs = Date.now() - startedAt;
  const actual = tools.executions.map((record) => record.fingerprint);
  const successful = tools.executions
    .filter((record) => record.success)
    .map((record) => record.fingerprint);
  const failed = tools.executions
    .filter((record) => !record.success)
    .map((record) => record.fingerprint);
  const expectedAllowed = fixture.expectedAllowed.map(fingerprint);
  const expectedRefused = fixture.expectedRefused.map(fingerprint);
  const expectedFailures = fixture.expectedFailures.map(fingerprint);
  const refused = result.plan.steps
    .filter((step) => step.result?.policy?.action !== undefined)
    .map((step) => fingerprint(step.toolCall));
  const allowedScore = multisetScore(expectedAllowed, actual);
  const refusalScore = multisetScore(expectedRefused, refused);
  const failureScore = multisetScore(expectedFailures, failed);
  const promptTokens = llm.usage.reduce(
    (sum, item) => sum + item.promptTokens,
    0,
  );
  const completionTokens = llm.usage.reduce(
    (sum, item) => sum + item.completionTokens,
    0,
  );
  const modeledLatencyMs =
    llm.usage.reduce((sum, item) => sum + item.modeledLatencyMs, 0) +
    tools.executions.reduce((sum, item) => sum + item.modeledLatencyMs, 0);
  const duplicateCallsPrevented = result.plan.steps.filter(
    (step) =>
      step.result?.cached === true &&
      (step.result.result as { reason?: string } | undefined)?.reason ===
        'DUPLICATE_SUCCESSFUL_CALL',
  ).length;
  const delegationProduced = result.delegation !== undefined;
  const answerProduced = result.message.trim().length > 0 || delegationProduced;
  const delegationCorrect = fixture.expectDelegation
    ? delegationProduced
    : !delegationProduced;
  const supplementalRoundsCorrect =
    mode !== 'harness_v1' ||
    llm.supplementalRounds === fixture.expectedSupplementalRounds;
  const passed =
    answerProduced &&
    delegationCorrect &&
    supplementalRoundsCorrect &&
    allowedScore.unexpected === 0 &&
    allowedScore.missed === 0 &&
    refusalScore.correct === expectedRefused.length &&
    refusalScore.unexpected === 0 &&
    refusalScore.missed === 0 &&
    failureScore.correct === expectedFailures.length &&
    failureScore.unexpected === 0 &&
    failureScore.missed === 0 &&
    actual.length <= MAX_TOOL_CALLS_PER_CASE;

  return {
    caseId: `${fixture.id}#${repetition}`,
    fixtureId: fixture.id,
    category: fixture.category,
    agentType: fixture.agentType,
    locale: fixture.locale,
    repetition,
    passed,
    answerProduced,
    delegationProduced,
    executedToolCalls: actual.length,
    failedToolCalls: failed.length,
    correctToolCalls: allowedScore.correct,
    unexpectedToolCalls: allowedScore.unexpected,
    missedToolCalls: allowedScore.missed,
    expectedRefusals: expectedRefused.length,
    correctRefusals: refusalScore.correct,
    duplicateExecutions: duplicateCount(successful),
    duplicateCallsPrevented,
    supplementalRounds: llm.supplementalRounds,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    observedLatencyMs,
    modeledLatencyMs,
  };
}

function deltaRatio(current: number, baseline: number): number {
  if (baseline === 0) return current === 0 ? 0 : 1;
  return Number(((current - baseline) / baseline).toFixed(4));
}

/** Run both modes on an identical, frozen, fully synthetic dataset. */
export async function runAgentHarnessBenchmark(): Promise<AgentHarnessBenchmarkReport> {
  const legacyCases: AgentHarnessBenchmarkCaseResult[] = [];
  const harnessCases: AgentHarnessBenchmarkCaseResult[] = [];
  for (const fixture of FIXTURES) {
    for (
      let repetition = 1;
      repetition <= BENCHMARK_RUNS_PER_FIXTURE;
      repetition++
    ) {
      legacyCases.push(await runFixture(fixture, 'legacy_rewoo', repetition));
      harnessCases.push(await runFixture(fixture, 'harness_v1', repetition));
    }
  }
  const legacy = aggregateBenchmarkMode('legacy_rewoo', legacyCases);
  const harness = aggregateBenchmarkMode('harness_v1', harnessCases);
  const failures = evaluateBenchmarkGate(legacy, harness);
  return {
    schemaVersion: 2,
    datasetVersion: DATASET_VERSION,
    execution: 'deterministic_offline',
    sensitiveDataIncluded: false,
    coverage: getAgentHarnessBenchmarkCoverage(),
    legacy,
    harness,
    comparison: {
      taskSuccessRateDelta: Number(
        (harness.taskSuccessRate - legacy.taskSuccessRate).toFixed(4),
      ),
      toolPrecisionDelta: Number(
        (harness.toolPrecision - legacy.toolPrecision).toFixed(4),
      ),
      toolRecallDelta: Number(
        (harness.toolRecall - legacy.toolRecall).toFixed(4),
      ),
      refusalAccuracyDelta: Number(
        (harness.refusalAccuracy - legacy.refusalAccuracy).toFixed(4),
      ),
      duplicateExecutionsDelta:
        harness.duplicateExecutions - legacy.duplicateExecutions,
      totalTokensDelta: harness.totalTokens - legacy.totalTokens,
      totalTokensDeltaRatio: deltaRatio(
        harness.totalTokens,
        legacy.totalTokens,
      ),
      modeledLatencyMsDelta: harness.modeledLatencyMs - legacy.modeledLatencyMs,
      modeledLatencyMsDeltaRatio: deltaRatio(
        harness.modeledLatencyMs,
        legacy.modeledLatencyMs,
      ),
    },
    gate: { passed: failures.length === 0, failures },
  };
}

export function assertAgentHarnessBenchmark(
  report: AgentHarnessBenchmarkReport,
): void {
  if (!report.gate.passed) {
    throw new Error(
      `AI_AGENT_HARNESS_BENCHMARK_FAILED:${report.gate.failures.join(',')}`,
    );
  }
}

export {
  getAgentHarnessBenchmarkFixtureCount,
  validateAgentHarnessBenchmarkFixtures,
} from './agent-harness-benchmark.dataset';
