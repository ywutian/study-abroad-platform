import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanupSemanticSyntheticAccounts } from './cleanup-ai-agent-semantic-synthetic-accounts.mjs';

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('cleans only exact semantic synthetic accounts and verifies zero remain', async () => {
  let listCalls = 0;
  const cleanedBodies = [];
  const fetchImpl = async (url, options = {}) => {
    if (url.endsWith('/auth/login')) {
      return response({ data: { accessToken: 'admin-token' } });
    }
    if (url.includes('/admin/users?')) {
      listCalls += 1;
      const data =
        listCalls === 1
          ? [
              {
                id: 'synthetic-1',
                email: 'agent-semantic-20260825010101-r1-s1@example.invalid',
              },
              { id: 'real-1', email: 'real@example.com' },
            ]
          : [];
      return response({ data: { data, total: data.length } });
    }
    if (url.endsWith('/semantic-synthetic-cleanup')) {
      cleanedBodies.push(JSON.parse(options.body));
      return response({ data: { cleaned: true } });
    }
    throw new Error('unexpected_request');
  };

  const result = await cleanupSemanticSyntheticAccounts({
    fetchImpl,
    apiBase: 'https://example.invalid/api/v1',
    email: 'admin@example.invalid',
    password: 'protected-secret',
    expectedCount: 1,
  });

  assert.deepEqual(result, { matched: 1, cleaned: 1, remaining: 0 });
  assert.deepEqual(cleanedBodies, [
    {
      targetUserId: 'synthetic-1',
      expectedEmail: 'agent-semantic-20260825010101-r1-s1@example.invalid',
    },
  ]);
});

test('fails closed when the discovered count differs from operator intent', async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith('/auth/login')) {
      return response({ data: { accessToken: 'admin-token' } });
    }
    return response({ data: { data: [], total: 0 } });
  };

  await assert.rejects(
    cleanupSemanticSyntheticAccounts({
      fetchImpl,
      apiBase: 'https://example.invalid/api/v1',
      email: 'admin@example.invalid',
      password: 'protected-secret',
      expectedCount: 3,
    }),
    /synthetic_count_mismatch/
  );
});
