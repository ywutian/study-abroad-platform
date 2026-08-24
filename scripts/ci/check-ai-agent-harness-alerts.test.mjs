import assert from 'node:assert/strict';
import test from 'node:test';

import { checkHarnessAlerts } from './check-ai-agent-harness-alerts.mjs';

function response(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ success: status < 300, data }),
  };
}

test('returns only aggregate severity counts', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return calls.length === 1
      ? response(200, { accessToken: 'secret-token' })
      : response(200, [
          { alertId: 'one', title: 'private title', severity: 'critical' },
          { alertId: 'two', title: 'private title', severity: 'warning' },
        ]);
  };

  const result = await checkHarnessAlerts({
    fetchImpl,
    apiBase: 'https://example.invalid/api/v1',
    email: 'admin@example.invalid',
    password: 'secret-password',
  });
  assert.deepEqual(result, {
    activeAlerts: 2,
    bySeverity: { critical: 1, warning: 1, info: 0, unknown: 0 },
  });
  assert.equal(calls[1].options.headers.authorization, 'Bearer secret-token');
});

test('fails closed when the admin session contract is missing', async () => {
  await assert.rejects(
    checkHarnessAlerts({
      fetchImpl: async () => response(200, {}),
      apiBase: 'https://example.invalid/api/v1',
      email: 'admin@example.invalid',
      password: 'secret-password',
    }),
    /admin_login_contract_missing/
  );
});
