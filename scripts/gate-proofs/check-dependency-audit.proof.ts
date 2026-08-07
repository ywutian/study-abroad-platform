import { runGate, withPatchedFile, expectClean, expectFired } from './harness';

const LOCK = 'pnpm-lock.yaml';
const PKG = 'package.json';
const GATE = 'check-dependency-audit.ts';

/** The advisory #572 fixed. Reintroducing the vulnerable version is a real finding, not a fixture. */
const VULN = 'GHSA-5p4m-2wfm-xmqj';
const downgradeJsYaml = (s: string) =>
  s.replace(/js-yaml@3\.15\.1/g, 'js-yaml@3.15.0').replace(/js-yaml: 3\.15\.1/g, 'js-yaml: 3.15.0');

/**
 * Proof for `check-dependency-audit.ts` — the gate that decides whether a CVE
 * reaches production. `check-audit-gate.ts` protects it from being softened in
 * CI; nothing checked that it still classifies correctly.
 *
 * The seed is a real advisory rather than a fixture: pinning js-yaml back to
 * 3.15.0 restores GHSA-5p4m-2wfm-xmqj, the HIGH that blocked every push in this
 * repo on 2026-08-06 until #572 bumped it. If OSV ever stops reporting it, this
 * proof fails loudly instead of quietly testing nothing.
 */
export async function prove(): Promise<void> {
  expectClean(runGate(GATE));

  // 1. A real HIGH in the lockfile must fail the gate.
  await withPatchedFile(LOCK, downgradeJsYaml, () => expectFired(runGate(GATE), VULN));

  // 2. The same finding, ignored, must pass — and this is the load-bearing half
  //    of seed 1: without it, a gate that failed for ANY unrelated reason would
  //    still satisfy "fired on a seeded violation".
  await withPatchedFile(LOCK, downgradeJsYaml, async () => {
    await withPatchedFile(
      PKG,
      (s) => s.replace(/"ignoreGhsas":\s*\[/, `"ignoreGhsas": [\n        "${VULN}",`),
      () => expectClean(runGate(GATE), 'a tree whose only HIGH finding is explicitly ignored')
    );
  });

  // 3. A lockfile the scanner cannot read must fail, not pass. "Scanned nothing"
  //    and "found nothing" print the same ✅ in most tools; here the scanner
  //    errors out and the gate must surface that rather than report a clean run.
  await withPatchedFile(
    LOCK,
    () => 'lockfileVersion: "9.0"\n\nimporters:\n\n  .: {}\n',
    () => expectFired(runGate(GATE), 'osv-scanner failed to run')
  );
}
