import { runGate, withPatchedFile, expectClean, expectFired } from './harness';

/**
 * Seed: point one workflow's VPC connector at a name the shared config does not
 * declare. That is the exact drift this gate was written for — deploy settings
 * duplicated inline across five workflows, any one able to wander off alone.
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

  await withPatchedFile(
    '.github/workflows/ci.yml',
    (s) => s.replace('https://api.openai.com/v1', 'https://other-provider.example/v1'),
    () => expectFired(runGate('check-deploy-config-drift.ts'), 'canonical LLM setting')
  );
  for (const setting of [
    'OPENAI_CHAT_API_KEY=openai-platform-api-key:1',
    'OPENAI_API_KEY=openai-platform-api-key:1',
  ]) {
    await withPatchedFile(
      '.github/workflows/ci.yml',
      (s) => s.replace(setting, setting + '-drift'),
      () => expectFired(runGate('check-deploy-config-drift.ts'), 'isolated chat/embedding')
    );
  }
  await withPatchedFile(
    '.github/workflows/ci.yml',
    (s) =>
      s.replace('needs: [build, e2e, security, docker, sbom]', 'needs: [build, e2e, security]'),
    () => expectFired(runGate('check-deploy-config-drift.ts'), 'production image policy failed')
  );
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
}
