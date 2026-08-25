import { TOOL_METADATA } from '../config/tools.config';
import type { ToolCall } from '../types';
import { AGENT_HARNESS_BENCHMARK_FIXTURES as FIXTURES } from './agent-harness-benchmark.fixtures';
import { BENCHMARK_PRODUCTION_TOOL_NAMES } from './agent-harness-benchmark.tools';
import type {
  AgentHarnessBenchmarkReport,
  BenchmarkCategory,
  BenchmarkFixture,
} from './agent-harness-benchmark.types';
import {
  BENCHMARK_CATEGORY_TARGETS,
  BENCHMARK_RUNS_PER_FIXTURE,
  MAX_TOOL_CALLS_PER_CASE,
} from './agent-harness-benchmark.types';

function benchmarkCalls(fixture: BenchmarkFixture): ToolCall[] {
  return [
    ...(fixture.initial.toolCalls ?? []),
    ...fixture.supplemental.flatMap((item) => item.toolCalls ?? []),
  ];
}

function getCategoryCounts(): Record<BenchmarkCategory, number> {
  const counts = Object.fromEntries(
    Object.keys(BENCHMARK_CATEGORY_TARGETS).map((category) => [category, 0]),
  ) as Record<BenchmarkCategory, number>;
  for (const fixture of FIXTURES) counts[fixture.category] += 1;
  return counts;
}

export function getAgentHarnessBenchmarkCoverage(): AgentHarnessBenchmarkReport['coverage'] {
  const coveredTools = new Set(
    FIXTURES.flatMap(benchmarkCalls)
      .map((call) => call.name)
      .filter((name) => name in TOOL_METADATA),
  );
  return {
    fixtureCount: FIXTURES.length,
    repetitionsPerFixture: BENCHMARK_RUNS_PER_FIXTURE,
    executionsPerMode: FIXTURES.length * BENCHMARK_RUNS_PER_FIXTURE,
    categoryFixtureCounts: getCategoryCounts(),
    agentTypeCount: new Set(FIXTURES.map((fixture) => fixture.agentType)).size,
    localeCount: new Set(FIXTURES.map((fixture) => fixture.locale)).size,
    productionToolsCovered: coveredTools.size,
    productionToolsTotal: Object.keys(TOOL_METADATA).length,
  };
}

/** Exposed only to prove metadata coverage in tests without serializing it. */
export function getAgentHarnessBenchmarkFixtureCount(): number {
  return FIXTURES.length;
}

/** Dataset and metadata guard; all failures are stable, non-sensitive codes. */
export function validateAgentHarnessBenchmarkFixtures(): string[] {
  const failures = new Set<string>();
  const expectedFixtureCount = Object.values(BENCHMARK_CATEGORY_TARGETS).reduce(
    (total, count) => total + count,
    0,
  );
  if (FIXTURES.length !== expectedFixtureCount) {
    failures.add('BENCHMARK_FIXTURE_COUNT_MISMATCH');
  }
  if (BENCHMARK_RUNS_PER_FIXTURE < 3) {
    failures.add('BENCHMARK_REPETITIONS_BELOW_THREE');
  }

  const fixtureIds = new Set(FIXTURES.map((fixture) => fixture.id));
  if (fixtureIds.size !== FIXTURES.length) {
    failures.add('BENCHMARK_FIXTURE_IDS_NOT_UNIQUE');
  }

  const categoryCounts = getCategoryCounts();
  for (const [category, target] of Object.entries(
    BENCHMARK_CATEGORY_TARGETS,
  ) as Array<[BenchmarkCategory, number]>) {
    if (categoryCounts[category] !== target) {
      failures.add(`BENCHMARK_CATEGORY_COUNT_MISMATCH:${category}`);
    }
  }

  const metadataNames = Object.keys(TOOL_METADATA);
  const declaredNames = new Set<string>(BENCHMARK_PRODUCTION_TOOL_NAMES);
  if (
    declaredNames.size !== metadataNames.length ||
    metadataNames.some((name) => !declaredNames.has(name))
  ) {
    failures.add('BENCHMARK_PRODUCTION_TOOL_LIST_DRIFT');
  }

  const coveredProductionTools = new Set<string>();
  for (const fixture of FIXTURES) {
    for (const call of benchmarkCalls(fixture)) {
      if (call.name in TOOL_METADATA) coveredProductionTools.add(call.name);
      if (
        call.name !== 'unregistered_synthetic_tool' &&
        !(call.name in TOOL_METADATA)
      ) {
        failures.add('BENCHMARK_UNCLASSIFIED_TOOL');
      }
    }
    if (
      fixture.category === 'multi_turn_context' &&
      fixture.contextMessages.length < 12
    ) {
      failures.add('BENCHMARK_MULTI_TURN_CONTEXT_TOO_SHORT');
    }
    if (
      fixture.category === 'permission_security' &&
      fixture.expectedRefused.length === 0
    ) {
      failures.add('BENCHMARK_PERMISSION_CASE_WITHOUT_REFUSAL');
    }
    if (
      fixture.category === 'failure_recovery' &&
      fixture.expectedFailures.length === 0
    ) {
      failures.add('BENCHMARK_RECOVERY_CASE_WITHOUT_FAILURE');
    }
    if (fixture.expectedAllowed.length > MAX_TOOL_CALLS_PER_CASE) {
      failures.add('BENCHMARK_EXPECTATION_EXCEEDS_TOOL_BUDGET');
    }
  }
  if (coveredProductionTools.size !== metadataNames.length) {
    failures.add('BENCHMARK_PRODUCTION_TOOL_COVERAGE_INCOMPLETE');
  }
  if (new Set(FIXTURES.map((fixture) => fixture.agentType)).size !== 6) {
    failures.add('BENCHMARK_AGENT_COVERAGE_INCOMPLETE');
  }
  if (new Set(FIXTURES.map((fixture) => fixture.locale)).size !== 2) {
    failures.add('BENCHMARK_LOCALE_COVERAGE_INCOMPLETE');
  }
  return [...failures].sort();
}
