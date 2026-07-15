/**
 * Dependency-vulnerability gate.
 *
 * `pnpm audit` is broken against the real npm registry: npmjs.org retired
 * the classic `/-/npm/v1/security/audits{,/quick}` REST endpoints it calls
 * (410 — "This endpoint is being retired. Use the bulk advisory endpoint
 * instead."). The fix lives in pnpm v11 (rewires the audit client to the
 * new bulk endpoint — see pnpm/pnpm#11268), but v11 requires Node >=22.13.
 * This repo deliberately pins Node 20.x (anti-churn playbook) — not worth
 * a Node major bump just to unbreak an audit command.
 *
 * This script replaces `pnpm audit --audit-level=high` with `osv-scanner`
 * (Google's OSV.dev-backed scanner), reading pnpm-lock.yaml directly — no
 * dependency on npm's registry API at all. Same hard-fail-on-high
 * semantics, same `pnpm.auditConfig.ignoreGhsas` suppression list.
 *
 * Prerequisite: the `osv-scanner` binary must be on PATH (CI installs a
 * pinned release binary the same way it does for gitleaks; locally,
 * `brew install osv-scanner`).
 *
 * Usage: tsx scripts/check-dependency-audit.ts
 */

import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const LOCKFILE = path.join(ROOT, 'pnpm-lock.yaml');
const FAIL_SEVERITIES = new Set(['HIGH', 'CRITICAL']);

interface OsvVuln {
  id: string;
  aliases?: string[];
  summary?: string;
  database_specific?: { severity?: string };
}
interface OsvPackage {
  package: { name: string; version: string };
  vulnerabilities?: OsvVuln[];
}
interface OsvResult {
  results: Array<{ packages?: OsvPackage[] }>;
}

function readIgnoreList(): Set<string> {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const list: string[] = pkg?.pnpm?.auditConfig?.ignoreGhsas ?? [];
  return new Set(list);
}

function runScanner(): OsvResult {
  try {
    const raw = execFileSync(
      'osv-scanner',
      ['scan', 'source', '-L', LOCKFILE, '--format', 'json'],
      {
        cwd: ROOT,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      }
    );
    return JSON.parse(raw) as OsvResult;
  } catch (err: unknown) {
    // osv-scanner exits 1 whenever it finds ANY vulnerability (it has no
    // built-in severity gate — that's this script's job). Its JSON report
    // still goes to stdout regardless of exit code, so recover it from the
    // thrown error rather than treating a non-zero exit as a tool failure.
    const e = err as { stdout?: unknown; message?: string };
    if (typeof e.stdout === 'string' && e.stdout.trim().startsWith('{')) {
      return JSON.parse(e.stdout) as OsvResult;
    }
    console.error('❌ osv-scanner failed to run (is it installed and on PATH?):');
    console.error(e.message ?? err);
    process.exit(1);
  }
}

function main() {
  const result = runScanner();
  const ignored = readIgnoreList();
  const bySeverity: Record<string, number> = {};
  const failing: Array<{
    pkg: string;
    version: string;
    id: string;
    severity: string;
    summary: string;
  }> = [];

  for (const r of result.results ?? []) {
    for (const pkg of r.packages ?? []) {
      for (const v of pkg.vulnerabilities ?? []) {
        const severity = v.database_specific?.severity ?? 'UNKNOWN';
        bySeverity[severity] = (bySeverity[severity] ?? 0) + 1;

        const ids = [v.id, ...(v.aliases ?? [])];
        if (ids.some((id) => ignored.has(id))) continue;

        if (FAIL_SEVERITIES.has(severity)) {
          failing.push({
            pkg: pkg.package.name,
            version: pkg.package.version,
            id: v.id,
            severity,
            summary: v.summary ?? '',
          });
        }
      }
    }
  }

  const total = Object.values(bySeverity).reduce((a, b) => a + b, 0);
  const breakdown =
    Object.entries(bySeverity)
      .map(([k, v]) => `${v} ${k.toLowerCase()}`)
      .join(' | ') || 'none';

  if (failing.length > 0) {
    const plural = failing.length === 1 ? 'y' : 'ies';
    console.error(`\n❌ ${failing.length} unignored HIGH/CRITICAL vulnerabilit${plural}:\n`);
    for (const f of failing) {
      console.error(`   ${f.severity}  ${f.pkg}@${f.version}  ${f.id}`);
      if (f.summary) console.error(`            ${f.summary}`);
    }
    console.error(
      '\nFix via the narrowest pnpm.overrides pin, or (only if genuinely not exploitable here) add the'
    );
    console.error(
      'GHSA id to pnpm.auditConfig.ignoreGhsas in package.json with a reason. See docs/SECURITY_DEPS.md.\n'
    );
    process.exit(1);
  }

  console.log(
    `✅ Dependency audit clean (osv-scanner): ${total} findings scanned (${breakdown}), 0 unignored high/critical.`
  );
}

main();
