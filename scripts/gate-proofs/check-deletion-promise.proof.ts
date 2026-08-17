import { runGate, withPatchedFile, withSeededViolation, expectClean, expectFired } from './harness';

/**
 * Seed: turn the purge flag off while the UI still promises a 30-day deletion.
 *
 * That exact state shipped in production before AccountPurgeService existed —
 * copy said 数据将被永久删除 and nothing deleted anything. It is the defect the
 * service was built to close, so it is the one this gate must catch.
 */
export async function prove(): Promise<void> {
  expectClean(runGate('check-deletion-promise.ts'));

  await withPatchedFile(
    '.github/workflows/ci.yml',
    (s) => s.replace('ACCOUNT_PURGE_ENABLED=true', 'ACCOUNT_PURGE_ENABLED=false'),
    () => expectFired(runGate('check-deletion-promise.ts'), 'does not match')
  );

  await withSeededViolation(
    'apps/mobile/src/lib/i18n/locales/de.json',
    JSON.stringify({ settings: { deleteAccountConfirm: 'Konto löschen' } }),
    () => expectFired(runGate('check-deletion-promise.ts'), 'locales/de.json')
  );
}
