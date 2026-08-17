import { runGate, withPatchedFile, expectClean, expectFired } from './harness';

const MIGRATE = 'apps/api/migrate.sh';
const REAL = 'run_seed "global-events" ./prisma/seeds/upsert-global-events.js';
const GATE = 'check-seed-pipeline-parity.ts';

/**
 * Proof for `check-seed-pipeline-parity.ts`.
 *
 * The failure this gate guards is silent by construction: `run_seed` is
 * fail-soft, so a seed that never ran and a seed that ran fine differ by one
 * WARNING line in a deploy log nobody reads.
 *
 * Which made its own blind spots worse than usual. It parsed
 * `run_seed "label" ./x.js` and checked whatever matched; anything that did NOT
 * match was simply absent from the check, and the only drift guard was "zero
 * seeds parsed" — silent when 17 of 18 parse. Probing it on 2026-08-06 found
 * two shapes that sailed through:
 *
 *   run_seed "global-events" ./prisma/seeds/upsert-global-events.ts   ← .ts
 *   run_seed 'global-events' ./prisma/seeds/upsert-global-events.js   ← single quotes
 *
 * The `.ts` one also breaks at deploy time, and does it quietly: `COPY prisma
 * ./prisma` puts the .ts in the image, so `[ -f "$script" ]` passes, `node`
 * chokes on TypeScript, and fail-soft swallows it.
 *
 * An invocation the checker cannot read is now an error, not a skip.
 */
export async function prove(): Promise<void> {
  expectClean(runGate(GATE));

  // The original guarantee: a seed missing from the Dockerfile compile list has
  // no .js in the --prod image, so migrate.sh skips it silently.
  await withPatchedFile(
    MIGRATE,
    (s) => s.replace(REAL, `run_seed "ghost" ./prisma/seeds/ghost-seed.js\n${REAL}`),
    () => expectFired(runGate(GATE), 'Dockerfile tsc compile list')
  );

  // Listed and compiled, but the source was never written.
  await withPatchedFile(
    MIGRATE,
    (s) => s.replace(REAL, `run_seed "ghost" ./prisma/seeds/never-written.js\n${REAL}`),
    () => expectFired(runGate(GATE), 'does not exist on disk')
  );

  // Unreadable shape #1: .ts path. Passed until 2026-08-06.
  await withPatchedFile(
    MIGRATE,
    (s) => s.replace(REAL, REAL.replace('.js', '.ts')),
    () => expectFired(runGate(GATE), 'cannot read')
  );

  // Unreadable shape #2: single-quoted label. Passed until 2026-08-06.
  await withPatchedFile(
    MIGRATE,
    (s) => s.replace(REAL, REAL.replace(/"/g, "'")),
    () => expectFired(runGate(GATE), 'cannot read')
  );

  // The `run_seed()` definition itself must not be mistaken for an invocation —
  // otherwise the new check reddens on a healthy tree, which the baseline
  // assertion above would catch, but say so here so the exclusion is deliberate
  // rather than incidental.
  expectClean(runGate(GATE), 'a tree whose only non-matching `run_seed` line is its definition');

  await withPatchedFile(
    MIGRATE,
    (s) =>
      s.replace(
        'SEED_FAIL_HARD_LABELS=" testing-policy global-events competitions competition-data match-pools forum-communities "',
        'SEED_FAIL_HARD_LABELS=" testing-policy "'
      ),
    () => expectFired(runGate(GATE), 'SEED_FAIL_HARD_LABELS does not contain')
  );
}
