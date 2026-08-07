import { runGate, withPatchedFile, expectClean, expectFired } from './harness';

const CI = '.github/workflows/ci.yml';
const AUDIT = 'scripts/check-dependency-audit.ts';
const STEP = '      - name: Dependency audit\n';
const RUN = '        run: pnpm exec tsx scripts/check-dependency-audit.ts\n';

/** Insert `attr` as the first attribute of the Dependency audit step. */
const withStepAttr = (attr: string) => (s: string) => s.replace(STEP, `${STEP}        ${attr}\n`);

/**
 * Proof for `check-audit-gate.ts` — the meta-gate that keeps the high-CVE gate
 * hard. It guards a security control, and until 2026-08-06 nothing guarded it.
 *
 * Probing it that day found two shapes it passed while the gate was fully
 * neutered, both of which its own docstring calls "silently softened":
 *
 *   - name: Dependency audit          - name: Dependency audit
 *     if: false                         run: |
 *     run: pnpm exec tsx …                set +e
 *                                         pnpm exec tsx …
 *                                         exit 0
 *
 * The first never runs. The second runs and always exits 0. Neither puts
 * `|| true` on the invocation line nor `continue-on-error` within six lines of
 * it, which was the entire extent of the old check — it read one line plus a
 * fixed window, so anything expressed elsewhere in the step was invisible.
 *
 * Seeded below in both layers, CI and script. The point of the last one is that
 * a conditional security gate is a way to turn it off without deleting it, and
 * `if: false` is only its most obvious spelling.
 */
export async function prove(): Promise<void> {
  expectClean(runGate('check-audit-gate.ts'));

  await withPatchedFile(
    CI,
    (s) => s.replace(RUN.trimEnd(), `${RUN.trimEnd()} || true`),
    () => expectFired(runGate('check-audit-gate.ts'), 'softened')
  );

  await withPatchedFile(CI, withStepAttr('continue-on-error: true'), () =>
    expectFired(runGate('check-audit-gate.ts'), 'continue-on-error')
  );

  // Never runs. Caught only since 2026-08-06.
  await withPatchedFile(CI, withStepAttr('if: false'), () =>
    expectFired(runGate('check-audit-gate.ts'), 'conditional')
  );

  // A condition that is false in practice rather than literally — the same
  // neutering, spelled so it reads like ordinary CI config.
  await withPatchedFile(CI, withStepAttr("if: github.ref == 'refs/heads/nonexistent'"), () =>
    expectFired(runGate('check-audit-gate.ts'), 'conditional')
  );

  // Runs, reports, always exits 0. Caught only since 2026-08-06.
  await withPatchedFile(
    CI,
    (s) =>
      s.replace(
        RUN,
        '        run: |\n          set +e\n          pnpm exec tsx scripts/check-dependency-audit.ts\n          exit 0\n'
      ),
    () => expectFired(runGate('check-audit-gate.ts'), 'set +e')
  );

  // The gate deleted outright — without this, a check that reports nothing at
  // all would satisfy every assertion above.
  await withPatchedFile(
    CI,
    (s) => s.replace(`${STEP}${RUN}\n`, ''),
    () => expectFired(runGate('check-audit-gate.ts'), 'gate is missing')
  );

  // Second layer: the threshold and the exit code live in script logic, so
  // softening no longer requires touching CI at all.
  await withPatchedFile(
    AUDIT,
    (s) => s.replace("new Set(['HIGH', 'CRITICAL'])", "new Set(['CRITICAL'])"),
    () => expectFired(runGate('check-audit-gate.ts'), 'HIGH and CRITICAL')
  );

  await withPatchedFile(
    AUDIT,
    (s) => s.replace(/process\.exit\(1\)/g, 'process.exitCode = 0'),
    () => expectFired(runGate('check-audit-gate.ts'), 'never block')
  );
}
