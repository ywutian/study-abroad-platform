#!/usr/bin/env tsx
/**
 * Phase 3 — Washington State University (WSU) end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: WSU CDS 2024-2025 (Fall 2024 entering class) published April 2025
 *   by Office of Strategy, Planning, and Analysis.
 *   URL: https://wpcdn.web.wsu.edu/wsuwp/uploads/sites/3447/2025/04/CDS_2024-2025.pdf
 *   Landing: https://strategy.wsu.edu/institutional-data/federal/
 *
 * WSU is a PUBLIC land-grant research university (CDS A2 "Public" checked) —
 *   oosAR is in eligible scope and carries the real CDS number, not TERMINAL.
 *
 * WSU is TEST-BLIND for Fall 2026 admission (CDS C8 "No" for SAT/ACT use in
 *   admission decisions; C8A SAT or ACT row blank under all considered/required
 *   columns). Per closure-pipeline convention, the reported CDS C9 SAT
 *   Composite percentiles are still recorded as OFFICIAL for descriptive
 *   applicant-profile use (not as a gating threshold).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 86.6  -> 89.03 (CDS 2024-25 C1: 22,668 admits /
 *                          25,462 applicants = 89.0268%. CORRECTION UP ~2.4pp
 *                          from prior LEGACY_DB 86.6. Tier LEGACY_DB_VALUE
 *                          -> OFFICIAL.)
 *   - sat25             : 1010  -> 1010  (CDS 2024-25 C9 SAT Composite 25th =
 *                          1010. NO CHANGE — tier already OFFICIAL with same
 *                          source URL; refreshing provenance to pull from
 *                          authoritative CDS PDF.)
 *   - sat75             : 1280  -> 1280  (CDS 2024-25 C9 SAT Composite 75th =
 *                          1280. NO CHANGE — tier already OFFICIAL. Refreshing
 *                          provenance. NOTE: WSU is TEST-BLIND — only 5% (303
 *                          enrolled freshmen) submitted SAT, 2% (66) submitted
 *                          ACT (ACT Composite 25/50/75 ~ 19/22/27).)
 *   - intlAcceptanceRate: 82    -> 80.36 (CDS 2024-25 C1 residency: 626 intl
 *                          admits / 779 intl applicants = 80.3594%.
 *                          CORRECTION DOWN ~1.6pp from prior LEGACY_DB 82.
 *                          Tier LEGACY_DB_VALUE -> OFFICIAL.)
 *   - oosAcceptanceRate : 87.8  -> 88.04 (CDS 2024-25 C1 residency: 8,425 OOS
 *                          admits / 9,569 OOS applicants = 88.0447%.
 *                          CORRECTION UP ~0.2pp from prior LEGACY_DB 87.8.
 *                          PUBLIC SCHOOL — oosAR is real OFFICIAL. Tier
 *                          LEGACY_DB_VALUE -> OFFICIAL.)
 *   - edAcceptanceRate  : null  -> null  (CDS 2024-25 C21: "No" — WSU does
 *                          NOT offer Early Decision. Already UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION in DB but provenance pointed
 *                          at a different URL (2025/09 vs. 2025/04). Refresh
 *                          to canonical April 2025 publication URL.)
 *   - eaAcceptanceRate  : null  -> null  (CDS 2024-25 C22: "No" — WSU does
 *                          NOT offer Early Action. Same refresh as ED.)
 *
 * NOTE on hasEarlyDecision: current DB value is TRUE, but CDS C21 is "No".
 *   Setting to FALSE to match CDS reality.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://wpcdn.web.wsu.edu/wsuwp/uploads/sites/3447/2025/04/CDS_2024-2025.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iqh0025z0ti7z1ynz4s';

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
    throw new Error(
      `School ${SCHOOL_ID} (Washington State University) not found`,
    );
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
    verifiedBy: 'closure-pipeline-phase3-batch22-claude',
    generatedBy: 'phase3-wsu-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 89.03,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 22,668 admits / 25,462 first-time, first-year applicants = 89.0268% (rounded to 89.03%). CORRECTION UP ~2.4pp from prior LEGACY_DB 86.6. Tier LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1010,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1010 (reported directly). No change in value — tier remains OFFICIAL, source refreshed to authoritative CDS PDF. NOTE: WSU is TEST-BLIND for Fall 2026 admission (CDS C8 "No"); only 5% (303 enrolled freshmen) submitted SAT, 2% (66) submitted ACT — SAT band is recorded for descriptive applicant-profile use only, not as a gating threshold.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1280,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1280 (reported directly). No change in value — tier remains OFFICIAL, source refreshed. Same test-blind + low-SAT-submission caveat as sat25.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 80.36,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 626 international admits / 779 international applicants = 80.3594% (rounded to 80.36%). CORRECTION DOWN ~1.6pp from prior LEGACY_DB 82. Tier LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 88.04,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 8,425 out-of-state admits / 9,569 out-of-state applicants = 88.0447% (rounded to 88.04%). WSU is a PUBLIC land-grant research university (Pullman, WA) — in-state vs. OOS distinction carries policy meaning (different tuition, residency-preference admit pathways). Tier upgraded from LEGACY_DB_VALUE (87.8) to OFFICIAL with minor precision adjustment.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. WSU does NOT offer Early Decision. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Provenance refreshed to canonical April 2025 CDS publication URL (was previously pointed at a September 2025 sibling URL). Also corrects stale hasEarlyDecision=true.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. WSU does NOT offer Early Action. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Provenance refreshed to canonical April 2025 CDS publication URL.',
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
      acceptanceRate: new Prisma.Decimal('89.03'),
      sat25: 1010,
      sat75: 1280,
      intlAcceptanceRate: new Prisma.Decimal('80.36'),
      oosAcceptanceRate: new Prisma.Decimal('88.04'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — WSU does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=89.03, sat25=1010, sat75=1280, intlAR=80.36, oosAR=88.04, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
