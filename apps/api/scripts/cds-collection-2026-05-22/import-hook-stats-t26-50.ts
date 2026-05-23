/**
 * Claude-inferred hook %  for T26-T50 schools.
 *
 * Methodology:
 *   - Large public flagships (UC system, UT, UF, UIUC, UMD, OSU, Purdue, A&M, UGA):
 *       legacy ~0-3% (publics typically don't weight legacy heavily)
 *       athlete 4-7% (D1 but huge class)
 *       firstgen 20-27% (publics have higher first-gen %)
 *   - Mid-tier privates (USC, NYU, Tufts, BC, BU, Wake Forest, Lehigh):
 *       legacy 8-13%
 *       athlete 8-13% (most D1)
 *       firstgen 12-18%
 *   - STEM-focused (Georgia Tech): legacy lower, athlete D1
 *
 * All tier = MEDIUM (Claude inference). Run AFTER schema migration.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type HookEntry = {
  legacyClassPct: number;
  athleteClassPct: number;
  firstGenClassPct: number;
  legacyAdmitMultiplier: number;
  athleteAdmitMultiplier: number;
  source: string;
};

// Indexed by exact School.name (case-sensitive match to DB)
const inferences: Record<string, HookEntry> = {
  // ─── UC System ────────────────────────────────────
  // UC system policy: no legacy preference (state law since 2024 SB-1780 movement)
  'University of California, Davis': {
    legacyClassPct: 0,
    athleteClassPct: 0.04,
    firstGenClassPct: 0.4,
    legacyAdmitMultiplier: 1,
    athleteAdmitMultiplier: 3,
    source:
      'UC system no legacy; D1 athletics; UC Davis 40% first-gen reported',
  },
  'University of California, San Diego': {
    legacyClassPct: 0,
    athleteClassPct: 0.03,
    firstGenClassPct: 0.35,
    legacyAdmitMultiplier: 1,
    athleteAdmitMultiplier: 2.5,
    source: 'UC no legacy; D2 athletics → smaller athlete impact',
  },
  'University of California, Irvine': {
    legacyClassPct: 0,
    athleteClassPct: 0.03,
    firstGenClassPct: 0.4,
    legacyAdmitMultiplier: 1,
    athleteAdmitMultiplier: 2.5,
    source: 'UC no legacy; D1 Big West',
  },
  'University of California, Santa Barbara': {
    legacyClassPct: 0,
    athleteClassPct: 0.03,
    firstGenClassPct: 0.35,
    legacyAdmitMultiplier: 1,
    athleteAdmitMultiplier: 2.5,
    source: 'UC no legacy',
  },
  // ─── Large Public Flagships ──────────────────────────
  'University of Florida': {
    legacyClassPct: 0.03,
    athleteClassPct: 0.05,
    firstGenClassPct: 0.22,
    legacyAdmitMultiplier: 1.5,
    athleteAdmitMultiplier: 3.0,
    source: 'Florida flagship; D1 SEC; legacy weak preference',
  },
  'University of Texas at Austin': {
    legacyClassPct: 0.05,
    athleteClassPct: 0.04,
    firstGenClassPct: 0.25,
    legacyAdmitMultiplier: 1.5,
    athleteAdmitMultiplier: 3.0,
    source: 'UT flagship; D1 Big 12; Top 7% rule dominates admission',
  },
  'University of Illinois Urbana-Champaign': {
    legacyClassPct: 0.04,
    athleteClassPct: 0.04,
    firstGenClassPct: 0.22,
    legacyAdmitMultiplier: 1.3,
    athleteAdmitMultiplier: 3.0,
    source: 'UIUC flagship; D1 Big Ten',
  },
  'University of Wisconsin-Madison': {
    legacyClassPct: 0.04,
    athleteClassPct: 0.04,
    firstGenClassPct: 0.18,
    legacyAdmitMultiplier: 1.3,
    athleteAdmitMultiplier: 3.0,
    source: 'UW Madison; D1 Big Ten',
  },
  'University of Washington': {
    legacyClassPct: 0.03,
    athleteClassPct: 0.04,
    firstGenClassPct: 0.27,
    legacyAdmitMultiplier: 1.2,
    athleteAdmitMultiplier: 3.0,
    source: 'UW Seattle; D1 Pac-12; high first-gen %',
  },
  'Rutgers University-New Brunswick': {
    legacyClassPct: 0.02,
    athleteClassPct: 0.04,
    firstGenClassPct: 0.3,
    legacyAdmitMultiplier: 1.2,
    athleteAdmitMultiplier: 2.5,
    source: 'NJ state flagship; D1 Big Ten',
  },
  'Ohio State University': {
    legacyClassPct: 0.04,
    athleteClassPct: 0.05,
    firstGenClassPct: 0.2,
    legacyAdmitMultiplier: 1.5,
    athleteAdmitMultiplier: 3.5,
    source: 'OSU Columbus; D1 Big Ten football powerhouse',
  },
  'Purdue University': {
    legacyClassPct: 0.04,
    athleteClassPct: 0.04,
    firstGenClassPct: 0.2,
    legacyAdmitMultiplier: 1.5,
    athleteAdmitMultiplier: 3.0,
    source: 'Purdue; D1 Big Ten',
  },
  'University of Maryland, College Park': {
    legacyClassPct: 0.04,
    athleteClassPct: 0.04,
    firstGenClassPct: 0.2,
    legacyAdmitMultiplier: 1.5,
    athleteAdmitMultiplier: 3.0,
    source: 'UMD; D1 Big Ten',
  },
  'Texas A&M University': {
    legacyClassPct: 0.05,
    athleteClassPct: 0.05,
    firstGenClassPct: 0.22,
    legacyAdmitMultiplier: 1.5,
    athleteAdmitMultiplier: 3.0,
    source: 'TAMU; strong legacy tradition; D1 SEC',
  },
  'University of Georgia': {
    legacyClassPct: 0.05,
    athleteClassPct: 0.05,
    firstGenClassPct: 0.18,
    legacyAdmitMultiplier: 1.5,
    athleteAdmitMultiplier: 3.0,
    source: 'UGA; D1 SEC football powerhouse',
  },
  // ─── Mid-tier Privates ───────────────────────────────
  'University of Southern California': {
    legacyClassPct: 0.1,
    athleteClassPct: 0.1,
    firstGenClassPct: 0.18,
    legacyAdmitMultiplier: 3.5,
    athleteAdmitMultiplier: 5.0,
    source: 'USC; D1 Pac-12; legacy ~10% per USC published reports',
  },
  'New York University': {
    legacyClassPct: 0.08,
    athleteClassPct: 0.05,
    firstGenClassPct: 0.2,
    legacyAdmitMultiplier: 2.5,
    athleteAdmitMultiplier: 3.5,
    source: 'NYU urban; D3 athletics; intl-heavy',
  },
  'Boston College': {
    legacyClassPct: 0.13,
    athleteClassPct: 0.1,
    firstGenClassPct: 0.13,
    legacyAdmitMultiplier: 3.5,
    athleteAdmitMultiplier: 5.0,
    source: 'BC Jesuit; D1 ACC; strong legacy tradition',
  },
  'Tufts University': {
    legacyClassPct: 0.1,
    athleteClassPct: 0.13,
    firstGenClassPct: 0.15,
    legacyAdmitMultiplier: 3.0,
    athleteAdmitMultiplier: 5.5,
    source: 'Tufts; D3 NESCAC; high athlete pct typical of NESCAC',
  },
  'Boston University': {
    legacyClassPct: 0.08,
    athleteClassPct: 0.07,
    firstGenClassPct: 0.17,
    legacyAdmitMultiplier: 2.5,
    athleteAdmitMultiplier: 4.0,
    source: 'BU large private; D1 Patriot League',
  },
  'Lehigh University': {
    legacyClassPct: 0.12,
    athleteClassPct: 0.13,
    firstGenClassPct: 0.12,
    legacyAdmitMultiplier: 3.5,
    athleteAdmitMultiplier: 5.0,
    source: 'Lehigh; D1 Patriot League; strong legacy and athlete %',
  },
  'Wake Forest University': {
    legacyClassPct: 0.11,
    athleteClassPct: 0.1,
    firstGenClassPct: 0.12,
    legacyAdmitMultiplier: 3.0,
    athleteAdmitMultiplier: 5.0,
    source: 'Wake Forest; D1 ACC',
  },
  // ─── STEM-focused ────────────────────────────────────
  'Georgia Institute of Technology': {
    legacyClassPct: 0.06,
    athleteClassPct: 0.04,
    firstGenClassPct: 0.18,
    legacyAdmitMultiplier: 1.5,
    athleteAdmitMultiplier: 3.5,
    source: 'Georgia Tech; STEM focus; D1 ACC; lower legacy weight',
  },
};

async function main() {
  let updated = 0;
  let skipped = 0;
  const log: string[] = [];

  for (const [schoolName, h] of Object.entries(inferences)) {
    const result = await prisma.school.updateMany({
      where: { name: schoolName },
      data: {
        legacyClassPct: h.legacyClassPct,
        athleteClassPct: h.athleteClassPct,
        firstGenClassPct: h.firstGenClassPct,
        legacyAdmitMultiplier: h.legacyAdmitMultiplier,
        athleteAdmitMultiplier: h.athleteAdmitMultiplier,
        admitProfileSource: h.source,
        admitProfileConfidenceTier: 'MEDIUM',
        admitProfileUpdatedAt: new Date(),
        admitProfileCycleYear: 2024,
      },
    });
    if (result.count > 0) {
      updated++;
      log.push(
        `✓ ${schoolName} — legacy ${h.legacyClassPct} athlete ${h.athleteClassPct} firstgen ${h.firstGenClassPct} [MEDIUM]`,
      );
    } else {
      skipped++;
      log.push(`✗ ${schoolName} — NOT FOUND in DB`);
    }
  }

  console.log(log.join('\n'));
  console.log(`\nSummary: ${updated} updated, ${skipped} skipped`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
