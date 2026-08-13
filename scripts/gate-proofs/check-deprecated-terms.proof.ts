import { expectClean, expectFired, runGate, withSeededViolation } from './harness';

const GATE = 'check-deprecated-terms.ts';

export async function prove(): Promise<void> {
  expectClean(runGate(GATE));

  await withSeededViolation(
    'apps/web/src/__gate_proof_deprecated_term.ts',
    "export const staleBrand = 'Feature Hall';\n",
    () => expectFired(runGate(GATE), 'Feature Hall')
  );
}
