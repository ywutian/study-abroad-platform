#!/usr/bin/env tsx
/**
 * build-cds-admit-bands.ts
 *
 * Offline merge helper for the Tier-1 seed orchestrator.
 *
 * Reads every committed band-shaped CDS file, extracts the rows that match the
 * `CdsBandInputRow` shape expected by `scripts/load-cds-bands.ts`
 * (schoolName/schoolId, gpaBand, testType, testBand, admitRate, sampleCount,
 * cycleYear, source, sourceUrl), dedups them, and writes the merged result to
 * `prisma/seeds/data/cds-admit-bands.json` — the committed payload that
 * `load-cds-bands.ts --file ... --apply` ingests.
 *
 * NOTE on source files: the `scripts/cds-data/*.json` directory holds CDS
 * residency / GPA-distribution extracts whose shape is NOT `CdsBandInputRow`
 * (they carry applicants/admitted/rates or gpaDistribution objects, not
 * per-band admit rates). The only committed files that actually contain the
 * band shape are the two top-level `scripts/` files listed below. We read
 * exactly those so we never fabricate band rows.
 *
 * Usage:
 *   cd apps/api && pnpm exec tsx prisma/seeds/build-cds-admit-bands.ts
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

type CdsBandInputRow = {
  schoolId?: string;
  schoolName?: string;
  schoolNameNorm?: string;
  gpaBand: string;
  testType: string;
  testBand?: string;
  admitRate: number;
  sampleCount?: number | null;
  cycleYear: number;
  source: string;
  sourceUrl?: string | null;
};

const API_ROOT = path.join(__dirname, '../..');

/** Committed files that contain rows in the `CdsBandInputRow` shape. */
const SOURCE_FILES = [
  path.join(API_ROOT, 'scripts/cds-bands-uc-system.json'),
  path.join(API_ROOT, 'scripts/seed-cds-fixture.json'),
];

const OUTPUT_FILE = path.join(
  API_ROOT,
  'prisma/seeds/data/cds-admit-bands.json',
);

function isBandRow(value: unknown): value is CdsBandInputRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.gpaBand === 'string' &&
    typeof row.testType === 'string' &&
    typeof row.admitRate === 'number' &&
    typeof row.cycleYear === 'number' &&
    typeof row.source === 'string' &&
    (typeof row.schoolName === 'string' ||
      typeof row.schoolNameNorm === 'string' ||
      typeof row.schoolId === 'string')
  );
}

function dedupKey(row: CdsBandInputRow): string {
  const school =
    row.schoolId ?? row.schoolNameNorm ?? row.schoolName ?? 'unknown';
  return [
    school.toLowerCase().trim(),
    row.gpaBand,
    row.testType,
    row.testBand ?? 'ANY',
    row.cycleYear,
  ].join('|');
}

function main() {
  const merged = new Map<string, CdsBandInputRow>();
  let scanned = 0;
  let skipped = 0;

  for (const file of SOURCE_FILES) {
    if (!existsSync(file)) {
      console.warn(`  skip (missing): ${path.relative(API_ROOT, file)}`);
      continue;
    }
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as unknown;
    const rows = Array.isArray(parsed)
      ? parsed
      : ((parsed as { rows?: unknown[] })?.rows ?? []);
    let fileValid = 0;
    for (const candidate of rows) {
      scanned++;
      if (!isBandRow(candidate)) {
        skipped++;
        continue;
      }
      merged.set(dedupKey(candidate), candidate);
      fileValid++;
    }
    console.log(`  ${path.relative(API_ROOT, file)}: ${fileValid} band rows`);
  }

  const out = [...merged.values()];
  writeFileSync(OUTPUT_FILE, `${JSON.stringify(out, null, 2)}\n`);
  console.log(
    `cds-admit-bands: scanned ${scanned}, skipped ${skipped} non-band, ` +
      `wrote ${out.length} deduped rows -> ${path.relative(API_ROOT, OUTPUT_FILE)}`,
  );

  if (out.length === 0) {
    console.error(
      'ERROR: no CDS band rows found — refusing to write empty payload',
    );
    process.exit(1);
  }
}

main();
