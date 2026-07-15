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
  const auditLine = lines[auditIdx];
  if (/\|\|\s*true|\|\|\s*:|;\s*true\b/.test(auditLine)) {
    errors.push(`CI audit line is softened (|| true / ; true): ${auditLine.trim()}`);
  }
  const from = Math.max(0, auditIdx - 6);
  const stepBlock = lines.slice(from, auditIdx + 2).join('\n');
  if (/continue-on-error:\s*true/.test(stepBlock)) {
    errors.push('CI audit step has `continue-on-error: true` — the gate would never block.');
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
