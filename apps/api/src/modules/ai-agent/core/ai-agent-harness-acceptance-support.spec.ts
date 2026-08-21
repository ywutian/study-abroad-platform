import { runUntilMetricObserved } from '../../../../scripts/ai-agent-harness-acceptance-support';

describe('AI Agent harness acceptance support', () => {
  it('stops immediately after observing the expected metric increment', async () => {
    const runAttempt = jest.fn().mockResolvedValue(undefined);
    const readMetric = jest
      .fn()
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(6);

    const result = await runUntilMetricObserved({
      baseline: 4,
      maxAttempts: 6,
      runAttempt,
      readMetric,
    });

    expect(result).toEqual({ attempts: 2, metricAfter: 5, observed: true });
    expect(runAttempt).toHaveBeenCalledTimes(2);
    expect(readMetric).toHaveBeenCalledTimes(2);
  });

  it('remains bounded when the expected metric increment is not observed', async () => {
    const runAttempt = jest.fn().mockResolvedValue(undefined);
    const readMetric = jest.fn().mockResolvedValue(8);

    const result = await runUntilMetricObserved({
      baseline: 8,
      maxAttempts: 3,
      runAttempt,
      readMetric,
    });

    expect(result).toEqual({ attempts: 3, metricAfter: 8, observed: false });
    expect(runAttempt).toHaveBeenCalledTimes(3);
    expect(readMetric).toHaveBeenCalledTimes(3);
  });
});
