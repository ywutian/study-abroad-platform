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
}
