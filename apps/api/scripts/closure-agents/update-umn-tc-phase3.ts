#!/usr/bin/env tsx
/**
 * Phase 3 — University of Minnesota Twin Cities end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: UMN Twin Cities CDS 2024-2025 (Fall 2024 entering class)
 *   URL: https://idr.umn.edu/sites/idr.umn.edu/files/cds_2024_2025_tc_1.pdf
 *
 * NOTE: UMN Twin Cities is PUBLIC (A2: Public).
 *   - isPrivate=false  ->  oosAcceptanceRate is in eligible scope, MUST carry
 *     a real OFFICIAL number extracted from CDS C1 residency table.
 *
 * Test policy: C8A — SAT/ACT "Not required for admission, but consider if
 *   submitted" (test-optional). SAT Composite quantiles in C9 recorded as
 *   OFFICIAL for descriptive applicant-profile use.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 79.75   ->  79.74   (CDS C1 Total: 33,091 admits /
 *                          41,496 applicants = 79.7427%. Minor precision
 *                          upgrade, tier LEGACY_DB->OFFICIAL.)
 *   - sat25             : 1270    ->  1320    (CDS C9 SAT Composite 25th = 1320
 *                          reported directly. CORRECTION UP +50 from prior 1270.
 *                          Tier LEGACY_DB->OFFICIAL.)
 *   - sat75             : 1430    ->  1470    (CDS C9 SAT Composite 75th = 1470
 *                          reported directly. CORRECTION UP +40 from prior 1430.
 *                          Tier LEGACY_DB->OFFICIAL.)
 *   - intlAcceptanceRate: 82.10   ->  82.07   (CDS C1 residency: 1,071 intl
 *                          admits / 1,305 intl applicants = 82.0690%. Minor
 *                          precision shift, tier LEGACY_DB->OFFICIAL.)
 *   - oosAcceptanceRate : 83.58   ->  83.58   (CDS C1 residency: 16,739 OOS
 *                          admits / 20,027 OOS applicants = 83.5821%. Value
 *                          matches; tier LEGACY_DB->OFFICIAL. PUBLIC school —
 *                          oosAR is real OFFICIAL number, not TERMINAL.)
 *   - edAcceptanceRate  : null    ->  null    (CDS C21 "No" — UMN does NOT
 *                          offer Early Decision. Stays cleared;
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION. Existing
 *                          provenance had tier OFFICIAL with value=undefined
 *                          (CDS_LLM_EXTRACT_2026_04) — refreshed to authoritative
 *                          CDS pull marked NOT_OFFERED.)
 *   - eaAcceptanceRate  : null    ->  null    (CDS C22 "Yes" — UMN offers
 *                          nonbinding Early Action (closing 11/1, notification
 *                          1/31). However the CDS form does NOT publish EA
 *                          applicant/admit counts (only ED has the counts
 *                          table). EA rate UNAVAILABLE/OFFICIAL_BLANK_SECTION.
 *                          Provenance refreshed from CDS_LLM_EXTRACT_2026_04.)
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

const CDS_URL =
  'https://idr.umn.edu/sites/idr.umn.edu/files/cds_2024_2025_tc_1.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ima0008z0ti358pkae1';

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
    throw new Error(`School ${SCHOOL_ID} (UMN Twin Cities) not found`);
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
    generatedBy: 'phase3-umn-tc-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 79.74,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 33,091 admits / 41,496 applicants = 79.7427% (rounded to 79.74%). Tier upgraded from LEGACY_DB (value 79.75) to OFFICIAL with minor precision adjustment.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1320,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1320 (reported directly). CORRECTION UP from prior 1270 (LEGACY_DB). NOTE: UMN Twin Cities is test-optional (C8A "Not required for admission, but consider if submitted"); 8.20% of Fall 2024 enrolled (606 students) submitted SAT.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1470,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1470 (reported directly). CORRECTION UP from prior 1430 (LEGACY_DB). NOTE: UMN is test-optional; SAT band recorded for descriptive applicant-profile use.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 82.07,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 1,071 international admits / 1,305 international applicants = 82.0690% (rounded to 82.07%). Tier upgraded from LEGACY_DB (value 82.10) to OFFICIAL with minor precision adjustment.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 83.58,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 16,739 out-of-state admits / 20,027 out-of-state applicants = 83.5821% (rounded to 83.58%). UMN Twin Cities is a PUBLIC institution (A2: Public) — in-state vs. out-of-state distinction carries real policy meaning (different tuition, residency considerations), so this field is in eligible scope and MUST carry a real CDS number. Value matches prior DB; tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. UMN Twin Cities does not offer Early Decision. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 (with value=undefined) to authoritative CDS pull marked NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — YES checked (closing 11/1, notification 1/31). However the CDS C22 form does NOT publish an EA applicant/admit counts table for the Fall 2024 entering class (only C21 has the entering-class counts table). EA admit rate cannot be computed from CDS. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 (with value=undefined).',
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

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('79.74'),
      sat25: 1320,
      sat75: 1470,
      intlAcceptanceRate: new Prisma.Decimal('82.07'),
      oosAcceptanceRate: new Prisma.Decimal('83.58'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — UMN does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=79.74, sat25=1320, sat75=1470, intlAR=82.07, oosAR=83.58, edAR=NOT_OFFERED, eaAR=NOT_PUBLISHED, hasED=false)',
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
