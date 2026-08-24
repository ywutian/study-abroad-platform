function unwrap(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload) return payload.data;
  return payload;
}

async function readJson(response, reasonCode) {
  if (!response.ok) throw new Error(`${reasonCode}_${response.status}`);
  const payload = await response.json();
  return unwrap(payload);
}

export async function checkHarnessAlerts({ fetchImpl, apiBase, email, password }) {
  const login = await fetchImpl(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const session = await readJson(login, 'admin_login_failed');
  const token = session?.accessToken;
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('admin_login_contract_missing');
  }

  const response = await fetchImpl(`${apiBase}/admin/ai-agent/harness/alerts?limit=100`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const alerts = await readJson(response, 'harness_alert_query_failed');
  if (!Array.isArray(alerts)) throw new Error('harness_alert_contract_invalid');

  const bySeverity = { critical: 0, warning: 0, info: 0, unknown: 0 };
  for (const alert of alerts) {
    const severity =
      alert && typeof alert === 'object' && typeof alert.severity === 'string'
        ? alert.severity
        : 'unknown';
    if (severity in bySeverity) bySeverity[severity] += 1;
    else bySeverity.unknown += 1;
  }
  return { activeAlerts: alerts.length, bySeverity };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const apiBase = process.env.HARNESS_API_BASE?.replace(/\/$/, '');
  const email = process.env.HARNESS_ADMIN_EMAIL;
  const password = process.env.HARNESS_ADMIN_PASSWORD;
  if (!apiBase || !email || !password) {
    console.error('::error::Harness alert monitor configuration is incomplete');
    process.exit(2);
  }
  try {
    const result = await checkHarnessAlerts({
      fetchImpl: fetch,
      apiBase,
      email,
      password,
    });
    // Counts and severities are the only emitted evidence. Titles, IDs,
    // messages, tokens, parameters and user data never enter Actions logs.
    console.log(JSON.stringify(result));
    if (result.activeAlerts > 0) {
      console.error(
        `::error::${result.activeAlerts} unacknowledged AI Agent Harness alert(s); open AI Operations → Reliability`
      );
      process.exit(1);
    }
  } catch (error) {
    console.error(
      `::error::Harness alert monitor failed: ${error instanceof Error ? error.message : 'unknown_error'}`
    );
    process.exit(1);
  }
}
