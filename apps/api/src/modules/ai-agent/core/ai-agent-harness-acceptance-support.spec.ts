import {
  parseAcceptanceSse,
  pollTerminalAgentRun,
  requestApprovalWithRetry,
  runUntilMetricObserved,
  verifyAndAcknowledgeHarnessAlert,
} from '../../../../scripts/ai-agent-harness-acceptance-support';

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

  it('retries a completed run until an approval request is observed', async () => {
    const runAttempt = jest
      .fn()
      .mockResolvedValueOnce({
        status: 201,
        events: [{ type: 'start', runId: 'run-1' }, { type: 'done' }],
      })
      .mockResolvedValueOnce({
        status: 201,
        events: [
          { type: 'start', runId: 'run-2' },
          {
            type: 'approval_required',
            approval: { approvalId: 'approval-2' },
          },
        ],
      });
    const readRun = jest.fn().mockResolvedValue({ status: 'COMPLETED' });

    const result = await requestApprovalWithRetry({
      maxAttempts: 3,
      runAttempt,
      readRun,
    });

    expect(result).toEqual({
      pending: { approvalId: 'approval-2' },
      runId: 'run-2',
      lastRun: { status: 'COMPLETED' },
      http: 201,
      attempts: 2,
    });
    expect(runAttempt).toHaveBeenCalledTimes(2);
    expect(readRun).toHaveBeenCalledTimes(2);
  });

  it('parses valid SSE records and drops terminal or malformed lines', () => {
    expect(
      parseAcceptanceSse(
        'data: {"type":"start","runId":"run-1"}\n' +
          'data: not-json\n' +
          'data: [DONE]\n',
      ),
    ).toEqual([{ type: 'start', runId: 'run-1' }]);
  });

  it('proves durable alert persistence, acknowledges it, and confirms removal', async () => {
    let active = true;
    const request = jest.fn(
      async (
        path: string,
        options?: {
          method?: string;
          body?: unknown;
          auth?: 'admin' | 'synthetic' | 'none';
        },
      ) => {
        if (path.endsWith('/delivery')) {
          return {
            ok: true,
            status: 200,
            payload: [{ channel: 'redis_queue', status: 'persisted' }],
          };
        }
        if (path.endsWith('/acknowledge') && options?.method === 'POST') {
          active = false;
          return { ok: true, status: 200, payload: { acknowledged: true } };
        }
        return {
          ok: true,
          status: 200,
          payload: active
            ? [
                {
                  alertId: 'alert-0123456789abcdef01234567',
                  source: 'conversationcontextservice',
                },
              ]
            : [],
        };
      },
    );

    await expect(
      verifyAndAcknowledgeHarnessAlert({
        request,
        source: 'conversationcontextservice',
        acknowledgementNote: 'Synthetic test acknowledgement',
      }),
    ).resolves.toEqual({
      persisted: true,
      acknowledged: true,
      unacknowledgedAlertId: '',
    });
    expect(request).toHaveBeenCalledWith(
      expect.stringMatching(/\/acknowledge$/),
      expect.objectContaining({ method: 'POST', auth: 'admin' }),
    );
  });

  it('waits for and returns a terminal run without re-executing it', async () => {
    const request = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        payload: { id: 'run-1', status: 'RUNNING' },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        payload: { id: 'run-1', status: 'COMPLETED' },
      });

    await expect(
      pollTerminalAgentRun({ request, runId: 'run-1' }),
    ).resolves.toEqual({ id: 'run-1', status: 'COMPLETED' });
    expect(request).toHaveBeenCalledTimes(2);
  });
});
