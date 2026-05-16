#!/usr/bin/env tsx
/**
 * Phase 3 — Colorado School of Mines end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: Colorado School of Mines CDS 2021-2022 (Fall 2022 entering class)
 *   URL: https://ir.mines.edu/wp-content/uploads/sites/66/2023/01/CDS23.pdf
 *   Index: https://ir.mines.edu/common-data-set/
 *
 * NOTE: Mines is a PUBLIC institution (isPrivate=false).
 *   - oosAR is in eligible scope per public-school convention; HOWEVER the
 *     Mines CDS C1 table does NOT break out residency (in-state vs.
 *     out-of-state vs. international) for first-time, first-year applicants
 *     and admits. Section B2 only reports enrolled nonresidents (22 of 1,515
 *     first-year enrolled), which is enrollment yield-side, not applied/admit.
 *     Therefore per closure-pipeline convention "C1 residency empty ->
 *     UNAVAILABLE / OFFICIAL_BLANK_SECTION" we mark intlAR and oosAR as
 *     UNAVAILABLE-terminal/OFFICIAL_BLANK_SECTION (not TERMINAL).
 *   - Mines is the most recent published CDS (CDS23 covering 2021-2022 / Fall
 *     2022 entering class). The institution has not yet released CDS24 or
 *     CDS25 as of this writing.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 18.47    -> 58.00  (CDS 2021-22 C1: 6,314 admits /
 *                          10,886 applicants = 58.0195%. BIG UPWARD
 *                          CORRECTION — prior 18.47 likely came from a stale
 *                          source or a confused other school. Tier
 *                          LEGACY_DB -> OFFICIAL.)
 *   - sat25             : 1310    -> 1340   (CDS 2021-22 C9: SAT Composite
 *                          25th = 1340 reported. CORRECTION UP +30 from prior
 *                          1310 (LEGACY_DB).)
 *   - sat75             : 1460    -> 1460   (CDS 2021-22 C9: SAT Composite
 *                          75th = 1460 reported. Value matches prior DB;
 *                          tier upgraded LEGACY_DB -> OFFICIAL.)
 *   - intlAcceptanceRate: 7.02    -> null   (CDS 2021-22 C1 does NOT publish
 *                          residency breakdown. Field cleared and marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION. Prior LEGACY_DB
 *                          value 7.02 retired as not sourceable from CDS.)
 *   - oosAcceptanceRate : 24.25   -> null   (CDS 2021-22 C1 does NOT publish
 *                          residency breakdown. Even though Mines is public,
 *                          the CDS itself omits the residency table for
 *                          first-time first-year applicants/admits. Field
 *                          cleared and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION.
 *                          Prior LEGACY_DB value 24.25 retired.)
 *   - edAcceptanceRate  : null    -> null   (CDS 2021-22 C21: "Yes" — Mines
 *                          DOES offer Early Decision (closing 11/1,
 *                          notification 12/21). However the Fall 2022 ED
 *                          applicants/admits cells are BLANK on the CDS form.
 *                          Field stays null, marked UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION.)
 *   - eaAcceptanceRate  : null    -> null   (CDS 2021-22 C22: "No" — Mines
 *                          does NOT offer Early Action. Field stays null,
 *                          marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/
 *                          NOT_OFFERED.)
 *
 * NOTE on hasEarlyDecision: current DB true matches CDS C21 "Yes" — retained.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://ir.mines.edu/wp-content/uploads/sites/66/2023/01/CDS23.pdf';
const CYCLE_YEAR = 2021; // CDS 2021-2022 = Fall 2022 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ime000az0ti9ts1sd20';

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
  if (!school)
    throw new Error(`School ${SCHOOL_ID} (Colorado School of Mines) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(
    `  isPrivate=${school.isPrivate}  [PUBLIC institution, but CDS C1 lacks residency table]`,
  );
  console.log(
    `  current AR=${school.acceptanceRate?.toString()} sat25=${school.sat25} sat75=${school.sat75}`,
  );
  console.log(
    `  current intlAR=${school.intlAcceptanceRate?.toString()} oosAR=${school.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${school.edAcceptanceRate?.toString() ?? 'null'} eaAR=${school.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-colorado-mines-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 58.0,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2021-22 Section C1: 6,314 admits / 10,886 applicants = 58.0195% (rounded to 58.00%). LARGE UPWARD CORRECTION from prior LEGACY_DB value 18.47 (likely from a stale or cross-school source). Tier upgraded LEGACY_DB -> OFFICIAL. NOTE: Mines is most recent CDS is 2021-22 (CDS23); no newer CDS published.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1340,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2021-22 Section C9: SAT Composite 25th = 1340 (reported directly). CORRECTION UP +30 from prior 1310 (LEGACY_DB). Tier upgraded LEGACY_DB -> OFFICIAL. 45% of Fall 2022 enrolled (686 students) submitted SAT.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1460,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2021-22 Section C9: SAT Composite 75th = 1460 (reported directly). Value matches prior DB; tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2021-22 Section C1 does NOT publish a residency breakdown for first-time, first-year applicants/admits. Section B2 only reports enrolled nonresidents (22 of 1,515 first-year enrolled) which is yield-side enrollment, not applied/admit. Per closure-pipeline convention "C1 residency empty -> UNAVAILABLE/OFFICIAL_BLANK_SECTION", field cleared. Prior LEGACY_DB value 7.02 retired as not sourceable from authoritative CDS.',
      realDataStatus: 'NOT_REPORTED_IN_CDS',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2021-22 Section C1 does NOT publish a residency breakdown for first-time, first-year applicants/admits. Even though Mines is a PUBLIC institution (CSM is a Colorado state school where OOS distinction has tuition/policy meaning), the CDS itself omits the residency table. Per closure-pipeline convention "C1 residency empty -> UNAVAILABLE/OFFICIAL_BLANK_SECTION", field cleared. Prior LEGACY_DB value 24.25 retired as not sourceable from authoritative CDS.',
      realDataStatus: 'NOT_REPORTED_IN_CDS',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2021-22 Section C21: "Yes" — Mines DOES offer Early Decision (closing 11/1, notification 12/21). However the Fall 2022 ED applicants/admits cells on the CDS form are BLANK (institution chose not to publish the round counts). Field stays null marked UNAVAILABLE/OFFICIAL_BLANK_SECTION. hasEarlyDecision=true retained per CDS C21 "Yes".',
      realDataStatus: 'OFFERED_NOT_PUBLISHED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2021-22 Section C22: "No" — Mines does NOT offer a nonbinding Early Action plan. Field stays null marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED. Replaces prior NO_PUBLIC_ROUND_RATE/TERMINAL provenance.',
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

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('58.00'),
      sat25: 1340,
      sat75: 1460,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      hasEarlyDecision: true, // CDS C21 "Yes"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=58.00, sat25=1340, sat75=1460, intlAR=BLANK, oosAR=BLANK, edAR=BLANK, eaAR=NOT_OFFERED, hasED=true)',
  );

  // verify
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
    `  AR=${after?.acceptanceRate?.toString()} sat25=${after?.sat25} sat75=${after?.sat75}`,
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
