import { expectClean, expectFired, runGate, withPatchedFile } from './harness';

const GATE = 'apps/mobile/scripts/check-mobile-i18n.ts';

export async function prove(): Promise<void> {
  expectClean(runGate(GATE));

  await withPatchedFile(
    'apps/mobile/src/lib/i18n/locales/en.json',
    (s) => {
      const data = JSON.parse(s) as Record<string, unknown>;
      data.__gateProofMobileOnlyEn = 'only in english';
      return `${JSON.stringify(data)}\n`;
    },
    () => expectFired(runGate(GATE), '__gateProofMobileOnlyEn')
  );
}
