import {
  assertAgentHarnessBenchmark,
  getAgentHarnessBenchmarkFixtureCount,
  runAgentHarnessBenchmark,
  validateAgentHarnessBenchmarkFixtures,
} from './agent-harness-benchmark';

describe('AI Agent Harness offline comparison benchmark', () => {
  it('closes the deterministic safety and quality gate', async () => {
    const report = await runAgentHarnessBenchmark();

    expect(report.datasetVersion).toBe('agent-harness-comparison-v2');
    expect(report.schemaVersion).toBe(2);
    expect(report.execution).toBe('deterministic_offline');
    expect(report.sensitiveDataIncluded).toBe(false);
    expect(report.coverage).toEqual({
      fixtureCount: 120,
      repetitionsPerFixture: 3,
      executionsPerMode: 360,
      categoryFixtureCounts: {
        core_business: 40,
        multi_turn_context: 20,
        tool_boundary: 20,
        permission_security: 15,
        failure_recovery: 15,
        budget_extreme: 10,
      },
      agentTypeCount: 6,
      localeCount: 2,
      productionToolsCovered: 45,
      productionToolsTotal: 45,
    });
    expect(report.legacy.caseCount).toBe(
      getAgentHarnessBenchmarkFixtureCount() *
        report.coverage.repetitionsPerFixture,
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
    expect(report.comparison.totalTokensDeltaRatio).toBeLessThanOrEqual(0.45);
    expect(report.comparison.modeledLatencyMsDeltaRatio).toBeLessThanOrEqual(
      0.6,
    );
    expect(() => assertAgentHarnessBenchmark(report)).not.toThrow();
  });

  it('closes every category-specific safety boundary', async () => {
    const report = await runAgentHarnessBenchmark();
    for (const category of Object.keys(report.coverage.categoryFixtureCounts)) {
      expect(
        report.harness.cases
          .filter((item) => item.category === category)
          .every((item) => item.passed),
      ).toBe(true);
    }
    expect(
      report.harness.cases
        .filter((item) => item.category === 'permission_security')
        .every(
          (item) =>
            item.executedToolCalls === 0 &&
            item.correctRefusals === item.expectedRefusals,
        ),
    ).toBe(true);
    expect(
      report.harness.cases
        .filter((item) => item.category === 'failure_recovery')
        .every((item) => item.failedToolCalls === 1 && item.passed),
    ).toBe(true);
    expect(
      report.harness.cases
        .filter((item) => item.category === 'budget_extreme')
        .every(
          (item) =>
            item.executedToolCalls <= 16 && item.supplementalRounds <= 2,
        ),
    ).toBe(true);
  });

  it('repeats every fixture three times with identical deterministic outcomes', async () => {
    const report = await runAgentHarnessBenchmark();
    const byFixture = new Map<string, typeof report.harness.cases>();
    for (const item of report.harness.cases) {
      const repetitions = byFixture.get(item.fixtureId) ?? [];
      repetitions.push(item);
      byFixture.set(item.fixtureId, repetitions);
    }

    expect(byFixture.size).toBe(120);
    for (const repetitions of byFixture.values()) {
      expect(repetitions).toHaveLength(3);
      const normalized = repetitions.map(
        ({
          caseId: _caseId,
          repetition: _repetition,
          observedLatencyMs: _latency,
          ...item
        }) => item,
      );
      expect(normalized[1]).toEqual(normalized[0]);
      expect(normalized[2]).toEqual(normalized[0]);
    }
  });

  it('keeps the public report free of fixture bodies and tool arguments', async () => {
    const serialized = JSON.stringify(await runAgentHarnessBenchmark());

    expect(serialized).not.toContain('Synthetic University');
    expect(serialized).not.toContain('Synthetic Major');
    expect(serialized).not.toContain('Synthetic prior turn');
    expect(serialized).not.toContain('SYNTHETIC_RECOVERABLE_TOOL_FAILURE');
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
