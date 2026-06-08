/**
 * Intelligent data-audit corrections — 2026-05-31.
 *
 * A 41-agent workflow verified all 241 US schools' prediction-driving fields
 * against each school's PUBLISHED Common Data Set / IPEDS / College Scorecard.
 * It found 76 "plausible-but-wrong" values that the automated invariant gates
 * (scripts/audit-prediction-data-integrity.ts) cannot catch — stale anchors,
 * mislabeled fields (enrollment % stored as an admit rate, an admit rate copied
 * into the OOS/intl slot), and fabricated rounds. This seed corrects the HIGH +
 * clear-MEDIUM findings; each carries its primary source.
 *
 * Correction kinds:
 *   - acceptanceRate (the prediction ANCHOR): set to the latest published rate
 *   - mislabeled intl/oos fields: null (the stored value is not an admit rate;
 *     the engine then falls back to its selectivity heuristic)
 *   - fabricated/mislabeled EA/ED: null; stale-but-real ED/EA: set
 *   - clearly-wrong SAT bands: set to the CDS C9 value (or null if test-blind)
 *
 * Idempotent updateMany on nameNorm. Wired into the seed pipeline after the
 * school seed. See docs/PREDICTION_DATA_DRIVEN_STRATEGY_2026-05-30.md §7.7.
 *
 * Run standalone (also to apply against prod):
 *   npx tsx apps/api/prisma/seed-audit-corrections-2026-05-31.ts
 */
import { PrismaClient } from '@prisma/client';

const standalonePrisma = new PrismaClient();

type Fields = {
  acceptanceRate?: number;
  intlAcceptanceRate?: number | null;
  oosAcceptanceRate?: number | null;
  edAcceptanceRate?: number | null;
  eaAcceptanceRate?: number | null;
  sat25?: number | null;
  sat75?: number | null;
};

interface Correction {
  nameNorm: string;
  set: Fields;
  source: string;
  note: string;
}

