import { runGate, withSeededViolation, expectClean, expectFired } from './harness';

const MANIFEST = 'apps/web/.next/app-build-manifest.json';
const CHUNK = 'apps/web/.next/static/chunks/__gate-proof.js';
const GATE = 'check-bundle-size.ts';

/** Above every ABSOLUTE_ROUTE_BUDGET (the largest is admin at ~1.07MB). */
const OVERSIZED = 'x'.repeat(2 * 1024 * 1024);

/**
 * Proof for `check-bundle-size.ts`.
 *
 * Probed on 2026-08-06 expecting the shape this repo keeps hitting — a gate that
 * measured nothing printing the same ✅ as one that measured everything. It is
 * **not** that. A missing build manifest makes it skip, deliberately, with the
 * rationale in the code: a turbo-cache HIT means Next does not re-emit
 * `.next/*`, and a cached build cannot be a regression. Live CI confirms it is
 * really measuring: `86 routes vs baseline`.
 *
 * The first version of this proof shrank the committed baseline and expected the
 * growth budget to fire. It passed locally and **failed in CI** — the Lint job
 * has no `.next`, so the gate skipped and the seeded violation never had
 * anything to violate. The proof was silently depending on a build artefact that
 * happened to be lying around on my machine.
 *
 * So it builds the world it needs instead: a manifest and one oversized chunk,
 * both synthetic, both removed afterwards. Independent of whether anything was
 * built.
 */
export async function prove(): Promise<void> {
  expectClean(runGate(GATE));

  // A route over the absolute first-load budget must fail, with no dependence on
  // the committed baseline (a route absent from it is still budget-checked).
  await withSeededViolation(CHUNK, OVERSIZED, async () => {
    await withSeededViolation(
      MANIFEST,
      JSON.stringify({ pages: { '/__gate-proof': ['static/chunks/__gate-proof.js'] } }),
      () => expectFired(runGate(GATE), 'absolute first-load JS budget')
    );
  });

  // And a small route must not. Without this the seed above would be satisfied
  // by a gate that fails on any synthetic manifest at all.
  await withSeededViolation(CHUNK, 'x'.repeat(1024), async () => {
    await withSeededViolation(
      MANIFEST,
      JSON.stringify({ pages: { '/__gate-proof': ['static/chunks/__gate-proof.js'] } }),
      () => expectClean(runGate(GATE), 'a synthetic manifest whose only route is 1KB')
    );
  });
}
