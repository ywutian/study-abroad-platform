#!/usr/bin/env tsx
/**
 * Phase 3 batch 7 — Vassar College end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: Vassar College CDS 2024-2025 (Fall 2024 entering class)
 *   URL: https://offices.vassar.edu/institutional-research/wp-content/uploads/sites/23/2025/03/Vassar-College-CDS-2024-2025-1.pdf
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 18.57 → 18.57  (CDS C1 Total: 2,311 admits / 12,447
 *                          applicants = 18.5667% (rounded to 18.57). Value
 *                          matches prior DB; tier upgraded LEGACY_DB → OFFICIAL.)
 *   - sat25             : 1380  → 1460   (CDS C9: SAT Composite 25th = 1460
 *                          reported directly. CORRECTION UP +80 from prior
 *                          SEED/HEURISTIC:PR-15. Tier upgraded SEED → OFFICIAL.
 *                          31% of Fall 2024 enrolled (208 students) submitted
 *                          SAT under test-optional policy.)
 *   - sat75             : 1540  → 1520   (CDS C9: SAT Composite 75th = 1520
 *                          reported directly; EBRW 770 + Math 780 sum = 1550
 *                          differs because composite quantiles ≠ section sums.
 *                          CORRECTION DOWN -20 from prior SEED/HEURISTIC:PR-15.
 *                          Tier upgraded SEED → OFFICIAL.)
 *   - intlAcceptanceRate: 4.05  → 4.05   (CDS C1 residency: 156 intl admits /
 *                          3,848 intl applicants = 4.0541%. Value matches prior
 *                          DB; tier upgraded LEGACY_DB → OFFICIAL.)
 *   - oosAcceptanceRate : 25.52 → null   (Vassar is a private liberal arts
 *                          college; in-state / out-of-state distinction
 *                          carries no policy meaning. CDS C1 residency does
 *                          report OOS (1,582/6,198 = 25.52%) but per
 *                          closure-pipeline convention, private schools →
 *                          UNAVAILABLE/TERMINAL. Prior legacy DB value cleared.)
 *   - edAcceptanceRate  : 31.23 → 31.23  (CDS C21: Vassar offers ED ("Yes"). Two
 *                          plans — ED I 11/15 closing (12/15 notification);
 *                          ED II 1/1 closing (2/1 notification). Fall 2024
 *                          entering class combined: 312 admits / 999 ED
 *                          applications = 31.2312% (rounded to 31.23). Value
 *                          matches prior DB; tier upgraded LEGACY_DB → OFFICIAL.)
 *   - eaAcceptanceRate  : 33.46 → null   (CDS C22: Vassar College does NOT
 *                          offer a nonbinding Early Action plan ("No" checked).
 *                          Prior DB value (33.46% from CDS 2023-24 sourceUrl)
 *                          was incorrectly preserved — Vassar has not offered
 *                          EA. CORRECTION: cleared, marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const VASSAR_CDS_URL =
  'https://offices.vassar.edu/institutional-research/wp-content/uploads/sites/23/2025/03/Vassar-College-CDS-2024-2025-1.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const vassar = await prisma.school.findFirst({
    where: { id: 'cmnwr8iv9004dz0tirpo4zq16', name: 'Vassar College' },
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
  if (!vassar) throw new Error('Vassar College not found');
  console.log(`Updating ${vassar.name} (${vassar.id})`);
  console.log(
    `  current AR=${vassar.acceptanceRate?.toString()} sat25=${vassar.sat25} sat75=${vassar.sat75}`,
  );
  console.log(
    `  current intlAR=${vassar.intlAcceptanceRate?.toString()} oosAR=${vassar.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${vassar.edAcceptanceRate?.toString()} eaAR=${vassar.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: VASSAR_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-vassar-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 18.57,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 2,311 admits / 12,447 applicants = 18.5667% (rounded to 18.57%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance. Cycle: Fall 2024 entering class.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1460,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1460 (reported directly). CORRECTION UP from prior 1380 (SEED/HEURISTIC:PR-15). Tier upgraded from SEED/HEURISTIC to OFFICIAL. 31% of Fall 2024 enrolled (208 students) submitted SAT under test-optional policy.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1520,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1520 (reported directly; SAT EBRW 770 + SAT Math 780 sum = 1550 differs because composite quantiles ≠ section sums). CORRECTION DOWN from prior 1540 (SEED/HEURISTIC:PR-15). Tier upgraded from SEED/HEURISTIC to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 4.05,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 156 international admits / 3,848 international applicants = 4.0541% (rounded to 4.05%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Vassar College is a private liberal arts college; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table does report OOS (1,582 admits / 6,198 applicants = 25.5244%), but the value is not actionable for applicants. Prior legacy DB value (25.52%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 31.23,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2024-25 Section C21: Vassar offers Early Decision ("Yes" checked) — two plans: ED I closes 11/15 (12/15 notification); ED II closes 1/1 (2/1 notification). Fall 2024 entering class combined: 312 admits / 999 ED applications = 31.2312% (rounded to 31.23%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: Vassar College does NOT offer a nonbinding Early Action plan ("No" checked for EA plan). Prior DB value (33.46%, sourced from CDS 2023-24 PDF marked OFFICIAL_SCHOOL) was incorrectly preserved — Vassar has not offered EA in current CDS. CORRECTION: value cleared, provenance refreshed from prior OFFICIAL_SCHOOL with value=33.46 to authoritative CDS_OFFICIAL pull marked UNAVAILABLE-terminal/NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(vassar.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: VASSAR_CDS_URL,
  };

  await prisma.school.update({
    where: { id: vassar.id },
    data: {
      acceptanceRate: new Prisma.Decimal('18.57'),
      sat25: 1460,
      sat75: 1520,
      intlAcceptanceRate: new Prisma.Decimal('4.05'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('31.23'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=18.57, sat25=1460, sat75=1520, intlAR=4.05, oosAR=N/A, edAR=31.23, eaAR=NOT_OFFERED)',
  );

  const after = await prisma.school.findUnique({
    where: { id: vassar.id },
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
