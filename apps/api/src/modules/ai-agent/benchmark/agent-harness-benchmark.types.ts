import type { AgentType } from '@study-abroad/shared';
import type { AgentHarnessMode, ToolCall } from '../types';

export const DATASET_VERSION = 'agent-harness-comparison-v2';
export const MAX_TOOL_CALLS_PER_CASE = 16;
export const BENCHMARK_RUNS_PER_FIXTURE = 3;
export const MAX_TOKEN_OVERHEAD_RATIO = 0.45;
export const MAX_MODELED_LATENCY_OVERHEAD_RATIO = 0.6;

export const BENCHMARK_CATEGORY_TARGETS = {
  core_business: 40,
  multi_turn_context: 20,
  tool_boundary: 20,
  permission_security: 15,
  failure_recovery: 15,
  budget_extreme: 10,
} as const;

export type BenchmarkCategory = keyof typeof BENCHMARK_CATEGORY_TARGETS;

export type BenchmarkMode = 'legacy_rewoo' | 'harness_v1';

export interface DeterministicResponse {
  content: string;
  toolCalls?: ToolCall[];
  promptTokens: number;
  completionTokens: number;
  modeledLatencyMs: number;
}

export interface BenchmarkFixture {
  id: string;
  category: BenchmarkCategory;
  agentType: AgentType;
  harnessMode: AgentHarnessMode;
  locale: 'en' | 'zh';
  input: string;
  contextMessages: ReadonlyArray<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  initial: DeterministicResponse;
  supplemental: readonly DeterministicResponse[];
  solve: DeterministicResponse;
  expectedAllowed: readonly ToolCall[];
  expectedRefused: readonly ToolCall[];
  expectedFailures: readonly ToolCall[];
  expectedSupplementalRounds: number;
  failurePlan?: ReadonlyArray<{ call: ToolCall; failures: number }>;
  authorizedToolNames?: readonly string[];
  expectDelegation?: boolean;
}

export interface AgentHarnessBenchmarkCaseResult {
  caseId: string;
  fixtureId: string;
  category: BenchmarkCategory;
  agentType: AgentType;
  locale: 'en' | 'zh';
  repetition: number;
  passed: boolean;
  answerProduced: boolean;
  delegationProduced: boolean;
  executedToolCalls: number;
  failedToolCalls: number;
  correctToolCalls: number;
  unexpectedToolCalls: number;
  missedToolCalls: number;
  expectedRefusals: number;
  correctRefusals: number;
  duplicateExecutions: number;
  duplicateCallsPrevented: number;
  supplementalRounds: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  observedLatencyMs: number;
  modeledLatencyMs: number;
}

export interface AgentHarnessBenchmarkModeResult {
  mode: BenchmarkMode;
  caseCount: number;
  passedCases: number;
  taskSuccessRate: number;
  toolPrecision: number;
  toolRecall: number;
  toolF1: number;
  refusalAccuracy: number;
  duplicateExecutions: number;
  duplicateCallsPrevented: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  observedLatencyMs: number;
  observedP95LatencyMs: number;
  modeledLatencyMs: number;
  modeledP95LatencyMs: number;
  maxExecutedToolCallsPerCase: number;
  cases: AgentHarnessBenchmarkCaseResult[];
}

export interface AgentHarnessBenchmarkReport {
  schemaVersion: 2;
  datasetVersion: string;
  execution: 'deterministic_offline';
  sensitiveDataIncluded: false;
  coverage: {
    fixtureCount: number;
    repetitionsPerFixture: number;
    executionsPerMode: number;
    categoryFixtureCounts: Record<BenchmarkCategory, number>;
    agentTypeCount: number;
    localeCount: number;
    productionToolsCovered: number;
    productionToolsTotal: number;
  };
  legacy: AgentHarnessBenchmarkModeResult;
  harness: AgentHarnessBenchmarkModeResult;
  comparison: {
    taskSuccessRateDelta: number;
    toolPrecisionDelta: number;
    toolRecallDelta: number;
    refusalAccuracyDelta: number;
    duplicateExecutionsDelta: number;
    totalTokensDelta: number;
    totalTokensDeltaRatio: number;
    modeledLatencyMsDelta: number;
    modeledLatencyMsDeltaRatio: number;
  };
  gate: {
    passed: boolean;
    failures: string[];
  };
}
