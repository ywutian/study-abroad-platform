#!/usr/bin/env tsx
/**
 * load-cds-c7.ts — load CDS Section C7 (admission factor importance) into
 * School.admissionFactors.
 *
 * Input:  scripts/cds-data/cds-c7-2024-25.json  ({ schools: [{ school, cdsUrl,
 *         cdsYear, admissionFactors }] })
 * Writes: School.admissionFactors = { ...18 factors, _cdsUrl, _cdsYear }
 *
 * Matches by normalized school name. Plain Prisma writes — no Nest DI, so tsx
 * runs fine.
 *
 * Usage:
 *   pnpm --filter api exec tsx scripts/load-cds-c7.ts --dry-run
 *   pnpm --filter api exec tsx scripts/load-cds-c7.ts
 */
import 'reflect-metadata';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { config as loadDotenv } from 'dotenv';
loadDotenv({ path: resolve(__dirname, '../.env') });
import { PrismaClient } from '@prisma/client';

const VALID = new Set([
  'VERY_IMPORTANT',
  'IMPORTANT',
  'CONSIDERED',
  'NOT_CONSIDERED',
]);

interface C7Row {
  school: string;
  cdsUrl: string;
  cdsYear: string;
  admissionFactors: Record<string, string>;
}

/** Normalize a school name for fuzzy matching. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const file = resolve(__dirname, 'cds-data/cds-c7-2024-25.json');
  const rows: C7Row[] = JSON.parse(readFileSync(file, 'utf8')).schools;

  // Validate every factor value up front — fail loud on a bad extraction.
  for (const r of rows) {
    for (const [k, v] of Object.entries(r.admissionFactors)) {
      if (!VALID.has(v)) {
        throw new Error(`${r.school}: factor ${k} has invalid value "${v}"`);
      }
    }
  }

  const prisma = new PrismaClient();
  try {
    const schools = await prisma.school.findMany({
      select: { id: true, name: true },
    });
    const byNorm = new Map(schools.map((s) => [norm(s.name), s]));

    let updated = 0;
    const unmatched: string[] = [];

    for (const r of rows) {
      const n = norm(r.school);
      let school = byNorm.get(n);
      if (!school) {
        // fallback: a DB name that contains, or is contained by, the target
        school = schools.find((s) => {
          const sn = norm(s.name);
          return sn.includes(n) || n.includes(sn);
        });
      }
      if (!school) {
        unmatched.push(r.school);
        continue;
      }
      const payload = {
        ...r.admissionFactors,
        _cdsUrl: r.cdsUrl,
        _cdsYear: r.cdsYear,
      };
      console.log(
        `  ${school.name} ← ${r.school} (${Object.keys(r.admissionFactors).length} factors, CDS ${r.cdsYear})`,
      );
      if (!dryRun) {
        await prisma.school.update({
          where: { id: school.id },
          data: { admissionFactors: payload },
        });
      }
      updated++;
    }

    console.log(
      `\n${dryRun ? '[dry-run] ' : ''}matched ${updated}/${rows.length}` +
        (unmatched.length ? `  · unmatched: ${unmatched.join(', ')}` : ''),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
