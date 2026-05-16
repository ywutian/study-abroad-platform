#!/usr/bin/env tsx
/**
 * Phase 3 — Stony Brook University (SUNY flagship, public R1) end-to-end
 * closure of the 7 prediction-critical fields.
 *
 * Source: Stony Brook University CDS 2024-2025
 *   URL: https://www.stonybrook.edu/irpe/_media/Common_data_sets/CDS_2024-2025.xlsx
 *   Index: https://www.stonybrook.edu/irpe/factbook/common-data-set.html
 *
 *   NOTE on source format: Stony Brook publishes CDS as XLSX (not PDF). The
 *   prior URL of record (an AAQEP report) was incorrect. Index page confirms
 *   Excel is the canonical distribution format. CDS 2025-2026 also exists
 *   (xlsx) but 2024-2025 is used here for cycle alignment with the rest of
 *   Phase 3 batch 16.
 *
 * NOTE: Stony Brook is a PUBLIC SUNY flagship — oosAcceptanceRate is in
 *   eligible scope and MUST carry a real OFFICIAL number extracted from CDS
 *   C1 residency table (different tuition, residency-preference admit
 *   pathways).
 *
 * NOTE: Stony Brook is **test-optional / considers if submitted** per CDS
 *   C8A (header table marks "Yes" for SAT/ACT use in admissions; sub-table
 *   places SAT/ACT in "Not required for admission, but considered if
 *   submitted" column). Only 0.34% of enrolled cohort submitted SAT and 0.03%
 *   submitted ACT — overwhelmingly test-blind in practice. Per closure-
 *   pipeline convention, SAT C9 Composite percentiles are recorded OFFICIAL
 *   for descriptive applicant-profile use.
 *
 * NOTE on Early plans: prior DB had hasEarlyDecision=true with edAR=undefined.
 *   CDS C21 confirms ED is **NOT** offered (No box checked; all ED date /
 *   applicant-count fields blank). CDS C22 confirms EA IS offered (closing
 *   10/15, notification 1/31, non-restrictive) but Stony Brook did not report
 *   EA applicant / admit counts in C22 (CDS template doesn't require them).
 *   Setting hasEarlyDecision=false to reflect CDS reality. Clearing prior
 *   TAVILY eaAR=70.5 (not authoritative) and marking eaAR
 *   UNAVAILABLE/OFFICIAL_BLANK_SECTION.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 48.2   → 49.04 (CDS C1 Total: 27,406 admits /
 *                          55,880 applicants = 49.0408%, rounds to 49.04%.
 *                          CORRECTION UP +0.84pp from prior 48.2
 *                          (LEGACY_DB_VALUE). Tier LEGACY_DB → OFFICIAL.)
 *   - sat25             : 1290   → 1340 (CDS C9 SAT Composite 25th = 1340.
 *                          CORRECTION UP +50 from prior 1290 (LEGACY_DB).)
 *   - sat75             : 1440   → 1480 (CDS C9 SAT Composite 75th = 1480.
 *                          CORRECTION UP +40 from prior 1440 (LEGACY_DB).)
 *   - intlAcceptanceRate: 73     → 73.08 (CDS C1 residency: 4,711 intl admits
 *                          / 6,446 intl applicants = 73.0841%, rounds to
 *                          73.08%. Minor precision upgrade from prior 73
 *                          (LEGACY_DB). Tier LEGACY_DB → OFFICIAL.)
 *   - oosAcceptanceRate : 61.7   → 61.68 (CDS C1 residency: 6,576 OOS admits
 *                          / 10,661 OOS applicants = 61.6828%, rounds to
 *                          61.68%. Minor precision adjustment from prior 61.7
 *                          (LEGACY_DB). Tier LEGACY_DB → OFFICIAL.)
 *   - edAcceptanceRate  : null   → null  (CDS C21 "No" — Stony Brook does NOT
 *                          offer Early Decision. Field stays null; tier
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.
 *                          Correct stale hasEarlyDecision=true → false.)
 *   - eaAcceptanceRate  : 70.5   → null  (CDS C22 "Yes" — Stony Brook offers
 *                          non-restrictive EA with closing 10/15 and
 *                          notification 1/31, but CDS C22 / Stony Brook's
 *                          filing does not include EA applicant or admit
 *                          counts. Prior TAVILY_ENRICHMENT value 70.5%
 *                          cleared as non-authoritative; mark
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_REPORTED_IN_CDS.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.stonybrook.edu/irpe/_media/Common_data_sets/CDS_2024-2025.xlsx';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ins0012z0ti4o8njwhn';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Stony Brook) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(
    `  isPrivate=${school.isPrivate}  [PUBLIC SUNY — oosAR carries real CDS number]`,
  );
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
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-stonybrook-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 49.04,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 27,406 admits / 55,880 applicants = 49.0408% (rounded to 49.04%). CORRECTION UP +0.84pp from prior 48.2 (LEGACY_DB_VALUE). Tier upgraded LEGACY_DB → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1340,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1340 (reported directly; EBRW 650 + Math 680 sum = 1330 differs because composite quantiles ≠ section sums). CORRECTION UP +50 from prior 1290 (LEGACY_DB_VALUE). NOTE: Stony Brook is test-optional / considers-if-submitted (CDS C8A "Yes" for SAT/ACT use, sub-table places SAT/ACT in "Not required, considered if submitted" column); only 0.34% of enrolled cohort submitted SAT and 0.03% submitted ACT — overwhelmingly test-blind in practice. SAT band is descriptive only.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1480,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1480 (reported directly; EBRW 730 + Math 770 sum = 1500 differs because composite quantiles ≠ section sums). CORRECTION UP +40 from prior 1440 (LEGACY_DB_VALUE). NOTE: see sat25 note on test-optional posture; SAT band is descriptive only.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 73.08,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 4,711 international admits / 6,446 international applicants = 73.0841% (rounded to 73.08%). Minor precision upgrade from prior 73 (LEGACY_DB_VALUE). Tier upgraded LEGACY_DB → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 61.68,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 6,576 out-of-state admits / 10,661 out-of-state applicants = 61.6828% (rounded to 61.68%). Stony Brook is a PUBLIC SUNY flagship — in-state (NY) vs. out-of-state distinction carries real policy meaning (different tuition, residency-preference admit pathways), so this field is in eligible scope and MUST carry a real CDS number. Minor precision adjustment from prior 61.7 (LEGACY_DB_VALUE). Tier upgraded LEGACY_DB → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked (all ED date and applicant-count fields blank). Stony Brook does not offer Early Decision. Stale DB hasEarlyDecision=true corrected to false. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance refreshed to 2024-25 cycle.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: Stony Brook offers a nonbinding, non-restrictive Early Action plan ("Yes" checked) with closing 10/15 and notification 1/31. However, the CDS C22 template / Stony Brook\'s filing does not include EA applicant or admit counts (only the closing/notification dates are reported). Prior TAVILY_ENRICHMENT value 70.5% cleared as non-authoritative; mark UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_REPORTED_IN_CDS. Provenance refreshed to authoritative CDS pull.',
      realDataStatus: 'NOT_REPORTED_IN_CDS',
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
      acceptanceRate: new Prisma.Decimal('49.04'),
      sat25: 1340,
      sat75: 1480,
      intlAcceptanceRate: new Prisma.Decimal('73.08'),
      oosAcceptanceRate: new Prisma.Decimal('61.68'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — Stony Brook does NOT offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=49.04, sat25=1340, sat75=1480, intlAR=73.08, oosAR=61.68, edAR=NOT_OFFERED, eaAR=NOT_REPORTED, hasED=false)',
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
