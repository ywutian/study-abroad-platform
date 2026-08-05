import { runGate, withPatchedFile, expectClean, expectFired } from './harness';

/**
 * Seed: change one @Cron schedule without regenerating the manifest. That is
 * the exact landing this gate exists to block — under CRON_DRIVER=http a
 * schedule the manifest doesn't know about fires never (or at the wrong time),
 * silently, which is the #553 failure mode this driver was built to remove.
 */
export async function prove(): Promise<void> {
  expectClean(runGate('check-cron-manifest.ts'));

  await withPatchedFile(
    'apps/api/src/modules/user/account-purge.service.ts',
    (s) => s.replace(`@Cron('0 4 * * *')`, `@Cron('0 5 * * *')`),
    () => expectFired(runGate('check-cron-manifest.ts'), 'cron-jobs.json is stale')
  );
}
