#!/usr/bin/env tsx
/**
 * Phase 3 — Temple University end-to-end closure of the 7 prediction-critical
 * fields.
 *
 * Source: Temple University CDS 2024-2025 (Fall 2024 entering class)
 *   URL: https://ira.temple.edu/sites/ira/files/Temple%20University%20CDS-2024-2025-v2.pdf
 *
 * Temple is a PUBLIC research university (Philadelphia, PA — state-related
 * Commonwealth System of Higher Education member).
 *   - isPrivate=false  ->  oosAcceptanceRate IS in eligible scope and carries
 *     a real OFFICIAL CDS number.
 *
 * Temple SAT/ACT usage (C8A): YES with "Not required for admission, but consider
 * if submitted" — test-OPTIONAL policy. C8F: "We are test optional; applicants
 * indicate whether they want their test scores used... International applicants,
 * home-schooled applicants and recruited student athletes must submit test
 * scores." Per closure-pipeline convention, reported CDS C9 SAT Composite
 * percentiles are still recorded as OFFICIAL for descriptive applicant-profile
 * use.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 80.45   -> 80.45  (CDS C1: 32,838 admits / 40,817
 *                          applicants = 80.4519%. Value matches prior DB;
 *                          tier upgraded LEGACY_DB -> OFFICIAL.)
 *   - sat25             : 1100    -> 1130   (CDS C9: SAT Composite 25th = 1130
 *                          reported directly; EBRW 570 + Math 550 sum = 1120
 *                          differs because composite quantiles ≠ section sums.
 *                          CORRECTION UP +30 from prior 1100 (LEGACY_DB).)
 *   - sat75             : 1290    -> 1358   (CDS C9: SAT Composite 75th = 1358
 *                          reported directly; EBRW 680 + Math 680 sum = 1360
 *                          differs because composite quantiles ≠ section sums.
 *                          CORRECTION UP +68 from prior 1290 (LEGACY_DB).)
 *   - intlAcceptanceRate: 70.84   -> 70.84  (CDS C1 residency: 2,828 intl
 *                          admits / 3,992 intl applicants = 70.8417% (rounded
 *                          to 70.84%). Value matches prior DB; tier upgraded
 *                          LEGACY_DB -> OFFICIAL.)
 *   - oosAcceptanceRate : 81.75   -> 81.75  (CDS C1 residency: 18,960 OOS
 *                          admits / 23,193 OOS applicants = 81.7488% (rounded
 *                          to 81.75%). Value matches prior DB; tier upgraded
 *                          LEGACY_DB -> OFFICIAL. Temple is PUBLIC — oosAR
 *                          carries the real CDS number, never TERMINAL.)
 *   - edAcceptanceRate  : null    -> null   (CDS C21: "No" — Temple does NOT
 *                          offer Early Decision for fall first-time applicants.
 *                          DB value was already null (undefined) under
 *                          CDS_LLM_EXTRACT_2026_04. Provenance refreshed to
 *                          authoritative CDS_OFFICIAL pull marked UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION/NOT_OFFERED. Also correct
 *                          stale DB hasEarlyDecision=true -> false to match
 *                          CDS reality.)
 *   - eaAcceptanceRate  : 28.1    -> null   (CDS C22: "Yes" — Temple offers
 *                          non-restrictive Early Action (closing 11/1,
 *                          notification 1/10), but CDS C22 has NO box to report
 *                          Fall 2024 EA application/admit counts (CDS only
 *                          collects counts for ED, not EA). Prior DB value
 *                          28.1 came from TAVILY_ENRICHMENT (non-authoritative
 *                          web aggregator). Per closure-pipeline convention,
 *                          CDS is the source of truth; since CDS does not
 *                          publish EA counts, value cleared and tier marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION (NOT_COLLECTED).)
 *
 * NOTE on hasEarlyDecision: current DB value is true but CDS C21 is "No".
 *   Setting to false to match CDS reality.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://ira.temple.edu/sites/ira/files/Temple%20University%20CDS-2024-2025-v2.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8inq0011z0tims8lt244';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Temple) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC — oosAR=OFFICIAL]`);
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
    generatedBy: 'phase3-temple-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 80.45,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 32,838 admits / 40,817 applicants = 80.4519% (rounded to 80.45%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with cycle metadata.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1130,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1130 (reported directly; EBRW 570 + Math 550 sum = 1120 differs because composite quantiles ≠ section sums). CORRECTION UP +30 from prior 1100 (LEGACY_DB). 17.70% of Fall 2024 enrolled (873 students) submitted SAT under test-optional policy (C8A "Not required for admission, but consider if submitted"; required only for international, home-schooled, recruited athletes).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1358,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1358 (reported directly; EBRW 680 + Math 680 sum = 1360 differs because composite quantiles ≠ section sums). CORRECTION UP +68 from prior 1290 (LEGACY_DB). NOTE: Temple is test-optional; SAT band is descriptive.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 70.84,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 2,828 international admits / 3,992 international applicants = 70.8417% (rounded to 70.84%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 81.75,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 18,960 out-of-state admits / 23,193 out-of-state applicants = 81.7488% (rounded to 81.75%). Temple is a PUBLIC research university (Pennsylvania state-related, Commonwealth System of Higher Education) — in-state vs. out-of-state distinction carries real policy meaning (different tuition rates). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. Temple University does not offer Early Decision for first-time, first-year fall applicants. DB value was already null; provenance refreshed from CDS_LLM_EXTRACT_2026_04 (undefined) to authoritative CDS_OFFICIAL pull marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED. Also corrected stale DB hasEarlyDecision=true to false.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Yes" — Temple offers a nonbinding (non-restrictive) Early Action plan with closing date 11/1 and notification 1/10. However, CDS C22 has NO field for reporting Fall 2024 EA application/admit counts (CDS only collects counts for ED in C21, not EA in C22). Prior DB value 28.1% originated from TAVILY_ENRICHMENT (non-authoritative web aggregator). Per closure-pipeline convention, CDS is the source of truth; since CDS does not publish EA counts, value cleared and tier marked UNAVAILABLE/OFFICIAL_BLANK_SECTION (NOT_COLLECTED).',
      realDataStatus: 'NOT_COLLECTED',
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
      acceptanceRate: new Prisma.Decimal('80.45'),
      sat25: 1130,
      sat75: 1358,
      intlAcceptanceRate: new Prisma.Decimal('70.84'),
      oosAcceptanceRate: new Prisma.Decimal('81.75'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — Temple does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=80.45, sat25=1130, sat75=1358, intlAR=70.84, oosAR=81.75, edAR=NOT_OFFERED, eaAR=NOT_COLLECTED, hasED=false)',
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
