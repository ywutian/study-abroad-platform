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

  // Second seed: un-register a @Cron class. `IpedsMonitorService` sat in zero
  // providers arrays from #74 until 2026-08-05 — manifest listed its job, its
  // spec passed (it instantiates the class directly), and the schedule had
  // never once run. Nothing was red until a production deploy's registry
  // assert failed. Removing the class from its module must now fail here,
  // seconds after the edit rather than mid-deploy.
  await withPatchedFile(
    'apps/api/src/modules/school/school.module.ts',
    (s) => s.replace(/^\s*IpedsMonitorService,\n/m, ''),
    () => expectFired(runGate('check-cron-manifest.ts'), 'not registered in any module')
  );
}
