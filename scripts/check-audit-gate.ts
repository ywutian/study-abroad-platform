/**
 * Dependency-audit gate integrity check.
 *
 * High-severity CVEs were patched reactively, over and over (undici, multer,
 * tar, minimatch, …). The actual guardrail — `scripts/check-dependency-audit.ts`
 * (osv-scanner under the hood; see that file for why it's not `pnpm audit`
 * anymore) — hard-fails CI on any unignored high/critical finding. The
 * recurring risk is that the gate gets *silently softened*: a `|| true`, a
 * `continue-on-error: true`, or (now that the severity threshold lives in
 * script logic instead of a CLI flag) a quiet edit to the script itself that
 * drops the high/critical check or the exit code.
 *
 * This check asserts both layers stay HARD. It does NOT scan deps (that's
 * check-dependency-audit.ts's job) — it protects the gate that runs it.
 * See docs/SECURITY_DEPS.md.
 *
 * Usage: tsx scripts/check-audit-gate.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const CI_FILE = path.join(ROOT, '.github/workflows/ci.yml');
const AUDIT_SCRIPT = path.join(ROOT, 'scripts/check-dependency-audit.ts');

function checkCiStep(errors: string[]) {
  if (!fs.existsSync(CI_FILE)) {
    errors.push('.github/workflows/ci.yml not found');
    return;
  }
  const lines = fs.readFileSync(CI_FILE, 'utf8').split('\n');

  const auditIdx = lines.findIndex(
    (l) => /check-dependency-audit\.ts\b/.test(l) && !l.trim().startsWith('#')
  );
  if (auditIdx === -1) {
    errors.push(
      'No `check-dependency-audit.ts` step found in CI — the dependency-vulnerability gate is missing.'
    );
    return;
  }
  // Read the WHOLE step, not the invocation line and a ±6-line guess.
  //
  // The line-only check passed two neutered configurations, both found by
  // probing it on 2026-08-06:
  //
  //   - name: Dependency audit          - name: Dependency audit
  //     if: false                         run: |
  //     run: pnpm exec tsx …                set +e
  //                                         pnpm exec tsx …
  //                                         exit 0
  //
  // The first never runs; the second always exits 0. Neither carries `|| true`
  // on the invocation line or `continue-on-error` within six lines of it, so
  // both read as a hard gate. "Silently softened" is the exact phrase in this
  // file's own docstring — it just could not see these two shapes.
  const isStepStart = (l: string) => /^\s*-\s+\S/.test(l);
  let start = auditIdx;
  while (start > 0 && !isStepStart(lines[start])) start--;
  let end = start + 1;
  while (end < lines.length && !isStepStart(lines[end])) end++;
  const stepBlock = lines.slice(start, end).join('\n');

  if (/\|\|\s*true|\|\|\s*:|;\s*true\b/.test(stepBlock)) {
    errors.push(`CI audit step is softened (|| true / ; true):\n${stepBlock.trim()}`);
  }
  if (/continue-on-error:\s*true/.test(stepBlock)) {
    errors.push('CI audit step has `continue-on-error: true` — the gate would never block.');
  }
  if (/^\s*set\s+\+e\b/m.test(stepBlock)) {
    errors.push(
      'CI audit step disables shell error propagation (`set +e`) — a failure would not fail the step.'
    );
  }
  if (/^\s*exit\s+0\s*$/m.test(stepBlock)) {
    errors.push('CI audit step ends with an unconditional `exit 0` — the step always succeeds.');
  }
  // A security gate has no legitimate reason to be conditional. Anything that
  // decides at runtime whether it runs is a way to turn it off without
  // deleting it — `if: false` is only the most obvious spelling.
  const ifLine = lines.slice(start, end).find((l) => /^\s*if:\s/.test(l));
  if (ifLine) {
    errors.push(
      `CI audit step is conditional (\`${ifLine.trim()}\`) — this gate must run on every CI invocation. ` +
        `Remove the condition, or say here why an unconditional CVE gate is wrong.`
    );
  }
}

function checkAuditScript(errors: string[]) {
  if (!fs.existsSync(AUDIT_SCRIPT)) {
    errors.push(
      'scripts/check-dependency-audit.ts not found — the audit gate has no implementation.'
    );
    return;
  }
  const src = fs.readFileSync(AUDIT_SCRIPT, 'utf8');

  if (
    !/FAIL_SEVERITIES\s*=\s*new Set\(\[[^\]]*['"]HIGH['"][^\]]*['"]CRITICAL['"][^\]]*\]\)/.test(src)
  ) {
    errors.push(
      "check-dependency-audit.ts no longer fails on both HIGH and CRITICAL (FAIL_SEVERITIES set doesn't match) — the gate was softened."
    );
  }
  if (!/process\.exit\(1\)/.test(src)) {
    errors.push(
      'check-dependency-audit.ts no longer exits non-zero on failure — the gate would never block.'
    );
  }
}

function main() {
  const errors: string[] = [];
  checkCiStep(errors);
  checkAuditScript(errors);

  if (errors.length > 0) {
    console.error('\n❌ Dependency-audit gate integrity check failed:\n');
    for (const e of errors) console.error('   ' + e);
    console.error('\nThe high-CVE gate must stay hard. See docs/SECURITY_DEPS.md.\n');
    process.exit(1);
  }
  console.log('✅ CI dependency-audit gate is hard (fails on high-severity CVEs).');
}

main();
