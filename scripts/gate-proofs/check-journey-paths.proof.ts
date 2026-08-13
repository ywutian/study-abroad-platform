import { expectClean, expectFired, runGate, withPatchedFile } from './harness';

const GATE = 'check-journey-paths.ts';
const SOURCE = 'scripts/check-journey-paths.ts';

export async function prove(): Promise<void> {
  expectClean(runGate(GATE));

  await withPatchedFile(
    SOURCE,
    (source) =>
      source.replace(
        "'apps/api/src/modules/auth',",
        "'apps/api/src/modules/__gate-proof-missing-auth',"
      ),
    () => expectFired(runGate(GATE), '__gate-proof-missing-auth')
  );
}
