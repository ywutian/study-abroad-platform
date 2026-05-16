#!/usr/bin/env tsx
/**
 * seed-prediction-closure.ts — Apply prediction-data closure to any DB.
 *
 * Reads the JSON payload produced by `build-prediction-closure-payload.ts`
 * and UPSERTs the 7 prediction-critical fields + provenance into the target
 * DB. Idempotent — safe to re-run.
 *
 * Match order per school: scorecardId → ipedsId → exact name.
 *
 * Usage:
 *   tsx apps/api/prisma/seeds/seed-prediction-closure.ts [--file=PATH] [--dry-run]
 *
 *   --file=PATH    Override default payload path (default: latest in data/)
 *   --dry-run      Print what would change; do not write
 *
 * Env: DATABASE_URL must point at the target DB.
 *
 * Exit codes:
 *   0 — all entries applied (or matched & unchanged)
 *   1 — fatal error (DB connection, bad payload)
 *   2 — some entries unmatched (no school in target DB matched scorecardId/ipedsId/name)
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PRED_FIELDS = [
  'acceptanceRate',
  'sat25',
  'sat75',
  'intlAcceptanceRate',
  'oosAcceptanceRate',
  'edAcceptanceRate',
  'eaAcceptanceRate',
] as const;

interface PayloadEntry {
  match: {
    scorecardId: string | null;
    ipedsId: string | null;
    name: string;
  };
  fields: {
    hasEarlyDecision: boolean | null;
    institutionType: string | null;
    dataReviewStatus: string | null;
    acceptanceRate: number | null;
    sat25: number | null;
    sat75: number | null;
    intlAcceptanceRate: number | null;
    oosAcceptanceRate: number | null;
    edAcceptanceRate: number | null;
    eaAcceptanceRate: number | null;
  };
  provenance: Record<string, Record<string, any>>;
}

interface Payload {
  schemaVersion: number;
  generatedAt: string;
  schoolCount: number;
  entries: PayloadEntry[];
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (n: string) => {
    const a = args.find((x) => x.startsWith(`--${n}=`));
    return a ? a.split('=')[1] : undefined;
  };
  return {
    file: get('file'),
    dryRun: args.includes('--dry-run'),
  };
}

function defaultPayloadPath(): string {
  const dir = path.join(process.cwd(), 'apps/api/prisma/seeds/data');
  if (!fs.existsSync(dir))
    throw new Error(`Payload directory not found: ${dir}`);
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith('prediction-closure-') && f.endsWith('.json'))
    .sort()
    .reverse();
  if (files.length === 0)
    throw new Error(`No prediction-closure-*.json in ${dir}`);
  return path.join(dir, files[0]);
}

async function findSchoolId(
  match: PayloadEntry['match'],
): Promise<string | null> {
  // 1. scorecardId is federally stable
  if (match.scorecardId) {
    const s = await prisma.school.findUnique({
      where: { scorecardId: match.scorecardId },
      select: { id: true },
    });
    if (s) return s.id;
  }
  // 2. ipedsId is federally stable
  if (match.ipedsId) {
    const s = await prisma.school.findUnique({
      where: { ipedsId: match.ipedsId },
      select: { id: true },
    });
    if (s) return s.id;
  }
  // 3. exact name fallback (scoped to US for safety)
  const byName = await prisma.school.findFirst({
    where: {
      name: match.name,
      country: { in: ['US', 'United States', 'United States of America'] },
    },
    select: { id: true },
  });
  return byName?.id ?? null;
}

function deepMergeProvenance(
  existing: Record<string, any>,
  incoming: Record<string, any>,
): Record<string, any> {
  const merged = { ...existing };
  for (const [field, incomingProv] of Object.entries(incoming)) {
    merged[field] = { ...(existing[field] ?? {}), ...incomingProv };
  }
  return merged;
}

async function main() {
  const opts = parseArgs();
  const payloadPath = opts.file ?? defaultPayloadPath();
  if (!fs.existsSync(payloadPath))
    throw new Error(`Payload not found: ${payloadPath}`);

  const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf-8')) as Payload;
  console.log(`Loading payload: ${payloadPath}`);
  console.log(`  generated:    ${payload.generatedAt}`);
  console.log(`  entries:      ${payload.entries.length}`);
  console.log(`  dry-run:      ${opts.dryRun}`);
  console.log('');

  // sanity: ensure DB reachable
  await prisma.$queryRaw`SELECT 1`;

  let matched = 0;
  const unmatched: string[] = [];
  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  for (const entry of payload.entries) {
    const id = await findSchoolId(entry.match);
    if (!id) {
      unmatched.push(entry.match.name);
      continue;
    }
    matched += 1;

    // Load current row to detect change + merge provenance
    const current = await prisma.school.findUnique({
      where: { id },
      select: {
        hasEarlyDecision: true,
        institutionType: true,
        dataReviewStatus: true,
        acceptanceRate: true,
        sat25: true,
        sat75: true,
        intlAcceptanceRate: true,
        oosAcceptanceRate: true,
        edAcceptanceRate: true,
        eaAcceptanceRate: true,
        metadata: true,
      },
    });
    if (!current) {
      failed += 1;
      continue;
    }

    // Detect changes
    const fieldChanges: Record<string, [any, any]> = {};
    for (const f of [...PRED_FIELDS, 'hasEarlyDecision'] as const) {
      const curr =
        (current as any)[f] instanceof Prisma.Decimal
          ? (current as any)[f].toNumber()
          : (current as any)[f];
      const next = (entry.fields as any)[f];
      if (String(curr ?? '') !== String(next ?? '')) {
        fieldChanges[f] = [curr, next];
      }
    }
    // institutionType + dataReviewStatus (for ArtCenter reclass + duplicate REJECTEDs)
    for (const f of ['institutionType', 'dataReviewStatus'] as const) {
      const curr = (current as any)[f];
      const next = (entry.fields as any)[f];
      if (next != null && curr !== next) {
        fieldChanges[f] = [curr, next];
      }
    }

    const currentMeta = (current.metadata as any) ?? {};
    const currentProv = currentMeta.provenance ?? {};
    const mergedProv = deepMergeProvenance(currentProv, entry.provenance);
    const nextMetadata = { ...currentMeta, provenance: mergedProv };

    const provChanged =
      JSON.stringify(currentProv) !== JSON.stringify(mergedProv);

    if (Object.keys(fieldChanges).length === 0 && !provChanged) {
      unchanged += 1;
      continue;
    }

    if (opts.dryRun) {
      console.log(`[dry-run] ${entry.match.name}`);
      for (const [f, [oldV, newV]] of Object.entries(fieldChanges)) {
        console.log(`  ${f}: ${oldV} → ${newV}`);
      }
      if (provChanged)
        console.log(
          `  provenance: ${Object.keys(entry.provenance).length} fields`,
        );
    } else {
      try {
        await prisma.school.update({
          where: { id },
          data: {
            ...(entry.fields.hasEarlyDecision != null
              ? { hasEarlyDecision: entry.fields.hasEarlyDecision }
              : {}),
            ...(entry.fields.institutionType != null
              ? { institutionType: entry.fields.institutionType as any }
              : {}),
            ...(entry.fields.dataReviewStatus != null
              ? { dataReviewStatus: entry.fields.dataReviewStatus as any }
              : {}),
            acceptanceRate: entry.fields.acceptanceRate,
            sat25: entry.fields.sat25,
            sat75: entry.fields.sat75,
            intlAcceptanceRate: entry.fields.intlAcceptanceRate,
            oosAcceptanceRate: entry.fields.oosAcceptanceRate,
            edAcceptanceRate: entry.fields.edAcceptanceRate,
            eaAcceptanceRate: entry.fields.eaAcceptanceRate,
            metadata: nextMetadata,
            lastDataReviewAt: new Date(),
          },
          select: { id: true },
        });
      } catch (err: any) {
        console.error(`  ✗ ${entry.match.name}: ${err.message}`);
        failed += 1;
        continue;
      }
    }
    updated += 1;
  }

  console.log('');
  console.log('━'.repeat(60));
  console.log('Prediction Closure Seed Result');
  console.log('━'.repeat(60));
  console.log(`Total entries:       ${payload.entries.length}`);
  console.log(`Matched in target:   ${matched}`);
  console.log(
    `Updated:             ${updated}${opts.dryRun ? ' (dry-run)' : ''}`,
  );
  console.log(`Unchanged:           ${unchanged}`);
  console.log(`Failed:              ${failed}`);
  console.log(`Unmatched:           ${unmatched.length}`);
  if (unmatched.length > 0 && unmatched.length <= 30) {
    console.log('');
    console.log(
      'Unmatched schools (no scorecardId/ipedsId/name match in target DB):',
    );
    for (const n of unmatched) console.log(`  - ${n}`);
  }
  console.log('');
  if (unmatched.length > 0) {
    console.log(
      '⚠️  Some entries did not match. Investigate before re-running:',
    );
    console.log('   - Schools may not exist in target DB (need to add first)');
    console.log('   - Name may differ (rename, accent, etc.)');
    console.log('   - scorecardId/ipedsId may be null in target DB');
    process.exit(2);
  }
  console.log('✅ Seed applied successfully.');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
