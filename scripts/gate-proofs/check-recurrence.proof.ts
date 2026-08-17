import { expectClean, expectFired, runGate } from './harness';

const GATE = 'check-recurrence.ts';

/**
 * This proof needs GIT HISTORY, and that is the whole reason it earned its keep.
 *
 * It went red on main on 2026-08-17: the seeded `--threshold=1` did not fire.
 * The cause was not the gate's counting but the checkout — GitHub Actions clones
 * at depth 1 by default, so there were no fix commits to count and every file
 * scored 0. The gate then printed the same all-clear it prints for a genuinely
 * clean tree, which is a false negative that reads exactly like a pass.
 *
 * Both halves are fixed: the Lint job now checks out with `fetch-depth: 0`, and
 * the gate refuses to report "no hotspots" from a shallow clone. Keep the seeds
 * below — without them the checkout could silently go back to depth 1 and the
 * gate would go back to answering from nothing.
 */

export async function prove(): Promise<void> {
  expectClean(
    runGate(GATE, ['--strict', '--threshold=9999', '.github/workflows/ci.yml']),
    'a deliberately unreachable recurrence threshold'
  );
  expectFired(
    runGate(GATE, ['--strict', '--threshold=1', '.github/workflows/ci.yml']),
    'RECURRING bug class'
  );
}
