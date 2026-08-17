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
const WORKFLOWS_DIR = path.join(ROOT, '.github/workflows');
const CI_FILE = path.join(WORKFLOWS_DIR, 'ci.yml');
const SCHEDULED_FILE = path.join(WORKFLOWS_DIR, 'osv-audit-scheduled.yml');
const AUDIT_SCRIPT = path.join(ROOT, 'scripts/check-dependency-audit.ts');

const isStepStart = (l: string) => /^\s*-\s+\S/.test(l);

function stepBlockAt(lines: string[], idx: number): { start: number; end: number; block: string } {
  let start = idx;
  while (start > 0 && !isStepStart(lines[start])) start--;
  let end = start + 1;
  while (end < lines.length && !isStepStart(lines[end])) end++;
  return { start, end, block: lines.slice(start, end).join('\n') };
}

function checkSoftenedStep(label: string, block: string, errors: string[]) {
  if (/\|\|\s*true|\|\|\s*:|;\s*true\b/.test(block)) {
    errors.push(`${label} is softened (|| true / ; true):\n${block.trim()}`);
  }
  if (/continue-on-error:\s*true/.test(block)) {
    errors.push(`${label} has \`continue-on-error: true\` — the gate would never block.`);
  }
  if (/^\s*set\s+\+e\b/m.test(block)) {
    errors.push(
      `${label} disables shell error propagation (\`set +e\`) — a failure would not fail the step.`
    );
  }
  if (/^\s*exit\s+0\s*$/m.test(block)) {
    errors.push(`${label} ends with an unconditional \`exit 0\` — the step always succeeds.`);
  }
}

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
  const { start, end, block } = stepBlockAt(lines, auditIdx);
  checkSoftenedStep('CI audit step', block, errors);
  const ifLine = lines.slice(start, end).find((l) => /^\s*if:\s/.test(l));
  if (ifLine) {
    errors.push(
      `CI audit step is conditional (\`${ifLine.trim()}\`) — this gate must run on every CI invocation. ` +
        `Remove the condition, or say here why an unconditional CVE gate is wrong.`
    );
  }
}

function checkScheduledWorkflow(errors: string[]) {
  if (!fs.existsSync(SCHEDULED_FILE)) {
    errors.push(
      '.github/workflows/osv-audit-scheduled.yml is missing — lockfile-unchanged CVEs would wait for the next push.'
    );
    return;
  }
  const text = fs.readFileSync(SCHEDULED_FILE, 'utf8');
  if (!/^\s*schedule:/m.test(text)) {
    errors.push('osv-audit-scheduled.yml has no `schedule:` trigger.');
  }
  if (!/check-dependency-audit\.ts\b/.test(text)) {
    errors.push(
      'osv-audit-scheduled.yml does not run check-dependency-audit.ts — it is not the same gate as CI.'
    );
  }
  if (/\bpnpm\s+audit\b/.test(text)) {
    errors.push(
      'osv-audit-scheduled.yml runs `pnpm audit`, which is broken on Node 20. Use check-dependency-audit.ts.'
    );
  }
}

function checkAllWorkflowAuditSteps(errors: string[]) {
  if (!fs.existsSync(WORKFLOWS_DIR)) return;
  for (const file of fs.readdirSync(WORKFLOWS_DIR).filter((f) => /\.ya?ml$/.test(f))) {
    const abs = path.join(WORKFLOWS_DIR, file);
    const lines = fs.readFileSync(abs, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('#')) continue;
      if (!/check-dependency-audit\.ts\b|\bpnpm\s+audit\b/.test(line)) continue;
      const { block } = stepBlockAt(lines, i);
      checkSoftenedStep(`${file} audit step`, block, errors);
    }
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
  checkScheduledWorkflow(errors);
  checkAllWorkflowAuditSteps(errors);
  checkAuditScript(errors);

  if (errors.length > 0) {
    console.error('\n❌ Dependency-audit gate integrity check failed:\n');
    for (const e of errors) console.error('   ' + e);
    console.error('\nThe high-CVE gate must stay hard. See docs/SECURITY_DEPS.md.\n');
    process.exit(1);
  }
  console.log(
    '✅ Dependency-audit gate is hard (CI + scheduled workflow; fails on high-severity CVEs).'
  );
}

main();
