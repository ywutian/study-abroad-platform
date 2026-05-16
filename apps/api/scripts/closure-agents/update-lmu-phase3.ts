#!/usr/bin/env tsx
/**
 * Phase 3 — Loyola Marymount University (LMU) end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: LMU CDS 2024-2025 (parsed by Claude directly from PDF text)
 *   URL: https://academics.lmu.edu/media/lmuacademics/strategicplanningacademiceffectiveness/officeofinstitutionalresearch/documents/Legacy-CDS_2024-2025_06112025.pdf
 *   (Author: Chavez, Christine — Acrobat PDFMaker 25 for Excel; text fully
 *    selectable, no OCR needed.)
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 45.1     → 45.08  (CDS C1: 10,409 admits / 23,089
 *                          applicants = 45.0820%. Tier upgraded LEGACY_DB
 *                          (same URL) → OFFICIAL. CORRECTION DOWN -0.02pp
 *                          (precision refresh).)
 *   - sat25             : 1230     → 1280   (CDS C9: SAT Composite 25th = 1280
 *                          reported directly (EBRW 640 + Math 620 sum = 1260
 *                          differs because composite quantiles ≠ section sums).
 *                          CORRECTION UP +50 from prior 1230 (LEGACY_DB).
 *                          Only 18% of Fall 2024 enrolled (279 students)
 *                          submitted SAT under test-optional policy.)
 *   - sat75             : 1390     → 1400   (CDS C9: SAT Composite 75th = 1400
 *                          reported directly (EBRW 720 + Math 710 sum = 1430
 *                          differs because composite quantiles ≠ section sums).
 *                          CORRECTION UP +10 from prior 1390 (LEGACY_DB).)
 *   - intlAcceptanceRate: 6.2      → 6.20   (CDS C1 residency table:
 *                          156 international admits / 2,517 international
 *                          applicants = 6.1979%. Value matches prior LEGACY_DB
 *                          to 2 decimals; tier upgraded LEGACY_DB → OFFICIAL.)
 *   - oosAcceptanceRate : 48.2     → null   (LMU is a private Jesuit research
 *                          university; in-state / out-of-state distinction
 *                          carries no policy meaning (no in-state tuition
 *                          advantage). CDS C1 residency does report OOS
 *                          (3,921 admits / 8,141 applicants = 48.1636%), but
 *                          the value is not actionable for applicants. Prior
 *                          LEGACY_DB value cleared per closure-pipeline
 *                          private-institution convention.)
 *   - edAcceptanceRate  : 44.11    → 44.11  (CDS C21: LMU offers ED I + ED II;
 *                          Fall 2024 entering class combined totals (CDS does
 *                          not split ED I / ED II in the count): 356 admits /
 *                          807 applicants = 44.1141% (rounded to 44.11%).
 *                          Value matches prior DB exactly; tier upgraded
 *                          LEGACY_DB → OFFICIAL.)
 *   - eaAcceptanceRate  : 52.38    → null   (CDS 2024-25 Section C22: LMU
 *                          offers nonbinding Early Action (EA closes 11/1,
 *                          notification 12/17; non-restrictive) BUT does NOT
 *                          publish EA applicant/admit counts in the 2024-25
 *                          CDS form (Section C22 has only plan-offered Yes/No,
 *                          dates, and restrictive-plan Yes/No — no count rows
 *                          on this institution's form). Prior LEGACY_DB value
 *                          52.38 sourced from the prior-cycle CDS_UNL2_2023-24
 *                          PDF, but is not present in the current cycle.
 *                          Cleared per closure-pipeline policy (cycle drift —
 *                          do not carry forward unreported counts).
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const LMU_CDS_URL =
  'https://academics.lmu.edu/media/lmuacademics/strategicplanningacademiceffectiveness/officeofinstitutionalresearch/documents/Legacy-CDS_2024-2025_06112025.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const lmu = await prisma.school.findFirst({
    where: { id: 'cmnwr8ind000tz0timgwcy8hj' },
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
  if (!lmu) throw new Error('Loyola Marymount University not found');
  console.log(`Updating ${lmu.name} (${lmu.id})`);
  console.log(
    `  current AR=${lmu.acceptanceRate?.toString()} sat25=${lmu.sat25} sat75=${lmu.sat75}`,
  );
  console.log(
    `  current intlAR=${lmu.intlAcceptanceRate?.toString()} oosAR=${lmu.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${lmu.edAcceptanceRate?.toString() ?? 'null'} eaAR=${lmu.eaAcceptanceRate?.toString() ?? 'null'} hasED=${lmu.hasEarlyDecision}`,
  );

  const baseProv = {
    sourceUrl: LMU_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-lmu-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 45.08,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 10,409 admits / 23,089 applicants = 45.0820% (rounded to 45.08%). Tier upgraded from LEGACY_DB (same URL, value 45.1) to OFFICIAL with refreshed precision. CORRECTION DOWN -0.02pp (precision refresh).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1280,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1280 reported directly (EBRW/Writing 640 + Math 620 sum = 1260 differs because composite quantiles ≠ section sums). CORRECTION UP +50 from prior LEGACY_DB 1230. 18% of Fall 2024 enrolled (279 students) submitted SAT under test-optional policy.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1400,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1400 reported directly (EBRW/Writing 720 + Math 710 sum = 1430 differs because composite quantiles ≠ section sums). CORRECTION UP +10 from prior LEGACY_DB 1390.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 6.2,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 156 international admits / 2,517 international applicants = 6.1979% (rounded to 6.20%). Value matches prior LEGACY_DB to 2 decimals; tier upgraded LEGACY_DB → OFFICIAL with refreshed cycle/provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Loyola Marymount University is a private Jesuit research university (Los Angeles, CA); in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency does report OOS (3,921 admits / 8,141 applicants = 48.1636%), but the value is not actionable for applicants. Prior LEGACY_DB value (48.2) cleared per closure-pipeline private-institution convention. UNAVAILABLE/TERMINAL.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 44.11,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2024-25 Section C21: LMU offers Early Decision (ED I closes 11/1, notification 12/17; ED II closes 1/8, notification 2/17). Fall 2024 entering class combined ED counts: 356 admits / 807 applicants = 44.1141% (rounded to 44.11%; CDS does not split ED I / ED II in the count row). Value matches prior LEGACY_DB exactly; tier upgraded to OFFICIAL with refreshed cycle metadata.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        "CDS 2024-25 Section C22: LMU offers nonbinding Early Action (EA closes 11/1, notification 12/17; non-restrictive) BUT does NOT publish EA applicant/admit counts in the 2024-25 CDS form (Section C22 contains only plan-offered Yes/No, dates, and restrictive-plan Yes/No — no count rows on this institution's form). Prior LEGACY_DB value 52.38 sourced from prior-cycle CDS_UNL2_2023-24 PDF and was not re-published in the 2024-25 cycle. Cleared per closure-pipeline policy (cycle drift — do not carry forward unreported counts). UNAVAILABLE/OFFICIAL_BLANK_SECTION.",
      realDataStatus: 'NOT_REPORTED',
    },
  };

  const existingMeta = toRecord(lmu.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: LMU_CDS_URL,
  };

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: lmu.id },
    data: {
      acceptanceRate: new Prisma.Decimal('45.08'),
      sat25: 1280,
      sat75: 1400,
      intlAcceptanceRate: new Prisma.Decimal('6.20'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('44.11'),
      eaAcceptanceRate: null, // CDS C22 dates published but counts blank
      hasEarlyDecision: true, // re-confirm from CDS C21 "Yes"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=45.08, sat25=1280, sat75=1400, intlAR=6.20, oosAR=N/A, edAR=44.11, eaAR=BLANK_SECTION)',
  );

  // verify
  const after = await prisma.school.findUnique({
    where: { id: lmu.id },
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
