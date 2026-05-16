#!/usr/bin/env tsx
/**
 * Phase 3 — Texas Tech University (Lubbock, TX) end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: Texas Tech University Common Data Set 2024-2025 (Fall 2024 entering
 *   class) published by Office of Institutional Research.
 *   PDF: https://www.depts.ttu.edu/irim/CommonDataSets/TTU_CDS_2024-2025-06-03-25.pdf
 *
 * Texas Tech is a PUBLIC research university (A2 "Public" checked) — oosAR is
 *   in eligible scope and carries the real CDS number.
 *
 * Value validation (vs. existing DB):
 *   - acceptanceRate    : 72.7   -> 84.61 (CDS C1: 31,419 admits / 37,132
 *                          applicants = 84.6172% (rounded to 84.61%). DB had
 *                          72.7 from LEGACY_DB_VALUE — that value is incorrect
 *                          for the Fall 2024 cohort. Corrected to 84.61.)
 *   - sat25             : 1090 SEED -> 1110 (CDS C9: SAT Composite 25th = 1110
 *                          reported directly. DB was SEED HEURISTIC:PR-15
 *                          (princetonreview aggregator). Promoting to OFFICIAL
 *                          from official Texas Tech CDS.)
 *   - sat75             : 1280 SEED -> 1270 (CDS C9: SAT Composite 75th = 1270
 *                          reported directly. DB was SEED HEURISTIC:PR-15.
 *                          Slight downward correction to OFFICIAL value.)
 *   - intlAcceptanceRate: 33.6   -> 74.00 (CDS C1 residency: 572 intl admits
 *                          / 773 intl applicants = 74.00% exactly. DB 33.6 was
 *                          incorrect — likely from a prior cycle or a different
 *                          data feed. Corrected.)
 *   - oosAcceptanceRate : 68.2   -> 77.61 (CDS C1 residency: 929 OOS admits
 *                          / 1,197 OOS applicants = 77.6107% (rounded to
 *                          77.61%). Public flagship — real policy meaning.
 *                          Corrected from LEGACY_DB_VALUE 68.2.)
 *   - edAcceptanceRate  : null   -> null  (CDS C21: "No" — Texas Tech does NOT
 *                          offer Early Decision. Stays null. Re-stamped from
 *                          prior CDS_LLM_EXTRACT_2026_04 to explicit
 *                          NOT_OFFERED with the canonical TTU IR PDF URL.)
 *   - eaAcceptanceRate  : null   -> null  (CDS C22: "No" — Texas Tech does NOT
 *                          offer Early Action either. Stays null. Re-stamped
 *                          to NOT_OFFERED.)
 *
 * NOTE on hasEarlyDecision: current DB value is TRUE, but CDS C21 = "No" and
 *   C22 = "No". TTU offers only regular/rolling admission. Setting to FALSE.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.depts.ttu.edu/irim/CommonDataSets/TTU_CDS_2024-2025-06-03-25.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8irn002pz0tihyw561a7';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Texas Tech) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC SCHOOL]`);
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
    verifiedBy: 'closure-pipeline-phase3-batch25-claude',
    generatedBy: 'phase3-ttu-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 84.61,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 31,419 admits / 37,132 first-time, first-year applicants = 84.6172% (rounded to 84.61%). DB had LEGACY_DB_VALUE 72.7 (incorrect for Fall 2024 cohort). Corrected from the official Texas Tech CDS PDF.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1110,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1110 reported directly (2,243 students = 33.1% of enrolled submitted SAT). Promoted from SEED HEURISTIC:PR-15 (princetonreview aggregator value 1090) to OFFICIAL from the official Texas Tech CDS PDF.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1270,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1270 reported directly. Promoted from SEED HEURISTIC:PR-15 (value 1280) to OFFICIAL with slight downward correction from the official Texas Tech CDS PDF.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 74.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 572 international admits / 773 international applicants = 74.0000% exactly. DB had LEGACY_DB_VALUE 33.6 — that value was incorrect (likely from a prior cycle or aggregator feed). Corrected.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 77.61,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 929 out-of-state admits / 1,197 out-of-state applicants = 77.6107% (rounded to 77.61%). Texas Tech is a PUBLIC research university — in-state vs. out-of-state distinction carries real policy meaning. Corrected from LEGACY_DB_VALUE 68.2.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. Texas Tech does NOT offer Early Decision (admissions are regular/rolling). Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Re-stamped from prior CDS_LLM_EXTRACT_2026_04 to explicit NOT_OFFERED with the canonical TTU IR PDF URL.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. Texas Tech does NOT offer Early Action either. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Re-stamped to NOT_OFFERED.',
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
      acceptanceRate: new Prisma.Decimal('84.61'),
      sat25: 1110,
      sat75: 1270,
      intlAcceptanceRate: new Prisma.Decimal('74.00'),
      oosAcceptanceRate: new Prisma.Decimal('77.61'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" and C22 "No" — TTU offers only regular/rolling
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=84.61, sat25=1110, sat75=1270, intlAR=74.00, oosAR=77.61, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
