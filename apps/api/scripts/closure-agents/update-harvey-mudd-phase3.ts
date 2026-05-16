#!/usr/bin/env tsx
/**
 * Phase 3 — Harvey Mudd College end-to-end closure of the 7 prediction-critical fields.
 *
 * Source: Harvey Mudd CDS 2024-2025 (parsed by Claude from PDF)
 *   URL: https://www.hmc.edu/institutional-research/wp-content/uploads/sites/42/2024/12/CDS-2024-2025-SharedtoWeb.pdf
 *
 * All 7 fields upgraded to OFFICIAL (or UNAVAILABLE-terminal where Harvey Mudd
 * structurally cannot publish the value).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 12.66  → 12.66  (CDS C1: 645/5094 = 12.661%; value confirmed, only tier+source upgraded)
 *   - sat25             : 1380   → 1510   (CDS C9: SAT Composite 25th percentile; prior SEED/HEURISTIC value)
 *   - sat75             : 1540   → 1560   (CDS C9: SAT Composite 75th percentile; prior SEED/HEURISTIC value)
 *   - intlAcceptanceRate: 4.64   → 4.64   (CDS C1 residency: 56/1206 = 4.643%; tier+source upgraded)
 *   - oosAcceptanceRate : 19.39  → null   (private school; in-state/OOS distinction does not apply)
 *   - edAcceptanceRate  : 17.83  → 16.16  (CDS C21: 106/656 = 16.159%; CORRECTION from prior 17.83%)
 *   - eaAcceptanceRate  : -      → -      (CDS C22 "No" — HMC does NOT offer EA; tier corrected to OFFICIAL_BLANK_SECTION/NOT_OFFERED)
 *
 *   Note on sat25/sat75: CDS C9 reports SAT Composite row directly (1510/1530/1560).
 *   We prefer the reported Composite over EBRW+Math sum (which would give 1500/1570).
 *   Per Phase 2 convention: when Composite row exists, use it.
 *
 *   Note on oosAR: CDS does report residency-segmented applicants (in-state 277/2279,
 *   OOS 312/1609), but for a private institution the in-state/OOS distinction carries
 *   no policy meaning. Per Phase 2 convention, private → UNAVAILABLE/TERMINAL.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const HMC_CDS_URL =
  'https://www.hmc.edu/institutional-research/wp-content/uploads/sites/42/2024/12/CDS-2024-2025-SharedtoWeb.pdf';
const CYCLE_YEAR = '2024-2025';
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const hmc = await prisma.school.findFirst({
    where: { name: { contains: 'Harvey Mudd' }, country: 'US' },
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
  if (!hmc) throw new Error('Harvey Mudd not found');
  console.log(`Updating ${hmc.name} (${hmc.id})`);
  console.log(
    `  current AR=${hmc.acceptanceRate?.toString()} sat25=${hmc.sat25} sat75=${hmc.sat75}`,
  );
  console.log(
    `  current intlAR=${hmc.intlAcceptanceRate?.toString()} oosAR=${hmc.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${hmc.edAcceptanceRate?.toString()} eaAR=${hmc.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: HMC_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-harvey-mudd-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 12.66,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 645 admitted / 5,094 applicants = 12.661% (rounded to 12.66%). Value confirmed against prior DB.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1510,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th percentile = 1510 (reported directly). CORRECTION from prior SEED/HEURISTIC value 1380.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1560,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th percentile = 1560 (reported directly; differs from EBRW 770 + Math 800 = 1570 because composite quantiles ≠ section sums). CORRECTION from prior SEED/HEURISTIC value 1540.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 4.64,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 56 international admitted / 1,206 international applicants = 4.643% (rounded to 4.64%). Value confirmed against prior DB.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Harvey Mudd is a private institution; in-state/out-of-state distinction carries no policy meaning (no in-state tuition advantage). Although CDS C1 residency table does break down OOS counts (312/1609 = 19.39%), the value is not actionable for applicants. Prior DB heuristic value (19.39%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 16.16,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: Harvey Mudd offers Early Decision ("Yes" checked). Fall 2024 entering class: 656 ED applications, 106 admitted = 16.159% (rounded to 16.16%). CORRECTION from prior 17.83%.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: Harvey Mudd does NOT offer a nonbinding Early Action plan ("No" checked). Field marked UNAVAILABLE-terminal (not offered).',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(hmc.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: HMC_CDS_URL,
  };

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: hmc.id },
    data: {
      acceptanceRate: new Prisma.Decimal('12.66'),
      sat25: 1510,
      sat75: 1560,
      intlAcceptanceRate: new Prisma.Decimal('4.64'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('16.16'),
      hasEarlyDecision: true, // re-confirm from CDS C21
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR, sat25, sat75, intlAR, oosAR=N/A, edAR, eaAR=NOT_OFFERED)',
  );

  // verify
  const after = await prisma.school.findUnique({
    where: { id: hmc.id },
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
    `  intlAR=${after?.intlAcceptanceRate?.toString() ?? 'null'} oosAR=${after?.oosAcceptanceRate?.toString() ?? 'null'}`,
  );
  console.log(
    `  edAR=${after?.edAcceptanceRate?.toString() ?? 'null'} eaAR=${after?.eaAcceptanceRate?.toString() ?? 'null'} hasED=${after?.hasEarlyDecision}`,
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
