#!/usr/bin/env tsx
/**
 * Loads CDS C9 (GPA distribution) + C21 (ED/EA admit rates) into School table.
 *
 * Usage:
 *   tsx scripts/load-cds-c9-c21.ts --file scripts/cds-data/cds-c9c21-*.json [--apply]
 */

import { readFileSync } from 'node:fs';
import { PrismaClient, Prisma } from '@prisma/client';

interface InputRow {
  schoolNameNorm: string;
  cycleYear?: number;
  sourceUrl?: string;
  gpaDistribution: Record<string, number> | null;
  edAcceptanceRate: number | null;
  eaAcceptanceRate: number | null;
  edApplied?: number | null;
  edAdmitted?: number | null;
  eaApplied?: number | null;
  eaAdmitted?: number | null;
  notes?: string | null;
}

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

function provenanceFor(
  row: InputRow,
  field: 'gpaDistribution' | 'edAcceptanceRate' | 'eaAcceptanceRate',
) {
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

function terminalProvenanceFor(
  row: InputRow,
  field: 'gpaDistribution' | 'edAcceptanceRate' | 'eaAcceptanceRate',
) {
  return {
    source: 'CDS_LLM_EXTRACT_2026_04',
    tier: 'OFFICIAL',
    realDataStatus: 'OFFICIAL_BLANK_SECTION',
    sourceType: 'OFFICIAL_CDS',
    sourceUrl: row.sourceUrl ?? null,
    cycleYear: row.cycleYear ?? 2024,
    extractionMethod: 'PDF_TEXT_LLM_C9_C21',
    validatorCount: 1,
    confidence: 0.85,
    verifiedAt: new Date().toISOString(),
    notes: row.notes ?? 'Official CDS section did not publish this field.',
  };
}

async function main() {
  const file = readArg('file');
  if (!file)
    throw new Error(
      'Usage: tsx scripts/load-cds-c9-c21.ts --file rows.json [--apply]',
    );

  const dryRun = !process.argv.includes('--apply');
  const raw = JSON.parse(readFileSync(file, 'utf8')) as
    | { schools: InputRow[] }
    | InputRow[];
  const rows: InputRow[] = Array.isArray(raw) ? raw : raw.schools;
  if (!Array.isArray(rows))
    throw new Error('Input must contain schools[] array');

  const prisma = new PrismaClient();
  let scanned = 0,
    updated = 0,
    skippedNoMatch = 0,
    skippedNoData = 0;
  const updates: string[] = [];
  try {
    for (const row of rows) {
      scanned++;
      const school = await prisma.school.findUnique({
        where: { nameNorm: row.schoolNameNorm },
        select: {
          id: true,
          name: true,
          gpaDistribution: true,
          edAcceptanceRate: true,
          eaAcceptanceRate: true,
          metadata: true,
        },
      });
      if (!school) {
        skippedNoMatch++;
        continue;
      }

      const data: Prisma.SchoolUpdateInput = {};
      const changes: string[] = [];
      const changedFields: Array<
        'gpaDistribution' | 'edAcceptanceRate' | 'eaAcceptanceRate'
      > = [];
      const terminalFields: Array<
        'gpaDistribution' | 'edAcceptanceRate' | 'eaAcceptanceRate'
      > = [];

      if (row.gpaDistribution && Object.keys(row.gpaDistribution).length > 0) {
        const sum = Object.values(row.gpaDistribution).reduce(
          (a, b) => a + (Number(b) || 0),
          0,
        );
        if (sum >= 0.85 && sum <= 1.15) {
          data.gpaDistribution = row.gpaDistribution as Prisma.InputJsonValue;
          changes.push('gpaDistribution');
          changedFields.push('gpaDistribution');
        }
      } else if (!school.gpaDistribution && row.sourceUrl) {
        terminalFields.push('gpaDistribution');
      }
      if (
        row.edAcceptanceRate != null &&
        row.edAcceptanceRate > 0 &&
        row.edAcceptanceRate <= 100
      ) {
        data.edAcceptanceRate = new Prisma.Decimal(row.edAcceptanceRate);
        changes.push(`edAcceptanceRate=${row.edAcceptanceRate}%`);
        changedFields.push('edAcceptanceRate');
      } else if (!school.edAcceptanceRate && row.sourceUrl) {
        terminalFields.push('edAcceptanceRate');
      }
      if (
        row.eaAcceptanceRate != null &&
        row.eaAcceptanceRate > 0 &&
        row.eaAcceptanceRate <= 100
      ) {
        data.eaAcceptanceRate = new Prisma.Decimal(row.eaAcceptanceRate);
        changes.push(`eaAcceptanceRate=${row.eaAcceptanceRate}%`);
        changedFields.push('eaAcceptanceRate');
      } else if (!school.eaAcceptanceRate && row.sourceUrl) {
        terminalFields.push('eaAcceptanceRate');
      }

      if (changes.length === 0 && terminalFields.length === 0) {
        skippedNoData++;
        continue;
      }

      const oldMeta = isRecord(school.metadata) ? school.metadata : {};
      const oldProvenance = isRecord(oldMeta.provenance)
        ? oldMeta.provenance
        : {};
      const provenancePatch = Object.fromEntries([
        ...changedFields.map((field) => [field, provenanceFor(row, field)]),
        ...terminalFields.map((field) => [
          field,
          terminalProvenanceFor(row, field),
        ]),
      ]);
      data.metadata = deepMerge(oldMeta, {
        provenance: deepMerge(oldProvenance, provenancePatch),
      }) as Prisma.InputJsonValue;
      for (const field of terminalFields) {
        changes.push(`${field}=OFFICIAL_BLANK_SECTION`);
      }

      if (!dryRun) {
        await prisma.school.update({ where: { id: school.id }, data });
      }
      updated++;
      updates.push(`${school.name}: ${changes.join(', ')}`);
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        scanned,
        updated,
        skippedNoMatch,
        skippedNoData,
      },
      null,
      2,
    ),
  );
  console.log('\nUpdates:');
  for (const u of updates.slice(0, 50)) console.log('  ' + u);
  if (updates.length > 50) console.log(`  ... and ${updates.length - 50} more`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
