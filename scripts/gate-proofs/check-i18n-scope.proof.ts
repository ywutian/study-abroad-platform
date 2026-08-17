import { expectClean, expectFired, runGate, withSeededViolation } from './harness';

const GATE = 'apps/web/scripts/check-i18n-scope.ts';

export async function prove(): Promise<void> {
  expectClean(runGate(GATE));

  await withSeededViolation(
    'apps/web/src/components/__gate_proof_i18n_scope.tsx',
    `import { useTranslations } from 'next-intl';
export function GateProofI18nScope() {
  const t = useTranslations('admin');
  return t('title');
}
`,
    () => expectFired(runGate(GATE), 'admin')
  );
}
