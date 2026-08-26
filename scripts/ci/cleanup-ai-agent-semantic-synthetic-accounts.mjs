const SYNTHETIC_EMAIL = /^agent-semantic-\d{14}-r(?:[1-9]|10)-s(?:[1-9]|[1-9]\d)@example\.invalid$/;

function unwrap(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data;
  }
  return payload;
}

async function readJson(response, reasonCode) {
  if (!response.ok) throw new Error(`${reasonCode}_${response.status}`);
  return unwrap(await response.json());
}

export async function cleanupSemanticSyntheticAccounts({
  fetchImpl,
  apiBase,
  email,
  password,
  expectedCount,
}) {
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
  const authorization = { authorization: `Bearer ${token}` };

  const list = async () => {
    const response = await fetchImpl(
      `${apiBase}/admin/users?search=agent-semantic-&page=1&pageSize=100`,
      { headers: authorization }
    );
    const result = await readJson(response, 'synthetic_list_failed');
    if (!result || !Array.isArray(result.data)) {
      throw new Error('synthetic_list_contract_invalid');
    }
    if (typeof result.total !== 'number' || result.total > 100) {
      throw new Error('synthetic_list_not_bounded');
    }
    return result.data.filter(
      (user) =>
        user &&
        typeof user.id === 'string' &&
        typeof user.email === 'string' &&
        SYNTHETIC_EMAIL.test(user.email)
    );
  };

  const targets = await list();
  if (targets.length !== expectedCount) {
    throw new Error('synthetic_count_mismatch');
  }
  for (const target of targets) {
    const response = await fetchImpl(
      `${apiBase}/admin/ai-agent/harness/semantic-synthetic-cleanup`,
      {
        method: 'POST',
        headers: { ...authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          targetUserId: target.id,
          expectedEmail: target.email,
        }),
      }
    );
    const result = await readJson(response, 'synthetic_cleanup_failed');
    if (result?.cleaned !== true) {
      throw new Error('synthetic_cleanup_contract_invalid');
    }
  }

  const remaining = await list();
  if (remaining.length !== 0) {
    throw new Error('synthetic_cleanup_incomplete');
  }
  return { matched: targets.length, cleaned: targets.length, remaining: 0 };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const apiBase = process.env.HARNESS_API_BASE?.replace(/\/$/, '');
  const email = process.env.HARNESS_ADMIN_EMAIL;
  const password = process.env.HARNESS_ADMIN_PASSWORD;
  const expectedCount = Number(process.env.SEMANTIC_EXPECTED_ACCOUNT_COUNT);
  if (
    !apiBase ||
    !email ||
    !password ||
    !Number.isInteger(expectedCount) ||
    expectedCount < 0 ||
    expectedCount > 100
  ) {
    console.error('::error::Semantic synthetic cleanup configuration is invalid');
    process.exit(2);
  }
  try {
    const result = await cleanupSemanticSyntheticAccounts({
      fetchImpl: fetch,
      apiBase,
      email,
      password,
      expectedCount,
    });
    console.log(JSON.stringify({ ...result, pass: true }));
  } catch (error) {
    console.error(
      `::error::Semantic synthetic cleanup failed: ${
        error instanceof Error ? error.message : 'unknown_error'
      }`
    );
    process.exit(1);
  }
}
