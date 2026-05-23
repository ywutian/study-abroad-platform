/**
 * Seed per-school hook % data (legacy / athlete / first-gen) on `School` table.
 *
 * Tier composition (T100):
 *   - HIGH tier (~7 schools): real data from official CDS / SFFA case / school
 *     class profile publications. Examples: Princeton, MIT, Harvard, Stanford,
 *     UPenn, Caltech, USC, JHU. Includes per-school admit multipliers
 *     (e.g. Harvard legacy 5.5×, athlete 20×).
 *
 *   - MEDIUM tier (~94 schools): Claude-inferred from peer-school patterns
 *     using 9 categorical buckets:
 *       PUB_FLAG_LARGE  — UMN, PSU, IU, Pitt, OSU, MSU
 *       PUB_FLAG_MID    — UMD, U Delaware, U Iowa, NC State, UMass, etc.
 *       PUB_SELECTIVE   — W&M, UConn, VT, U Colorado Boulder, Clemson
 *       PUB_REGIONAL    — Buffalo, Stony Brook, Binghamton, UC Riverside, etc.
 *       PVT_ELITE       — Northeastern (5% acceptance behaves like T25)
 *       PVT_TOP         — Rochester, Tulane, Miami, Brandeis, Case Western
 *       PVT_RELIGIOUS   — Baylor, Gonzaga, Marquette, Pepperdine, SMU, BC, ND
 *       PVT_STEM        — RPI, Stevens, IIT, RIT, WPI, Drexel, CO Mines
 *       PVT_MID         — GW, SCU, Syracuse, Yeshiva, Fordham, AU, Howard
 *
 * Used by M3 v2 Bayesian engine `dimLegacy` / `dimAthlete` to look up
 * per-school multipliers. Without this seed, the engine falls back to
 * global averages (×4 legacy, ×3 athlete) which is much less accurate.
 *
 * Idempotent — `updateMany` on School.name. Re-runs overwrite cleanly.
 *
 * Run standalone:
 *   pnpm --filter api exec tsx prisma/seed-hook-stats.ts
 *
 * Run for a specific tier only:
 *   pnpm --filter api exec tsx prisma/seed-hook-stats.ts --tier=HIGH
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Tier = 'HIGH' | 'MEDIUM';

interface HookSeed {
  name: string;
  legacyClassPct: number | null;
  athleteClassPct: number | null;
  firstGenClassPct: number | null;
  legacyAdmitMultiplier: number | null;
  athleteAdmitMultiplier: number | null;
  tier: Tier;
  source: string;
}

// ─── HIGH tier: published / SFFA / official CDS data ──────────────────────
const HIGH_TIER_SEEDS: HookSeed[] = [
  {
    name: 'Princeton University',
    legacyClassPct: 0.112,
    athleteClassPct: 0.18,
    firstGenClassPct: 0.16,
    legacyAdmitMultiplier: 6.7,
    athleteAdmitMultiplier: 6.5,
    tier: 'HIGH',
    source:
      'Class of 2028 official Princeton admissions data; legacy 11.2% of class, admit rate 31% (6.7× overall 4.6%)',
  },
  {
    name: 'Massachusetts Institute of Technology',
    legacyClassPct: 0,
    athleteClassPct: null,
    firstGenClassPct: null,
    legacyAdmitMultiplier: 1,
    athleteAdmitMultiplier: null,
    tier: 'HIGH',
    source: 'MIT public statement — does not consider legacy in admissions',
  },
  {
    name: 'Harvard University',
    legacyClassPct: null,
    athleteClassPct: null,
    firstGenClassPct: null,
    legacyAdmitMultiplier: 5.5,
    athleteAdmitMultiplier: 20,
    tier: 'HIGH',
    source:
      'SFFA case data 2014-2019: legacy admit 33% vs overall 6% = 5.5×; athletes 86% admit vs 4.2% = 20×',
  },
  {
    name: 'Stanford University',
    legacyClassPct: 0.16,
    athleteClassPct: 0.12,
    firstGenClassPct: 0.21,
    legacyAdmitMultiplier: 2.8,
    athleteAdmitMultiplier: null,
    tier: 'HIGH',
    source:
      'Stanford reported: legacies 16% of class, admit rate 11% (2.8× overall 3.9%); athletes 12% of enrolled (D1 36 varsity teams)',
  },
  {
    name: 'University of Pennsylvania',
    legacyClassPct: null,
    athleteClassPct: 0.1,
    firstGenClassPct: null,
    legacyAdmitMultiplier: 5.5,
    athleteAdmitMultiplier: null,
    tier: 'HIGH',
    source:
      'Penn ED data: legacies ~24% of ED admits, 5-6× boost; student-athletes 10% of undergrad body',
  },
  {
    name: 'California Institute of Technology',
    legacyClassPct: 0,
    athleteClassPct: 0,
    firstGenClassPct: null,
    legacyAdmitMultiplier: 1,
    athleteAdmitMultiplier: 1,
    tier: 'HIGH',
    source:
      'Caltech does not consider legacy or athletics in admissions (need-blind, academic-only)',
  },
  {
    name: 'Johns Hopkins University',
    legacyClassPct: 0,
    athleteClassPct: 0.08,
    firstGenClassPct: 0.18,
    legacyAdmitMultiplier: 1,
    athleteAdmitMultiplier: 4.0,
    tier: 'HIGH',
    source:
      'JHU eliminated legacy in 2014 (public announcement); D3 sports (limited athlete weight)',
  },
  {
    name: 'University of Southern California',
    legacyClassPct: 0.14,
    athleteClassPct: 0.1,
    firstGenClassPct: 0.22,
    legacyAdmitMultiplier: 3.5,
    athleteAdmitMultiplier: 5.0,
    tier: 'HIGH',
    source:
      'USC Class 2028 official: 14% legacy, 22% first-gen, EA admit 7.2% (2,938/40,953)',
  },
];

// ─── MEDIUM tier: Claude-inferred via peer-school pattern matching ────────
type Cat =
  | 'PUB_FLAG_LARGE'
  | 'PUB_FLAG_MID'
  | 'PUB_SELECTIVE'
  | 'PUB_REGIONAL'
  | 'PVT_ELITE'
  | 'PVT_TOP'
  | 'PVT_RELIGIOUS'
  | 'PVT_STEM'
  | 'PVT_MID'
  | 'IVY_PEER'
  | 'NESCAC_PEER'
  | 'NOTRE_DAME'
  | 'STEM_TOP'
  | 'PUBLIC_FLAGSHIP_MICH'
  | 'UC_SYSTEM';

const CAT_BASE: Record<
  Cat,
  Omit<HookSeed, 'name' | 'tier' | 'source'> & { rationale: string }
> = {
  PUB_FLAG_LARGE: {
    legacyClassPct: 0.04,
    athleteClassPct: 0.04,
    firstGenClassPct: 0.22,
    legacyAdmitMultiplier: 1.5,
    athleteAdmitMultiplier: 3.0,
    rationale: 'Large public flagship; D1 athletics; modest legacy preference',
  },
  PUB_FLAG_MID: {
    legacyClassPct: 0.03,
    athleteClassPct: 0.04,
    firstGenClassPct: 0.25,
    legacyAdmitMultiplier: 1.3,
    athleteAdmitMultiplier: 2.5,
    rationale: 'Mid-size public flagship',
  },
  PUB_SELECTIVE: {
    legacyClassPct: 0.04,
    athleteClassPct: 0.05,
    firstGenClassPct: 0.18,
    legacyAdmitMultiplier: 1.5,
    athleteAdmitMultiplier: 3.5,
    rationale: 'Selective public university; D1 athletics often significant',
  },
  PUB_REGIONAL: {
    legacyClassPct: 0.02,
    athleteClassPct: 0.03,
    firstGenClassPct: 0.28,
    legacyAdmitMultiplier: 1.2,
    athleteAdmitMultiplier: 2.0,
    rationale: 'Regional public university; high first-gen %',
  },
  PVT_ELITE: {
    legacyClassPct: 0.1,
    athleteClassPct: 0.1,
    firstGenClassPct: 0.18,
    legacyAdmitMultiplier: 3.5,
    athleteAdmitMultiplier: 5.5,
    rationale: 'Elite-selective private (T30 acceptance rate behavior)',
  },
  PVT_TOP: {
    legacyClassPct: 0.1,
    athleteClassPct: 0.09,
    firstGenClassPct: 0.15,
    legacyAdmitMultiplier: 3.0,
    athleteAdmitMultiplier: 4.5,
    rationale: 'Top mid-tier private',
  },
  PVT_RELIGIOUS: {
    legacyClassPct: 0.13,
    athleteClassPct: 0.1,
    firstGenClassPct: 0.13,
    legacyAdmitMultiplier: 3.5,
    athleteAdmitMultiplier: 5.0,
    rationale: 'Religious-affiliated private; strong legacy tradition',
  },
  PVT_STEM: {
    legacyClassPct: 0.05,
    athleteClassPct: 0.05,
    firstGenClassPct: 0.2,
    legacyAdmitMultiplier: 1.8,
    athleteAdmitMultiplier: 3.5,
    rationale: 'STEM-focused private; lower legacy weight',
  },
  PVT_MID: {
    legacyClassPct: 0.08,
    athleteClassPct: 0.07,
    firstGenClassPct: 0.18,
    legacyAdmitMultiplier: 2.5,
    athleteAdmitMultiplier: 4.0,
    rationale: 'Mid-tier private university',
  },
  IVY_PEER: {
    legacyClassPct: 0.11,
    athleteClassPct: 0.14,
    firstGenClassPct: 0.18,
    legacyAdmitMultiplier: 4.0,
    athleteAdmitMultiplier: 6.0,
    rationale: 'Ivy League peer; high legacy + athlete % typical',
  },
  NESCAC_PEER: {
    legacyClassPct: 0.13,
    athleteClassPct: 0.2,
    firstGenClassPct: 0.15,
    legacyAdmitMultiplier: 4.5,
    athleteAdmitMultiplier: 7.0,
    rationale:
      'Small Ivy / NESCAC peer; athletes ~20% of class due to small enrollment',
  },
  NOTRE_DAME: {
    legacyClassPct: 0.21,
    athleteClassPct: 0.1,
    firstGenClassPct: 0.13,
    legacyAdmitMultiplier: 3.0,
    athleteAdmitMultiplier: 4.0,
    rationale: 'Notre Dame ND admissions blog: legacy famously high ~20-22%',
  },
  STEM_TOP: {
    legacyClassPct: 0.05,
    athleteClassPct: 0.04,
    firstGenClassPct: 0.18,
    legacyAdmitMultiplier: 1.5,
    athleteAdmitMultiplier: 3.5,
    rationale: 'Top STEM-focused (Georgia Tech, CMU); lower legacy weight',
  },
  PUBLIC_FLAGSHIP_MICH: {
    legacyClassPct: 0.04,
    athleteClassPct: 0.06,
    firstGenClassPct: 0.2,
    legacyAdmitMultiplier: 1.5,
    athleteAdmitMultiplier: 3.0,
    rationale:
      'UMich-tier large public; D1 Big Ten but huge class dilutes weight',
  },
  UC_SYSTEM: {
    legacyClassPct: 0,
    athleteClassPct: 0.04,
    firstGenClassPct: 0.38,
    legacyAdmitMultiplier: 1,
    athleteAdmitMultiplier: 2.8,
    rationale: 'UC system policy: no legacy; high first-gen (avg ~38%)',
  },
};

// School → category mapping
const SCHOOL_TO_CAT: Record<string, Cat> = {
  // ─── T25 MEDIUM ────────────────────────────────────────
  'Yale University': 'IVY_PEER',
  'Duke University': 'PVT_TOP',
  'Brown University': 'IVY_PEER',
  'Northwestern University': 'PVT_TOP',
  'Columbia University': 'IVY_PEER',
  'Cornell University': 'IVY_PEER',
  'University of Chicago': 'PVT_TOP',
  'Rice University': 'PVT_TOP',
  'Dartmouth College': 'IVY_PEER',
  'Vanderbilt University': 'PVT_TOP',
  'University of Notre Dame': 'NOTRE_DAME',
  'University of Michigan, Ann Arbor': 'PUBLIC_FLAGSHIP_MICH',
  'Carnegie Mellon University': 'STEM_TOP',
  'Georgetown University': 'PVT_RELIGIOUS',
  'Emory University': 'PVT_TOP',
  'Washington University in St. Louis': 'PVT_TOP',
  // ─── T26-T50 MEDIUM ────────────────────────────────────
  'University of California, Davis': 'UC_SYSTEM',
  'University of California, San Diego': 'UC_SYSTEM',
  'University of California, Irvine': 'UC_SYSTEM',
  'University of California, Santa Barbara': 'UC_SYSTEM',
  'University of Florida': 'PUB_FLAG_LARGE',
  'University of Texas at Austin': 'PUB_FLAG_LARGE',
  'University of Illinois Urbana-Champaign': 'PUB_FLAG_LARGE',
  'University of Wisconsin-Madison': 'PUB_FLAG_LARGE',
  'University of Washington': 'PUB_FLAG_LARGE',
  'Rutgers University-New Brunswick': 'PUB_FLAG_LARGE',
  'Ohio State University': 'PUB_FLAG_LARGE',
  'Purdue University': 'PUB_FLAG_LARGE',
  'University of Maryland, College Park': 'PUB_FLAG_LARGE',
  'Texas A&M University': 'PUB_FLAG_LARGE',
  'University of Georgia': 'PUB_FLAG_LARGE',
  'New York University': 'PVT_MID',
  'Boston College': 'PVT_RELIGIOUS',
  'Tufts University': 'NESCAC_PEER',
  'Boston University': 'PVT_MID',
  'Lehigh University': 'PVT_TOP',
  'Wake Forest University': 'PVT_TOP',
  'Georgia Institute of Technology': 'STEM_TOP',
  // ─── T51-T100 MEDIUM ───────────────────────────────────
  'University of Rochester': 'PVT_TOP',
  'University of Minnesota, Twin Cities': 'PUB_FLAG_LARGE',
  'Northeastern University': 'PVT_ELITE',
  'Case Western Reserve University': 'PVT_TOP',
  'Tulane University': 'PVT_TOP',
  'University of Connecticut': 'PUB_SELECTIVE',
  'William & Mary': 'PUB_SELECTIVE',
  'Virginia Tech': 'PUB_SELECTIVE',
  'Brandeis University': 'PVT_TOP',
  'George Washington University': 'PVT_MID',
  'Santa Clara University': 'PVT_RELIGIOUS',
  'Syracuse University': 'PVT_MID',
  'Pepperdine University': 'PVT_RELIGIOUS',
  'University of Pittsburgh': 'PUB_FLAG_LARGE',
  'Pennsylvania State University': 'PUB_FLAG_LARGE',
  'Indiana University Bloomington': 'PUB_FLAG_LARGE',
  'University of Miami': 'PVT_TOP',
  'Rensselaer Polytechnic Institute': 'PVT_STEM',
  'Stevens Institute of Technology': 'PVT_STEM',
  'Penn State University': 'PUB_FLAG_LARGE',
  'Michigan State University': 'PUB_FLAG_LARGE',
  'SUNY Binghamton University': 'PUB_REGIONAL',
  'University of Delaware': 'PUB_FLAG_MID',
  'University of Iowa': 'PUB_FLAG_MID',
  'Yeshiva University': 'PVT_RELIGIOUS',
  'University of Colorado Boulder': 'PUB_SELECTIVE',
  'Southern Methodist University': 'PVT_RELIGIOUS',
  'Binghamton University': 'PUB_REGIONAL',
  'Clemson University': 'PUB_SELECTIVE',
  'North Carolina State University': 'PUB_FLAG_MID',
  'University at Buffalo': 'PUB_REGIONAL',
  'Fordham University': 'PVT_RELIGIOUS',
  'American University': 'PVT_MID',
  'Baylor University': 'PVT_RELIGIOUS',
  'Loyola Marymount University': 'PVT_RELIGIOUS',
  'Stony Brook University': 'PUB_REGIONAL',
  'Gonzaga University': 'PVT_RELIGIOUS',
  'Marquette University': 'PVT_RELIGIOUS',
  'University of Massachusetts Amherst': 'PUB_FLAG_MID',
  'University of South Florida': 'PUB_FLAG_MID',
  'Drexel University': 'PVT_STEM',
  'Worcester Polytechnic Institute': 'PVT_STEM',
  'University of Denver': 'PVT_MID',
  'Temple University': 'PUB_FLAG_MID',
  'University of San Diego': 'PVT_RELIGIOUS',
  'University of California, Riverside': 'PUB_REGIONAL',
  'Howard University': 'PVT_MID',
  'Illinois Institute of Technology': 'PVT_STEM',
  'University of California, Santa Cruz': 'PUB_REGIONAL',
  'Saint Louis University': 'PVT_RELIGIOUS',
  'Colorado School of Mines': 'PVT_STEM',
  'Rochester Institute of Technology': 'PVT_STEM',
  'University of Arizona': 'PUB_FLAG_MID',
  'Rutgers University-Newark': 'PUB_REGIONAL',
  'University of California, Merced': 'PUB_REGIONAL',
};

function buildMediumTierSeeds(): HookSeed[] {
  return Object.entries(SCHOOL_TO_CAT).map(([name, cat]) => {
    const base = CAT_BASE[cat];
    return {
      name,
      legacyClassPct: base.legacyClassPct,
      athleteClassPct: base.athleteClassPct,
      firstGenClassPct: base.firstGenClassPct,
      legacyAdmitMultiplier: base.legacyAdmitMultiplier,
      athleteAdmitMultiplier: base.athleteAdmitMultiplier,
      tier: 'MEDIUM' as const,
      source: `Claude inference (${cat}): ${base.rationale}`,
    };
  });
}

export function buildAllHookSeeds(): HookSeed[] {
  return [...HIGH_TIER_SEEDS, ...buildMediumTierSeeds()];
}

export async function seedHookStats(opts: { tier?: Tier } = {}) {
  const seeds = buildAllHookSeeds().filter(
    (s) => !opts.tier || s.tier === opts.tier,
  );

  let updated = 0;
  let skipped = 0;
  const tierCounts: Record<string, number> = {};

  for (const seed of seeds) {
    tierCounts[seed.tier] = (tierCounts[seed.tier] ?? 0) + 1;
    const result = await prisma.school.updateMany({
      where: { name: seed.name },
      data: {
        legacyClassPct: seed.legacyClassPct,
        athleteClassPct: seed.athleteClassPct,
        firstGenClassPct: seed.firstGenClassPct,
        legacyAdmitMultiplier: seed.legacyAdmitMultiplier,
        athleteAdmitMultiplier: seed.athleteAdmitMultiplier,
        admitProfileSource: seed.source,
        admitProfileConfidenceTier: seed.tier,
        admitProfileUpdatedAt: new Date(),
        admitProfileCycleYear: 2024,
      },
    });
    if (result.count > 0) {
      updated++;
    } else {
      skipped++;
      console.warn(`  ! ${seed.name} — NOT FOUND in DB (skipped)`);
    }
  }
  console.log(`\n━━━ Tier breakdown ━━━`);
  for (const [t, n] of Object.entries(tierCounts)) {
    console.log(`  ${t}: ${n}`);
  }
  console.log(`\nSummary: ${updated} updated, ${skipped} skipped`);
  return { updated, skipped };
}

if (require.main === module) {
  const tierArg = process.argv
    .find((a) => a.startsWith('--tier='))
    ?.split('=')[1] as Tier | undefined;
  seedHookStats({ tier: tierArg })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
