#!/usr/bin/env tsx
/**
 * Phase 3 — University of Arizona end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: University of Arizona CDS 2024-2025 (Fall 2024 entering class),
 *   posted March 2025 by University Analytics and Institutional Research.
 *   URL: https://uair.arizona.edu/sites/default/files/2025-03/CDS-2024-2025-FINAL.pdf
 *   Index: https://uair.arizona.edu/content/common-data-set
 *
 * NOTE: University of Arizona is a PUBLIC research university (isPrivate=false).
 *   - oosAcceptanceRate is in eligible scope, MUST carry a real OFFICIAL number
 *     extracted from CDS C1 residency table. NOT marked UNAVAILABLE/TERMINAL.
 *
 * University of Arizona uses ROLLING ADMISSIONS (C16 "rolling basis") with a
 * priority date (5/1) — no Early Decision and no Early Action plan per CDS
 * C21 "No" and C22 "No". Current DB has hasEarlyDecision=true, which is
 * incorrect per CDS — corrected to false.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 87.4     -> 86.14  (CDS 2024-25 C1 residency total:
 *                          50,252 admits / 58,339 applicants = 86.1362%
 *                          (rounded to 86.14%). Tier upgraded LEGACY_DB
 *                          (sourceUrl pointed to CDS 2023-24) -> OFFICIAL.
 *                          CORRECTION DOWN -1.26pp.)
 *   - sat25             : 1080     -> 1130  (CDS 2024-25 C9: SAT Composite
 *                          25th = 1130 reported directly. CORRECTION UP +50
 *                          from prior 1080 (LEGACY_DB, 2023-24 cycle).
 *                          Submitting SAT 11% (1,031 students).)
 *   - sat75             : 1300     -> 1340  (CDS 2024-25 C9: SAT Composite
 *                          75th = 1340 reported directly. CORRECTION UP +40
 *                          from prior 1300 (LEGACY_DB, 2023-24 cycle).)
 *   - intlAcceptanceRate: 77.49    -> 57.74  (CDS 2024-25 C1 residency: 5,330
 *                          intl admits / 9,231 intl applicants = 57.7402%
 *                          (rounded to 57.74%). Tier upgraded LEGACY_DB
 *                          (2023-24 cycle) -> OFFICIAL. BIG CORRECTION DOWN
 *                          -19.75pp — intl applicant pool grew significantly
 *                          while admit selectivity tightened.)
 *   - oosAcceptanceRate : 72.25    -> 91.95  (CDS 2024-25 C1 residency: 31,303
 *                          OOS admits / 34,044 OOS applicants = 91.9486%
 *                          (rounded to 91.95%). Public R1 — oosAR IS a real
 *                          OFFICIAL number per pipeline convention. BIG
 *                          UPWARD CORRECTION +19.70pp from LEGACY_DB 72.25
 *                          (2023-24 cycle). Tier LEGACY_DB -> OFFICIAL.)
 *   - edAcceptanceRate  : null     -> null   (CDS 2024-25 C21: "Does your
 *                          institution offer an early decision plan?" — NO
 *                          checked. University of Arizona uses rolling
 *                          admissions with a priority date (5/1), does not
 *                          offer ED. Field stays cleared.
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : null     -> null   (CDS 2024-25 C22: "Do you have a
 *                          nonbinding early action plan?" — NO checked.
 *                          University of Arizona does not offer EA either.
 *                          Field stays cleared.
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
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
  'https://uair.arizona.edu/sites/default/files/2025-03/CDS-2024-2025-FINAL.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8inn000zz0tihkfqe5yc';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UArizona) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC R1]`);
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
    generatedBy: 'phase3-uarizona-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 86.14,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1 residency total: 50,252 admits / 58,339 applicants = 86.1362% (rounded to 86.14%). Gender table totals 50,252 (21,436M + 28,816W) / 58,339 (25,635M + 32,704W) consistent. Tier upgraded from LEGACY_DB (value 87.4, sourceUrl pointed to UArizona CDS 2023-24 cycle) to OFFICIAL with refreshed 2024-25 cycle. CORRECTION DOWN -1.26pp.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1130,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1130 (reported directly; EBRW 560 + Math 560 sum = 1120 differs because composite quantiles ≠ section sums). CORRECTION UP +50 from prior 1080 (LEGACY_DB, 2023-24 cycle). Tier upgraded LEGACY_DB -> OFFICIAL. Submitting SAT 11% (1,031 students); ACT 18% (1,692 students). C8A "Considered if submitted" — test-optional policy.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1340,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1340 (reported directly; EBRW 670 + Math 680 sum = 1350 differs because composite quantiles ≠ section sums). CORRECTION UP +40 from prior 1300 (LEGACY_DB, 2023-24 cycle). Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 57.74,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 5,330 international admits / 9,231 international applicants = 57.7402% (rounded to 57.74%). Tier upgraded from LEGACY_DB (value 77.49, sourced from UArizona CDS 2023-24 cycle) to OFFICIAL with refreshed 2024-25 cycle. BIG CORRECTION DOWN -19.75pp — international applicant pool grew while admit selectivity tightened.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 91.95,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 31,303 out-of-state admits / 34,044 out-of-state applicants = 91.9486% (rounded to 91.95%). University of Arizona is a PUBLIC R1 research university — in-state vs. out-of-state distinction carries real policy meaning (different tuition, residency-preference admit pathways), so this field is in eligible scope and MUST carry a real CDS number. BIG UPWARD CORRECTION +19.70pp from prior LEGACY_DB value 72.25% (2023-24 cycle). Tier upgraded LEGACY_DB -> OFFICIAL. (Public-school convention: oosAR carries the real number, never marked TERMINAL.)',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. University of Arizona uses rolling admissions (C16 "On a rolling basis") with a priority date of 5/1; does not offer Early Decision. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 (value=undefined, 2023-24 cycle) to authoritative 2024-25 CDS pull.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. University of Arizona uses rolling admissions with a priority date (5/1), does not offer a formal nonbinding Early Action plan. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 (value=undefined, 2023-24 cycle) to authoritative 2024-25 CDS pull.',
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

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('86.14'),
      sat25: 1130,
      sat75: 1340,
      intlAcceptanceRate: new Prisma.Decimal('57.74'),
      oosAcceptanceRate: new Prisma.Decimal('91.95'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — UArizona does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=86.14, sat25=1130, sat75=1340, intlAR=57.74, oosAR=91.95 PUBLIC, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
