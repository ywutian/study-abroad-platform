import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, runGate, withPatchedFile, expectClean, expectFired } from './harness';

/**
 * Seed: point one workflow's VPC connector at a name the shared config does not
 * declare. That is the exact drift this gate was written for — deploy settings
 * duplicated inline across five workflows, any one able to wander off alone.
 *
 * The LLM anchors are derived from deploy-config.json rather than written as
 * literals. Literal anchors rot on every provider change — three times in one
 * day (#649, #653, #654), each time reporting "seeded nothing" — and a proof
 * that must be hand-edited alongside the value it guards is not independent of
 * it. Reading the canonical value and seeding `value + '-drift'` keeps the
 * falsification honest: the gate must fire whenever a workflow disagrees with
 * the config, whatever the config currently says.
 */
export async function prove(): Promise<void> {
  expectClean(runGate('check-deploy-config-drift.ts'));

  await withPatchedFile(
    '.github/workflows/ci.yml',
    (s) => s.replace('study-abroad-connector', 'some-other-connector'),
    () => expectFired(runGate('check-deploy-config-drift.ts'))
  );

  await withPatchedFile(
    '.github/workflows/ci.yml',
    (s) => s.replace('gh attestation verify', 'gh attestation inspect'),
    () => expectFired(runGate('check-deploy-config-drift.ts'), 'verify signed provenance')
  );

  await withPatchedFile(
    '.github/workflows/ci.yml',
    (s) => s.replace('PUSH_OUTPUT=$(docker push', 'PUSH_OUTPUT=$(docker image ls'),
    () => expectFired(runGate('check-deploy-config-drift.ts'), 'capture the immutable digest')
  );

  const { llm } = JSON.parse(readFileSync(join(ROOT, '.github/deploy-config.json'), 'utf8')) as {
    llm: {
      provider: string;
      model: string;
      productionEmbeddingBaseUrl: string;
      productionEmbeddingSecret: string;
      productionEmbeddingSecretVersion: number;
      productionChat: {
        model: string;
        baseUrl: string;
        secret: string;
        secretVersion: number;
        reasoningEffort?: string;
      };
    };
  };
  const chat = llm.productionChat;

  // Each canonical LLM setting, drifted by APPENDING, must be caught. The
  // suffix matters: the gate used to test membership with `includes()`, which
  // any value carrying the canonical one as a prefix satisfies — so
  // `...openai.com/v1-evil.example` passed. The old proof replaced the whole
  // URL instead of extending it and never probed that. Seed by appending.
  // `OPENAI_BASE_URL=` is not a substring of `OPENAI_CHAT_BASE_URL=`, so the
  // embedding and chat anchors stay distinct even when both point at the same
  // endpoint — which is the case today.
  for (const [setting, expected] of [
    [`LLM_PROVIDER=${llm.provider}`, 'canonical LLM setting'],
    [`OPENAI_MODEL=${llm.model}`, 'canonical LLM setting'],
    [`OPENAI_BASE_URL=${llm.productionEmbeddingBaseUrl}`, 'canonical LLM setting'],
    [
      `OPENAI_API_KEY=${llm.productionEmbeddingSecret}:${llm.productionEmbeddingSecretVersion}`,
      'isolated chat/embedding',
    ],
    [`OPENAI_CHAT_MODEL=${chat.model}`, 'isolated chat/embedding'],
    [`OPENAI_CHAT_BASE_URL=${chat.baseUrl}`, 'isolated chat/embedding'],
    [`OPENAI_CHAT_API_KEY=${chat.secret}:${chat.secretVersion}`, 'isolated chat/embedding'],
  ] as const) {
    await withPatchedFile(
      '.github/workflows/ci.yml',
      (s) => s.replace(setting, setting + '-drift'),
      () => expectFired(runGate('check-deploy-config-drift.ts'), expected)
    );
  }

  await withPatchedFile(
    '.github/workflows/ci.yml',
    (s) =>
      s.replace('needs: [build, e2e, security, docker, sbom]', 'needs: [build, e2e, security]'),
    () => expectFired(runGate('check-deploy-config-drift.ts'), 'production image policy failed')
  );

  // The reasoning-effort check has two shapes depending on what the config
  // declares. Without one, a workflow that carries the option is drift; with
  // one, a workflow that carries a different value is drift. Seed whichever
  // applies, so the proof does not invert the next time the option toggles.
  if (chat.reasoningEffort === undefined) {
    await withPatchedFile(
      '.github/workflows/ci.yml',
      (s) =>
        s.replace(
          'OPENAI_CHAT_TRANSPORT=sse|',
          'OPENAI_CHAT_TRANSPORT=sse|OPENAI_CHAT_REASONING_EFFORT=none|'
        ),
      () =>
        expectFired(
          runGate('check-deploy-config-drift.ts'),
          'unexpected isolated chat/embedding reasoning setting'
        )
    );
  } else {
    const current = `OPENAI_CHAT_REASONING_EFFORT=${chat.reasoningEffort}`;
    await withPatchedFile(
      '.github/workflows/ci.yml',
      (s) => s.replace(current, `${current}-drift`),
      () => expectFired(runGate('check-deploy-config-drift.ts'), 'isolated chat/embedding')
    );
  }
}
