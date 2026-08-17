import { expectClean, expectFired, runGate, withSeededViolation } from './harness';

const GATE = 'apps/mobile/scripts/check-mobile-quality.ts';
const CI = { env: { CI: 'true' } };

export async function prove(): Promise<void> {
  expectClean(runGate(GATE, [], CI));

  await withSeededViolation(
    'apps/mobile/src/components/__gate_proof_quality.tsx',
    `export function GateProofMobileQuality() {
  return { queryKey: ['forum'] };
}
`,
    () => expectFired(runGate(GATE, [], CI), 'no-inline-list-query-key')
  );
}
