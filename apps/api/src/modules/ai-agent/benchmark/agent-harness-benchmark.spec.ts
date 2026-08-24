import {
  assertAgentHarnessBenchmark,
  getAgentHarnessBenchmarkFixtureCount,
  runAgentHarnessBenchmark,
  validateAgentHarnessBenchmarkFixtures,
} from './agent-harness-benchmark';

describe('AI Agent Harness offline comparison benchmark', () => {
  it('closes the deterministic safety and quality gate', async () => {
    const report = await runAgentHarnessBenchmark();

    expect(report.datasetVersion).toBe('agent-harness-comparison-v1');
    expect(report.execution).toBe('deterministic_offline');
    expect(report.sensitiveDataIncluded).toBe(false);
    expect(report.legacy.caseCount).toBe(
      getAgentHarnessBenchmarkFixtureCount(),
    );
    expect(report.harness.caseCount).toBe(report.legacy.caseCount);
    expect(report.harness.taskSuccessRate).toBe(1);
    expect(report.harness.toolPrecision).toBe(1);
    expect(report.harness.toolRecall).toBe(1);
    expect(report.harness.refusalAccuracy).toBe(1);
    expect(report.harness.duplicateExecutions).toBe(0);
    expect(report.harness.duplicateCallsPrevented).toBeGreaterThanOrEqual(1);
    expect(report.harness.maxExecutedToolCallsPerCase).toBeLessThanOrEqual(16);
    expect(report.comparison.taskSuccessRateDelta).toBeGreaterThan(0);
    expect(() => assertAgentHarnessBenchmark(report)).not.toThrow();
  });

  it('keeps the public report free of fixture bodies and tool arguments', async () => {
    const serialized = JSON.stringify(await runAgentHarnessBenchmark());

    expect(serialized).not.toContain('Synthetic University');
    expect(serialized).not.toContain('Synthetic Major');
    expect(serialized).not.toContain('targetMajor');
    expect(serialized).not.toContain('"arguments":');
    expect(serialized).not.toContain('systemPrompt');
  });

  it('is stable apart from measured wall-clock latency', async () => {
    const first = await runAgentHarnessBenchmark();
    const second = await runAgentHarnessBenchmark();
    const stripObservedLatency = (report: typeof first) => ({
      ...report,
      legacy: {
        ...report.legacy,
        observedLatencyMs: 0,
        observedP95LatencyMs: 0,
        cases: report.legacy.cases.map((item) => ({
          ...item,
          observedLatencyMs: 0,
        })),
      },
      harness: {
        ...report.harness,
        observedLatencyMs: 0,
        observedP95LatencyMs: 0,
        cases: report.harness.cases.map((item) => ({
          ...item,
          observedLatencyMs: 0,
        })),
      },
    });

    expect(stripObservedLatency(second)).toEqual(stripObservedLatency(first));
  });

  it('uses metadata-classified production tools plus one deliberate unknown', () => {
    expect(validateAgentHarnessBenchmarkFixtures()).toEqual([]);
  });
});
