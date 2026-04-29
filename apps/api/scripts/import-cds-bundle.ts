#!/usr/bin/env ts-node
/**
 * Phase X3: Atomic CDS bundle importer.
 *
 * Single-script import for all CDS-derived data:
 *  - School.acceptanceRate, intlAcceptanceRate, oosAcceptanceRate (CDS C1)
 *  - School.gpaDistribution (CDS C9 / C11 marginal GPA distribution)
 *  - SchoolMetric for ed_acceptance_rate, ea_acceptance_rate (CDS C21)
 *
 * Each school is updated in a single Prisma transaction for atomicity.
 *
 * Usage:
 *   pnpm --filter api exec tsx scripts/import-cds-bundle.ts \
 *     --input scripts/cds-data/cds-merged-bundle-2026-04-28.json \
 *     --direct-db --live
 *
 * The input file shape:
 *   { schools: [{ schoolNameNorm, cycleYear?, sourceUrl?, rates?, gpaDistribution?,
 *                 edAcceptanceRate?, eaAcceptanceRate?, edApplied?, edAdmitted?,
 *                 eaApplied?, eaAdmitted?, notes? }] }
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  buildVerifiedFieldProvenance,
  validateVerifiedCdsRow,
  type CdsRateField,
  type CdsVerification,
  type VerifiedRateField,
} from './lib/cds-real-validation';

function loadDotEnv() {
  for (const file of [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'apps/api/.env'),
  ]) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(t);
      if (!m || process.env[m[1]] != null) continue;
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

loadDotEnv();
const prisma = new PrismaClient();

interface BundleRow {
  schoolNameNorm: string;
  schoolName?: string;
  cycleYear?: number;
  sourceUrl?: string;
  applicants?: {
    total?: number;
    inState?: number;
    outOfState?: number;
    international?: number;
  };
  admitted?: {
    total?: number;
    inState?: number;
    outOfState?: number;
    international?: number;
  };
  rates?: {
    acceptanceRate?: number | null;
    intlAcceptanceRate?: number | null;
    oosAcceptanceRate?: number | null;
    transferAcceptanceRate?: number | null;
  };
  gpaDistribution?: Record<string, number> | null;
  edAcceptanceRate?: number | null;
  eaAcceptanceRate?: number | null;
  edApplied?: number | null;
  edAdmitted?: number | null;
  eaApplied?: number | null;
  eaAdmitted?: number | null;
  notes?: string;
  verification?: CdsVerification;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (n: string) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const has = (n: string) => args.includes(`--${n}`);
  return {
    input: get('input') ?? 'scripts/cds-data/cds-merged-bundle-2026-04-28.json',
    live: has('live'),
    directDb: has('direct-db'),
    actorUserId: get('actor-user-id') ?? 'system-pr15-bundle-import',
    requireVerifiedReal: !has('allow-unverified'),
  };
}

function normalizePercent(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v) || v < 0) return null;
  const pct = v < 1 ? v * 100 : v;
  // Cap at 100% — many CDS C21 ED rates exceed 50% which is fine
  if (pct > 100) return null;
  return Math.round(pct * 100) / 100;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function deepMerge<T extends Record<string, unknown>>(
  a: T,
  b: Record<string, unknown>,
): T {
  const out: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (isPlainObject(v) && isPlainObject(out[k])) {
      out[k] = deepMerge(out[k] as Record<string, unknown>, v);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

interface PerSchoolResult {
  schoolNameNorm: string;
  schoolName: string;
  matched: boolean;
  changedRates: string[];
  changedExtras: string[]; // gpaDistribution, ed_*, ea_*
  notFound: boolean;
  error?: string;
}

async function importBundle(
  rows: BundleRow[],
  live: boolean,
  actorUserId: string,
  requireVerifiedReal: boolean,
) {
  const results: PerSchoolResult[] = [];
  let totalChanged = 0;
  const startedAt = Date.now();

  // Pre-fetch all schools by nameNorm in one query
  const schools = await prisma.school.findMany({
    where: { nameNorm: { in: rows.map((r) => r.schoolNameNorm) } },
    select: {
      id: true,
      name: true,
      nameNorm: true,
      acceptanceRate: true,
      intlAcceptanceRate: true,
      oosAcceptanceRate: true,
      transferAcceptanceRate: true,
      gpaDistribution: true,
      metadata: true,
    },
  });
  const byNorm = new Map(schools.map((s) => [s.nameNorm, s]));

  for (const row of rows) {
    const school = byNorm.get(row.schoolNameNorm);
    if (!school) {
      results.push({
        schoolNameNorm: row.schoolNameNorm,
        schoolName: row.schoolName ?? row.schoolNameNorm,
        matched: false,
        changedRates: [],
        changedExtras: [],
        notFound: true,
      });
      continue;
    }

    const rowValidation = requireVerifiedReal
      ? validateVerifiedCdsRow(row)
      : null;
    if (rowValidation && !rowValidation.importable) {
      results.push({
        schoolNameNorm: row.schoolNameNorm,
        schoolName: school.name,
        matched: true,
        changedRates: [],
        changedExtras: [],
        notFound: false,
        error: `verified-real validation failed: ${rowValidation.errors.join('; ')}`,
      });
      continue;
    }
    const verifiedRateFields = new Map<CdsRateField, VerifiedRateField>(
      (rowValidation?.verifiedRateFields ?? []).map((f) => [f.field, f]),
    );

    // Determine what to update
    const changedRates: string[] = [];
    const changedExtras: string[] = [];
    const updates: Record<string, unknown> = {};

    // 1. Rates from C1
    const rateFields = [
      'acceptanceRate',
      'intlAcceptanceRate',
      'oosAcceptanceRate',
      'transferAcceptanceRate',
    ] as const;
    for (const f of rateFields) {
      if (requireVerifiedReal && !verifiedRateFields.has(f)) continue;
      const norm = normalizePercent(row.rates?.[f]);
      if (norm == null) continue;
      const cur = (school as any)[f] as Prisma.Decimal | null;
      const curN = cur ? cur.toNumber() : null;
      if (curN != null && Math.abs(curN - norm) < 0.005) continue;
      updates[f] = new Prisma.Decimal(norm);
      changedRates.push(f);
    }

    // 2. gpaDistribution from C9/C11
    if (row.gpaDistribution && Object.keys(row.gpaDistribution).length > 0) {
      const cur = school.gpaDistribution as Record<string, number> | null;
      // Only update if we'd actually change something
      const same =
        cur != null &&
        JSON.stringify(cur) === JSON.stringify(row.gpaDistribution);
      if (!same) {
        updates.gpaDistribution = row.gpaDistribution as Prisma.InputJsonValue;
        changedExtras.push('gpaDistribution');
      }
    }

    // 3. Provenance metadata
    const sourceLabel =
      row.sourceUrl?.includes('aggiedata') ||
      row.sourceUrl?.includes('opa.berkeley') ||
      row.sourceUrl?.includes('ucop')
        ? 'CDS_OFFICIAL_UC'
        : 'CDS_LLM_EXTRACT_2026_04';
    if (changedRates.length > 0 || changedExtras.length > 0) {
      const oldMeta = (school.metadata as Record<string, unknown>) ?? {};
      const oldProv = (oldMeta.provenance as Record<string, unknown>) ?? {};
      const provUpdate: Record<string, unknown> = {};
      if (requireVerifiedReal) {
        for (const f of changedRates) {
          provUpdate[f] = buildVerifiedFieldProvenance(
            row,
            f,
            verifiedRateFields.get(f as CdsRateField),
            actorUserId,
          );
        }
        for (const f of changedExtras) {
          provUpdate[f] = buildVerifiedFieldProvenance(
            row,
            f,
            undefined,
            actorUserId,
          );
        }
      } else {
        const provInfo = {
          source: sourceLabel,
          tier: 'OFFICIAL',
          cycleYear: row.cycleYear ?? 2024,
          sourceUrl: row.sourceUrl ?? null,
          verifiedBy: actorUserId,
          confidence: 0.95,
          verifiedAt: new Date().toISOString(),
        };
        for (const f of [...changedRates, ...changedExtras]) {
          provUpdate[f] = provInfo;
        }
      }
      const newMeta = deepMerge(oldMeta, {
        provenance: deepMerge(oldProv as Record<string, unknown>, provUpdate),
      });
      updates.metadata = newMeta as Prisma.InputJsonValue;
    }

    // 4. ED/EA SchoolMetric rows (separate from school updates)
    const metricInserts: Array<{ key: string; value: number }> = [];
    if (row.edAcceptanceRate != null) {
      const v = normalizePercent(row.edAcceptanceRate);
      if (v != null) {
        metricInserts.push({ key: 'ed_acceptance_rate', value: v });
        changedExtras.push('ed_acceptance_rate');
      }
    }
    if (row.eaAcceptanceRate != null) {
      const v = normalizePercent(row.eaAcceptanceRate);
      if (v != null) {
        metricInserts.push({ key: 'ea_acceptance_rate', value: v });
        changedExtras.push('ea_acceptance_rate');
      }
    }

    // Skip if nothing to do
    if (changedRates.length === 0 && changedExtras.length === 0) {
      results.push({
        schoolNameNorm: row.schoolNameNorm,
        schoolName: school.name,
        matched: true,
        changedRates: [],
        changedExtras: [],
        notFound: false,
      });
      continue;
    }

    if (live) {
      try {
        await prisma.$transaction(async (tx) => {
          if (Object.keys(updates).length > 0) {
            await tx.school.update({
              where: { id: school.id },
              data: updates as Prisma.SchoolUpdateInput,
            });
          }
          for (const m of metricInserts) {
            // Upsert by (schoolId, year, metricKey)
            const year = row.cycleYear ?? 2024;
            await tx.schoolMetric.upsert({
              where: {
                schoolId_year_metricKey: {
                  schoolId: school.id,
                  year,
                  metricKey: m.key,
                },
              },
              create: {
                schoolId: school.id,
                year,
                metricKey: m.key,
                value: new Prisma.Decimal(m.value),
              },
              update: {
                value: new Prisma.Decimal(m.value),
              },
            });
          }
        });
        totalChanged += 1;
      } catch (err) {
        results.push({
          schoolNameNorm: row.schoolNameNorm,
          schoolName: school.name,
          matched: true,
          changedRates,
          changedExtras,
          notFound: false,
          error: err instanceof Error ? err.message : String(err),
        });
        continue;
      }
    }

    results.push({
      schoolNameNorm: row.schoolNameNorm,
      schoolName: school.name,
      matched: true,
      changedRates,
      changedExtras,
      notFound: false,
    });
  }

  return { results, totalChanged, durationMs: Date.now() - startedAt };
}

async function main() {
  const args = parseArgs();
  if (!args.directDb) {
    console.error('--direct-db required (HTTP mode not implemented yet)');
    process.exit(1);
  }
  const text = fs.readFileSync(args.input, 'utf8');
  const data = JSON.parse(text) as { schools?: BundleRow[] };
  const rows = data.schools ?? [];
  console.log(
    `[${args.live ? 'LIVE' : 'DRY-RUN'}] importing ${rows.length} bundle rows from ${args.input}`,
  );
  const { results, totalChanged, durationMs } = await importBundle(
    rows,
    args.live,
    args.actorUserId,
    args.requireVerifiedReal,
  );

  const matched = results.filter((r) => r.matched).length;
  const notFound = results.filter((r) => r.notFound).length;
  const ratesChanged = results.filter((r) => r.changedRates.length > 0).length;
  const extrasChanged = results.filter(
    (r) => r.changedExtras.length > 0,
  ).length;
  const errors = results.filter((r) => r.error).length;

  console.log(
    `\n==== Bundle import ${args.live ? '[LIVE]' : '[DRY-RUN]'} ====`,
  );
  console.log(`Total rows:           ${rows.length}`);
  console.log(`Matched in DB:        ${matched}`);
  console.log(`Not found (skip):     ${notFound}`);
  console.log(`Schools w/ rate change: ${ratesChanged}`);
  console.log(`Schools w/ extras chg:  ${extrasChanged}`);
  console.log(`Total schools updated:  ${totalChanged}`);
  console.log(`Errors:               ${errors}`);
  console.log(`Duration:             ${durationMs}ms`);
  console.log(
    `Verified-real gate:   ${args.requireVerifiedReal ? 'ON' : 'OFF (--allow-unverified)'}`,
  );

  if (errors > 0) {
    console.log('\nErrors:');
    for (const r of results.filter((r) => r.error)) {
      console.log(`  ${r.schoolName}: ${r.error?.slice(0, 200)}`);
    }
  }

  // Sample changed schools
  const samples = results
    .filter((r) => r.changedRates.length + r.changedExtras.length > 0)
    .slice(0, 10);
  if (samples.length > 0) {
    console.log('\nSample changes:');
    for (const r of samples) {
      console.log(
        `  ${r.schoolName.slice(0, 40).padEnd(42)} rates=[${r.changedRates.join(',')}] extras=[${r.changedExtras.join(',')}]`,
      );
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
