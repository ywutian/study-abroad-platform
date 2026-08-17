import { expectClean, expectFired, runGate, withSeededViolation } from './harness';

const GATE = 'apps/web/scripts/check-missing-keys.ts';

export async function prove(): Promise<void> {
  expectClean(runGate(GATE));

  await withSeededViolation(
    'apps/web/src/components/__gate_proof_missing_keys.tsx',
    `import { useTranslations } from 'next-intl';
export function GateProofMissingKeys() {
  const t = useTranslations();
  return t('gateProofDefinitelyMissingKey12345');
}
`,
    () => expectFired(runGate(GATE), 'gateProofDefinitelyMissingKey12345')
  );
}
