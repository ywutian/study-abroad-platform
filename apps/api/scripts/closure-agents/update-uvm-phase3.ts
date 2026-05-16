#!/usr/bin/env tsx
/**
 * Phase 3 — University of Vermont (UVM) end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: UVM CDS 2025-2026 (Fall 2025 entering class) — posted Feb 2026 by
 *   the Office of Institutional Research and Assessment.
 *   URL: https://www.uvm.edu/d10-files/documents/2026-02/Common_Data_Set_2025-2026.pdf
 *   Index: https://www.uvm.edu/oira/common-data-set
 *
 * UVM (The University of Vermont and State Agricultural College) is the
 *   flagship PUBLIC research university of Vermont:
 *   - isPrivate=false  ->  oosAcceptanceRate is in eligible scope, MUST carry
 *     a real OFFICIAL number from CDS C1 residency table.
 *
 * UVM is test-optional per CDS C8A (SAT/ACT marked "Not required for
 *   admission, but considered if submitted"). SAT band is still recorded as
 *   OFFICIAL for descriptive applicant-profile use.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 65.3   -> 73.05  (CDS 2025-26 C1: 18,576 admits /
 *                          25,434 applicants = 73.0518%. SIGNIFICANT UPWARD
 *                          CORRECTION — applicant pool grew while admit rate
 *                          rose. Tier LEGACY_DB->OFFICIAL.)
 *   - sat25             : 1290   -> 1300   (CDS 2025-26 C9: SAT Composite
 *                          25th = 1300. CORRECTION UP from prior 1290
 *                          (SEED/HEURISTIC:PR-15). Tier SEED->OFFICIAL.)
 *   - sat75             : 1440   -> 1430   (CDS 2025-26 C9: SAT Composite
 *                          75th = 1430. CORRECTION DOWN from prior 1440
 *                          (SEED/HEURISTIC:PR-15). Tier SEED->OFFICIAL.)
 *   - intlAcceptanceRate: 34.9   -> 30.44  (CDS 2025-26 C1 residency: 390
 *                          intl admits / 1,281 intl applicants = 30.4450%.
 *                          CORRECTION DOWN from prior 34.9 (LEGACY_DB,
 *                          earlier cycle). Tier LEGACY_DB->OFFICIAL.)
 *   - oosAcceptanceRate : 65.7   -> 75.18  (CDS 2025-26 C1 residency: 16,695
 *                          OOS admits / 22,205 OOS applicants = 75.1830%.
 *                          SIGNIFICANT UPWARD CORRECTION from prior 65.7%
 *                          (LEGACY_DB, earlier cycle). UVM is a PUBLIC
 *                          flagship — IS/OOS distinction is real policy
 *                          meaning (different tuition, residency-preference
 *                          pathways). Tier LEGACY_DB->OFFICIAL.)
 *   - edAcceptanceRate  : 93.74  -> 91.67  (CDS 2025-26 C21: "Yes" — UVM
 *                          offers ED (closing Nov 1, notification Dec 1).
 *                          363 ED admits / 396 ED apps = 91.6667% (rounded to
 *                          91.67%). CORRECTION DOWN from prior 93.74
 *                          (LEGACY_DB, earlier cycle). Tier LEGACY_DB->
 *                          OFFICIAL.)
 *   - eaAcceptanceRate  : null   -> null   (CDS 2025-26 C22: "Yes" — UVM
 *                          offers a nonbinding EA plan (closing 11/1,
 *                          notification late December, non-restrictive).
 *                          However, CDS C22 admits/applicants fields are
 *                          BLANK in the published document. Marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION per closure
 *                          pipeline convention.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.uvm.edu/d10-files/documents/2026-02/Common_Data_Set_2025-2026.pdf';
const CYCLE_YEAR = 2025; // CDS 2025-2026 = Fall 2025 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ipx001wz0timhlbfii2';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UVM) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC VT flagship]`);
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
    generatedBy: 'phase3-uvm-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 73.05,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2025-26 Section C1: 18,576 admits / 25,434 applicants = 73.0518% (rounded to 73.05%). SIGNIFICANT UPWARD CORRECTION from prior LEGACY_DB value 65.3% (earlier cycle). Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1300,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2025-26 Section C9: SAT Composite 25th = 1300 (reported directly on the SAT Composite row). CORRECTION UP from prior 1290 (SEED tier, HEURISTIC:PR-15). NOTE: UVM is test-optional per CDS C8A (SAT/ACT marked "Not required for admission, but considered if submitted"); SAT band is descriptive only.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1430,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2025-26 Section C9: SAT Composite 75th = 1430 (reported directly on the SAT Composite row). CORRECTION DOWN from prior 1440 (SEED tier, HEURISTIC:PR-15). Tier SEED -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 30.44,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2025-26 Section C1 residency table: 390 international admits / 1,281 international applicants = 30.4450% (rounded to 30.44%). CORRECTION DOWN from prior LEGACY_DB value 34.9% (earlier cycle). Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 75.18,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2025-26 Section C1 residency table: 16,695 out-of-state admits / 22,205 out-of-state applicants = 75.1830% (rounded to 75.18%). UVM is the flagship PUBLIC research university of Vermont — in-state vs. out-of-state residency carries real policy meaning (different tuition, residency-preference pathways), so this field is in eligible scope and MUST carry a real CDS number. SIGNIFICANT UPWARD CORRECTION from prior LEGACY_DB value 65.7% (earlier cycle). Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 91.67,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2025-26 Section C21: "Yes" — UVM offers Early Decision (closing Nov 1, notification Dec 1). 363 ED admits / 396 ED applications received = 91.6667% (rounded to 91.67%). CORRECTION DOWN from prior LEGACY_DB value 93.74 (earlier cycle). Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2025-26 Section C22: "Yes" — UVM offers a nonbinding Early Action plan (closing 11/1, notification late December, non-restrictive). However, the CDS C22 EA admits/applicants fields are BLANK in the published document. Marked UNAVAILABLE/OFFICIAL_BLANK_SECTION per closure pipeline convention (CDS section exists and is "Yes" but the per-section counts are not published). Field value cleared.',
      realDataStatus: 'NOT_PUBLISHED',
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
      acceptanceRate: new Prisma.Decimal('73.05'),
      sat25: 1300,
      sat75: 1430,
      intlAcceptanceRate: new Prisma.Decimal('30.44'),
      oosAcceptanceRate: new Prisma.Decimal('75.18'),
      edAcceptanceRate: new Prisma.Decimal('91.67'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true, // UVM does offer ED per CDS C21; existing DB true is correct
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=73.05, sat25=1300, sat75=1430, intlAR=30.44, oosAR=75.18, edAR=91.67, eaAR=NOT_PUBLISHED, hasED=true)',
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
