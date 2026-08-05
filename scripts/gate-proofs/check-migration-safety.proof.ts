import { runGate, withSeededViolation, expectClean, expectFired } from './harness';

/**
 * This gate is the reason the ratchet exists.
 *
 * `.husky/pre-push` decided whether to run it with `git diff origin/main...HEAD`
 * — committed on this branch — and then invoked `--new-only`, which looked for
 * files with `git diff --name-only HEAD` — uncommitted only. The two used
 * contradictory definitions of "new", so by the time the hook fired every
 * migration was in the one state the finder could not see. It printed
 * "✅ No migration files to check" and exited 0, every single time.
 *
 * So this proves BOTH halves, and the second is the one that was broken:
 *  1. a dangerous migration is rejected at all
 *  2. `--new-only` can actually see an untracked migration — the state a
 *     brand-new one is in before `git add`
 */
const DANGEROUS = `ALTER TABLE "User" ADD COLUMN "seeded_proof" TEXT NOT NULL;\n`;
const DIR = 'apps/api/prisma/migrations/29990101000000_gate_proof_seeded';

export async function prove(): Promise<void> {
  expectClean(runGate('check-migration-safety.ts'));

  await withSeededViolation(`${DIR}/migration.sql`, DANGEROUS, () => {
    // (1) full scan rejects NOT NULL without DEFAULT
    expectFired(runGate('check-migration-safety.ts'), 'not-null-without-default');

    // (2) --new-only must SEE it. An untracked file is invisible to
    // `git diff --name-only HEAD`; if this ever goes green again, the finder
    // has drifted back to a definition of "new" that excludes new files.
    expectFired(runGate('check-migration-safety.ts', ['--new-only']), 'not-null-without-default');
  });
}
