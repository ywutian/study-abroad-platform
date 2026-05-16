#!/usr/bin/env tsx
/**
 * Phase 3 (batch20) — Iowa State University end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: Iowa State University CDS 2024-2025, published by Office of
 *   Institutional Research, Iowa State University.
 *   URL: https://www.ir.iastate.edu/files/documents/cds/CDS-24-25.pdf
 *   Index: https://www.ir.iastate.edu/common-data-set
 *
 * NOTE: Iowa State is a PUBLIC institution (Iowa land-grant flagship).
 *   isPrivate=false → oosAcceptanceRate is in eligible scope and carries a
 *   real OFFICIAL number from CDS C1 residency table.
 *
 * IMPORTANT: Prior DB provenance pointed sourceUrl at the University of Iowa
 *   CDS PDF (provost.uiowa.edu/.../cds_2425_0.pdf), which is a DIFFERENT
 *   institution. The legacy values (AR=83.62, intlAR=44.32, oosAR=85.30)
 *   were taken from U of Iowa, not Iowa State, so this is a corrective
 *   rewrite with the correct CDS PDF for Iowa State.
 *
 * Test policy: Iowa State is test-optional (CDS C8A: "Not required for
 *   admission, but considered if submitted" for SAT/ACT). 13% submitted SAT
 *   (n=791), 46% submitted ACT (n=2698). Per closure-pipeline convention,
 *   reported CDS C9 SAT Composite percentiles are still recorded as
 *   OFFICIAL for descriptive applicant-profile use.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 83.62 → 88.66  (CDS 2024-25 C1: 20,475 admits /
 *                          23,095 applicants = 88.6555% (rounded to 88.66%).
 *                          BIG UPWARD CORRECTION from prior 83.62 which was
 *                          U of Iowa's value (wrong-institution URL in
 *                          legacy provenance). Tier LEGACY_DB → OFFICIAL.)
 *   - sat25             : 1130 → 1130   (CDS 2024-25 C9: SAT Composite 25th
 *                          = 1130 (reported directly per closure policy
 *                          "C9 优先 Composite"; EBRW 560 + Math 560 sum =
 *                          1120 differs slightly because composite quantiles
 *                          ≠ section sums). Value matches prior DB exactly;
 *                          provenance refreshed CDS_PDF_AUTO/prepscholar
 *                          (wrong URL) → CDS_OFFICIAL with correct ISU PDF.)
 *   - sat75             : 1350 → 1350   (CDS 2024-25 C9: SAT Composite 75th
 *                          = 1350 (reported directly; EBRW 670 + Math 690
 *                          sum = 1360 differs because composite quantiles ≠
 *                          section sums). Value matches prior DB exactly;
 *                          provenance refreshed CDS_PDF_AUTO/prepscholar →
 *                          CDS_OFFICIAL with correct ISU PDF.)
 *   - intlAcceptanceRate: 44.32 → 68.39  (CDS 2024-25 C1 residency table:
 *                          2,250 international admits / 3,290 international
 *                          applicants = 68.3891% (rounded to 68.39%). BIG
 *                          UPWARD CORRECTION from prior 44.32 (U of Iowa
 *                          value). Tier LEGACY_DB → OFFICIAL.)
 *   - oosAcceptanceRate : 85.30 → 91.47  (CDS 2024-25 C1 residency table:
 *                          12,951 out-of-state admits / 14,159 out-of-state
 *                          applicants = 91.4683% (rounded to 91.47%). Iowa
 *                          State is a PUBLIC land-grant flagship → in-state
 *                          vs. OOS distinction carries real policy meaning,
 *                          so this field is in eligible scope and MUST
 *                          carry a real CDS number. UPWARD CORRECTION from
 *                          prior 85.30 (U of Iowa value). Tier LEGACY_DB →
 *                          OFFICIAL.)
 *   - edAcceptanceRate  : null  → null   (CDS 2024-25 C21: "Does your
 *                          institution offer an early decision plan?" — NO
 *                          (X in No box). Iowa State does NOT offer Early
 *                          Decision. Field stays cleared, refreshed from
 *                          prior CDS_LLM_EXTRACT_2026_04 (wrong-institution
 *                          URL) to authoritative UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION/NOT_OFFERED with correct
 *                          ISU CDS URL.)
 *   - eaAcceptanceRate  : null  → null   (CDS 2024-25 C22: "Do you have a
 *                          nonbinding early action plan?" — NO (X in No
 *                          box). Iowa State does NOT offer Early Action.
 *                          Refreshed from prior CDS_LLM_EXTRACT_2026_04
 *                          (wrong-institution URL) to authoritative
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *
 * NOTE on hasEarlyDecision: current DB value is true, but CDS C21 is NO.
 *   hasEarlyDecision is OUTSIDE the 7-field scope; leaving as-is per task
 *   convention (don't touch already-closed/non-prediction fields).
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL = 'https://www.ir.iastate.edu/files/documents/cds/CDS-24-25.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ipc001pz0tiz0bgth66';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Iowa State) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate} (public)`);
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
    verifiedBy: 'closure-pipeline-phase3-batch20-claude',
    generatedBy: 'phase3-batch20-iowa-state-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 88.66,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1 (Iowa State University): 20,475 admits / 23,095 applicants = 88.6555% (rounded to 88.66%). BIG UPWARD CORRECTION from prior 83.62 — prior LEGACY_DB sourceUrl pointed at provost.uiowa.edu (University of Iowa CDS), a different institution. Tier upgraded LEGACY_DB → OFFICIAL with correct Iowa State CDS PDF.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1130,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1130 (reported directly per closure policy "C9 优先 Composite"; EBRW 560 + Math 560 sum = 1120 differs because composite quantiles ≠ section sums). Value matches prior DB exactly; provenance refreshed from CDS_PDF_AUTO (wrong-institution prepscholar URL) → CDS_OFFICIAL with correct ISU CDS PDF. Iowa State is test-optional (CDS C8A "Not required for admission, but considered if submitted"); 13% submitted SAT (n=791); SAT band is descriptive applicant-profile use only.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1350,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1350 (reported directly per closure policy "C9 优先 Composite"; EBRW 670 + Math 690 sum = 1360 differs because composite quantiles ≠ section sums). Value matches prior DB exactly; provenance refreshed from CDS_PDF_AUTO (wrong-institution prepscholar URL) → CDS_OFFICIAL with correct ISU CDS PDF. Iowa State is test-optional.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 68.39,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 2,250 international admits / 3,290 international applicants = 68.3891% (rounded to 68.39%). BIG UPWARD CORRECTION from prior 44.32 — prior LEGACY_DB used U of Iowa value (wrong institution). Tier upgraded LEGACY_DB → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 91.47,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 12,951 out-of-state admits / 14,159 out-of-state applicants = 91.4683% (rounded to 91.47%). Iowa State is a PUBLIC land-grant flagship — in-state vs. OOS distinction carries real policy meaning (different tuition tiers), so this field is in eligible scope and MUST carry a real CDS number. UPWARD CORRECTION from prior 85.30 (U of Iowa value, wrong institution). Tier upgraded LEGACY_DB → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO (X marked in No box). Iowa State does NOT offer Early Decision (ED dates blank, ED applicant/admit counts blank). NOTE: DB has hasEarlyDecision=true which contradicts CDS; field is OUTSIDE the 7 prediction-critical scope so left untouched per task instructions. Provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 (wrong-institution URL) to authoritative UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED with correct ISU CDS URL.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO (X marked in No box). Iowa State does NOT offer Early Action (EA dates blank). Provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 (wrong-institution URL) to authoritative UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED with correct ISU CDS URL.',
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
  // Per task scope: don't overwrite already-closed/non-prediction fields like hasEarlyDecision.
  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('88.66'),
      sat25: 1130,
      sat75: 1350,
      intlAcceptanceRate: new Prisma.Decimal('68.39'),
      oosAcceptanceRate: new Prisma.Decimal('91.47'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=88.66, sat25=1130, sat75=1350, intlAR=68.39, oosAR=91.47, edAR=NOT_OFFERED, eaAR=NOT_OFFERED)',
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
