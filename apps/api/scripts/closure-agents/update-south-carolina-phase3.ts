#!/usr/bin/env tsx
/**
 * Phase 3 — University of South Carolina (Columbia) end-to-end closure of the
 * 7 prediction-critical fields.
 *
 * Source: USC (SC) CDS 2024-2025 (Fall 2024 entering class), Office of
 *   Institutional Research, Assessment, and Analytics.
 *   URL: http://oiraa.dw.sc.edu/cds/cds2024/cds_2024-2025.pdf
 *
 * USC South Carolina is a PUBLIC flagship research university (Columbia, SC).
 *   - isPrivate=false  ->  oosAcceptanceRate is in eligible scope and MUST
 *     carry a real OFFICIAL number extracted from CDS C1 residency table.
 *
 * Test policy (CDS C8A): TEST-OPTIONAL — SAT/ACT listed as "Not required
 *   for admission, but considered if submitted." Only 29% (2,141) submitted
 *   SAT, 15% (1,096) submitted ACT. SAT band still recorded per closure-
 *   pipeline convention (descriptive applicant-profile use, not gating).
 *
 * ED/EA (CDS C21/C22):
 *   - C21 Early Decision: "No" — USC SC does NOT offer ED.
 *     (Existing DB hasEarlyDecision=true is STALE — being corrected to false.)
 *   - C22 Early Action: "Yes" — USC SC offers nonbinding EA (closing 10/15).
 *     Non-restrictive. CDS C22 fields for "Number of EA applications received"
 *     and "Number admitted under EA" left BLANK by USC SC — admit counts not
 *     published. Per closure-pipeline convention: UNAVAILABLE/OFFICIAL_BLANK_SECTION.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 60.2   -> 60.15  (CDS 2024-25 C1: 31,701 admits /
 *                          52,703 applicants = 60.1503%. Tier upgraded
 *                          LEGACY_DB -> OFFICIAL. Minor precision adjustment.)
 *   - sat25             : 1180   -> 1190   (CDS 2024-25 C9: SAT Composite 25th
 *                          = 1190 reported directly. CORRECTION UP +10 from
 *                          prior 1180 (LEGACY_DB heuristic). USC SC test-
 *                          optional: 29% submitted SAT.)
 *   - sat75             : 1350   -> 1350   (CDS 2024-25 C9: SAT Composite 75th
 *                          = 1350 — matches prior. Tier upgraded LEGACY_DB ->
 *                          OFFICIAL with verified cycle/source.)
 *   - intlAcceptanceRate: 65.3   -> 65.32  (CDS 2024-25 C1 residency: 388
 *                          international admits / 594 international applicants
 *                          = 65.3199% (rounded to 65.32%). Tier upgraded
 *                          LEGACY_DB -> OFFICIAL. Minor precision adjustment.)
 *   - oosAcceptanceRate : 54.7   -> 54.72  (CDS 2024-25 C1 residency: 21,379
 *                          OOS admits / 39,067 OOS applicants = 54.7187%
 *                          (rounded to 54.72%). Tier upgraded LEGACY_DB ->
 *                          OFFICIAL. Minor precision adjustment. USC SC is a
 *                          PUBLIC flagship — oosAR carries a real number.)
 *   - edAcceptanceRate  : null   -> null   (CDS C21: "No" — USC SC does not
 *                          offer ED. Field stays cleared
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION. Provenance
 *                          refreshed to verified 2024-25 cycle pull.)
 *   - eaAcceptanceRate  : null   -> null   (CDS C22: "Yes" — USC SC offers EA
 *                          (closing 10/15) but admit counts NOT REPORTED in
 *                          CDS C22. Field stays cleared
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *
 * NOTE on hasEarlyDecision: current DB value is true, but CDS C21 is "No".
 *   Setting to false to match CDS reality.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL = 'http://oiraa.dw.sc.edu/cds/cds2024/cds_2024-2025.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8inv0014z0ti6jqhq1ga';

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
    throw new Error(
      `School ${SCHOOL_ID} (University of South Carolina) not found`,
    );
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC]`);
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
    generatedBy: 'phase3-south-carolina-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 60.15,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 31,701 admits / 52,703 applicants = 60.1503% (rounded to 60.15%). Tier upgraded from LEGACY_DB (value 60.2) to OFFICIAL with minor precision adjustment.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1190,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1190 (reported directly). CORRECTION UP +10 from prior 1180 (LEGACY_DB heuristic). NOTE: USC SC is test-optional (CDS C8A "Not required for admission, but considered if submitted") — only 29% (2,141) submitted SAT; SAT band recorded for descriptive applicant-profile use, not as a gating threshold.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1350,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1350 (reported directly) — matches prior DB value. Tier upgraded from LEGACY_DB to OFFICIAL with verified cycle/source. USC SC test-optional: 29% submitted SAT, 15% submitted ACT (ACT Composite 25/75 = 26/32). SAT band descriptive only.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 65.32,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 388 international admits / 594 international applicants = 65.3199% (rounded to 65.32%). Tier upgraded from LEGACY_DB (value 65.3) to OFFICIAL with minor precision adjustment.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 54.72,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 21,379 out-of-state admits / 39,067 out-of-state applicants = 54.7187% (rounded to 54.72%). USC SC is a PUBLIC flagship — in-state vs. out-of-state distinction carries real policy meaning (different tuition; in-state cohort: 9,934/13,042 = 76.17% admit). Tier upgraded LEGACY_DB -> OFFICIAL with minor precision adjustment.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. USC SC does not offer Early Decision. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance refreshed to verified 2024-25 cycle pull. NOTE: existing DB hasEarlyDecision=true is STALE — being corrected to false in this update.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — YES checked (closing 10/15; non-restrictive). However, USC SC left the "Number of EA applications" and "Number admitted under EA" fields BLANK in CDS C22 — admit counts not reported. Marked UNAVAILABLE/OFFICIAL_BLANK_SECTION (EA program confirmed exists; admit numbers not officially published).',
      realDataStatus: 'NOT_REPORTED',
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
      acceptanceRate: new Prisma.Decimal('60.15'),
      sat25: 1190,
      sat75: 1350,
      intlAcceptanceRate: new Prisma.Decimal('65.32'),
      oosAcceptanceRate: new Prisma.Decimal('54.72'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — USC SC does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=60.15, sat25=1190, sat75=1350, intlAR=65.32, oosAR=54.72, edAR=NOT_OFFERED, eaAR=NOT_REPORTED, hasED=false)',
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
