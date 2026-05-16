#!/usr/bin/env tsx
/**
 * Phase 3 — Boston University end-to-end closure of the 7 prediction-critical
 * fields.
 *
 * Source: BU CDS 2024-2025 (Fall 2024 entering class, updated section I).
 *   URL: https://www.bu.edu/asir/files/2026/04/CDS_2024_25-updated-sect-I.pdf
 *
 * NOTE: BU is a PRIVATE (nonprofit) institution (CDS A2 "Private (nonprofit)").
 *   - isPrivate=true  ->  oosAcceptanceRate marked UNAVAILABLE/TERMINAL per
 *     closure-pipeline convention for private schools.
 *   - intlAcceptanceRate: CDS C1 has NO residency breakdown at all — only the
 *     gender totals (Applied/Admitted/Enrolled). No in-state/OOS/intl split is
 *     published. So intlAR cannot be derived from CDS; marked UNAVAILABLE/
 *     TERMINAL (private school + CDS does not publish residency).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 10.7  -> 11.11  (CDS 2024-25 C1: 8,749 admits /
 *                          78,769 applicants = 11.1071% (rounded to 11.11%).
 *                          Minor correction UP +0.41pp from prior LEGACY_DB.
 *                          Tier LEGACY_DB->OFFICIAL.)
 *   - sat25             : 1390  -> 1430   (CDS 2024-25 C9: SAT Composite 25th =
 *                          1430 reported directly. CORRECTION UP +40 from prior
 *                          1390 (SEED/PR-15 heuristic). 33% of Fall 2024 enrolled
 *                          (1,083 students) submitted SAT under test-optional.)
 *   - sat75             : 1510  -> 1510   (CDS 2024-25 C9: SAT Composite 75th =
 *                          1510 reported directly. Matches prior DB value
 *                          exactly. Tier LEGACY_DB->OFFICIAL.)
 *   - intlAcceptanceRate: 10.17 -> null   (BU CDS 2024-25 C1 has NO residency
 *                          breakdown — only total applicants/admits by gender,
 *                          no in-state/OOS/intl split is published. Prior value
 *                          10.17 was a PERMANENT_HEURISTIC INFERRED estimate.
 *                          Per closure-pipeline convention for private schools
 *                          without published residency: clear to null and mark
 *                          UNAVAILABLE/TERMINAL.)
 *   - oosAcceptanceRate : 9.63  -> null   (Private school + no published
 *                          residency in CDS. Prior 9.63 was PERMANENT_HEURISTIC
 *                          INFERRED. Cleared per private-school convention,
 *                          marked UNAVAILABLE/TERMINAL.)
 *   - edAcceptanceRate  : 28.25 -> 28.25  (CDS 2024-25 C21: ED offered ("Yes"
 *                          checked); two plans — ED I closes 11/1 (12/15
 *                          notification), ED II closes 1/5 (2/15 notification).
 *                          Fall 2024 combined totals: 1,936 admits / 6,854 ED
 *                          applications = 28.2463% (rounded to 28.25%). Value
 *                          matches prior DB; tier LEGACY_DB->OFFICIAL.)
 *   - eaAcceptanceRate  : null  -> null   (CDS 2024-25 C22: BU does NOT offer a
 *                          nonbinding Early Action plan ("No" checked). Field
 *                          stays null. Existing tier=UNAVAILABLE source=
 *                          OFFICIAL_BLANK_SECTION; provenance refreshed to
 *                          authoritative CDS pull.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.bu.edu/asir/files/2026/04/CDS_2024_25-updated-sect-I.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmn1htkpw0016vqf20t0lflxm';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (BU) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate} (private nonprofit)`);
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
    generatedBy: 'phase3-bu-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 11.11,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 8,749 admits / 78,769 applicants = 11.1071% (rounded to 11.11%). Minor CORRECTION UP +0.41pp from prior LEGACY_DB value 10.7. Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1430,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1430 (reported directly; EBRW 690 + Math 730 sum = 1420 differs because composite quantiles ≠ section sums). CORRECTION UP +40 from prior 1390 (SEED/PR-15 heuristic). BU is test-optional through Fall 2028; 33% of Fall 2024 enrolled (1,083 students) submitted SAT.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1510,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1510 (reported directly; EBRW 750 + Math 780 sum = 1530 differs because composite quantiles ≠ section sums). Matches prior DB value 1510 exactly. Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'BU CDS 2024-25 Section C1 has NO residency breakdown — only gender totals (Applied/Admitted/Enrolled) are published; no in-state/OOS/international split. Prior DB value 10.17 was a PERMANENT_HEURISTIC INFERRED estimate (not derived from CDS). Per closure-pipeline convention for private institutions without published residency data: clear to null and mark UNAVAILABLE-terminal.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'BU is a private (nonprofit) institution (CDS A2 "Private"); in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS 2024-25 C1 also has no residency breakdown to extract from. Prior DB value 9.63 was PERMANENT_HEURISTIC INFERRED. Cleared per closure-pipeline private-school convention, marked UNAVAILABLE-terminal.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 28.25,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2024-25 Section C21: BU offers Early Decision ("Yes" checked) with two plans — ED I closes 11/1 (12/15 notification), ED II closes 1/5 (2/15 notification). Fall 2024 combined totals: 1,936 admits / 6,854 ED applications = 28.2463% (rounded to 28.25%). Value matches prior DB; tier upgraded LEGACY_DB -> OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: BU does NOT offer a nonbinding Early Action plan ("No" checked). Field stays null. Provenance refreshed to authoritative CDS pull marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
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
      acceptanceRate: new Prisma.Decimal('11.11'),
      sat25: 1430,
      sat75: 1510,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('28.25'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true, // re-confirm from CDS C21 "Yes"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=11.11, sat25=1430, sat75=1510, intlAR=N/A, oosAR=N/A, edAR=28.25, eaAR=NOT_OFFERED)',
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
