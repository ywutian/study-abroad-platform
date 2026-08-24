import type { AgentType } from '@study-abroad/shared';
import type { AgentHarnessMode, ToolCall } from '../types';

export const DATASET_VERSION = 'agent-harness-comparison-v1';
export const MAX_TOOL_CALLS_PER_CASE = 16;

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
  agentType: AgentType;
  harnessMode: AgentHarnessMode;
  input: string;
  initial: DeterministicResponse;
  supplemental: DeterministicResponse[];
  solve: DeterministicResponse;
  expectedAllowed: ToolCall[];
  expectedRefused: ToolCall[];
}

export interface AgentHarnessBenchmarkCaseResult {
  caseId: string;
  passed: boolean;
  answerProduced: boolean;
  executedToolCalls: number;
  correctToolCalls: number;
  unexpectedToolCalls: number;
  missedToolCalls: number;
  expectedRefusals: number;
  correctRefusals: number;
  duplicateExecutions: number;
  duplicateCallsPrevented: number;
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
  schemaVersion: 1;
  datasetVersion: string;
  execution: 'deterministic_offline';
  sensitiveDataIncluded: false;
  legacy: AgentHarnessBenchmarkModeResult;
  harness: AgentHarnessBenchmarkModeResult;
  comparison: {
    taskSuccessRateDelta: number;
    toolPrecisionDelta: number;
    toolRecallDelta: number;
    refusalAccuracyDelta: number;
    duplicateExecutionsDelta: number;
    totalTokensDelta: number;
    modeledLatencyMsDelta: number;
  };
  gate: {
    passed: boolean;
    failures: string[];
  };
}
