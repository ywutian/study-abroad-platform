#!/usr/bin/env tsx
/**
 * fix-uc-residency-rates.ts — correct the corrupt UC residency admit rates.
 *
 * WHY
 * ---
 * The prediction-system diagnostic (2026-05-21) found the 9 UC campuses'
 * `intlAcceptanceRate` and `oosAcceptanceRate` were wrong — magnitudes off
 * and, for UC Davis, `oosAcceptanceRate` (57.32) had been cross-contaminated
 * with the transfer-admission rate (57.30). That broke the counselor
 * engine's geo / intl modifiers.
 *
 * DATA SOURCE
 * -----------
 * Real Fall 2025 first-year admission rates by residency, from the UC
 * Information Center freshman-admissions data download (tabulated by
 * College Kickstart, cross-verified against UC press-room systemwide
 * aggregates + UC Berkeley's official 11.4% overall rate):
 *   https://www.universityofcalifornia.edu/about-us/information-center/freshman-admissions-summary
 *   https://www.collegekickstart.com/blog/item/university-of-california-fall-2025-admission-trends
 *
 * NOTE — counterintuitive but REAL: at the five mid-selectivity campuses
 * (San Diego, Davis, Irvine, Santa Barbara) the international and
 * out-of-state admit rates are genuinely HIGHER than the overall / CA-
 * resident rates. Those campuses actively recruit non-residents for
 * tuition revenue, and the non-resident applicant pools are more self-
 * selected. This is not data corruption — it is the documented pattern.
 *
 * All values are percentages (0-100), matching the `School.*Rate` columns.
 *
 * Idempotent: re-running just re-applies the same values.
 *
 * Usage:
 *   pnpm --filter api exec tsx scripts/fix-uc-residency-rates.ts
 *   pnpm --filter api exec tsx scripts/fix-uc-residency-rates.ts --dry-run
 */
import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'path';
loadDotenv({ path: resolve(__dirname, '../.env') });

import { PrismaClient } from '@prisma/client';

/** Fall 2025 freshman admission rates by residency (percentages 0-100). */
interface UcRates {
  nameMatch: string; // substring to match School.name
  overall: number;
  caResident: number;
  oosDomestic: number;
  international: number;
}

const UC_FALL_2025: UcRates[] = [
  {
    nameMatch: 'University of California, Berkeley',
    overall: 11.4,
    caResident: 13.6,
    oosDomestic: 10.3,
    international: 6.1,
  },
  {
    nameMatch: 'University of California, Los Angeles',
    overall: 9.4,
    caResident: 9.6,
    oosDomestic: 11.2,
    international: 6.4,
  },
  {
    nameMatch: 'University of California, San Diego',
    overall: 28.4,
    caResident: 24.7,
    oosDomestic: 39.4,
    international: 30.6,
  },
  {
    nameMatch: 'University of California, Davis',
    overall: 44.6,
    caResident: 37.3,
    oosDomestic: 63.4,
    international: 57.1,
  },
  {
    nameMatch: 'University of California, Irvine',
    overall: 28.7,
    caResident: 21.6,
    oosDomestic: 47.6,
    international: 42.8,
  },
  {
    nameMatch: 'University of California, Santa Barbara',
    overall: 38.3,
    caResident: 32.1,
    oosDomestic: 54.8,
    international: 48.1,
  },
  {
    nameMatch: 'University of California, Santa Cruz',
    overall: 72.9,
    caResident: 71.2,
    oosDomestic: 86.4,
    international: 72.2,
  },
  {
    nameMatch: 'University of California, Riverside',
    overall: 87.4,
    caResident: 87.5,
    oosDomestic: 95.2,
    international: 83.7,
  },
  {
    nameMatch: 'University of California, Merced',
    // Merced's published CA-resident rate is ~100% (admits-÷-applicants
    // artifact at a near-open-admission campus); we keep `overall` as the
    // headline figure and don't store the >100% CA value.
    overall: 97.7,
    caResident: 100,
    oosDomestic: 87.1,
    international: 80.3,
  },
];

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const prisma = new PrismaClient();
  try {
    let updated = 0;
    for (const uc of UC_FALL_2025) {
      const school = await prisma.school.findFirst({
        where: { name: uc.nameMatch },
        select: {
          id: true,
          name: true,
          acceptanceRate: true,
          oosAcceptanceRate: true,
          intlAcceptanceRate: true,
        },
      });
      if (!school) {
        console.warn(`  ⚠ no School row matched "${uc.nameMatch}" — skipped`);
        continue;
      }
      const before = `overall=${school.acceptanceRate ?? 'null'} oos=${school.oosAcceptanceRate ?? 'null'} intl=${school.intlAcceptanceRate ?? 'null'}`;
      const after = `overall=${uc.overall} oos=${uc.oosDomestic} intl=${uc.international}`;
      console.log(`  ${school.name}`);
      console.log(`    before: ${before}`);
      console.log(`    after:  ${after}`);
      if (!dryRun) {
        await prisma.school.update({
          where: { id: school.id },
          data: {
            acceptanceRate: uc.overall,
            oosAcceptanceRate: uc.oosDomestic,
            intlAcceptanceRate: uc.international,
          },
        });
        updated++;
      }
    }
    console.log(
      dryRun
        ? `\n[dry-run] would update ${UC_FALL_2025.length} UC campuses`
        : `\n✓ updated ${updated} UC campuses with Fall-2025 residency rates`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
