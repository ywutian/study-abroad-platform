import { expectClean, expectFired, runGate, withSeededViolation } from './harness';

const GATE = 'apps/web/scripts/check-i18n.ts';
const CI = { env: { CI: 'true' } };

export async function prove(): Promise<void> {
  expectClean(runGate(GATE, [], CI));

  await withSeededViolation(
    'apps/web/src/components/__gate_proof_i18n.tsx',
    `export function GateProofI18n() {
  return <p>门禁中文探针文案</p>;
}
`,
    () => expectFired(runGate(GATE, [], CI), '门禁中文探针')
  );
}
