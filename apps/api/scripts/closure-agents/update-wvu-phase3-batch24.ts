#!/usr/bin/env tsx
/**
 * Phase 3 — West Virginia University end-to-end closure of the 7
 *   prediction-critical fields.
 *
 * Source: WVU CDS 2024-2025 — PDF posted by WVU Data Office.
 *   URL: https://dataoffice.wvu.edu/files/d/d0809710-b583-4b08-8214-e297d97326d5/cds-2024-2025-wvu-final.pdf
 *
 * WVU is a PUBLIC research university (Morgantown, WV) — oosAR carries the
 *   real CDS number, not TERMINAL.
 *
 * CDS 2024-2025 facts pulled directly from the PDF:
 *   - C1 residency table (in-state / out-of-state / international):
 *       Applied:   3,485 / 15,652 / 1,013 / Total 20,150
 *       Admitted:  2,572 / 12,629 /   369 / Total 15,570
 *   - C8A: Test-optional — "Not required for admission, but consider if
 *          submitted" (SAT or ACT). C9 SAT scores still reported.
 *   - C9: SAT Composite 25th=1010, 50th=1110, 75th=1210 (composite row).
 *   - C21: Early Decision: No (not offered).
 *   - C22: Early Action: No (not offered).
 *
 * Computed rates:
 *   - acceptanceRate    : 15,570 / 20,150 = 77.2705% ~= 77.27 (TINY correction
 *                          from prior 77.3 -> 77.27; tier LEGACY -> OFFICIAL).
 *   - oosAcceptanceRate : 12,629 / 15,652 = 80.6925% ~= 80.69 (TINY correction
 *                          from prior 80.7 -> 80.69; tier LEGACY -> OFFICIAL).
 *   - intlAcceptanceRate:    369 /  1,013 = 36.4264% ~= 36.43 (TINY correction
 *                          from prior 36.4 -> 36.43; tier LEGACY -> OFFICIAL).
 *   - sat25             : 1010 (NO CHANGE in value; tier OFFICIAL but prior
 *                          source was prepscholar.com — upgraded to CDS_OFFICIAL
 *                          direct PDF.)
 *   - sat75             : 1210 (CORRECTION DOWN -10 from prior 1220 — prior
 *                          source was prepscholar.com snippet, not CDS. Tier
 *                          re-anchored to CDS_OFFICIAL direct PDF.)
 *   - edAcceptanceRate  : null (CDS C21 = No; NOT_OFFERED). Already correctly
 *                          recorded as OFFICIAL/NOT_OFFERED; LEFT UNCHANGED.
 *   - eaAcceptanceRate  : null (CDS C22 = No; NOT_OFFERED). Already correctly
 *                          recorded as OFFICIAL/NOT_OFFERED; LEFT UNCHANGED.
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
  'https://dataoffice.wvu.edu/files/d/d0809710-b583-4b08-8214-e297d97326d5/cds-2024-2025-wvu-final.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ira002jz0tib0nkhdsx';

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
    throw new Error(`School ${SCHOOL_ID} (West Virginia University) not found`);
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
    verifiedBy: 'closure-pipeline-phase3-batch24-claude',
    generatedBy: 'phase3-wvu-validation',
  };

  // Only re-write the 5 fields that are currently LEGACY (open). edAR/eaAR
  // already correctly closed as OFFICIAL/NOT_OFFERED pointing at the same
  // CDS PDF — preserve those untouched.
  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 77.27,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 15,570 admits / 20,150 first-time, first-year applicants = 77.2705% (rounded to 77.27%). TINY correction -0.03 from prior 77.3 to align with exact CDS arithmetic; tier upgraded LEGACY_DB_VALUE -> OFFICIAL with direct CDS PDF as source.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1010,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1010 (reported directly in composite row). NO change in numeric value; source re-anchored from prepscholar.com snippet to CDS PDF (CDS_OFFICIAL). WVU is test-optional ("Not required for admission, but consider if submitted") per C8A; SAT distribution still reported in C9 for the enrolled cohort.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1210,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1210 (reported directly in composite row). CORRECTION DOWN -10 from prior 1220 (prior was a prepscholar.com snippet, not CDS). Source re-anchored to CDS PDF (CDS_OFFICIAL).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 36.43,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 369 international admits / 1,013 international applicants = 36.4264% (rounded to 36.43%). TINY correction +0.03 from prior 36.4 to align with exact CDS arithmetic; tier upgraded LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 80.69,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 12,629 out-of-state admits / 15,652 out-of-state applicants = 80.6925% (rounded to 80.69%). WVU is a PUBLIC research university (Morgantown, WV) — in-state vs. OOS distinction carries real policy meaning. TINY correction -0.01 from prior 80.7; tier upgraded LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
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
      acceptanceRate: new Prisma.Decimal('77.27'),
      sat25: 1010,
      sat75: 1210,
      intlAcceptanceRate: new Prisma.Decimal('36.43'),
      oosAcceptanceRate: new Prisma.Decimal('80.69'),
      // edAR / eaAR already null (NOT_OFFERED) and already closed — preserve.
      // CDS C21 = No; correct stale DB true.
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 5 fields (AR=77.27, sat25=1010, sat75=1210, intlAR=36.43, oosAR=80.69) + hasED=false; edAR/eaAR LEFT closed as NOT_OFFERED',
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
