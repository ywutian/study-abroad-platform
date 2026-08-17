import { expectClean, expectFired, runGate, withSeededViolation } from './harness';

const GATE = 'check-e2e-runner.ts';

export async function prove(): Promise<void> {
  expectClean(runGate(GATE));

  await withSeededViolation(
    'e2e/_gate_proof_orphan.spec.ts',
    "import { test } from '@playwright/test';\ntest('gate', async () => {});\n",
    () => expectFired(runGate(GATE), '_gate_proof_orphan.spec.ts')
  );
}
