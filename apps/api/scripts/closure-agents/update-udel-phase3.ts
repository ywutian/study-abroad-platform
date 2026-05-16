#!/usr/bin/env tsx
/**
 * Phase 3 — University of Delaware (UDel) end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: UDel CDS 2024-2025 (Fall 2024 entering class)
 *   URL: https://ire.udel.edu/files/2025/07/CDS2425_UDelaware.pdf
 *   (Redirects to https://bpb-us-w2.wpmucdn.com/sites.udel.edu/dist/e/2019/files/2025/07/CDS2425_UDelaware.pdf)
 *
 * UDel is a PUBLIC research university (Newark, DE).
 *   - isPrivate=false  ->  oosAcceptanceRate is in eligible scope, MUST carry
 *     a real OFFICIAL number extracted from CDS C1 residency table.
 *
 * UDel is TEST-OPTIONAL through 2025 (CDS C8A "Yes" overall, specific box
 *   checked is "Not required for admission, but consider if submitted").
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 39.4    -> 69.24  (CDS C1: 27,517 admits / 39,742
 *                          applicants = 69.2391%, rounded to 69.24%. MAJOR
 *                          CORRECTION UP +29.84pp from prior 39.4% (LEGACY_DB).
 *                          Likely the prior 39.4% was YIELD (enrollees/admits =
 *                          4075/27517 ~14.8% — actually neither, may have been
 *                          stale or wrong-metric). Tier upgraded LEGACY_DB
 *                          -> OFFICIAL.)
 *   - sat25             : 1170    -> 1220   (CDS C9: SAT Composite 25th = 1220
 *                          reported directly; EBRW 610 + Math 590 sum = 1200
 *                          differs because composite quantiles ≠ section sums.
 *                          CORRECTION UP +50 from prior 1170 (LEGACY_DB).
 *                          Tier upgraded LEGACY_DB -> OFFICIAL. NOTE: UDel is
 *                          test-optional; only 19.10% of Fall 2024 enrolled
 *                          (780 students) submitted SAT.)
 *   - sat75             : 1360    -> 1370   (CDS C9: SAT Composite 75th = 1370
 *                          reported directly; EBRW 700 + Math 690 sum = 1390
 *                          differs because composite quantiles ≠ section sums.
 *                          CORRECTION UP +10 from prior 1360 (LEGACY_DB). Tier
 *                          upgraded LEGACY_DB -> OFFICIAL.)
 *   - intlAcceptanceRate: 69      -> 54.80  (CDS C1 residency: 1,240 intl admits
 *                          / 2,263 intl applicants = 54.7945%, rounded to
 *                          54.80%. CORRECTION DOWN -14.20pp from prior 69%
 *                          (LEGACY_DB). The prior 69% appears to be near the
 *                          overall admit rate (69.24%), not the international-
 *                          specific rate. Tier upgraded LEGACY_DB -> OFFICIAL.)
 *   - oosAcceptanceRate : null    -> 70.04  (CDS C1 residency: 23,364 OOS
 *                          admits / 33,360 OOS applicants = 70.0360%, rounded
 *                          to 70.04%. UDel is a PUBLIC institution — in-state
 *                          vs. out-of-state distinction carries real policy
 *                          meaning (different tuition; UDel actively recruits
 *                          OOS students who comprise ~84% of the applicant
 *                          pool). Prior tier was PERMANENT_HEURISTIC (null
 *                          value, no source). Tier upgraded PERMANENT_HEURISTIC
 *                          -> OFFICIAL with real CDS number.)
 *   - edAcceptanceRate  : null    -> null   (CDS C21: "Does your institution
 *                          offer an early decision plan?" — NO checked. UDel
 *                          does not offer Early Decision. DB previously held
 *                          tier=OFFICIAL source=CDS_LLM_EXTRACT_2026_04 with
 *                          value=undefined — semantics preserved, source
 *                          refreshed to authoritative CDS pull marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.
 *                          Also correcting stale DB hasEarlyDecision=true ->
 *                          false to match CDS C21 "No".)
 *   - eaAcceptanceRate  : null    -> null   (CDS C22: "Do you have a nonbinding
 *                          early action plan?" — YES checked. UDel offers EA
 *                          (closes 11/1, notification 1/31, non-restrictive).
 *                          However, C22 does NOT include a "For the Fall 2024
 *                          entering class" applications/admits subform — only
 *                          closing/notification dates are collected. Prior
 *                          provenance had tier=OFFICIAL source=
 *                          CDS_LLM_EXTRACT_2026_04 with value=undefined;
 *                          refreshed to authoritative CDS pull marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION since CDS does
 *                          not publish this number despite EA being offered.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL = 'https://ire.udel.edu/files/2025/07/CDS2425_UDelaware.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8in7000qz0ti04kcrc1l';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UDel) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC — oosAR=OFFICIAL]`);
  console.log(
    `  current AR=${school.acceptanceRate?.toString()} sat25=${school.sat25} sat75=${school.sat75}`,
  );
  console.log(
    `  current intlAR=${school.intlAcceptanceRate?.toString()} oosAR=${school.oosAcceptanceRate?.toString() ?? 'null'}`,
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
    generatedBy: 'phase3-udel-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 69.24,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 27,517 admits / 39,742 applicants = 69.2391% (rounded to 69.24%). MAJOR CORRECTION UP +29.84pp from prior 39.4% (LEGACY_DB) — prior value appears to have been a stale or wrong-metric figure (yield is ~14.8%; neither matches). Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1220,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1220 (reported directly; EBRW 610 + Math 590 sum = 1200 differs because composite quantiles ≠ section sums). CORRECTION UP +50 from prior 1170 (LEGACY_DB heuristic). Tier upgraded LEGACY_DB -> OFFICIAL. NOTE: UDel is test-optional through 2025 (CDS C8A "Not required for admission, but consider if submitted"); only 19.10% of Fall 2024 enrolled (780 students) submitted SAT.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1370,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1370 (reported directly; EBRW 700 + Math 690 sum = 1390 differs because composite quantiles ≠ section sums). CORRECTION UP +10 from prior 1360 (LEGACY_DB heuristic). Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 54.8,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 1,240 international admits / 2,263 international applicants = 54.7945% (rounded to 54.80%). CORRECTION DOWN -14.20pp from prior 69% (LEGACY_DB) — prior value was near the overall admit rate (69.24%), suggesting it was a stale/wrong-metric carry-over rather than the international-specific rate. Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 70.04,
      policyLabel: 'Out-of-state admit rate',
      reason:
        "CDS 2024-25 Section C1 residency table: 23,364 out-of-state admits / 33,360 out-of-state applicants = 70.0360% (rounded to 70.04%). UDel is a PUBLIC research university — in-state vs. out-of-state distinction carries real policy meaning (different tuition; OOS comprises ~84% of UDel's applicant pool, dwarfing the 10.4% in-state share, meaning UDel actively recruits nationally). Prior provenance was PERMANENT_HEURISTIC with null value and no source. Tier upgraded PERMANENT_HEURISTIC -> OFFICIAL with real CDS number.",
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. UDel does not offer Early Decision (only Early Action). Prior provenance was tier=OFFICIAL source=CDS_LLM_EXTRACT_2026_04 with value=undefined; refreshed to authoritative CDS pull marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED. Also correcting stale DB hasEarlyDecision=true -> false to match CDS C21 "No".',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: UDel offers nonbinding non-restrictive Early Action ("Yes" checked) — closing 11/1, notification 1/31. However, the C22 form does NOT include a "For the Fall 2024 entering class" applications/admits subform (CDS template only collects these counts under C21 ED, not C22 EA). Prior provenance was tier=OFFICIAL source=CDS_LLM_EXTRACT_2026_04 with value=undefined; refreshed to authoritative CDS pull marked UNAVAILABLE/OFFICIAL_BLANK_SECTION since CDS does not publish this number despite EA being offered.',
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
      acceptanceRate: new Prisma.Decimal('69.24'),
      sat25: 1220,
      sat75: 1370,
      intlAcceptanceRate: new Prisma.Decimal('54.80'),
      oosAcceptanceRate: new Prisma.Decimal('70.04'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — UDel does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  OK updated 7 fields (AR=69.24, sat25=1220, sat75=1370, intlAR=54.80, oosAR=70.04, edAR=NOT_OFFERED, eaAR=NOT_REPORTED, hasED=false)',
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
