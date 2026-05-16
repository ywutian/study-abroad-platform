#!/usr/bin/env tsx
/**
 * Phase 3 — George Mason University (GMU) end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: GMU CDS 2025-2026 (Fall 2025 entering class) — posted Feb 2026 by
 *   the Office of Institutional Effectiveness and Planning (OIEP).
 *   URL: https://oiep.gmu.edu/wp-content/uploads/2026/02/CDS-PDF-2025-2026_PDF_Template_Final_02_19.pdf
 *   Index: https://institutionalresearch.gmu.edu/common-data-set
 *
 * GMU is a PUBLIC research university in Virginia (largest public research
 *   university in the Commonwealth of Virginia):
 *   - isPrivate=false  ->  oosAcceptanceRate is in eligible scope, MUST carry
 *     a real OFFICIAL number from CDS C1 residency table.
 *
 * GMU is test-optional / "Score Optional" per CDS C8A (SAT/ACT marked
 *   "Not required for admission, but consider if submitted"). SAT band is
 *   still recorded as OFFICIAL for descriptive applicant-profile use.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 87.5   -> 86.47  (CDS 2025-26 C1: 22,495 admits /
 *                          26,014 applicants = 86.4727%. Minor downward
 *                          adjustment, tier LEGACY_DB->OFFICIAL.)
 *   - sat25             : 1170   -> 1180   (CDS 2025-26 C9: SAT Composite
 *                          25th = 1180. CORRECTION UP from prior 1170.
 *                          Tier corrected: previous OFFICIAL/CDS_PDF_AUTO
 *                          pointed to prepscholar URL — replaced with
 *                          authoritative GMU CDS source.)
 *   - sat75             : 1350   -> 1360   (CDS 2025-26 C9: SAT Composite
 *                          75th = 1360. CORRECTION UP from prior 1350. Same
 *                          URL correction.)
 *   - intlAcceptanceRate: 83.13  -> null   (CDS 2025-26 C1 residency table:
 *                          GMU REPORTS BLANK for International column —
 *                          only IN-STATE (16,236/14,222) and OUT-OF-STATE
 *                          (9,778/8,273) values are populated; the
 *                          INTERNATIONAL column is empty. Prior 83.13 value
 *                          came from INFERRED/PERMANENT_HEURISTIC (non-CDS)
 *                          — DEMOTE to UNAVAILABLE/OFFICIAL_BLANK_SECTION
 *                          per closure pipeline convention. Field cleared.)
 *   - oosAcceptanceRate : 86.9   -> 84.61  (CDS 2025-26 C1 residency: 8,273
 *                          OOS admits / 9,778 OOS applicants = 84.6083%.
 *                          Minor downward correction. Tier LEGACY_DB->
 *                          OFFICIAL. GMU is a PUBLIC research university —
 *                          IS/OOS distinction is real policy meaning.)
 *   - edAcceptanceRate  : null   -> null   (CDS 2025-26 C21: "No" — GMU
 *                          does NOT offer Early Decision. Text confirms:
 *                          "George Mason does not offer an Early Decision
 *                          option. Only Early Action." Field stays cleared
 *                          (UNAVAILABLE/OFFICIAL_BLANK_SECTION). DB
 *                          hasEarlyDecision corrected from true to false.)
 *   - eaAcceptanceRate  : null   -> null   (CDS 2025-26 C22: "Yes" — GMU
 *                          offers a nonbinding EA plan (closing 11/1,
 *                          notification 12/16, non-restrictive). However,
 *                          CDS C22 admits/applicants fields are BLANK.
 *                          Stays UNAVAILABLE/OFFICIAL_BLANK_SECTION.
 *                          Provenance refreshed to 2025-26 cycle.)
 *
 * NOTE on hasEarlyDecision: existing DB has true; correct to false to match
 *   CDS C21 = No (GMU is EA-only, not ED).
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://oiep.gmu.edu/wp-content/uploads/2026/02/CDS-PDF-2025-2026_PDF_Template_Final_02_19.pdf';
const CYCLE_YEAR = 2025; // CDS 2025-2026 = Fall 2025 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ipz001xz0ti9f4tlagk';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (GMU) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC VA research univ]`);
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
    generatedBy: 'phase3-gmu-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 86.47,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2025-26 Section C1: 22,495 admits / 26,014 applicants = 86.4727% (rounded to 86.47%). Minor downward adjustment from prior LEGACY_DB value 87.5%. Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1180,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2025-26 Section C9: SAT Composite 25th = 1180 (reported directly). CORRECTION UP from prior 1170. Provenance corrected from CDS_PDF_AUTO (pointing to prepscholar.com — non-authoritative) to CDS_OFFICIAL with canonical GMU CDS URL. NOTE: GMU is test-optional / Score Optional per CDS C8A (SAT/ACT marked "Not required for admission, but consider if submitted"); SAT band is descriptive only.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1360,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2025-26 Section C9: SAT Composite 75th = 1360 (reported directly). CORRECTION UP from prior 1350. Provenance corrected from CDS_PDF_AUTO (prepscholar.com URL) to CDS_OFFICIAL with canonical GMU CDS URL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2025-26 Section C1 residency table: GMU reports only IN-STATE (16,236 apps / 14,222 admits) and OUT-OF-STATE (9,778 apps / 8,273 admits) columns; the INTERNATIONAL column is BLANK in the published document. Prior DB value 83.13% was sourced from INFERRED/PERMANENT_HEURISTIC (non-CDS) — DEMOTED to UNAVAILABLE/OFFICIAL_BLANK_SECTION per closure pipeline convention (CDS is canonical; non-CDS inference is not OFFICIAL). Field value cleared.',
      realDataStatus: 'NOT_PUBLISHED',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 84.61,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2025-26 Section C1 residency table: 8,273 out-of-state admits / 9,778 out-of-state applicants = 84.6083% (rounded to 84.61%). GMU is a PUBLIC research university (largest in Virginia) — in-state vs. out-of-state residency carries real policy meaning (different tuition, residency-preference pathways), so this field is in eligible scope and MUST carry a real CDS number. Minor downward correction from prior LEGACY_DB value 86.9%. Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2025-26 Section C21: "Does your institution offer an early decision plan?" — NO. CDS commentary confirms: "George Mason does not offer an Early Decision option. Only Early Action." Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). DB hasEarlyDecision corrected from true to false to match CDS. Provenance refreshed to 2025-26 cycle.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2025-26 Section C22: "Yes" — GMU offers a nonbinding Early Action plan (closing 11/1, notification 12/16, non-restrictive). However, the CDS C22 EA admits/applicants fields are BLANK in the published document. Stays UNAVAILABLE/OFFICIAL_BLANK_SECTION per closure pipeline convention (CDS section exists and is "Yes" but the per-section counts are not published). Field value cleared. Provenance refreshed to 2025-26 cycle.',
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
      acceptanceRate: new Prisma.Decimal('86.47'),
      sat25: 1180,
      sat75: 1360,
      intlAcceptanceRate: null,
      oosAcceptanceRate: new Prisma.Decimal('84.61'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — GMU does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=86.47, sat25=1180, sat75=1360, intlAR=NOT_PUBLISHED, oosAR=84.61, edAR=NOT_OFFERED, eaAR=NOT_PUBLISHED, hasED=false)',
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
