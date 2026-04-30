#!/usr/bin/env ts-node
/**
 * Phase Z: Import SchoolCdsAdmitBand cells (Tier 1 anchor data) from
 * hand-curated UC system data.
 *
 * Each cell is upserted on (schoolId, gpaBand, testType, testBand, cycleYear).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';

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

interface Cell {
  gpaBand: string;
  testType: string;
  testBand: string;
  admitRate: number;
  cycleYear: number;
  source: string;
  sourceUrl?: string;
  sampleCount?: number;
}

interface SchoolCells {
  schoolNameNorm: string;
  cells: Cell[];
}

async function main() {
  const args = process.argv.slice(2);
  const live = args.includes('--live');
  const inputIdx = args.indexOf('--input');
  const file =
    inputIdx >= 0 && args[inputIdx + 1]
      ? args[inputIdx + 1]
      : path.join(
          process.cwd(),
          'scripts/cds-data/uc-system-c9-cells-2024.json',
        );
  const data = JSON.parse(fs.readFileSync(file, 'utf8')) as {
    cells: SchoolCells[];
  };

  console.log(`[${live ? 'LIVE' : 'DRY-RUN'}] Importing C9 cells from ${file}`);
  let totalCells = 0;
  let inserted = 0;
  let updated = 0;
  let notFound = 0;

  for (const sc of data.cells) {
    const school = await prisma.school.findFirst({
      where: { nameNorm: sc.schoolNameNorm },
      select: { id: true, name: true },
    });
    if (!school) {
      console.log(`  SKIP not found: ${sc.schoolNameNorm}`);
      notFound++;
      continue;
    }
    for (const cell of sc.cells) {
      totalCells++;
      const existing = await prisma.schoolCdsAdmitBand.findUnique({
        where: {
          schoolId_gpaBand_testType_testBand_cycleYear: {
            schoolId: school.id,
            gpaBand: cell.gpaBand,
            testType: cell.testType,
            testBand: cell.testBand,
            cycleYear: cell.cycleYear,
          },
        },
      });
      if (live) {
        if (existing) {
          await prisma.schoolCdsAdmitBand.update({
            where: { id: existing.id },
            data: {
              admitRate: new Prisma.Decimal(cell.admitRate),
              source: cell.source,
              sourceUrl: cell.sourceUrl ?? null,
              sampleCount: cell.sampleCount ?? null,
            },
          });
          updated++;
        } else {
          await prisma.schoolCdsAdmitBand.create({
            data: {
              schoolId: school.id,
              gpaBand: cell.gpaBand,
              testType: cell.testType,
              testBand: cell.testBand,
              cycleYear: cell.cycleYear,
              admitRate: new Prisma.Decimal(cell.admitRate),
              source: cell.source,
              sourceUrl: cell.sourceUrl ?? null,
              sampleCount: cell.sampleCount ?? null,
            },
          });
          inserted++;
        }
      } else {
        if (existing) updated++;
        else inserted++;
      }
    }
    console.log(
      `  ${live ? '✓' : '·'} ${school.name}: ${sc.cells.length} cells`,
    );
  }
  console.log(
    `\nDone: ${totalCells} total cells. Inserted ${inserted}, updated ${updated}, not-found schools ${notFound}`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
