#!/usr/bin/env ts-node
/**
 * Importer: ship per-school CDS C1 admit rates → /admin/schools/bulk-update-acceptance-rates
 *
 * Reads a JSON file (default: scripts/cds-data/cds-2024-25-extracted.json) where each
 * school has applicants/admitted/enrolled per residency from official CDS, and POSTs the
 * payload to the admin bulk-update endpoint (PR-12).
 *
 * Usage:
 *   pnpm --filter api exec tsx scripts/import-cds-rates.ts \
 *     --base https://study-abroad-api-1032896108391.us-central1.run.app \
 *     --token "$JWT" \
 *     --dry-run        # default; preview what would change
 *
 *   # Live run:
 *   pnpm --filter api exec tsx scripts/import-cds-rates.ts \
 *     --base https://... --token "$JWT" --live
 *
 *   # Override input JSON:
 *   pnpm --filter api exec tsx scripts/import-cds-rates.ts \
 *     --input scripts/cds-data/my-fixture.json --token "$JWT" --base ... --live
 *
 * Returns nonzero exit code if any row errors / not-found.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

interface CdsRow {
  schoolNameNorm: string;
  cycleYear: number;
  sourceUrl: string;
  rates: {
    acceptanceRate: number | null;
    intlAcceptanceRate: number | null;
    transferAcceptanceRate: number | null;
  };
  notes?: string;
}

interface CdsFile {
  _meta: Record<string, unknown>;
  schools: CdsRow[];
  pendingExtraction?: string[];
  patterns?: Record<string, string>;
}

interface BulkUpdateRow {
  schoolNameNorm: string;
  acceptanceRate?: number;
  intlAcceptanceRate?: number;
  transferAcceptanceRate?: number;
  source: string;
  sourceUrl: string;
  cycleYear: number;
}

interface BulkUpdateResult {
  dryRun: boolean;
  scanned: number;
  updated: number;
  skippedNoChange: number;
  notFound: Array<{ rowIndex: number; schoolNameNorm?: string }>;
  errors: Array<{ rowIndex: number; reason: string }>;
  changes: Array<{
    schoolId: string;
    schoolName: string;
    changedFields: string[];
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  }>;
  durationMs: number;
}

function parseArgs(): {
  input: string;
  base: string;
  token: string;
  dryRun: boolean;
} {
  const args = process.argv.slice(2);
  const get = (name: string): string | undefined => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const has = (name: string) => args.includes(`--${name}`);

  const input =
    get('input') ??
    path.join(process.cwd(), 'scripts/cds-data/cds-2024-25-extracted.json');
  const base = get('base') ?? process.env.API_BASE ?? '';
  const token = get('token') ?? process.env.ADMIN_JWT ?? '';
  // Default is dry-run; --live flips to live
  const dryRun = !has('live');

  if (!base) {
    throw new Error(
      '--base or API_BASE env required (e.g. https://study-abroad-api-1032896108391.us-central1.run.app)',
    );
  }
  if (!token) {
    throw new Error('--token or ADMIN_JWT env required');
  }
  return { input, base: base.replace(/\/$/, ''), token, dryRun };
}

function buildRows(cds: CdsFile): BulkUpdateRow[] {
  const rows: BulkUpdateRow[] = [];
  for (const school of cds.schools) {
    const r = school.rates;
    // Skip if no rate at all
    if (
      r.acceptanceRate == null &&
      r.intlAcceptanceRate == null &&
      r.transferAcceptanceRate == null
    ) {
      continue;
    }
    const row: BulkUpdateRow = {
      schoolNameNorm: school.schoolNameNorm,
      source: `cds-${school.cycleYear}-${school.cycleYear + 1}:${school.schoolNameNorm.replace(/\s+/g, '-').replace(/,/g, '')}`,
      sourceUrl: school.sourceUrl,
      cycleYear: school.cycleYear,
    };
    if (r.acceptanceRate != null) row.acceptanceRate = r.acceptanceRate;
    if (r.intlAcceptanceRate != null)
      row.intlAcceptanceRate = r.intlAcceptanceRate;
    if (r.transferAcceptanceRate != null)
      row.transferAcceptanceRate = r.transferAcceptanceRate;
    rows.push(row);
  }
  return rows;
}

async function postBulkUpdate(
  base: string,
  token: string,
  rows: BulkUpdateRow[],
  dryRun: boolean,
): Promise<BulkUpdateResult> {
  const url = `${base}/api/v1/admin/schools/bulk-update-acceptance-rates`;
  const body = JSON.stringify({ rows, dryRun });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`POST ${url} → HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  const env = JSON.parse(text);
  // Backend wraps in { success, data, meta }
  return (env.data ?? env) as BulkUpdateResult;
}

function summarize(rows: BulkUpdateRow[], result: BulkUpdateResult): void {
  const mode = result.dryRun ? '[DRY-RUN]' : '[LIVE]';
  console.log('');
  console.log(`==== Bulk update result ${mode} ====`);
  console.log(`Scanned:        ${result.scanned}`);
  console.log(`Updated:        ${result.updated}`);
  console.log(`Skipped (no change): ${result.skippedNoChange}`);
  console.log(`Not found:      ${result.notFound.length}`);
  console.log(`Errors:         ${result.errors.length}`);
  console.log(`Duration:       ${result.durationMs}ms`);
  console.log('');

  if (result.changes.length > 0) {
    console.log('--- Changes ---');
    for (const c of result.changes) {
      const fields = c.changedFields.length
        ? c.changedFields.join(', ')
        : '(no change)';
      console.log(`  ${c.schoolName}: ${fields}`);
      for (const f of c.changedFields) {
        const beforeVal = (c.before as any)[f];
        const afterVal = (c.after as any)[f];
        console.log(`    ${f}: ${beforeVal ?? 'null'} → ${afterVal}`);
      }
    }
    console.log('');
  }

  if (result.notFound.length > 0) {
    console.log('--- Not found (school nameNorm mismatch?) ---');
    for (const n of result.notFound) {
      const row = rows[n.rowIndex];
      console.log(
        `  Row ${n.rowIndex}: ${n.schoolNameNorm} (source: ${row?.source})`,
      );
    }
    console.log('');
  }

  if (result.errors.length > 0) {
    console.log('--- Errors ---');
    for (const e of result.errors) {
      console.log(`  Row ${e.rowIndex}: ${e.reason}`);
    }
    console.log('');
  }
}

async function main() {
  const opts = parseArgs();
  console.log(`Reading ${opts.input}...`);
  const cds: CdsFile = JSON.parse(fs.readFileSync(opts.input, 'utf8'));
  const rows = buildRows(cds);
  console.log(
    `Built ${rows.length} bulk-update rows from ${cds.schools.length} schools.`,
  );

  if (rows.length === 0) {
    console.error('No rows with rate data — nothing to import.');
    process.exit(1);
  }

  console.log(
    `${opts.dryRun ? '[DRY-RUN]' : '[LIVE]'} POST → ${opts.base}/api/v1/admin/schools/bulk-update-acceptance-rates`,
  );
  const result = await postBulkUpdate(opts.base, opts.token, rows, opts.dryRun);
  summarize(rows, result);

  if (result.errors.length > 0 || result.notFound.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