// All rates are percentages (Decimal(5,2) convention); SAT are total 400-1600.
export const AUDIT_CORRECTIONS: ReadonlyArray<Correction> = [
  // ── Anchor (overall admit rate) — stale / mislabeled / wrong ──────────────
  {
    nameNorm: 'university of colorado boulder',
    set: {
      acceptanceRate: 80.5,
      oosAcceptanceRate: null,
      intlAcceptanceRate: null,
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
    },
    source:
      'College Scorecard / CDS 2024-25 (54,756 applied / 44,053 admitted = 80.5%)',
    note: 'Anchor was 18.47% (~4x too low, mislabeled). OOS 24.25%, intl 7.02%, ED 31.81% and EA 20.57% were enrollment-share/yield figures mislabeled as admit rates → nulled. The wrong 18.47% anchor masked the ED/EA as plausible early boosts; against the real 80.5% overall they are impossibly low, and CU Boulder offers EA (hasEarlyAction) not ED at all.',
  },
  {
    nameNorm: 'new mexico state university',
    set: { acceptanceRate: 88.97, intlAcceptanceRate: null },
    source: 'College Scorecard/IPEDS latest admission_rate.overall = 0.8897',
    note: 'Anchor was 71% (stale). intl 67.45% was a mislabeled value (real intl share ~5.7%) → nulled.',
  },
  {
    nameNorm: 'university of nevada, reno',
    set: { acceptanceRate: 85.3 },
    source: 'UNR CDS 2023-24 C1 (8,652/10,142 = 85.3%)',
    note: 'Anchor was 73.71% (~11.6pp low).',
  },
  {
    nameNorm: 'texas tech university',
    set: { acceptanceRate: 72.6, intlAcceptanceRate: null },
    source: 'College Board / CDS (34,356 applied / 24,958 admitted = 72.64%)',
    note: 'Anchor was 84.61% (~12pp high). intl 74% mislabeled → nulled.',
  },
  {
    nameNorm: 'mississippi state university',
    set: { acceptanceRate: 77.6 },
    source: 'IPEDS / ir.msstate.edu CDS (76.32% 2023-24, 77.64% 2024-25)',
    note: 'Anchor was 62% (matched 2017-18; stale by ~7 years, ~15pp low).',
  },
  {
    nameNorm: 'northern illinois university',
    set: {
      acceptanceRate: 70.0,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      sat25: null,
      sat75: null,
    },
    source: 'collegetuitioncompare / datausa CDS (69.79-70.5%)',
    note: 'Anchor 88.15% (~18pp high). intl 87.62% & oos 83.53% impossible (in-state-dominant) → nulled; test-optional SAT band wrong → nulled.',
  },
  {
    nameNorm: 'university of hawaii at manoa',
    set: { acceptanceRate: 86.6 },
    source:
      'UH Manoa CDS 2024-25 C1 (14,481/16,722 = 86.60%); NCES IPEDS 141574 corroborates',
    note: "Was 69.7% (CDS 2023-24, one cycle stale). Fall 2024 genuinely jumped to 86.6% — apps fell ~13% (19,217->16,722) while admits rose ~8% (13,388->14,481). This is the single source for Hawaii's overall; supersedes the duplicate overallRate override removed from seed-instate-rate-2026-05-31.",
  },
  {
    nameNorm: 'university of vermont',
    set: { acceptanceRate: 65.3, oosAcceptanceRate: 65.7 },
    source:
      'UVM CDS 2024-25 C1 (17,722/27,138 = 65.3%; OOS 16,036/24,417 = 65.7%)',
    note: 'Anchor was 73.05% (~7.8pp high); OOS 75.18% likewise overstated.',
  },
  {
    nameNorm: 'ohio state university',
    set: { acceptanceRate: 50.8, oosAcceptanceRate: 49.7 },
    source: 'OSU CDS 2023-24 C1 (35,588/70,028 = 50.82%; OOS 49.7%)',
    note: 'Anchor was 60.57% (~9.8pp high).',
  },
  {
    nameNorm: 'university of denver',
    set: { acceptanceRate: 71.2, intlAcceptanceRate: null },
    source: 'DU CDS 2023-24 C1 (13,679/19,214 = 71.2%)',
    note: 'Anchor was 77.29% (stale). intl 48.79% stale enrollment-ish → nulled.',
  },
  {
    nameNorm: 'university of san diego',
    set: { acceptanceRate: 46.8, intlAcceptanceRate: null },
    source: 'USD CDS 2023-24 C1 (7,452/15,921 = 46.8%)',
    note: 'Anchor was 52.38% (stale; USD tightened). intl 49.12% now exceeds the corrected overall (unverified) → nulled.',
  },
  {
    nameNorm: 'university of wisconsin-milwaukee',
    set: {
      acceptanceRate: 89.0,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
    },
    source: 'IPEDS 2023 (88.4%) / collegetuitioncompare 2024-25 (90.7%)',
    note: 'Anchor 97.11% (~7pp high). intl 79.32% & oos 99.22% impossible → nulled.',
  },
  {
    nameNorm: 'saint louis university',
    set: { acceptanceRate: 75.04 },
    source: 'IPEDS 2024-25 (11,656/15,533 = 75.04%)',
    note: 'Anchor was 70.05% (matched 2021-22; stale ~3 years).',
  },
  {
    nameNorm: 'purdue university',
    set: { acceptanceRate: 50.3, oosAcceptanceRate: null },
    source: 'Purdue CDS 2023-24 C1 (36,602/72,800 = 50.28%)',
    note: 'Anchor was 43.43% (~6.9pp low); OOS 43.58% tracked the wrong overall → nulled.',
  },
  {
    nameNorm: 'pratt institute',
    set: { acceptanceRate: 73.25, eaAcceptanceRate: null },
    source: 'Pratt Fall 2024 / Class of 2028 (6,195/8,457 = 73.25%)',
    note: 'Anchor was 44.87% (2022; stale ~28pp). The stray EA=73% was actually the current overall → nulled the bogus EA.',
  },
  {
    nameNorm: 'school of the art institute of chicago',
    set: { acceptanceRate: 77.0 },
    source: 'IPEDS 2024-25 (77.47%; CollegeData 77%, Niche 76.4%)',
    note: 'Anchor was 60% (~17pp low); yield matched IPEDS so only the rate was stale.',
  },
  {
    nameNorm: 'manhattan school of music',
    set: { acceptanceRate: 40.0 },
    source: 'IPEDS 2024-25 (573/1,405 = 40.78%)',
    note: 'Anchor was 78.94% (~2x; duplicated the OOS field). EA=36% and yield matched reality.',
  },
  {
    nameNorm: 'savannah college of art and design',
    set: {
      acceptanceRate: 83.0,
      oosAcceptanceRate: null,
      intlAcceptanceRate: null,
    },
    source: 'SCAD 2024-25 (13,241/15,956 = 83%); scad.edu IR for intl ~13%',
    note: 'Anchor was 92% (~9pp high). OOS 93.84% and intl 87.4% were enrollment/geo figures → nulled.',
  },
  {
    nameNorm: 'maryland institute college of art',
    set: { acceptanceRate: 76.8 },
    source: 'IPEDS 2024-25 (2,458/3,201 = 76.79%)',
    note: 'Anchor was 64% (~13pp low); yield matched IPEDS so only the rate was wrong.',
  },
  {
    nameNorm: 'new england conservatory',
    set: { acceptanceRate: 41.1 },
    source: 'NEC IPEDS 2024-25 (457/1,112 = 41.10%)',
    note: 'Anchor was 31% (stale); the correct rate already sat in the EA field, yield matched.',
  },
  {
    nameNorm: 'california college of the arts',
    set: { acceptanceRate: 91.1 },
    source: 'IPEDS 2024-25 (2,160/2,371 = 91.10%)',
    note: 'Anchor was 84% (matched no published year; rate is volatile, yield current).',
  },
  {
    nameNorm: 'missouri university of science and technology',
    set: { acceptanceRate: 72.55 },
    source: 'Missouri S&T CDS 2024-25 (6,059/8,352 = 72.55%)',
    note: 'Anchor was 78.63% (~6pp high vs the two most recent cycles).',
  },
  {
    nameNorm: 'university of rhode island',
    set: { acceptanceRate: 77.1, sat25: 1160, sat75: 1300 },
    source: 'URI CDS 2023-24 C1 (19,568/25,391 = 77.07%); C9 SAT 1160-1300',
    note: 'Anchor was 72.16% (~5pp low). SAT band 1020-1260 shifted ~80-140pts low.',
  },
  {
    nameNorm: 'the juilliard school',
    set: { acceptanceRate: 9.0, sat25: null, sat75: null },
    source: 'DataUSA/IPEDS 2024-25 (~9.15%); Juilliard is test-blind',
    note: 'Anchor 6% (stale). Test-blind audition conservatory — fabricated SAT band nulled.',
  },
  {
    nameNorm: 'wright state university',
    set: { acceptanceRate: 96.33, sat25: 913, sat75: 1240 },
    source:
      'Wright State (Dayton) CDS 2024-25 C1 (8,530/8,855 = 96.33%); C9 SAT 913-1240',
    note: 'Anchor 99.69% was the Lake campus rate (wrong-campus). SAT band 830-1000 sat entirely below the real 25th pct.',
  },

  // ── Mislabeled intl (enrollment-% / garbage stored as intl admit rate) ────
  {
    nameNorm: 'rose-hulman institute of technology',
    set: { intlAcceptanceRate: null },
    source: 'Rose-Hulman CDS 2024-25 B2 (~8.2% intl)',
    note: 'intl 68.9% was a non-admit-rate metric (~8x reality).',
  },
  {
    nameNorm: 'curtis institute of music',
    set: { intlAcceptanceRate: null, oosAcceptanceRate: null },
    source: 'collegetuitioncompare 2024-25 (~49% intl)',
    note: 'intl 1.6% & oos 2.8% impossible for a ~half-international conservatory.',
  },
  {
    nameNorm: 'texas a&m university',
    set: { intlAcceptanceRate: null },
    source: 'collegefactual (~1.2% undergrad intl)',
    note: 'intl 56.53% impossible as an international share.',
  },
  {
    nameNorm: 'clarkson university',
    set: { intlAcceptanceRate: null },
    source: 'collegetuitioncompare 2024-25 (~6% undergrad intl)',
    note: 'intl 64.92% impossible (mislabeled).',
  },
  {
    nameNorm: 'cleveland state university',
    set: { intlAcceptanceRate: null, oosAcceptanceRate: null },
    source: 'collegefactual (~4.1% intl); Princeton Review (~4% OOS)',
    note: 'intl 85% & oos 95.88% inverted/mislabeled (CSU is ~96% in-state).',
  },
  {
    nameNorm: 'university of toledo',
    set: { intlAcceptanceRate: null },
    source: 'UToledo CDS 2023-24 (nonresident ~8.6%)',
    note: 'intl 71.01% implausible.',
  },
  {
    nameNorm: 'wayne state university',
    set: { intlAcceptanceRate: null },
    source: 'College Scorecard (undergrad nonresident 2.23%)',
    note: 'intl 49.39% implausibly high.',
  },
  {
    nameNorm: 'university of georgia',
    set: { intlAcceptanceRate: null },
    source: 'UGA admissions (Fall 2024: 1% intl undergrad)',
    note: 'intl 20.91% ~16x the true undergrad intl share.',
  },
  {
    nameNorm: 'harvey mudd college',
    set: { intlAcceptanceRate: null },
    source: 'HMC CDS 2023-24 (~10-13% intl)',
    note: 'intl 4.64% inconsistent with any HMC intl share; enrollment-share figure, not an admit rate.',
  },
  {
    nameNorm: 'northeastern university',
    set: { intlAcceptanceRate: null },
    source: 'NEU CDS 2024-25 B2 (~10-13% undergrad intl)',
    note: 'intl 3.81% inconsistent with every primary measure.',
  },
  {
    nameNorm: 'villanova university',
    set: { intlAcceptanceRate: null, eaAcceptanceRate: 15.45 },
    source: 'Villanova CDS 2023-24 (intl ~2%; EA 2,266/14,667 = 15.45%)',
    note: 'intl 17% ~8x reality → nulled; EA 28% wrong → set to 15.45%.',
  },

  // ── Mislabeled OOS at non-flagged private/garbage rows → null ─────────────
  {
    nameNorm: 'massachusetts institute of technology',
    set: { oosAcceptanceRate: null },
    source: 'MIT CDS 2024-25 (OOS share 91%, not an admit rate)',
    note: 'OOS 4.55% was the overall admit rate copied into the OOS slot (MIT is private → geo neutral anyway).',
  },
  {
    nameNorm: 'williams college',
    set: { oosAcceptanceRate: null },
    source: 'Williams residency (~86.6% OOS share)',
    note: 'OOS 0.09% impossible (parse error).',
  },
  {
    nameNorm: 'amherst college',
    set: { oosAcceptanceRate: null, eaAcceptanceRate: null },
    source: 'Amherst Class of 2028 profile (ED-only, no EA; ~88% OOS share)',
    note: 'OOS 0.08% impossible; EA 61% fabricated (Amherst has no EA round).',
  },
  {
    nameNorm: 'university of idaho',
    set: { oosAcceptanceRate: null },
    source: 'U Idaho (no residency admit-rate split; overall ~75-79%)',
    note: 'OOS 85.94% exceeds overall — mislabeled.',
  },

  // ── Stale-but-real ED/EA fields → set ─────────────────────────────────────
  {
    nameNorm: 'colgate university',
    set: { edAcceptanceRate: 22.94 },
    source: 'Colgate CDS 2023-24 C21 (481/2,097 = 22.94%)',
    note: 'ED was 35.25% (~12pp high for the same cycle).',
  },
  {
    nameNorm: 'case western reserve university',
    set: { edAcceptanceRate: 37.06 },
    source: 'CWRU CDS 2024-25 C21 (298/804 = 37.06%)',
    note: 'ED was 24.98% (prior-cycle value; made ED look lower than overall).',
  },
  {
    nameNorm: 'rensselaer polytechnic institute',
    set: { edAcceptanceRate: 58.0 },
    source: 'RPI Class of 2028 (139/240 = 57.9%)',
    note: 'ED was 69.09% (stale older cycle).',
  },
  {
    nameNorm: 'university of san francisco',
    set: { edAcceptanceRate: null },
    source: 'USF (49.4% is its EA rate, not ED)',
    note: 'EA value was mislabeled into the ED field → nulled.',
  },
  {
    nameNorm: 'university of north carolina at chapel hill',
    set: { eaAcceptanceRate: null },
    source:
      'UNC (does not publish a separate EA rate; value = overall placeholder)',
    note: 'EA 15.34% was the overall rate copied into the EA slot.',
  },

  // ── Clearly-wrong SAT bands → set / null ──────────────────────────────────
  {
    nameNorm: 'university of washington',
    set: { sat25: 1280 },
    source: 'UW Seattle CDS 2023-24 C9 (SAT 25th = 1280)',
    note: 'sat25 1333 was ~53pts high (picked up the 50th pctile).',
  },
  {
    nameNorm: 'university of california, irvine',
    set: { sat25: 1180 },
    source: 'UCI CDS / Peterson 2024 (SAT mid-50 1180-1440)',
    note: 'sat25 1250 was ~70pts high.',
  },
  {
    nameNorm: 'worcester polytechnic institute',
    set: { sat25: null, sat75: null },
    source: 'WPI CDS 2023-24 (test-blind; C9 SAT blank)',
    note: 'Test-blind school — fabricated SAT band 1300-1460 nulled.',
  },
];

export interface AuditCorrectionResult {
  updated: number;
  notFound: string[];
}

export async function applyAuditCorrections(
  prisma: PrismaClient = standalonePrisma,
): Promise<AuditCorrectionResult> {
  let updated = 0;
  const notFound: string[] = [];
  for (const c of AUDIT_CORRECTIONS) {
    const res = await prisma.school.updateMany({
      where: { nameNorm: c.nameNorm },
      data: c.set,
    });
    if (res.count > 0) updated += res.count;
    else notFound.push(c.nameNorm);
  }
  return { updated, notFound };
}

async function main() {
  const { updated, notFound } = await applyAuditCorrections();
  console.log(
    `🔧 Audit corrections: applied to ${updated}/${AUDIT_CORRECTIONS.length} school(s).`,
  );
  if (notFound.length > 0) {
    console.warn(`⚠ ${notFound.length} not in DB:`, notFound.join(', '));
  }
  await standalonePrisma.$disconnect();
}

if (require.main === module) {
  main().catch((e) => {
    console.error('❌ audit corrections failed:', (e as Error).message);
    process.exit(1);
  });
}
