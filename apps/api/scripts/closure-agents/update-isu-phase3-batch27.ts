#!/usr/bin/env tsx
/**
 * Phase 3 — Idaho State University (Pocatello, ID) end-to-end closure of
 *   the 7 prediction-critical fields.
 *
 * Source: Idaho State University CDS 2024-2025 (Fall 2024 entering class)
 *   URL: https://www.isu.edu/media/libraries/finance-and-business-affairs/Academic-Year-2024-2025.pdf
 *
 * The CDS is published in a flat data-dictionary format (one row per cell)
 *   under the Office of Finance & Business Affairs at isu.edu (replaces the
 *   prior stale path under academic-affairs/institutional-research).
 *
 * ISU is a PUBLIC Idaho regional research university (R2). oosAR is in
 *   eligible scope. HOWEVER, ISU's C1 residency breakdown table is published
 *   with INCONSISTENT data — the in-state row reports 6,506 admitted vs only
 *   6,280 applied (admits > applicants, structurally impossible), and the
 *   three residency rows sum to 14,222 applicants vs the C117 total of 7,652
 *   (off by ~86%). These rows cannot be trusted. The gender-breakdown
 *   totals (men 3,394 + women 4,256 + unknown 2 = 7,652 applied;
 *   3,233 + 4,085 + 2 = 7,320 admitted) ARE self-consistent and match the
 *   C117/C118 totals exactly, so the overall AR is reliable.
 *
 * Value changes vs existing DB:
 *   - acceptanceRate    : 96     -> 95.66  (CDS C117/C118: 7,652 applied,
 *                          7,320 admitted. AR = 7,320/7,652 = 95.6613%
 *                          (rounded to 95.66%). Prior DB 96 was a rounded
 *                          legacy figure consistent with this number. Tier
 *                          LEGACY_DB_VALUE -> OFFICIAL.)
 *   - sat25             : 890    -> 910    (CDS C905 SAT Composite 25th
 *                          percentile = 910. Prior DB 890 differed by 20 pts;
 *                          source was Clastify (third-party aggregator, not
 *                          official). Corrected to CDS value. Submitting SAT
 *                          69% (1,241), ACT 22% (299) — SAT-dominant.)
 *   - sat75             : 1140   -> 1140   (CDS C907 SAT Composite 75th
 *                          percentile = 1140. Matches DB. Source upgraded
 *                          from Clastify -> CDS_OFFICIAL.)
 *   - intlAcceptanceRate: 97     -> null   (CDS C1 residency breakdown table
 *                          is internally inconsistent and cannot be trusted
 *                          (in-state row reports admits > applicants;
 *                          residency rows sum to ~14,222 vs C117 total of
 *                          7,652). Specifically the "International/Nonresident"
 *                          row prints 7,111 applied / 6,589 admitted —
 *                          implausible given total applicants are 7,652.
 *                          Cannot derive an authoritative intl admit rate
 *                          from the published CDS. Prior DB value 97
 *                          (sourced from Clastify per existing provenance)
 *                          cannot be back-traced to the CDS. Cleared to null
 *                          with tier UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *   - oosAcceptanceRate : 97.8   -> null   (Same residency-table-erroneous
 *                          issue. OOS row prints 831 applied / 813 admitted
 *                          (ratio 97.83%, consistent with the prior DB 97.8
 *                          value), but the table as a whole fails arithmetic
 *                          (sum of residency rows ≠ totals). Per closure
 *                          rule when the official source is internally
 *                          inconsistent, the field is marked
 *                          OFFICIAL_BLANK_SECTION rather than asserting a
 *                          number that cannot be cross-validated. Cleared
 *                          to null. Prior DB 97.8 was from LEGACY_DB_VALUE.)
 *   - edAcceptanceRate  : null   -> null   (CDS C2101: "Does your institution
 *                          offer an early decision plan?" — n (No). ISU
 *                          does NOT offer ED. Stays null. Tier transitions
 *                          OFFICIAL/CDS_LLM_EXTRACT_2026_04 (stale) ->
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : null   -> null   (CDS C2201: "Do you have a
 *                          nonbinding early action plan?" — N. ISU does NOT
 *                          offer EA. Same as edAR.)
 *
 * hasEarlyDecision: current DB value is TRUE. CDS C2101 confirms ISU does
 *   NOT offer ED. Correcting to FALSE.
 *
 * Test policy (C8A/C801): SAT/ACT use in admission = Y. SAT or ACT is
 *   "Required to be considered for admission" (C802). NOTE: ISU's CDS C8
 *   sub-fields contradict ISU's public admissions website which advertises
 *   test-optional; the CDS form may not be up to date. C9 percentile values
 *   are still authoritative for the reported submitter cohort.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.isu.edu/media/libraries/finance-and-business-affairs/Academic-Year-2024-2025.pdf';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iss003cz0tia71q9qy1';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Idaho State) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC Idaho R2]`);
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
    generatedBy: 'phase3-batch27-isu',
  };

  const blankResidencyReason =
    'CDS 2024-25 Section C1 residency breakdown table is INTERNALLY INCONSISTENT and cannot be trusted: in-state row reports 6,506 admitted vs only 6,280 applied (admits > applicants is structurally impossible); residency rows sum to 14,222 applied vs the C117 grand total of 7,652 (off by 86%). The gender breakdown (men 3,394 + women 4,256 + unknown 2 = 7,652 applied; 3,233 + 4,085 + 2 = 7,320 admitted) IS self-consistent and matches C117/C118 exactly, so the overall AR is reliable — but individual residency rates cannot be derived from the published CDS. Per closure rule "official source internally inconsistent -> BLANK_SECTION". Cleared to null. Field stays open for the next CDS cycle if ISU republishes corrected residency cells.';

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 95.66,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 C117/C118: 7,652 total applied (men 3,394 + women 4,256 + another 0 + unknown 2); 7,320 total admitted (3,233 + 4,085 + 0 + 2). AR = 7,320/7,652 = 95.6613% (rounded to 95.66%). Prior DB 96 was the rounded legacy figure (same number, lower precision). Tier upgraded LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 910,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'CDS 2024-25 Section C9 (C905) SAT Composite 25th percentile = 910. CORRECTION: prior DB 890 was sourced from Clastify (third-party aggregator) not from the official CDS. Differs by 20 points. Updated to authoritative CDS value. Submitting SAT 69% (1,241 students); ACT 22% (299) — ISU is SAT-dominant.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1140,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'CDS 2024-25 Section C9 (C907) SAT Composite 75th percentile = 1140. Value matches prior DB; source upgraded from Clastify (third-party aggregator) -> CDS_OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      policyLabel: 'International admit rate',
      reason:
        blankResidencyReason +
        ' Specifically the International/Nonresident row prints 7,111 applied / 6,589 admitted — implausible given total applicants of 7,652.',
      realDataStatus: 'BLANK_IN_OFFICIAL_SOURCE',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      policyLabel: 'Out-of-state admit rate',
      reason:
        blankResidencyReason +
        ' The OOS row prints 831 applied / 813 admitted (ratio 97.83%, consistent with the prior DB 97.8 value), but per the rule above we will not assert a residency rate when the surrounding table fails arithmetic.',
      realDataStatus: 'BLANK_IN_OFFICIAL_SOURCE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21 (C2101): "Does your institution offer an early decision plan?" — n (No). ISU does NOT offer ED. Field stays null. Tier transitions OFFICIAL/CDS_LLM_EXTRACT_2026_04 (stale) -> UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22 (C2201): "Do you have a nonbinding early action plan?" — N (No). ISU does NOT offer EA. Same treatment as edAR.',
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
      acceptanceRate: new Prisma.Decimal('95.66'),
      sat25: 910,
      sat75: 1140,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C2101 "n" — ISU does NOT offer ED; correct stale DB true.
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=95.66, sat25=910 [corrected from 890], sat75=1140, intlAR=BLANK [bad CDS table], oosAR=BLANK [bad CDS table], edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
