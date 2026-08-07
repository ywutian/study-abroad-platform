import { runGate, withPatchedFile, expectClean, expectFired } from './harness';

const BASELINE = 'apps/web/.bundle-baseline.json';
const GATE = 'check-bundle-size.ts';

/**
 * Proof for `check-bundle-size.ts`.
 *
 * Probed on 2026-08-06 expecting the shape this repo keeps hitting — a gate that
 * measures nothing and prints the same ✅ as one that measured everything. It is
 * **not** that. A missing build manifest makes it skip, deliberately and with a
 * written rationale (a turbo-cache HIT means Next does not re-emit `.next/*`,
 * and a cached build is by definition not a regression candidate). Live CI
 * output confirms it is really measuring: `86 routes vs baseline`.
 *
 * So this pins what is already right, in both directions — the skip has to stay
 * a skip, and the budget has to stay a budget. The two are one `return` apart in
 * the same function, and only one of them is supposed to be silent.
 */
export async function prove(): Promise<void> {
  expectClean(runGate(GATE));

  // A route grown past the allowed percentage must fail. Seeded by shrinking the
  // BASELINE rather than inflating a build, so the proof needs no rebuild.
  await withPatchedFile(
    BASELINE,
    (s) => {
      const b = JSON.parse(s) as { routes: Record<string, number>; thresholdPct?: number };
      for (const key of Object.keys(b.routes))
        b.routes[key] = Math.max(1, Math.floor(b.routes[key] / 4));
      return `${JSON.stringify(b, null, 2)}\n`;
    },
    () => expectFired(runGate(GATE), 'exceeded the bundle-size growth budget')
  );

  // No baseline: informational, never fatal. If this ever starts failing, PRs
  // that touch nothing web-related start failing with it.
  await withPatchedFile(
    BASELINE,
    () => '{"routes":{}}\n',
    () => expectClean(runGate(GATE), 'a tree whose baseline has no routes')
  );
}
