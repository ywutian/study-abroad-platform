#!/usr/bin/env tsx
/**
 * Phase 3 — University of Kentucky (UK) end-to-end closure of the 7 prediction-
 * critical fields.
 *
 * Source: UK CDS 2024-2025 (Fall 2024 entering class) — published by the
 *   Institutional Research, Analytics, and Decision Support (IRADS) office.
 *   URL: https://irads.uky.edu/sites/default/files/2025-07/cds-2024-2025_0.pdf
 *   Landing: https://www.uky.edu/irads/common-data-set
 *
 * UK is a PUBLIC research university (CDS A2 "Public" checked) — oosAR is in
 * eligible scope and carries the real CDS number, not TERMINAL.
 *
 * UK is test-optional (CDS C8A "Not required for admission, but considered if
 * submitted"). SAT/ACT scores reported in C9 are recorded as OFFICIAL for
 * descriptive applicant-profile use.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 93     -> 92.94 (CDS 2024-25 C1: 31,517 apps / 29,293
 *                          admits = 92.9418%. Rounded to 92.94. Minor precision
 *                          shift, tier LEGACY_DB_VALUE -> OFFICIAL.)
 *   - sat25             : 1070   -> 1070  (CDS 2024-25 C9: SAT Composite 25th
 *                          = 1070 reported. Value matches prior; tier
 *                          OFFICIAL/CDS_PDF_AUTO (prepscholar.com URL) ->
 *                          OFFICIAL/CDS_OFFICIAL with authoritative source URL.)
 *   - sat75             : 1270   -> 1270  (CDS 2024-25 C9: SAT Composite 75th
 *                          = 1270 reported. Value matches prior; tier and URL
 *                          refreshed.)
 *   - intlAcceptanceRate: 93.4   -> 93.35 (CDS 2024-25 C1 residency: 969 intl
 *                          admits / 1,038 intl applicants = 93.3526%. Minor
 *                          precision shift, tier LEGACY_DB -> OFFICIAL.)
 *   - oosAcceptanceRate : 92.3   -> 92.27 (CDS 2024-25 C1 residency: 19,623
 *                          OOS admits / 21,268 OOS applicants = 92.2654%.
 *                          Tier LEGACY_DB -> OFFICIAL. PUBLIC SCHOOL —
 *                          oosAR is a real OFFICIAL number.)
 *   - edAcceptanceRate  : null   -> null  (CDS 2024-25 C21: "No" — UK does
 *                          not offer Early Decision. UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION/NOT_OFFERED. Provenance
 *                          refreshed to authoritative CDS pull.)
 *   - eaAcceptanceRate  : null   -> null  (CDS 2024-25 C22: "Yes" — UK
 *                          OFFERS Early Action (non-binding, non-restrictive,
 *                          closing 12/01). However, the CDS does NOT publish
 *                          EA applicant/admit counts (the count cells are
 *                          blank in section C22). UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION (NOT_REPORTED). Provenance
 *                          refreshed.)
 *
 * NOTE on hasEarlyDecision: current DB value is true, but CDS C21 is "No"
 *   (UK does not offer ED, only EA). Setting to false to match CDS reality.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://irads.uky.edu/sites/default/files/2025-07/cds-2024-2025_0.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ior001iz0tibsba6d2o';

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
    throw new Error(`School ${SCHOOL_ID} (University of Kentucky) not found`);
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
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-ukentucky-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 92.94,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 31,517 total first-time, first-year applications (men 12,769 + women 18,485 + another gender 122 + unknown 141) / 29,293 admits (11,655 + 17,396 + 112 + 130) = 92.9418% (rounded to 92.94%). Tier upgraded from LEGACY_DB_VALUE (93) to OFFICIAL with minor precision adjustment.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1070,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1070 (reported directly; EBRW 540 + Math 530 = 1070 also coincides). Value matches prior 1070; tier preserved at OFFICIAL but source upgraded from CDS_PDF_AUTO (with stale prepscholar.com URL) to CDS_OFFICIAL with authoritative irads.uky.edu URL. NOTE: only 7% (481) of enrolled first-year submitted SAT; ACT-dominant (50%, 3,229; ACT Composite 25/50/75 = 21/25/28). UK CDS C8A: "Not required for admission, but considered if submitted".',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1270,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1270 (reported directly; EBRW 650 + Math 640 = 1290 differs because composite quantiles do not equal section sums). Value matches prior 1270; source upgraded to authoritative irads.uky.edu URL. Same submission-rate caveat as sat25.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 93.35,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 969 international admits / 1,038 international applicants = 93.3526% (rounded to 93.35%). Minor precision shift from prior LEGACY_DB_VALUE 93.4; tier upgraded to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 92.27,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 19,623 out-of-state admits / 21,268 out-of-state applicants = 92.2654% (rounded to 92.27%). UK is a PUBLIC research university (Kentucky land-grant, Lexington) — in-state vs. out-of-state distinction carries policy meaning (different tuition). CDS F1: 39.1% of first-time freshmen are from out of state. Tier upgraded from LEGACY_DB_VALUE (92.3) to OFFICIAL with minor precision shift.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. UK does not offer Early Decision (rolling/priority Dec 1 + closing Feb 15 + EA Dec 1). Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Provenance refreshed; corrects stale hasEarlyDecision=true.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — YES checked. UK offers Early Action with closing date 12/01 (non-restrictive: "Is your early action plan a restrictive plan..." — NO). However, the CDS does NOT publish EA applicant/admit counts for the Fall 2024 entering class (the per-round count cells in C22 are blank). Field cleared and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION (NOT_REPORTED) per closure-pipeline convention when a round is offered but admit counts are not published.',
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
      acceptanceRate: new Prisma.Decimal('92.94'),
      sat25: 1070,
      sat75: 1270,
      intlAcceptanceRate: new Prisma.Decimal('93.35'),
      oosAcceptanceRate: new Prisma.Decimal('92.27'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — UK does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=92.94, sat25=1070, sat75=1270, intlAR=93.35, oosAR=92.27, edAR=NOT_OFFERED, eaAR=NOT_REPORTED (EA offered, no counts), hasED=false)',
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
