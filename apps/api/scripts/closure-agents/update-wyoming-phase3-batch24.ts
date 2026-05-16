#!/usr/bin/env tsx
/**
 * Phase 3 — University of Wyoming (Laramie, WY) end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: University of Wyoming Common Data Set 2024-2025 (Fall 2024 entering
 *   class) published by Office of Institutional Analysis.
 *   PDF: https://www.uwyo.edu/oia/_files/cds/cds2024-2025.pdf
 *
 * Wyoming is a PUBLIC land-grant research university (A2 "Public" checked) —
 *   oosAR is in eligible scope and carries the real CDS number, not TERMINAL.
 *
 * Value validation (vs. existing DB):
 *   - acceptanceRate    : 96.9    ~  96.88 (CDS C1: gender sums to 6,023
 *                          admits / 6,217 applicants (matches residency
 *                          totals of 6,023 admits / 6,217 apps) = 96.8795%
 *                          (rounded to 96.88%). Tier LEGACY_DB_VALUE ->
 *                          OFFICIAL.)
 *   - sat25             : 1040    =  1040 (CDS C9: SAT Composite 25th = 1040.
 *                          NO CHANGE. Tier re-anchored from princetonreview
 *                          aggregator URL to official Wyoming CDS PDF.)
 *   - sat75             : 1280   -> 1265 (CDS C9: SAT Composite 75th = 1265.
 *                          DB had 1280 from CDS_PDF_AUTO via princetonreview;
 *                          official CDS reports 1265. Correcting downward.)
 *   - intlAcceptanceRate: 96.5   ~  96.52 (CDS C1 residency: 222 intl
 *                          admits / 230 intl applicants = 96.5217% (rounded
 *                          to 96.52%). Tier LEGACY_DB_VALUE -> OFFICIAL,
 *                          minor precision bump.)
 *   - oosAcceptanceRate : 96.8   ~  96.76 (CDS C1 residency: 4,176 OOS
 *                          admits / 4,316 OOS applicants = 96.7563% (rounded
 *                          to 96.76%). PUBLIC land-grant — real policy
 *                          meaning. Tier LEGACY_DB_VALUE -> OFFICIAL.)
 *   - edAcceptanceRate  : null   -> null  (CDS C21: "No" — Wyoming does NOT
 *                          offer Early Decision. Stays null. Re-stamped from
 *                          CDS_LLM_EXTRACT_2026_04 to explicit NOT_OFFERED.)
 *   - eaAcceptanceRate  : null   -> null  (CDS C22: "No" — Wyoming does NOT
 *                          offer Early Action either. Stays null. Re-stamped
 *                          to NOT_OFFERED.)
 *
 * NOTE on hasEarlyDecision: current DB value is TRUE, but CDS C21 = "No" and
 *   C22 = "No". Wyoming offers only regular/rolling admission. Setting to
 *   FALSE to match CDS.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL = 'https://www.uwyo.edu/oia/_files/cds/cds2024-2025.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ir7002iz0ti11f0voua';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Wyoming) not found`);
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
    verifiedBy: 'closure-pipeline-phase3-batch24-claude',
    generatedBy: 'phase3-wyoming-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 96.88,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 6,023 admits / 6,217 first-time, first-year applicants (gender table sums match residency totals) = 96.8795% (rounded to 96.88%). Tier LEGACY_DB_VALUE (96.9) -> OFFICIAL with full precision from the official Wyoming CDS PDF.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1040,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1040 (reported directly; 212 students = 15% of cohort submitted SAT). Re-anchored from prior OFFICIAL provenance that wrongly cited princetonreview.com aggregator to the official Wyoming CDS PDF. Value unchanged.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1265,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1265 (reported directly). DB previously held 1280 (CDS_PDF_AUTO via princetonreview.com aggregator) — that value is incorrect. Corrected to 1265 from the official Wyoming CDS PDF.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 96.52,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 222 international admits / 230 international applicants = 96.5217% (rounded to 96.52%). Tier LEGACY_DB_VALUE (96.5) -> OFFICIAL with full precision.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 96.76,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 4,176 out-of-state admits / 4,316 out-of-state applicants = 96.7563% (rounded to 96.76%). Wyoming is the PUBLIC land-grant flagship of the state — in-state vs. out-of-state distinction carries policy meaning. Tier LEGACY_DB_VALUE (96.8) -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. Wyoming does NOT offer Early Decision (admissions are regular/rolling). Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Re-stamped from prior CDS_LLM_EXTRACT_2026_04 to explicit NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. Wyoming does NOT offer Early Action either. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Re-stamped from prior CDS_LLM_EXTRACT_2026_04 to explicit NOT_OFFERED.',
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
      acceptanceRate: new Prisma.Decimal('96.88'),
      sat25: 1040,
      sat75: 1265,
      intlAcceptanceRate: new Prisma.Decimal('96.52'),
      oosAcceptanceRate: new Prisma.Decimal('96.76'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" and C22 "No" — Wyoming offers only regular/rolling
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=96.88, sat25=1040, sat75=1265, intlAR=96.52, oosAR=96.76, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
