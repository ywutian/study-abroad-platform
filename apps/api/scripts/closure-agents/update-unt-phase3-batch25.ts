#!/usr/bin/env tsx
/**
 * Phase 3 — University of North Texas (UNT) closure of the 7
 *   prediction-critical fields.
 *
 * Source:
 *   Primary: UNT CDS 2024-2025 — UNT Institutional Research.
 *     https://institutionalresearch.unt.edu/cds_univnorthtx_final2024-2025.pdf
 *
 * UNT is a PUBLIC R1 research university (Denton, TX).
 *
 * CDS 2024-25 facts (from PDF):
 *   - C1 with FULL residency breakdown (NOT redacted):
 *       Applied:  IS=34,181 OOS=2,089 Intl=2,207 Unknown=0 Total=38,477
 *       Admitted: IS=24,992 OOS=1,526 Intl=1,275 Unknown=0 Total=27,793
 *       Enrolled: IS=6,080  OOS=211   Intl=439   Unknown=0 Total=6,730
 *     -> AR    = 27,793 / 38,477 = 72.2353% ≈ 72.23
 *     -> oosAR =  1,526 /  2,089 = 73.0493% ≈ 73.05
 *     -> intlAR=  1,275 /  2,207 = 57.7707% ≈ 57.77
 *   - C8A: SAT/ACT "Not considered for admission, even if submitted" (test-blind).
 *   - C9: SAT Composite 25th=990, 50th=1100, 75th=1220 (composite row).
 *   - C21: Early Decision = NO (NOT_OFFERED).
 *   - C22: Early Action  = NO (NOT_OFFERED).
 *
 * Computed actions:
 *   - acceptanceRate    : 72.23 -> 72.23 (NO numeric change; tier
 *                          LEGACY_DB_VALUE -> OFFICIAL with cycleYear).
 *   - sat25             : 980 -> 990 (CORRECTION UP +10; tier
 *                          LEGACY_DB_VALUE -> OFFICIAL; CDS C9 composite).
 *   - sat75             : 1230 -> 1220 (CORRECTION DOWN -10; tier
 *                          LEGACY -> OFFICIAL; CDS C9 composite).
 *   - intlAcceptanceRate: 57.77 -> 57.77 (NO change; tier LEGACY -> OFFICIAL).
 *   - oosAcceptanceRate : 73.05 -> 73.05 (NO change; tier LEGACY -> OFFICIAL).
 *   - edAcceptanceRate  : null (NOT_OFFERED per C21) — already correctly
 *                          OFFICIAL pointing at CDS — LEFT UNCHANGED.
 *   - eaAcceptanceRate  : 87.18 -> null (CORRECTION; CDS C22 = NO. Prior
 *                          value 87.18 was sourced from TAVILY_ENRICHMENT
 *                          which CONTRADICTS the institution's official
 *                          CDS. Tier upgraded VERIFIED_REAL -> OFFICIAL
 *                          with source NOT_OFFERED.)
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

const CDS_URL =
  'https://institutionalresearch.unt.edu/cds_univnorthtx_final2024-2025.pdf';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8irq002rz0ti2ejl7chb';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UNT) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC SCHOOL]`);
  console.log(
    `  current AR=${school.acceptanceRate?.toString()} sat25=${school.sat25} sat75=${school.sat75}`,
  );
  console.log(
    `  current intlAR=${school.intlAcceptanceRate?.toString()} oosAR=${school.oosAcceptanceRate?.toString()} eaAR=${school.eaAcceptanceRate?.toString()}`,
  );

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-batch25-claude',
    generatedBy: 'phase3-unt-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 72.23,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1 totals: 27,793 admits / 38,477 first-time, first-year applicants = 72.2353% (72.23%). No numeric change; tier LEGACY_DB_VALUE -> OFFICIAL with direct CDS PDF.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 990,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 990 (reported directly in composite row). CORRECTION UP +10 from prior 980 (LEGACY_DB_VALUE). Tier LEGACY -> OFFICIAL. NOTE: UNT is test-blind for admission per C8A; C9 reflects the enrolled cohort that submitted scores.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1220,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1220 (reported directly in composite row). CORRECTION DOWN -10 from prior 1230 (LEGACY_DB_VALUE). Tier LEGACY -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 57.77,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency row: International admitted 1,275 / International applied 2,207 = 57.7707% (57.77%). No numeric change; tier LEGACY_DB_VALUE -> OFFICIAL with proper cycleYear.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 73.05,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency row: OOS admitted 1,526 / OOS applied 2,089 = 73.0493% (73.05%). No numeric change; tier LEGACY_DB_VALUE -> OFFICIAL. UNT is a PUBLIC R1 university (Denton, TX) — OOS distinction is policy-meaningful.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'NOT_OFFERED',
      value: null,
      policyLabel: 'Early Action (not offered)',
      reason:
        'CDS 2024-25 Section C22: Early Action = NO (UNT does not offer EA). CORRECTION: prior value 87.18 sourced from TAVILY_ENRICHMENT CONTRADICTS the institutional CDS — the rate is N/A because the policy does not exist. Tier VERIFIED_REAL (Tavily) -> OFFICIAL / NOT_OFFERED.',
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
      acceptanceRate: new Prisma.Decimal('72.23'),
      sat25: 990,
      sat75: 1220,
      intlAcceptanceRate: new Prisma.Decimal('57.77'),
      oosAcceptanceRate: new Prisma.Decimal('73.05'),
      eaAcceptanceRate: null, // NOT_OFFERED — overwriting incorrect Tavily value.
      // edAR LEFT UNCHANGED (already OFFICIAL null/NOT_OFFERED).
      hasEarlyDecision: false, // CDS C21 = No.
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 6 fields (AR=72.23, sat25=990, sat75=1220, intlAR=57.77, oosAR=73.05, eaAR=NOT_OFFERED) + hasED=false',
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
