#!/usr/bin/env tsx
/**
 * Phase 3 — University of Central Florida (UCF) end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: UCF CDS 2024-2025 (Fall 2024 entering class) published by
 *   Institutional Knowledge Management / UCF Analytics.
 *   URL: https://analytics.ucf.edu/wp-content/uploads/2025/08/Common-Data-Set-2024-2025.pdf
 *
 * UCF is a PUBLIC research university (CDS A2 "Public" checked) — oosAR is in
 *   eligible scope and carries the real CDS number, not TERMINAL.
 *
 * Pre-state (already OFFICIAL from prior batch, kept verbatim):
 *   - acceptanceRate    : 44.71  (CDS C1 24,651 admits / 55,135 applicants)
 *   - intlAcceptanceRate: 23.39  (CDS C1 442 intl admits / 1,890 intl applicants)
 *   - oosAcceptanceRate : 28.87  (CDS C1 2,774 OOS admits / 9,608 OOS applicants)
 *   - edAcceptanceRate  : null   (already OFFICIAL via CDS_LLM_EXTRACT_2026_04;
 *                                  this script re-affirms with explicit
 *                                  OFFICIAL_BLANK_SECTION/NOT_OFFERED — UCF C21 = No)
 *
 * Value changes (vs. existing DB):
 *   - sat25             : 1200   -> 1210  (CDS 2024-25 C9 SAT Composite 25th =
 *                          1210. Tier SEED HEURISTIC:PR-15 -> OFFICIAL.)
 *   - sat75             : 1350   -> 1340  (CDS 2024-25 C9 SAT Composite 75th =
 *                          1340. Tier SEED HEURISTIC:PR-15 -> OFFICIAL.)
 *   - eaAcceptanceRate  : 39.9   -> null  (CDS 2024-25 C22 offers EA but does
 *                          NOT publish applicant/admit counts — only dates
 *                          15-Oct closing / 15-Nov notification. Replace
 *                          TAVILY_ENRICHMENT estimate with OFFICIAL_BLANK_SECTION
 *                          UNAVAILABLE per closure policy: official source is
 *                          present but the section is blank.)
 *
 * NOTE on hasEarlyDecision: current DB value is TRUE, but CDS C21 is "No" —
 *   UCF does NOT offer Early Decision. Setting to FALSE to match CDS.
 *   (UCF offers Early Action, not Early Decision.)
 *
 * Re-affirm of edAR: prior provenance was OFFICIAL via CDS_LLM_EXTRACT_2026_04
 *   with value=null; re-stamp with explicit OFFICIAL_BLANK_SECTION/NOT_OFFERED
 *   reason for consistency with batch convention.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://analytics.ucf.edu/wp-content/uploads/2025/08/Common-Data-Set-2024-2025.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iqk0027z0ti3qm7r15o';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UCF) not found`);
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
    generatedBy: 'phase3-ucf-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 44.71,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 24,651 admits / 55,135 first-time, first-year applicants = 44.7129% (rounded to 44.71%). Re-affirmed OFFICIAL with CDS-direct numbers; value unchanged from prior closure.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1210,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1210 (reported directly). Tier upgraded from SEED (HEURISTIC:PR-15) to OFFICIAL. NOTE: 71.4% of enrolled first-years (5,686) submitted SAT — SAT-dominant relative to ACT (28.4%, 2,266 submitters; ACT Composite 25/50/75 = 25/27/29).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1340,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1340 (reported directly). Tier upgraded from SEED (HEURISTIC:PR-15) to OFFICIAL. Prior DB value 1350 corrected down 10 points.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 23.39,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 442 international admits / 1,890 international applicants = 23.3862% (rounded to 23.39%). Re-affirmed OFFICIAL; value unchanged.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 28.87,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 2,774 out-of-state admits / 9,608 out-of-state applicants = 28.8718% (rounded to 28.87%). UCF is a PUBLIC research university (Orlando, FL) — in-state vs. out-of-state distinction carries policy meaning (different tuition: $6,368 in-state vs. $24,076 out-of-state per CDS G1). Re-affirmed OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. UCF does NOT offer Early Decision (offers Early Action only). Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Replaces prior provenance (source=CDS_LLM_EXTRACT_2026_04 marked OFFICIAL with value=null) with explicit blank-section marker. Also corrects stale hasEarlyDecision=true.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — YES checked (Early action closing 15-Oct, notification 15-Nov, nonrestrictive). However, UCF does NOT publish EA applicant/admit counts — only dates. Field cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION) per closure policy: official source is present but the count section is blank. Replaces prior TAVILY_ENRICHMENT estimate of 39.9 (not from CDS).',
      realDataStatus: 'OFFICIAL_BLANK_SECTION',
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
      acceptanceRate: new Prisma.Decimal('44.71'),
      sat25: 1210,
      sat75: 1340,
      intlAcceptanceRate: new Prisma.Decimal('23.39'),
      oosAcceptanceRate: new Prisma.Decimal('28.87'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — UCF does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=44.71, sat25=1210, sat75=1340, intlAR=23.39, oosAR=28.87, edAR=NOT_OFFERED, eaAR=OFFICIAL_BLANK_SECTION, hasED=false)',
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
