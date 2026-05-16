#!/usr/bin/env tsx
/**
 * Phase 3 — Illinois State University (ISU) end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: ISU CDS 2024-2025 (Fall 2024 entering class), published by the
 *   Office of Planning, Research and Policy Analysis.
 *   URL: https://prpa.illinoisstate.edu/downloads/CDS-2024-2025_ISU_FINAL.pdf
 *   Landing: https://prpa.illinoisstate.edu/data-center/reports/
 *
 * ISU is PUBLIC (CDS A2 "Public" checked) — oosAR is in eligible scope and
 *   carries the real CDS number, not TERMINAL.
 *
 * ISU is TEST-OPTIONAL for Fall 2026 admission (CDS C8A: SAT/ACT "Not required
 *   for admission, but consider if submitted" — same row as test-considered).
 *   ~44% of enrolled freshmen submitted SAT (1,872 of 4,285). Per closure-pipeline
 *   convention, the CDS C9 SAT Composite percentiles are recorded as OFFICIAL
 *   (descriptive applicant-profile band; not a gating threshold).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 88.15 -> 88.15 (CDS 2024-25 C1: 19,017 admits /
 *                          21,573 first-time first-year applicants = 88.1518%.
 *                          NO CHANGE in value. Tier upgraded
 *                          VERIFIED_REAL/LEGACY_DB_VALUE -> OFFICIAL.)
 *   - sat25             : 1030  -> 1010  (CDS 2024-25 C9 SAT Composite 25th =
 *                          1010 (reported directly). DB value 1030 was stale;
 *                          correcting to CDS-reported 1010. Tier upgraded.
 *                          Replaces stale CDS_PDF_AUTO with clastify.com 3rd-party
 *                          URL.)
 *   - sat75             : 1220  -> 1210  (CDS 2024-25 C9 SAT Composite 75th =
 *                          1210 (reported directly). DB value 1220 was stale;
 *                          correcting to CDS-reported 1210. Tier upgraded.)
 *   - intlAcceptanceRate: 87.62 -> 87.62 (CDS 2024-25 C1 residency table: 375
 *                          intl admits / 428 intl applicants = 87.6168%
 *                          (rounded 87.62%). NO CHANGE in value. Tier upgraded
 *                          VERIFIED_REAL/LEGACY_DB_VALUE -> OFFICIAL.)
 *   - oosAcceptanceRate : 83.53 -> 83.53 (CDS 2024-25 C1 residency table: 969
 *                          OOS admits / 1,160 OOS applicants = 83.5345%
 *                          (rounded 83.53%). PUBLIC SCHOOL — oosAR is real
 *                          OFFICIAL. NO CHANGE in value. Tier upgraded.)
 *   - edAcceptanceRate  : null  -> null  (CDS 2024-25 C21: "No" — ISU does NOT
 *                          offer Early Decision. Replace prior provenance
 *                          (source=CDS_LLM_EXTRACT_2026_04 tier OFFICIAL despite
 *                          value=null + wrong sourceUrl pointing to Title II
 *                          Program Report) with explicit UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : null  -> null  (CDS 2024-25 C22: "No" — ISU does NOT
 *                          offer Early Action. Same correction as ED.)
 *
 * NOTE on hasEarlyDecision: current DB value is TRUE, but CDS C21 is "No".
 *   Setting to FALSE to match CDS reality.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://prpa.illinoisstate.edu/downloads/CDS-2024-2025_ISU_FINAL.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iqm0028z0ti63txqxzg';

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
      `School ${SCHOOL_ID} (Illinois State University) not found`,
    );
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC SCHOOL]`);
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
    verifiedBy: 'closure-pipeline-phase3-batch23-claude',
    generatedBy: 'phase3-illinois-state-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 88.15,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 19,017 admits / 21,573 first-time, first-year applicants = 88.1518% (rounded 88.15%). NO CHANGE in value — tier upgraded from VERIFIED_REAL/LEGACY_DB_VALUE to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1010,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1010 (reported directly). DB value 1030 was stale (prior CDS_PDF_AUTO source linked to clastify.com 3rd-party aggregator, not the official CDS). Corrected to CDS-reported 1010 and tier upgraded to OFFICIAL. NOTE: ISU is TEST-OPTIONAL (CDS C8A: SAT/ACT "Not required for admission, but consider if submitted"); 43.69% of enrolled freshmen (1,872) submitted SAT — SAT band is recorded for descriptive applicant-profile use only, not as a gating threshold.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1210,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1210 (reported directly). DB value 1220 was stale (prior CDS_PDF_AUTO source linked to clastify.com 3rd-party aggregator). Corrected to CDS-reported 1210 and tier upgraded to OFFICIAL. Same test-optional caveat as sat25.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 87.62,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 375 international admits / 428 international applicants = 87.6168% (rounded 87.62%). NO CHANGE in value — tier upgraded from VERIFIED_REAL/LEGACY_DB_VALUE to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 83.53,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 969 out-of-state admits / 1,160 out-of-state applicants = 83.5345% (rounded 83.53%). ISU is a PUBLIC regional research university (Normal, IL) — in-state vs. out-of-state distinction carries policy meaning (different tuition $12,066 vs $24,132). NO CHANGE in value — tier upgraded from VERIFIED_REAL/LEGACY_DB_VALUE to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. ISU does NOT offer Early Decision. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Replaces prior provenance (source=CDS_LLM_EXTRACT_2026_04 marked OFFICIAL despite value=null + sourceUrl wrongly pointing to a Title II Program Report unrelated to ED). Also corrects stale hasEarlyDecision=true.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. ISU does NOT offer Early Action. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Replaces prior CDS_LLM_EXTRACT_2026_04 misattribution to Title II Program Report.',
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
      acceptanceRate: new Prisma.Decimal('88.15'),
      sat25: 1010,
      sat75: 1210,
      intlAcceptanceRate: new Prisma.Decimal('87.62'),
      oosAcceptanceRate: new Prisma.Decimal('83.53'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — ISU does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=88.15, sat25=1010, sat75=1210, intlAR=87.62, oosAR=83.53, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
