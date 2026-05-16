#!/usr/bin/env tsx
/**
 * Phase 3 — University of Cincinnati (UC, Clifton) end-to-end closure of
 * the 7 prediction-critical fields.
 *
 * Source: University of Cincinnati Common Data Set 2024-2025 (Fall 2024
 *   entering class) — Clifton campus, posted by UC Office of Institutional
 *   Research, last updated 07/21/2025.
 *   PDF: https://www.uc.edu/content/dam/refresh/provost-62/offices/ir/2025-2026ay/CDS-2024-2025-University%20of%20Cincinnati%20Clifton%20FINAL%20Update%2007212 5%20Tuition%20Information.pdf
 *
 * NOTE: Prior DB provenance correctly pointed to the same UC IR-hosted CDS
 *   PDF for residency-derived fields (intlAR/oosAR), so values are largely
 *   correct. However sat25/sat75 (1160/1350) had a sourceUrl pointing to
 *   clastify.com (third-party blog) — replaced with authoritative UC CDS C9.
 *   edAR/eaAR provenance had CDS_LLM_EXTRACT_2026_04 tier OFFICIAL — replaced
 *   with verified C21/C22 reads.
 *
 * Institution facts:
 *   - PUBLIC research university (state of Ohio), ~28,000 undergraduates
 *   - In-state vs. out-of-state distinction carries real policy meaning
 *     (different tuition: ~$13,244 in-state vs. ~$28,470 OOS for 2024-25;
 *     residency-based pathways) → oosAR is in eligible scope and CARRIES a
 *     REAL CDS NUMBER (NOT marked TERMINAL).
 *   - UC is TEST-OPTIONAL (CDS C8A: "Not required for admission, but
 *     considered if submitted"). C9 SAT percentiles recorded as OFFICIAL for
 *     descriptive applicant-profile use (not as a gating threshold).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 85.29  → 85.29   (CDS 2024-25 C1: 29,242 admits /
 *                          34,285 applicants = 85.2879% (rounded 85.29%). No
 *                          value change; tier upgraded LEGACY_DB → OFFICIAL.)
 *   - sat25             : 1160   → 1160    (CDS 2024-25 C9: SAT Composite
 *                          25th = 1160 reported. No value change. Tier was
 *                          already OFFICIAL but sourceUrl pointed to
 *                          clastify.com (third-party blog); replaced with
 *                          authoritative UC IR-hosted CDS PDF.)
 *   - sat75             : 1350   → 1350    (CDS 2024-25 C9: SAT Composite
 *                          75th = 1350 reported. Same — value unchanged,
 *                          sourceUrl corrected.)
 *   - intlAcceptanceRate: 68.96  → 68.96   (CDS 2024-25 C1 residency: 2,006
 *                          intl admits / 2,909 intl applicants = 68.9584%
 *                          (rounded 68.96%). No value change; tier upgraded
 *                          LEGACY_DB → OFFICIAL.)
 *   - oosAcceptanceRate : 83.37  → 83.37   (CDS 2024-25 C1 residency: 9,343
 *                          OOS admits / 11,206 OOS applicants = 83.3750%
 *                          (rounded 83.37%). No value change; tier upgraded
 *                          LEGACY_DB → OFFICIAL. NOTE: UC is a PUBLIC
 *                          institution; OOS distinction carries policy meaning,
 *                          oosAR is in eligible scope, carries a REAL CDS
 *                          number (NOT TERMINAL).)
 *   - edAcceptanceRate  : null   → null    (CDS 2024-25 C21: "Does your
 *                          institution offer an early decision plan?" — NO
 *                          checked (✔). UC does NOT offer Early Decision.
 *                          Field stays cleared. Provenance refreshed from
 *                          CDS_LLM_EXTRACT_2026_04 to authoritative
 *                          CDS_OFFICIAL pull marked UNAVAILABLE/NOT_OFFERED.)
 *   - eaAcceptanceRate  : null   → null    (CDS 2024-25 C22: "Do you have a
 *                          nonbinding early action plan?" — NO checked (✔).
 *                          UC does NOT offer Early Action. Field stays cleared.
 *                          Provenance refreshed from CDS_LLM_EXTRACT_2026_04
 *                          to authoritative CDS_OFFICIAL pull marked
 *                          UNAVAILABLE/NOT_OFFERED.)
 *
 * hasEarlyDecision correction: DB shows true; CDS C21 = No → setting to false.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const UC_CDS_URL =
  'https://www.uc.edu/content/dam/refresh/provost-62/offices/ir/2025-2026ay/CDS-2024-2025-University%20of%20Cincinnati%20Clifton%20FINAL%20Update%20072125%20Tuition%20Information.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ipt001uz0tivghae5e1';

const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findUnique({
    where: { id: SCHOOL_ID },
    select: {
      id: true,
      name: true,
      isPrivate: true,
      hasEarlyDecision: true,
      dataReviewStatus: true,
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
    throw new Error(`School ${SCHOOL_ID} (University of Cincinnati) not found`);
  if (school.dataReviewStatus === 'REJECTED') {
    console.log(
      `Skipping closed/rejected school ${school.name} (status=${school.dataReviewStatus})`,
    );
    return;
  }
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC research university]`);
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
    sourceUrl: UC_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-cincinnati-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 85.29,
      policyLabel: 'Overall admit rate',
      reason:
        'University of Cincinnati CDS 2024-25 (Fall 2024 entering class, Clifton campus) Section C1: TOTAL applicants 34,285; TOTAL admits 29,242; TOTAL enrolled 6,584. AR = 29,242 / 34,285 = 85.2879% (rounded to 85.29%). No value change vs prior LEGACY_DB 85.29; tier upgraded LEGACY_DB → OFFICIAL with full extraction.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1160,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'UC CDS 2024-25 Section C9: SAT Composite 25th = 1160 (reported directly). No value change; CORRECTION: prior tier was OFFICIAL but sourceUrl pointed to clastify.com (third-party blog, source=CDS_PDF_AUTO mis-labeled); replaced with authoritative UC IR-hosted CDS PDF. 10.59% of Fall 2024 enrolled (697 students) submitted SAT under UC test-optional policy. NOTE: UC is test-optional (CDS C8A: "Not required for admission, but considered if submitted"); SAT band is recorded for descriptive applicant-profile use only.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1350,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'UC CDS 2024-25 Section C9: SAT Composite 75th = 1350 (reported directly). No value change; sourceUrl corrected from clastify.com (third-party) to authoritative UC IR-hosted CDS PDF.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 68.96,
      policyLabel: 'International admit rate',
      reason:
        'UC CDS 2024-25 Section C1 residency table: 2,006 international admits / 2,909 international applicants = 68.9584% (rounded to 68.96%). No value change vs prior LEGACY_DB 68.96; tier upgraded LEGACY_DB → OFFICIAL with full extraction.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 83.37,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'University of Cincinnati is a PUBLIC research university (state of Ohio); in-state/out-of-state distinction carries real policy meaning (different tuition: ~$13,244 in-state vs. ~$28,470 OOS for 2024-25; residency-based pathways). oosAR is in eligible scope and carries a REAL CDS number (NOT TERMINAL). CDS 2024-25 Section C1 residency table: 9,343 OOS admits / 11,206 OOS applicants = 83.3750% (rounded to 83.37%). No value change vs prior LEGACY_DB 83.37; tier upgraded LEGACY_DB → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'UC CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked (✔). University of Cincinnati does NOT offer Early Decision. DB value already null; provenance refreshed from CDS_LLM_EXTRACT_2026_04 to authoritative CDS_OFFICIAL pull marked UNAVAILABLE/NOT_OFFERED. Stale hasEarlyDecision=true flag corrected to false.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'UC CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked (✔). University of Cincinnati does NOT offer Early Action. DB value already null; provenance refreshed from CDS_LLM_EXTRACT_2026_04 to authoritative CDS_OFFICIAL pull marked UNAVAILABLE/NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(school.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: UC_CDS_URL,
  };

  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('85.29'),
      sat25: 1160,
      sat75: 1350,
      intlAcceptanceRate: new Prisma.Decimal('68.96'),
      oosAcceptanceRate: new Prisma.Decimal('83.37'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — UC does NOT offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=85.29, sat25=1160, sat75=1350, intlAR=68.96, oosAR=83.37, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
