import type { ConfigService } from '@nestjs/config';
import { TOOL_METADATA, TOOLS } from '../config/tools.config';
import type { LLMOptions, LLMResponse, StreamChunk } from '../core/llm.service';
import { ToolPolicyService } from '../core/tool-policy.service';
import { canonicalize } from '../core/workflow-contract';
import { WorkflowEngineService } from '../core/workflow-engine.service';
import type {
  AgentConfig,
  ConversationState,
  Message,
  ToolCall,
} from '../types';
import { AGENT_HARNESS_BENCHMARK_FIXTURES as FIXTURES } from './agent-harness-benchmark.fixtures';
import type {
  AgentHarnessBenchmarkCaseResult,
  AgentHarnessBenchmarkModeResult,
  AgentHarnessBenchmarkReport,
  BenchmarkFixture,
  BenchmarkMode,
  DeterministicResponse,
} from './agent-harness-benchmark.types';
import {
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
}

function fingerprint(call: ToolCall): string {
  return `${call.name}:${JSON.stringify(canonicalize(call.arguments))}`;
}

class DeterministicLlm {
  readonly usage: RecordedUsage[] = [];
  private supplementalIndex = 0;

  constructor(private readonly fixture: BenchmarkFixture) {}

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

  execute(call: ToolCall): Promise<{
    success: true;
    result: { synthetic: true };
    duration: number;
  }> {
    const modeledLatencyMs = 4;
    this.executions.push({
      fingerprint: fingerprint(call),
      modeledLatencyMs,
    });
    return Promise.resolve({
      success: true as const,
      result: { synthetic: true as const },
      duration: modeledLatencyMs,
    });
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
      {
        id: `synthetic-input-${fixture.id}`,
        role: 'user',
        content: fixture.input,
        timestamp: new Date(0),
      },
    ],
    context: { userId: 'synthetic-benchmark-user' },
    metadata: { locale: 'en' },
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
  return {
    type: fixture.agentType,
    name: 'Deterministic Benchmark Agent',
    description: 'Offline synthetic benchmark agent',
    systemPrompt: 'Use only the deterministic synthetic benchmark input.',
    systemPromptEn: 'Use only the deterministic synthetic benchmark input.',
    tools: [...names],
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

function percentile95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * 0.95) - 1];
}

function rate(numerator: number, denominator: number): number {
  if (denominator === 0) return 1;
  return Number((numerator / denominator).toFixed(4));
}

async function runFixture(
  fixture: BenchmarkFixture,
  mode: BenchmarkMode,
): Promise<AgentHarnessBenchmarkCaseResult> {
  const llm = new DeterministicLlm(fixture);
  const tools = new DeterministicTools();
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
  const expectedAllowed = fixture.expectedAllowed.map(fingerprint);
  const expectedRefused = fixture.expectedRefused.map(fingerprint);
  const refused = result.plan.steps
    .filter((step) => step.result?.policy?.action !== undefined)
    .map((step) => fingerprint(step.toolCall));
  const allowedScore = multisetScore(expectedAllowed, actual);
  const refusalScore = multisetScore(expectedRefused, refused);
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
  const answerProduced = result.message.trim().length > 0;
  const passed =
    answerProduced &&
    allowedScore.unexpected === 0 &&
    allowedScore.missed === 0 &&
    refusalScore.correct === expectedRefused.length &&
    refusalScore.unexpected === 0 &&
    refusalScore.missed === 0 &&
    actual.length <= MAX_TOOL_CALLS_PER_CASE;

  return {
    caseId: fixture.id,
    passed,
    answerProduced,
    executedToolCalls: actual.length,
    correctToolCalls: allowedScore.correct,
    unexpectedToolCalls: allowedScore.unexpected,
    missedToolCalls: allowedScore.missed,
    expectedRefusals: expectedRefused.length,
    correctRefusals: refusalScore.correct,
    duplicateExecutions: duplicateCount(actual),
    duplicateCallsPrevented,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    observedLatencyMs,
    modeledLatencyMs,
  };
}

