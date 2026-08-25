import type {
  AgentHarnessBenchmarkCaseResult,
  AgentHarnessBenchmarkModeResult,
  BenchmarkMode,
} from './agent-harness-benchmark.types';
import {
  MAX_MODELED_LATENCY_OVERHEAD_RATIO,
  MAX_TOKEN_OVERHEAD_RATIO,
  MAX_TOOL_CALLS_PER_CASE,
} from './agent-harness-benchmark.types';
import { validateAgentHarnessBenchmarkFixtures } from './agent-harness-benchmark.dataset';

function percentile95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * 0.95) - 1];
}

function rate(numerator: number, denominator: number): number {
  if (denominator === 0) return 1;
  return Number((numerator / denominator).toFixed(4));
}

export function aggregateBenchmarkMode(
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

export function evaluateBenchmarkGate(
  legacy: AgentHarnessBenchmarkModeResult,
  harness: AgentHarnessBenchmarkModeResult,
): string[] {
  const failures = validateAgentHarnessBenchmarkFixtures();
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
  if (
    harness.totalTokens >
    legacy.totalTokens * (1 + MAX_TOKEN_OVERHEAD_RATIO)
  ) {
    failures.push('HARNESS_TOKEN_OVERHEAD_EXCEEDED');
  }
  if (
    harness.modeledLatencyMs >
    legacy.modeledLatencyMs * (1 + MAX_MODELED_LATENCY_OVERHEAD_RATIO)
  ) {
    failures.push('HARNESS_MODELED_LATENCY_OVERHEAD_EXCEEDED');
  }
  return failures;
}
