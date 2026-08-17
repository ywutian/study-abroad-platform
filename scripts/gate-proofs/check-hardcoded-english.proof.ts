import { expectFired, runGate, withSeededViolation } from './harness';

const GATE = 'apps/web/scripts/check-hardcoded-english.ts';

export async function prove(): Promise<void> {
  await withSeededViolation(
    'apps/web/src/components/__gate_proof_hardcoded_en.tsx',
    `export function GateProofHardcodedEnglish() {
  return (
    <button>Delete this account forever</button>
  );
}
`,
    () => expectFired(runGate(GATE, ['--strict']), 'Delete this account forever')
  );
}
