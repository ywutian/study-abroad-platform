#!/usr/bin/env ts-node
/**
 * Backfills provenance for already-loaded CDS C9/C21 fields without changing
 * the stored values. A provenance row is written only when an extracted file
 * contains the same value currently stored in the DB.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';

type Field = 'gpaDistribution' | 'edAcceptanceRate' | 'eaAcceptanceRate';

type Row = {
  schoolNameNorm: string;
  cycleYear?: number;
  sourceUrl?: string;
  gpaDistribution?: Record<string, number> | null;
  edAcceptanceRate?: number | null;
  eaAcceptanceRate?: number | null;
  edApplied?: number | null;
  edAdmitted?: number | null;
  eaApplied?: number | null;
  eaAdmitted?: number | null;
};

function readArg(name: string): string | null {
  const inline = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...left };
  for (const [key, value] of Object.entries(right)) {
    if (isRecord(value) && isRecord(out[key])) {
      out[key] = deepMerge(out[key] as Record<string, unknown>, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function normalizeJson(value: unknown): string {
  if (!isRecord(value)) return '';
  const sorted = Object.fromEntries(
    Object.entries(value)
      .map(([k, v]): [string, number] => [
        k,
        Math.round(Number(v) * 10000) / 10000,
      ])
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  return JSON.stringify(sorted);
}

function decimalToNumber(value: unknown): number | null {
  if (value == null) return null;
  if (value instanceof Prisma.Decimal) return value.toNumber();
  if (typeof value === 'number') return value;
  return null;
}

function rateMatches(stored: unknown, extracted: number | null | undefined) {
  const storedNumber = decimalToNumber(stored);
  if (storedNumber == null || extracted == null) return false;
  return Math.abs(storedNumber - Number(extracted)) < 0.01;
}

function provenanceFor(row: Row, field: Field) {
  const formula =
    field === 'edAcceptanceRate' && row.edApplied && row.edAdmitted
      ? `${row.edAdmitted}/${row.edApplied}*100=${row.edAcceptanceRate}%`
      : field === 'eaAcceptanceRate' && row.eaApplied && row.eaAdmitted
        ? `${row.eaAdmitted}/${row.eaApplied}*100=${row.eaAcceptanceRate}%`
        : undefined;

  return {
    source: 'CDS_LLM_EXTRACT_2026_04',
    tier: 'OFFICIAL',
    realDataStatus: 'OFFICIAL_REAL_LEGACY',
    sourceType: 'OFFICIAL_CDS',
    sourceUrl: row.sourceUrl ?? null,
    cycleYear: row.cycleYear ?? 2024,
    extractionMethod: 'PDF_TEXT_LLM_C9_C21',
    validatorCount: 1,
    originalFormula: formula,
    confidence: 0.9,
    verifiedAt: new Date().toISOString(),
  };
}

function readRows(dir: string): Row[] {
  const rows: Row[] = [];
  for (const file of fs.readdirSync(dir).sort()) {
    if (!/^cds-c9c21-.*\.json$/.test(file)) continue;
    const full = path.join(dir, file);
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(full, 'utf8'));
    } catch {
      continue;
    }
    const list = Array.isArray(parsed)
      ? parsed
      : isRecord(parsed) && Array.isArray(parsed.schools)
        ? parsed.schools
        : [];
    for (const item of list) {
      if (!isRecord(item) || typeof item.schoolNameNorm !== 'string') continue;
      rows.push(item as Row);
    }
  }
  return rows.filter((row) => row.sourceUrl);
}

async function main() {
  const live = process.argv.includes('--apply');
  const dir = readArg('dir') ?? path.join(process.cwd(), 'scripts/cds-data');
  const rows = readRows(dir);
  const rowsByNorm = new Map<string, Row[]>();
  for (const row of rows) {
    const list = rowsByNorm.get(row.schoolNameNorm) ?? [];
    list.push(row);
    rowsByNorm.set(row.schoolNameNorm, list);
  }

  const prisma = new PrismaClient();
  let scanned = 0;
  let updated = 0;
  const noMatch: string[] = [];
  const changes: string[] = [];

  try {
    const schools = await prisma.school.findMany({
      select: {
        id: true,
        name: true,
        nameNorm: true,
        gpaDistribution: true,
        edAcceptanceRate: true,
        eaAcceptanceRate: true,
        metadata: true,
      },
      orderBy: { name: 'asc' },
    });

    for (const school of schools) {
      const candidates = rowsByNorm.get(school.nameNorm) ?? [];
      if (candidates.length === 0) continue;
      scanned++;
      const oldMeta = isRecord(school.metadata) ? school.metadata : {};
      const oldProvenance = isRecord(oldMeta.provenance)
        ? oldMeta.provenance
        : {};
      const patch: Record<string, unknown> = {};

      const tryField = (field: Field) => {
        if (oldProvenance[field]) return;
        const match = candidates.find((row) => {
          if (field === 'gpaDistribution') {
            return (
              school.gpaDistribution != null &&
              normalizeJson(school.gpaDistribution) ===
                normalizeJson(row.gpaDistribution)
            );
          }
          return rateMatches(
            (school as Record<string, unknown>)[field],
            row[field],
          );
        });
        if (!match) {
          if ((school as Record<string, unknown>)[field] != null) {
            noMatch.push(`${school.name}: ${field}`);
          }
          return;
        }
        patch[field] = provenanceFor(match, field);
      };

      tryField('gpaDistribution');
      tryField('edAcceptanceRate');
      tryField('eaAcceptanceRate');

      if (Object.keys(patch).length === 0) continue;
      const nextMeta = deepMerge(oldMeta, {
        provenance: deepMerge(oldProvenance, patch),
      });
      if (live) {
        await prisma.school.update({
          where: { id: school.id },
          data: { metadata: nextMeta as Prisma.InputJsonValue },
        });
      }
      updated++;
      changes.push(`${school.name}: ${Object.keys(patch).join(', ')}`);
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log(
    JSON.stringify(
      {
        dryRun: !live,
        filesDir: dir,
        extractedRows: rows.length,
        scanned,
        updated,
        noMatch: noMatch.length,
      },
      null,
      2,
    ),
  );
  console.log('\nUpdates:');
  for (const item of changes.slice(0, 80)) console.log('  ' + item);
  if (changes.length > 80) console.log(`  ... and ${changes.length - 80} more`);
  if (noMatch.length > 0) {
    console.log('\nNo exact provenance match:');
    for (const item of noMatch.slice(0, 40)) console.log('  ' + item);
    if (noMatch.length > 40)
      console.log(`  ... and ${noMatch.length - 40} more`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
