#!/usr/bin/env tsx
/**
 * Phase 3 — Rochester Institute of Technology (RIT) end-to-end closure of the
 * 7 prediction-critical fields.
 *
 * Source: RIT Common Data Set 2024-2025 (Fall 2024 entering class), final
 *   posted 6/3/2025 by RIT Institutional Research, Data and Analytics.
 *   URL: https://www.rit.edu/institutionalresearch/sites/rit.edu.institutionalresearch/files/documents/Common%20Data%20Set%20PDFs/RIT_CDS_2024_25_FINAL_20250603.pdf
 *   Index: https://www.rit.edu/institutionalresearch/common-data-set
 *
 * RIT is a private research university (isPrivate=true). Per closure-pipeline
 * convention, oosAcceptanceRate is marked UNAVAILABLE/TERMINAL — in-state vs.
 * out-of-state distinction carries no policy meaning for private institutions
 * (no in-state tuition advantage), even though the CDS C1 residency table
 * does report OOS numbers.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 71.14    -> 66.98  (CDS 2024-25 C1 residency total:
 *                          18,682 admits / 27,892 applicants = 66.9762%
 *                          (rounded to 66.98%). Tier upgraded LEGACY_DB
 *                          (sourceUrl pointed to RIT CDS 2023-24) -> OFFICIAL
 *                          with refreshed cycle. CORRECTION DOWN -4.16pp.)
 *   - sat25             : 1300     -> 1300  (CDS 2024-25 C9: SAT Composite
 *                          25th = 1300 reported directly. Value matches prior
 *                          DB; tier upgraded SEED/PR-15 -> OFFICIAL.
 *                          Submitting SAT 42.90% (1,305 students).)
 *   - sat75             : 1460     -> 1440  (CDS 2024-25 C9: SAT Composite
 *                          75th = 1440 reported directly. CORRECTION DOWN
 *                          from prior 1460 (SEED/PR-15 heuristic). Tier
 *                          upgraded SEED -> OFFICIAL.)
 *   - intlAcceptanceRate: 39.47    -> 37.49  (CDS 2024-25 C1 residency: 1,188
 *                          international admits / 3,169 international
 *                          applicants = 37.4882% (rounded to 37.49%). Tier
 *                          upgraded LEGACY_DB -> OFFICIAL. CORRECTION DOWN
 *                          -1.98pp.)
 *   - oosAcceptanceRate : 78.15    -> null   (RIT is private; in-state/OOS
 *                          distinction carries no policy meaning. CDS C1
 *                          residency does report OOS (10,991/14,442 = 76.10%)
 *                          but per pipeline convention, private schools ->
 *                          UNAVAILABLE/TERMINAL. Prior legacy DB value
 *                          cleared.)
 *   - edAcceptanceRate  : 72.78    -> 72.20  (CDS 2024-25 C21: ED offered
 *                          ("Yes" checked); two plans — ED I closes 11/1
 *                          (12/1 notification), ED II closes 1/15 (2/15 from
 *                          OCR ambiguity but plan exists). Fall 2024 entering
 *                          class combined totals: 1,509 admits / 2,090 ED
 *                          applications = 72.2010% (rounded to 72.20%). Tier
 *                          upgraded LEGACY_DB -> OFFICIAL. CORRECTION DOWN
 *                          -0.58pp.)
 *   - eaAcceptanceRate  : null     -> null   (CDS 2024-25 C22: RIT offers
 *                          nonbinding EA ("Yes" checked; closing 11/1,
 *                          notification 1/31; not restrictive). However, the
 *                          CDS C22 template does NOT collect EA application
 *                          /admit counts — only plan existence and dates.
 *                          Field stays null. Provenance refreshed from prior
 *                          CDS_LLM_EXTRACT_2026_04 (with value=undefined) to
 *                          authoritative CDS 2024-25 pull marked UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION/NOT_PUBLISHED.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.rit.edu/institutionalresearch/sites/rit.edu.institutionalresearch/files/documents/Common%20Data%20Set%20PDFs/RIT_CDS_2024_25_FINAL_20250603.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iu6003wz0tio3oagiri';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (RIT) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(
    `  current AR=${school.acceptanceRate?.toString()} sat25=${school.sat25} sat75=${school.sat75}`,
  );
  console.log(
    `  current intlAR=${school.intlAcceptanceRate?.toString()} oosAR=${school.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${school.edAcceptanceRate?.toString()} eaAR=${school.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-rit-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 66.98,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1 residency total: 18,682 admits / 27,892 applicants = 66.9762% (rounded to 66.98%). Gender table totals 18,682/27,911 = 66.93% (rounding consistent within ±0.05pp). Tier upgraded from LEGACY_DB (value 71.14, sourceUrl pointed to RIT CDS 2023-24 cycle) to OFFICIAL with refreshed 2024-25 cycle. CORRECTION DOWN -4.16pp.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1300,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1300 (reported directly; EBRW 640 + Math 640 sum = 1280 differs because composite quantiles ≠ section sums). Value matches prior DB (1300); tier upgraded from SEED/PR-15 heuristic to OFFICIAL. 42.90% of Fall 2024 enrolled (1,305 students) submitted SAT under consider-if-submitted policy (C8A "Required to be considered for admission, but consider if submitted" for Fall 2026 cycle; Fall 2024 was test-optional).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1440,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1440 (reported directly; EBRW 720 + Math 740 sum = 1460 differs because composite quantiles ≠ section sums). CORRECTION DOWN from prior 1460 (SEED/PR-15 heuristic). Tier upgraded from SEED -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 37.49,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 1,188 international admits / 3,169 international applicants = 37.4882% (rounded to 37.49%). Tier upgraded from LEGACY_DB (value 39.47, sourceUrl pointed to RIT CDS 2023-24 cycle) to OFFICIAL with refreshed 2024-25 cycle. CORRECTION DOWN -1.98pp.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Rochester Institute of Technology is a private research university; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table does report OOS (10,991 admits / 14,442 applicants = 76.1044%), but the value is not actionable for applicants. Prior legacy DB value (78.15%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 72.2,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2024-25 Section C21: RIT offers Early Decision ("Yes" checked) with two plans — ED I closes 11/1 (12/1 notification), ED II (closing/notification dates published in CDS). Fall 2024 entering class combined totals: 1,509 admits / 2,090 ED applications = 72.2010% (rounded to 72.20%). Tier upgraded from LEGACY_DB (value 72.78, sourceUrl pointed to RIT CDS 2023-24 cycle) to OFFICIAL with refreshed 2024-25 cycle. CORRECTION DOWN -0.58pp.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: RIT offers nonbinding Early Action ("Yes" checked; closing 11/1, notification 1/31; not restrictive). However, the CDS C22 template does NOT collect EA application/admit counts — only plan existence and dates. Field stays null. Provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 (with value=undefined, sourced from 2023-24 cycle) to authoritative 2024-25 CDS pull marked UNAVAILABLE/OFFICIAL_BLANK_SECTION: plan exists but CDS does not publish admit numbers.',
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
      acceptanceRate: new Prisma.Decimal('66.98'),
      sat25: 1300,
      sat75: 1440,
      intlAcceptanceRate: new Prisma.Decimal('37.49'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('72.20'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true, // re-confirm from CDS C21 "Yes"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=66.98 OFFICIAL, sat25=1300, sat75=1440, intlAR=37.49, oosAR=N/A private, edAR=72.20, eaAR=NOT_PUBLISHED EA-blank-counts, hasED=true)',
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
