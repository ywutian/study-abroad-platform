import {
  JsonRecord,
  createSyntheticHarnessIdentity,
  unwrapAcceptancePayload,
} from './ai-agent-harness-acceptance-support';

export const EMBEDDING_EVIDENCE_CHECKS = [
  'singleVector',
  'batchVectors',
  'cacheConsistent',
  'vectorStored',
  'semanticRecall',
  'semanticOrdering',
  'userIsolation',
  'fallbackStored',
  'fallbackRecall',
  'fixtureCleanup',
] as const;

export async function verifyEmbeddingMemory(options: {
  apiBase: string;
  adminToken: string;
  targetUserId: string;
  emit: (record: JsonRecord) => void;
}): Promise<boolean> {
  const { syntheticEmail, syntheticPassword: password } =
    createSyntheticHarnessIdentity(60_000);
  let token = '';
  let accountCreated = false;
  let isolationAccountCleaned = false;
  let evidence: JsonRecord = {};
  const request = async (
    path: string,
    method: string,
    bearer: string,
    body?: unknown,
  ) => {
    const response = await fetch(`${options.apiBase}${path}`, {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(120_000),
      headers: {
        'content-type': 'application/json',
        ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const payload = unwrapAcceptancePayload(await response.json());
    if (!response.ok) throw new Error('embedding_acceptance_http_failed');
    return payload;
  };
  try {
    const user = await request('/auth/register', 'POST', '', {
      email: syntheticEmail,
      password,
      locale: 'en',
    });
    accountCreated = true;
    token = typeof user?.accessToken === 'string' ? user.accessToken : '';
    const isolationUserId = user?.user?.id;
    if (!token || typeof isolationUserId !== 'string')
      throw new Error('embedding_acceptance_registration_contract');
    const result = await request(
      '/admin/ai-agent/harness/embedding-acceptance',
      'POST',
      options.adminToken,
      { targetUserId: options.targetUserId, isolationUserId },
    );
    evidence = Object.fromEntries(
      EMBEDDING_EVIDENCE_CHECKS.map((key) => [key, result?.[key] === true]),
    );
  } catch {
    // No provider response, credentials or user identifiers in release artifacts.
  } finally {
    // Registration may have committed before a connection/body failure. Recover
    // only with this invocation's random password, never another account's token.
    if (!token) {
      try {
        const login = await request('/auth/login', 'POST', '', {
          email: syntheticEmail,
          password,
        });
        token = typeof login?.accessToken === 'string' ? login.accessToken : '';
      } catch {
        /* failed registration remains a failed scenario */
      }
    }
    if (token) {
      let dataCleared = false;
      let accountDeleted = false;
      try {
        await request('/ai-agent/user-data/all', 'DELETE', token);
        dataCleared = true;
      } catch {
        /* report below */
      }
      try {
        await request('/users/me', 'DELETE', token, { password });
        accountDeleted = true;
      } catch {
        /* report below */
      }
      isolationAccountCleaned = dataCleared && accountDeleted;
    }
  }
  const pass =
    accountCreated &&
    isolationAccountCleaned &&
    EMBEDDING_EVIDENCE_CHECKS.every((key) => evidence[key] === true);
  options.emit({
    scenario: 'embedding_memory',
    ...evidence,
    isolationAccountCleaned,
    pass,
    reasonCode: pass ? 'EMBEDDING_MEMORY_VERIFIED' : 'EMBEDDING_MEMORY_FAILED',
  });
  return pass;
}
