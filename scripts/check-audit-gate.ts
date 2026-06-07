/**
 * Dependency-audit gate integrity check.
 *
 * High-severity CVEs were patched reactively, over and over (undici, multer,
 * tar, minimatch, …). The actual guardrail — `pnpm audit --audit-level=high`
 * in CI — already hard-fails the build. The recurring risk is that the gate
 * gets *silently softened* (a `|| true`, a `continue-on-error: true`, or the
 * level relaxed), and then high CVEs slip in unnoticed again.
 *
 * This check asserts the CI audit step stays HARD. It does NOT scan deps (that's
 * `pnpm audit`'s job) — it protects the gate that runs it. See docs/SECURITY_DEPS.md.
 *
 * Usage: tsx scripts/check-audit-gate.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const CI_FILE = path.join(ROOT, '.github/workflows/ci.yml');

function main() {
  const errors: string[] = [];
  if (!fs.existsSync(CI_FILE)) {
    console.error('❌ .github/workflows/ci.yml not found');
    process.exit(1);
  }
  const lines = fs.readFileSync(CI_FILE, 'utf8').split('\n');

  // Find the step that runs `pnpm audit`.
  const auditIdx = lines.findIndex((l) => /pnpm\s+audit\b/.test(l) && !l.trim().startsWith('#'));
  if (auditIdx === -1) {
    errors.push('No `pnpm audit` step found in CI — the dependency-vulnerability gate is missing.');
  } else {
    const auditLine = lines[auditIdx];
    // The gate must fail on high (or stricter: critical). moderate/low/none = softened.
    if (!/--audit-level=(high|critical)\b/.test(auditLine)) {
      errors.push(
        `CI audit must run at --audit-level=high (or critical). Found: ${auditLine.trim()}`
      );
    }
    // No inline softening.
    if (/\|\|\s*true|\|\|\s*:|;\s*true\b/.test(auditLine)) {
      errors.push(`CI audit line is softened (|| true / ; true): ${auditLine.trim()}`);
    }
    // No continue-on-error on the step (scan the ~6 lines around the step header).
    const from = Math.max(0, auditIdx - 6);
    const stepBlock = lines.slice(from, auditIdx + 2).join('\n');
    if (/continue-on-error:\s*true/.test(stepBlock)) {
      errors.push('CI audit step has `continue-on-error: true` — the gate would never block.');
    }
  }

  if (errors.length > 0) {
    console.error('\n❌ Dependency-audit gate integrity check failed:\n');
    for (const e of errors) console.error('   ' + e);
    console.error('\nThe high-CVE gate must stay hard. See docs/SECURITY_DEPS.md.\n');
    process.exit(1);
  }
  console.log('✅ CI dependency-audit gate is hard (fails on high-severity CVEs).');
}

main();
