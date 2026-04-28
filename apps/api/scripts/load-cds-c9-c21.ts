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
}

function readArg(name: string): string | null {
  const inline = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
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
        },
      });
      if (!school) {
        skippedNoMatch++;
        continue;
      }

      const data: Prisma.SchoolUpdateInput = {};
      const changes: string[] = [];

      if (row.gpaDistribution && Object.keys(row.gpaDistribution).length > 0) {
        const sum = Object.values(row.gpaDistribution).reduce(
          (a, b) => a + (Number(b) || 0),
          0,
        );
        if (sum >= 0.85 && sum <= 1.15) {
          data.gpaDistribution = row.gpaDistribution as Prisma.InputJsonValue;
          changes.push('gpaDistribution');
        }
      }
      if (
        row.edAcceptanceRate != null &&
        row.edAcceptanceRate > 0 &&
        row.edAcceptanceRate <= 100
      ) {
        data.edAcceptanceRate = new Prisma.Decimal(row.edAcceptanceRate);
        changes.push(`edAcceptanceRate=${row.edAcceptanceRate}%`);
      }
      if (
        row.eaAcceptanceRate != null &&
        row.eaAcceptanceRate > 0 &&
        row.eaAcceptanceRate <= 100
      ) {
        data.eaAcceptanceRate = new Prisma.Decimal(row.eaAcceptanceRate);
        changes.push(`eaAcceptanceRate=${row.eaAcceptanceRate}%`);
      }

      if (changes.length === 0) {
        skippedNoData++;
        continue;
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
