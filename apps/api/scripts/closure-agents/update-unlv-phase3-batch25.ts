#!/usr/bin/env tsx
/**
 * Phase 3 — University of Nevada, Las Vegas (UNLV) closure of the 7
 *   prediction-critical fields.
 *
 * Sources:
 *   Primary (2024-25): UNLV CDS 2024-2025 — UNLV IR.
 *     https://www.it.unlv.edu/sites/default/files/assets/ir/UNLV_common_dataset_2024-2025_2.pdf
 *   Reference (2023-24): UNLV CDS 2023-2024 — UNLV IR.
 *     https://it.unlv.edu/sites/default/files/assets/ir/UNLV_common_dataset_2023-2024.pdf
 *
 * UNLV is a PUBLIC R1 research university (Las Vegas, NV).
 *
 * CDS 2024-25 facts (from PDF):
 *   - C1 totals (gender sums; residency cells BLANK in 2024-25):
 *       Applied:  5937 + 8491 + 44 + 0 = 14,472
 *       Admitted: 4918 + 7286 + 38 + 0 = 12,242
 *       Enrolled: 1891 + 2539 = 4,430
 *     -> AR = 12,242 / 14,472 = 84.5910% ≈ 84.59
 *     -> residency breakdown UNAVAILABLE in 2024-25 CDS (BLANK).
 *   - C8A: SAT/ACT NOT required and NOT considered for admission (test-blind).
 *   - C9: SAT Composite literal values 25th=750, 50th=1010, 75th=1020 (note:
 *     the 50→75 jump of 10 pts is mathematically anomalous vs EBRW+Math
 *     subscores summing to 75th≈1240; this is an internal CDS inconsistency).
 *     PRIOR DB sat25/sat75 are already tier=OFFICIAL (CDS_PDF_AUTO) with
 *     values 1000/1220. Per closure rule "do not overwrite already-closed
 *     fields", sat25/sat75 LEFT UNCHANGED.
 *   - C21: Early Decision = NO (NOT_OFFERED).
 *   - C22: Early Action  = NO (NOT_OFFERED).
 *
 * CDS 2023-24 residency breakdown (from PDF) — applied as REFERENCE for
 *   intlAR/oosAR closure (since 2024-25 residency is BLANK):
 *       Applied:  IS=7563, OOS=5845, Intl=303, Total=13,711
 *       Admitted: IS=6915, OOS=4582, Intl=261, Total=11,758
 *     -> oosAR  = 4582 / 5845 = 78.3918% ≈ 78.39
 *     -> intlAR =  261 /  303 = 86.1386% ≈ 86.14
 *
 *   The DB currently holds intlAR=86.1 and oosAR=78.4 (LEGACY_DB_VALUE
 *   pointing at 2023-24 PDF). These NUMERIC VALUES match the 2023-24 CDS
 *   to within rounding (86.14 vs 86.1; 78.39 vs 78.4). Per workflow
 *   guidance "preserve close-enough OFFICIAL values; just upgrade tier",
 *   we tier-upgrade LEGACY_DB_VALUE -> OFFICIAL with proper CDS URL +
 *   cycleYear, and refine value to the CDS-derived exact figure (86.14 /
 *   78.39).
 *
 * Computed actions:
 *   - acceptanceRate    : 87 -> 84.59 (CORRECTION DOWN -2.41; tier
 *                          LEGACY_DB_VALUE -> OFFICIAL from 2024-25 CDS).
 *   - sat25 / sat75     : LEFT UNCHANGED (already OFFICIAL).
 *   - intlAcceptanceRate: 86.1 -> 86.14 (refine; tier LEGACY -> OFFICIAL,
 *                          source = 2023-24 CDS C1 residency table — note
 *                          the 2024-25 cycle redacts this row).
 *   - oosAcceptanceRate : 78.4 -> 78.39 (refine; tier LEGACY -> OFFICIAL,
 *                          source = 2023-24 CDS C1 residency table — note
 *                          the 2024-25 cycle redacts this row).
 *   - edAcceptanceRate  : null (NOT_OFFERED per C21) — already correctly
 *                          OFFICIAL — LEFT UNCHANGED.
 *   - eaAcceptanceRate  : null (NOT_OFFERED per C22) — already correctly
 *                          OFFICIAL — LEFT UNCHANGED.
 *
 * NOTE on hasEarlyDecision: current DB true, but CDS C21 = No.
 *   Setting to FALSE to match CDS reality.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_2024_URL =
  'https://www.it.unlv.edu/sites/default/files/assets/ir/UNLV_common_dataset_2024-2025_2.pdf';
const CDS_2023_URL =
  'https://it.unlv.edu/sites/default/files/assets/ir/UNLV_common_dataset_2023-2024.pdf';
const CYCLE_2024 = 2024;
const CYCLE_2023 = 2023;
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8irs002sz0ti22brcgol';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UNLV) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC SCHOOL]`);
  console.log(
    `  current AR=${school.acceptanceRate?.toString()} sat25=${school.sat25} sat75=${school.sat75}`,
  );
  console.log(
    `  current intlAR=${school.intlAcceptanceRate?.toString()} oosAR=${school.oosAcceptanceRate?.toString()}`,
  );

  const baseProv2024 = {
    sourceUrl: CDS_2024_URL,
    cycleYear: CYCLE_2024,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-batch25-claude',
    generatedBy: 'phase3-unlv-validation',
  };
  const baseProv2023 = {
    sourceUrl: CDS_2023_URL,
    cycleYear: CYCLE_2023,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-batch25-claude',
    generatedBy: 'phase3-unlv-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv2024,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 84.59,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1 (gender totals): 12,242 admits / 14,472 first-time, first-year applicants = 84.5910% (84.59%). CORRECTION DOWN -2.41 from prior 87 (prior was LEGACY_DB_VALUE). Tier LEGACY_DB_VALUE -> OFFICIAL with direct CDS PDF.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv2023,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 86.14,
      policyLabel: 'International admit rate (2023-24 CDS reference cycle)',
      reason:
        'CDS 2023-24 Section C1 residency row: International admitted 261 / International applied 303 = 86.1386% (86.14%). Refinement from prior 86.1 (LEGACY_DB_VALUE -> OFFICIAL). NOTE: CDS 2024-25 redacts the residency breakdown (cells BLANK), so the 2023-24 cycle is the most recent official disclosure of international applicant counts.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv2023,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 78.39,
      policyLabel: 'Out-of-state admit rate (2023-24 CDS reference cycle)',
      reason:
        'CDS 2023-24 Section C1 residency row: OOS admitted 4,582 / OOS applied 5,845 = 78.3918% (78.39%). Refinement from prior 78.4 (LEGACY_DB_VALUE -> OFFICIAL). NOTE: CDS 2024-25 redacts the residency breakdown (cells BLANK), so the 2023-24 cycle is the most recent official disclosure of OOS counts. UNLV is a PUBLIC R1 university (Las Vegas, NV) — OOS distinction is policy-meaningful.',
      realDataStatus: 'VERIFIED_REAL',
    },
  };

  const existingMeta = toRecord(school.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: CDS_2024_URL,
  };

  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('84.59'),
      intlAcceptanceRate: new Prisma.Decimal('86.14'),
      oosAcceptanceRate: new Prisma.Decimal('78.39'),
      // sat25 / sat75 LEFT UNCHANGED (already OFFICIAL).
      // edAR / eaAR LEFT UNCHANGED (already OFFICIAL NOT_OFFERED).
      hasEarlyDecision: false, // CDS 2024-25 C21 = No.
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 3 fields (AR=84.59 [-2.41], intlAR=86.14, oosAR=78.39) + hasED=false; sat25/sat75/edAR/eaAR LEFT closed',
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
