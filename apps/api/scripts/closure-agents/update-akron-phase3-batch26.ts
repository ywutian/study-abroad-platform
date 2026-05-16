#!/usr/bin/env tsx
/**
 * Phase 3 — University of Akron (Main Campus) end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: University of Akron CDS 2024-2025 (Fall 2024 entering class)
 *   URL: https://www.uakron.edu/ir/docs/CDS/CDS%202024-2025%20University%20of%20Akron%20Main%20Campus.pdf
 *
 * Akron is a PUBLIC Ohio research university.
 *   - oosAcceptanceRate is in eligible scope. However, Akron's 2024-25 CDS
 *     Section C1 residency table publishes ONLY the international and
 *     enrolled-by-residency rows — the in-state/out-of-state APPLIED and
 *     ADMITTED cells are left BLANK. Therefore oosAcceptanceRate is marked
 *     UNAVAILABLE/OFFICIAL_BLANK_SECTION. intlAcceptanceRate IS available.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 97     -> 59.67  (LARGE CORRECTION. CDS 2024-25
 *                          C1 main table: men 8,876 applied + women 9,071 +
 *                          another 50 + unknown 28 = 18,025 total applied.
 *                          Admits: 4,962 + 5,736 + 36 + 21 = 10,755 total
 *                          admitted. AR = 10,755 / 18,025 = 59.6671% (rounded
 *                          to 59.67%). Prior DB value 97 was egregiously
 *                          wrong — Akron's actual admit rate is ~60%, not 97%.
 *                          Tier upgraded VERIFIED_REAL/LEGACY_DB_VALUE ->
 *                          OFFICIAL.)
 *   - sat25             : 910    -> 910    (CDS 2024-25 C9 SAT Composite
 *                          25th = 910. Value matches DB exactly. Tier
 *                          upgraded LEGACY_DB_VALUE -> OFFICIAL.)
 *   - sat75             : 1190   -> 1190   (CDS 2024-25 C9 SAT Composite
 *                          75th = 1190. Value matches DB exactly. Tier
 *                          upgraded LEGACY_DB_VALUE -> OFFICIAL. NOTE: Only
 *                          13.57% (267 students) submitted SAT — Akron is
 *                          ACT-dominant (64.41% submitted ACT = 1,267
 *                          students). Test-optional per C8A "Not required
 *                          for admission, but consider if submitted".)
 *   - intlAcceptanceRate: 92.15  -> 14.22  (CORRECTION. CDS 2024-25 C1
 *                          residency breakdown table: INTERNATIONAL column
 *                          shows 6,477 applied / 921 admitted (the in-state
 *                          and out-of-state cells are blank in the APPLIED
 *                          and ADMITTED rows). intlAR = 921 / 6,477 = 14.2196%
 *                          (rounded to 14.22%). Prior DB value 92.15 was
 *                          HEURISTIC, not from CDS. Cross-validated against
 *                          public Akron International Center reporting "550
 *                          international students enrolled" — consistent
 *                          with low international admit rate at a regional
 *                          public R1.)
 *   - oosAcceptanceRate : 98     -> null   (CDS 2024-25 C1 residency
 *                          breakdown table publishes ONLY the international
 *                          and enrolled-by-residency rows. The in-state and
 *                          out-of-state cells in the APPLIED and ADMITTED
 *                          rows are LEFT BLANK by Akron in the CDS. Cannot
 *                          derive a CDS-official OOS admit rate. Prior DB
 *                          value 98 was HEURISTIC. Cleared to null with
 *                          tier UNAVAILABLE/OFFICIAL_BLANK_SECTION. NOTE:
 *                          Enrolled-by-residency IS published — in-state
 *                          1,758, out-of-state 162, intl 39, unknown 8,
 *                          total 1,967 — which yields enrollment ratios but
 *                          not admit rates. Field stays open for the next
 *                          CDS cycle if Akron fills the missing cells.)
 *   - edAcceptanceRate  : null   -> null   (CDS 2024-25 C21: "Does your
 *                          institution offer an early decision plan?" — NO
 *                          checked. Akron does not offer ED. Field stays
 *                          null. Tier transitions OFFICIAL/CDS_LLM_EXTRACT_2026_04
 *                          (stale) -> UNAVAILABLE/OFFICIAL_BLANK_SECTION/
 *                          NOT_OFFERED.)
 *   - eaAcceptanceRate  : null   -> null   (CDS 2024-25 C22: "Do you have
 *                          a nonbinding early action plan?" — NO checked.
 *                          Akron does not offer EA. Same as edAR.)
 *
 * NOTE on hasEarlyDecision: current DB value is true, but CDS C21 is "No".
 *   Correcting to false to match CDS reality.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.uakron.edu/ir/docs/CDS/CDS%202024-2025%20University%20of%20Akron%20Main%20Campus.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8is60030z0timvbtgjwa';

const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findUnique({
    where: { id: SCHOOL_ID },
    select: {
      id: true,
      name: true,
      isPrivate: true,
      hasEarlyDecision: true,
      acceptanceRate: true,
      sat25: true,
      sat75: true,
      intlAcceptanceRate: true,
      oosAcceptanceRate: true,
      edAcceptanceRate: true,
      eaAcceptanceRate: true,
      metadata: true,
    },
  });
  if (!school) throw new Error(`School ${SCHOOL_ID} (Akron) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC Ohio R1]`);
  console.log(
    `  current AR=${school.acceptanceRate?.toString()} sat25=${school.sat25} sat75=${school.sat75}`,
  );
  console.log(
    `  current intlAR=${school.intlAcceptanceRate?.toString()} oosAR=${school.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${school.edAcceptanceRate?.toString() ?? 'null'} eaAR=${school.eaAcceptanceRate?.toString() ?? 'null'} hasED=${school.hasEarlyDecision}`,
  );

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-batch26-akron',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 59.67,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1 main table: 18,025 total applied (men 8,876 + women 9,071 + another 50 + unknown 28), 10,755 total admitted (4,962 + 5,736 + 36 + 21). AR = 10,755 / 18,025 = 59.6671% (rounded to 59.67%). LARGE CORRECTION: prior DB value 97 was egregiously wrong — Akron is a non-selective regional public R1 with ~60% admit rate, not 97%. Tier upgraded LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 910,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'CDS 2024-25 Section C9 SAT Composite 25th percentile = 910. Value matches prior LEGACY_DB exactly; tier upgraded LEGACY_DB_VALUE -> OFFICIAL. NOTE: Only 13.57% (267 of 1,967 enrolled) submitted SAT — Akron is ACT-dominant (64.41% submitted ACT = 1,267 students). Test-optional per C8A "Not required for admission, but consider if submitted".',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1190,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'CDS 2024-25 Section C9 SAT Composite 75th percentile = 1190. Value matches prior LEGACY_DB exactly; tier upgraded LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 14.22,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency breakdown table: INTERNATIONAL column shows 6,477 applied / 921 admitted. intlAR = 921 / 6,477 = 14.2196% (rounded to 14.22%). LARGE CORRECTION: prior DB value 92.15 was HEURISTIC, not from CDS. Cross-validated against public Akron International Center reporting "550 international students enrolled" — consistent with a regional public R1 receiving many international applications but admitting selectively.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency breakdown table: Akron published ONLY the INTERNATIONAL column for APPLIED/ADMITTED rows AND the full ENROLLED row (in-state 1,758 / OOS 162 / intl 39 / unknown 8 / total 1,967). The in-state and out-of-state APPLIED and ADMITTED cells are LEFT BLANK in the official CDS PDF. Cannot derive a CDS-official OOS admit rate. Prior DB value 98 was HEURISTIC. Cleared to null with tier UNAVAILABLE/OFFICIAL_BLANK_SECTION. Field stays open for the next CDS cycle.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. Akron does not offer Early Decision. Field stays null. Tier transitions OFFICIAL/CDS_LLM_EXTRACT_2026_04 (stale) -> UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED with refreshed provenance.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. Akron does not offer Early Action. Same treatment as edAcceptanceRate.',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(school.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: CDS_URL,
  };

  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('59.67'),
      sat25: 910,
      sat75: 1190,
      intlAcceptanceRate: new Prisma.Decimal('14.22'),
      oosAcceptanceRate: null,
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — Akron does not offer ED; correct stale DB true.
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=59.67, sat25=910, sat75=1190, intlAR=14.22, oosAR=BLANK, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
  );

  const after = await prisma.school.findUnique({
    where: { id: school.id },
    select: {
      acceptanceRate: true,
      sat25: true,
      sat75: true,
      intlAcceptanceRate: true,
      oosAcceptanceRate: true,
      edAcceptanceRate: true,
      eaAcceptanceRate: true,
      hasEarlyDecision: true,
      metadata: true,
    },
  });
  console.log('');
  console.log('=== After update ===');
  console.log(
    `  AR=${after?.acceptanceRate?.toString()} sat25=${after?.sat25 ?? 'null'} sat75=${after?.sat75 ?? 'null'}`,
  );
  console.log(
    `  intlAR=${after?.intlAcceptanceRate?.toString() ?? 'null'} oosAR=${after?.oosAcceptanceRate?.toString() ?? 'null'} edAR=${after?.edAcceptanceRate?.toString() ?? 'null'} eaAR=${after?.eaAcceptanceRate?.toString() ?? 'null'} hasED=${after?.hasEarlyDecision}`,
  );
  const prov = (after?.metadata as any)?.provenance ?? {};
  for (const f of [
    'acceptanceRate',
    'sat25',
    'sat75',
    'intlAcceptanceRate',
    'oosAcceptanceRate',
    'edAcceptanceRate',
    'eaAcceptanceRate',
  ]) {
    const p = prov[f];
    console.log(
      `  ${f.padEnd(22)} tier=${p?.tier ?? 'NULL'}  source=${p?.source ?? 'NULL'}  cycle=${p?.cycleYear ?? '-'}`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
