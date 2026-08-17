import { expectFired, runGate, withSeededViolation } from './harness';

const GATE = 'apps/web/scripts/check-typography.ts';

export async function prove(): Promise<void> {
  await withSeededViolation(
    'apps/web/src/components/__gate_proof_raw_size.tsx',
    `export function GateProofTypography() {
  return <p className="text-[32px]">Headline</p>;
}
`,
    () => expectFired(runGate(GATE, ['--strict']), 'no-arbitrary-font-size')
  );
}
