#!/usr/bin/env tsx
/**
 * Phase 3 — Kent State University end-to-end closure of the 7 prediction-critical
 *   fields.
 *
 * Source: Kent State CDS 2025-2026 (Fall 2025 entering class) — .docx posted by
 *   Kent State Institutional Research.
 *   URL: https://www-s3-live.kent.edu/s3fs-root/s3fs-public/file/KC%20CDS_2025-2026-Final_web_0.docx
 *   Landing: https://www.kent.edu/ir/common-dataset-cds
 *
 * Kent State is a PUBLIC research university (Kent, OH) — oosAR carries the
 *   real CDS number, not TERMINAL.
 *
 * CDS 2025-2026 facts pulled directly from the .docx:
 *   - C1 residency table (in-state / out-of-state / international):
 *       Applied:  16,510 / 5,903 / 3,113 / Total 25,526
 *       Admitted: 10,028 / 3,421 / 2,566 / Total 16,015
 *   - C8: Uses SAT/ACT in admission decisions (Yes)
 *   - C9: SAT Composite 25th=990, 50th=1120, 75th=1230 (composite row)
 *   - C21: Early Decision: No (not offered)
 *   - C22: Early Action: No (not offered)
 *
 * Computed rates:
 *   - acceptanceRate    : 16,015 / 25,526 = 62.7438% ~= 62.74 (NO CHANGE in
 *                          value; tier upgraded LEGACY_DB_VALUE -> OFFICIAL.)
 *   - oosAcceptanceRate :  3,421 /  5,903 = 57.9536% ~= 57.95 (NO CHANGE in
 *                          value; tier upgraded LEGACY_DB_VALUE -> OFFICIAL.)
 *   - intlAcceptanceRate:  2,566 /  3,113 = 82.4285% ~= 82.43 (NO CHANGE in
 *                          value; tier upgraded LEGACY_DB_VALUE -> OFFICIAL.)
 *   - sat25             : 990 (CORRECTION DOWN -30 from prior 1020 — prior was
 *                          a heuristic/older value). Tier LEGACY_DB_VALUE ->
 *                          OFFICIAL.
 *   - sat75             : 1230 (NO CHANGE in value; tier LEGACY_DB_VALUE ->
 *                          OFFICIAL.)
 *   - edAcceptanceRate  : null (CDS C21 = No; NOT_OFFERED). Replaces prior
 *                          provenance which cited an unrelated Information
 *                          Packet 2024-25 PDF (not the CDS), preserving the
 *                          correct null value.
 *   - eaAcceptanceRate  : null (CDS C22 = No; NOT_OFFERED). Same correction.
 *
 * NOTE on hasEarlyDecision: current DB value is TRUE, but CDS C21 = No.
 *   Setting to FALSE to match CDS reality.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www-s3-live.kent.edu/s3fs-root/s3fs-public/file/KC%20CDS_2025-2026-Final_web_0.docx';
const CYCLE_YEAR = 2025; // CDS 2025-2026 = Fall 2025 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ir0002fz0tiuxlv8v32';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Kent State) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC SCHOOL]`);
  console.log(
    `  current AR=${school.acceptanceRate?.toString()} sat25=${school.sat25} sat75=${school.sat75}`,
  );
  console.log(
    `  current intlAR=${school.intlAcceptanceRate?.toString()} oosAR=${school.oosAcceptanceRate?.toString()}`,
  );

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-batch23-claude',
    generatedBy: 'phase3-kent-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 62.74,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2025-26 Section C1: 16,015 admits / 25,526 first-time, first-year applicants = 62.7438% (rounded to 62.74%). NO change in numeric value, tier upgraded LEGACY_DB_VALUE -> OFFICIAL with direct CDS .docx as source.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 990,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2025-26 Section C9: SAT Composite 25th = 990 (reported directly in composite row, not EBRW or Math alone). CORRECTION DOWN -30 from prior 1020 (which was a heuristic/older value). NOTE: Kent State uses SAT/ACT in admission decisions (C8 = Yes).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1230,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2025-26 Section C9: SAT Composite 75th = 1230 (reported directly). NO change in numeric value; tier upgraded LEGACY_DB_VALUE -> OFFICIAL with direct CDS .docx as source.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 82.43,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2025-26 Section C1 residency table: 2,566 international admits / 3,113 international applicants = 82.4285% (rounded to 82.43%). NO change in numeric value; tier upgraded LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 57.95,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2025-26 Section C1 residency table: 3,421 out-of-state admits / 5,903 out-of-state applicants = 57.9536% (rounded to 57.95%). Kent State is a PUBLIC research university (Kent, OH) — in-state vs. OOS distinction carries real policy meaning. NO change in numeric value; tier upgraded LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2025-26 Section C21: "Does your institution offer an early decision plan?" — NO. Kent State does NOT offer Early Decision. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Replaces prior provenance that cited an unrelated Information Packet 2024-25 PDF; corrects stale hasEarlyDecision=true.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2025-26 Section C22: "Do you have a nonbinding early action plan?" — NO. Kent State does NOT offer Early Action. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Replaces prior provenance that cited an unrelated Information Packet 2024-25 PDF.',
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
      acceptanceRate: new Prisma.Decimal('62.74'),
      sat25: 990,
      sat75: 1230,
      intlAcceptanceRate: new Prisma.Decimal('82.43'),
      oosAcceptanceRate: new Prisma.Decimal('57.95'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 = No; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=62.74, sat25=990, sat75=1230, intlAR=82.43, oosAR=57.95, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
