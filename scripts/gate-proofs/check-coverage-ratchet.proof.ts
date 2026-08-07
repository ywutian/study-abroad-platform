import { runGate, withPatchedFile, expectClean, expectFired } from './harness';

const CI = '.github/workflows/ci.yml';
const BASELINE = 'scripts/coverage-thresholds.baseline.json';
const GATE = 'check-coverage-ratchet.ts';

const SHARED_STEP = '        run: pnpm --filter @study-abroad/shared exec vitest run --coverage\n';
const MOBILE_STEP =
  '        run: pnpm --filter study-abroad-mobile exec jest --runInBand --coverage --forceExit\n';
const WEB_STEP = 'run: pnpm --filter web exec vitest run --coverage';
const API_STEP = 'run: pnpm --filter api exec jest --coverage --forceExit';

/**
 * Proof for `check-coverage-ratchet.ts`.
 *
 * The ratchet exists because "fix(ci): lower coverage thresholds" had shipped at
 * least three times. It compared each app's configured threshold against a
 * committed baseline — and that is all it compared.
 *
 * So on 2026-08-06 it was guarding `packages/shared` at 90/80/95/90, the highest
 * floor in the repo, while **CI ran no shared tests at all**. 21 test files, a
 * protected number, and nothing that ever evaluated it. web had lost the same
 * property once before, via a plainer route — `vitest run` without `--coverage`,
 * which is the only thing that makes the threshold block execute. ci.yml still
 * carries the comment left behind: "`--coverage` is REQUIRED, not a nicety".
 *
 * A comment is not a guard, which is what the enforcement seeds below are for.
 * Seed A is the state this repo was actually in.
 */
export async function prove(): Promise<void> {
  expectClean(runGate(GATE));

  // The original job: a threshold below its baseline.
  await withPatchedFile(
    BASELINE,
    (s) => s.replace(/"statements":\s*\d+/, '"statements": 999'),
    () => expectFired(runGate(GATE), 'statements')
  );

  // A: no CI step runs the app's tests. Not hypothetical — this is exactly how
  // shared sat until the step was added alongside this proof.
  await withPatchedFile(
    CI,
    (s) => s.replace(SHARED_STEP, ''),
    () => expectFired(runGate(GATE), 'never evaluated')
  );

  await withPatchedFile(
    CI,
    (s) => s.replace(MOBILE_STEP, ''),
    () => expectFired(runGate(GATE), 'never evaluated')
  );

  // B: the step runs, without --coverage. Tests pass, thresholds never compute.
  await withPatchedFile(
    CI,
    (s) => s.replace(WEB_STEP, 'run: pnpm --filter web exec vitest run'),
    () => expectFired(runGate(GATE), 'the floor is inert')
  );

  // C: --passWithNoTests. A run finding zero tests exits 0 and computes nothing.
  await withPatchedFile(
    CI,
    (s) => s.replace(API_STEP, 'run: pnpm --filter api exec jest --coverage --passWithNoTests'),
    () => expectFired(runGate(GATE), 'passWithNoTests')
  );
}
