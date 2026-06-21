import { pingCronHeartbeat } from './cron-heartbeat.util';

describe('pingCronHeartbeat', () => {
  const ORIGINAL = process.env.HEALTHCHECK_PING_BASE_URL;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.HEALTHCHECK_PING_BASE_URL;
    else process.env.HEALTHCHECK_PING_BASE_URL = ORIGINAL;
  });

  it('no-ops (no fetch) when HEALTHCHECK_PING_BASE_URL is unset', async () => {
    delete process.env.HEALTHCHECK_PING_BASE_URL;

    await pingCronHeartbeat('deadline-reminder');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('pings <base>/<slug> when configured (trailing slashes normalized)', async () => {
    process.env.HEALTHCHECK_PING_BASE_URL = 'https://hc-ping.com/abc123/';

    await pingCronHeartbeat('outcome-reminder');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://hc-ping.com/abc123/outcome-reminder',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('never throws when the ping fails (heartbeat outage must not break the cron)', async () => {
    process.env.HEALTHCHECK_PING_BASE_URL = 'https://hc-ping.com/abc123';
    fetchMock.mockRejectedValue(new Error('network down'));

    await expect(pingCronHeartbeat('ipeds-monitor')).resolves.toBeUndefined();
  });
});