function aggregateMode(
  mode: BenchmarkMode,
  cases: AgentHarnessBenchmarkCaseResult[],
): AgentHarnessBenchmarkModeResult {
  const sum = (select: (item: AgentHarnessBenchmarkCaseResult) => number) =>
    cases.reduce((total, item) => total + select(item), 0);
  const correct = sum((item) => item.correctToolCalls);
  const unexpected = sum((item) => item.unexpectedToolCalls);
  const missed = sum((item) => item.missedToolCalls);
  const precision = rate(correct, correct + unexpected);
  const recall = rate(correct, correct + missed);
  return {
    mode,
    caseCount: cases.length,
    passedCases: cases.filter((item) => item.passed).length,
    taskSuccessRate: rate(
      cases.filter((item) => item.passed).length,
      cases.length,
    ),
    toolPrecision: precision,
    toolRecall: recall,
    toolF1:
      precision + recall === 0
        ? 0
        : Number(((2 * precision * recall) / (precision + recall)).toFixed(4)),
    refusalAccuracy: rate(
      sum((item) => item.correctRefusals),
      sum((item) => item.expectedRefusals),
    ),
    duplicateExecutions: sum((item) => item.duplicateExecutions),
    duplicateCallsPrevented: sum((item) => item.duplicateCallsPrevented),
    promptTokens: sum((item) => item.promptTokens),
    completionTokens: sum((item) => item.completionTokens),
    totalTokens: sum((item) => item.totalTokens),
    observedLatencyMs: sum((item) => item.observedLatencyMs),
    observedP95LatencyMs: percentile95(
      cases.map((item) => item.observedLatencyMs),
    ),
    modeledLatencyMs: sum((item) => item.modeledLatencyMs),
    modeledP95LatencyMs: percentile95(
      cases.map((item) => item.modeledLatencyMs),
    ),
    maxExecutedToolCallsPerCase: Math.max(
      0,
      ...cases.map((item) => item.executedToolCalls),
    ),
    cases,
  };
}

function evaluateGate(
  legacy: AgentHarnessBenchmarkModeResult,
  harness: AgentHarnessBenchmarkModeResult,
): string[] {
  const failures: string[] = [];
  if (harness.taskSuccessRate !== 1)
    failures.push('HARNESS_TASK_SUCCESS_BELOW_100_PERCENT');
  if (harness.toolPrecision !== 1)
    failures.push('HARNESS_TOOL_PRECISION_BELOW_100_PERCENT');
  if (harness.toolRecall !== 1)
    failures.push('HARNESS_TOOL_RECALL_BELOW_100_PERCENT');
  if (harness.refusalAccuracy !== 1)
    failures.push('HARNESS_REFUSAL_ACCURACY_BELOW_100_PERCENT');
  if (harness.duplicateExecutions !== 0)
    failures.push('HARNESS_DUPLICATE_EXECUTION_DETECTED');
  if (harness.maxExecutedToolCallsPerCase > MAX_TOOL_CALLS_PER_CASE)
    failures.push('HARNESS_TOOL_BUDGET_EXCEEDED');
  if (harness.taskSuccessRate <= legacy.taskSuccessRate)
    failures.push('HARNESS_DID_NOT_IMPROVE_TASK_SUCCESS');
  return failures;
}

/** Run both modes on an identical, frozen, fully synthetic dataset. */
export async function runAgentHarnessBenchmark(): Promise<AgentHarnessBenchmarkReport> {
  const legacyCases: AgentHarnessBenchmarkCaseResult[] = [];
  const harnessCases: AgentHarnessBenchmarkCaseResult[] = [];
  for (const fixture of FIXTURES) {
    legacyCases.push(await runFixture(fixture, 'legacy_rewoo'));
    harnessCases.push(await runFixture(fixture, 'harness_v1'));
  }
  const legacy = aggregateMode('legacy_rewoo', legacyCases);
  const harness = aggregateMode('harness_v1', harnessCases);
  const failures = evaluateGate(legacy, harness);
  return {
    schemaVersion: 1,
    datasetVersion: DATASET_VERSION,
    execution: 'deterministic_offline',
    sensitiveDataIncluded: false,
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
      modeledLatencyMsDelta: harness.modeledLatencyMs - legacy.modeledLatencyMs,
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

/** Exposed only to prove metadata coverage in tests without serializing it. */
export function getAgentHarnessBenchmarkFixtureCount(): number {
  return FIXTURES.length;
}

/** Compile-time/runtime guard against silently benchmarking unclassified tools. */
export function validateAgentHarnessBenchmarkFixtures(): string[] {
  const missing = new Set<string>();
  for (const fixture of FIXTURES) {
    for (const call of [
      ...(fixture.initial.toolCalls ?? []),
      ...fixture.supplemental.flatMap((item) => item.toolCalls ?? []),
    ]) {
      if (
        call.name !== 'unregistered_synthetic_tool' &&
        !(call.name in TOOL_METADATA)
      ) {
        missing.add(call.name);
      }
    }
  }
  return [...missing].sort();
}
