#!/usr/bin/env tsx
/**
 * Phase 3 batch 6 — Carleton College end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: Carleton College CDS 2023-2024 (Fall 2023 entering class)
 *   URL: https://carleton-wp-production.s3.amazonaws.com/uploads/sites/292/2024/05/CDS_UNL2_2023_2024_Carleton-FINAL.pdf
 *
 * NOTE: This is the authoritative CDS URL specified for this closure task.
 * The CDS reports Fall 2023 entering class data (cycleYear=2023). Prior DB
 * provenance referenced a newer 2024-2025 CDS for some fields, but the
 * authoritative URL provided drives this update.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 17.85 → 22.28  (CDS C1 Total: 1,440 admits / 6,464
 *                          applicants = 22.2772%. Tier upgraded LEGACY_DB
 *                          (sourceUrl pointed to collegekickstart.com
 *                          aggregator) → OFFICIAL. CORRECTION UP +4.43pp.)
 *   - sat25             : 1380  → 1440   (CDS C9: SAT Composite 25th = 1440
 *                          (reported directly). CORRECTION UP +60 from prior
 *                          1380 (SEED/PR-15 heuristic). Tier upgraded
 *                          SEED/HEURISTIC → OFFICIAL.)
 *   - sat75             : 1540  → 1530   (CDS C9: SAT Composite 75th = 1530
 *                          (reported directly). CORRECTION DOWN -10 from
 *                          prior 1540 (SEED/PR-15 heuristic). Tier upgraded
 *                          SEED/HEURISTIC → OFFICIAL.)
 *   - intlAcceptanceRate: 5.15  → 5.15   (CDS C1 residency: 141 intl admits /
 *                          2,737 intl applicants = 5.1516%. Value matches
 *                          prior DB; tier upgraded LEGACY_DB → OFFICIAL.)
 *   - oosAcceptanceRate : 35.84 → null   (Carleton is a private liberal arts
 *                          college; in-state / out-of-state distinction
 *                          carries no policy meaning. CDS C1 residency does
 *                          report OOS (1,042/2,907 = 35.84%) but per
 *                          closure-pipeline convention, private schools →
 *                          UNAVAILABLE/TERMINAL. Prior legacy DB value
 *                          cleared.)
 *   - edAcceptanceRate  : 36.58 → 38.78  (CDS C21: ED offered ("Yes"). Fall
 *                          2023 entering class: 247 admits / 637 ED
 *                          applications = 38.7755% (rounded 38.78%).
 *                          CORRECTION UP +2.20pp from prior DB (which was
 *                          based on a different/newer ED cycle). Tier
 *                          upgraded LEGACY_DB → OFFICIAL.)
 *   - eaAcceptanceRate  : null  → null   (CDS C22: Carleton does NOT offer a
 *                          nonbinding Early Action plan ("No" checked).
 *                          Provenance refreshed to authoritative CDS pull
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CARLETON_CDS_URL =
  'https://carleton-wp-production.s3.amazonaws.com/uploads/sites/292/2024/05/CDS_UNL2_2023_2024_Carleton-FINAL.pdf';
const CYCLE_YEAR = 2023; // CDS 2023-2024 = Fall 2023 entering class
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const carleton = await prisma.school.findFirst({
    where: { id: 'cmnwr8iv20049z0ti4tahvum5', name: 'Carleton College' },
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
  if (!carleton) throw new Error('Carleton College not found');
  console.log(`Updating ${carleton.name} (${carleton.id})`);
  console.log(
    `  current AR=${carleton.acceptanceRate?.toString()} sat25=${carleton.sat25} sat75=${carleton.sat75}`,
  );
  console.log(
    `  current intlAR=${carleton.intlAcceptanceRate?.toString()} oosAR=${carleton.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${carleton.edAcceptanceRate?.toString()} eaAR=${carleton.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: CARLETON_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-carleton-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 22.28,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2023-24 Section C1: 1,440 admits / 6,464 applicants = 22.2772% (rounded to 22.28%). Tier upgraded from LEGACY_DB (value 17.85, sourceUrl pointed to collegekickstart.com aggregator — not Carleton) to OFFICIAL. CORRECTION UP +4.43pp. Cycle: Fall 2023 entering class (per CDS authoritative source).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1440,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2023-24 Section C9: SAT Composite 25th = 1440 (reported directly). CORRECTION UP from prior 1380 (SEED/HEURISTIC:PR-15). Tier upgraded from SEED/HEURISTIC to OFFICIAL. 32% of Fall 2023 enrolled (173 students) submitted SAT under test-optional policy.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1530,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2023-24 Section C9: SAT Composite 75th = 1530 (reported directly; SAT EBRW 760 + SAT Math 790 sum = 1550 differs because composite quantiles ≠ section sums). CORRECTION DOWN from prior 1540 (SEED/HEURISTIC:PR-15). Tier upgraded from SEED/HEURISTIC to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 5.15,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2023-24 Section C1 residency table: 141 international admits / 2,737 international applicants = 5.1516% (rounded to 5.15%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Carleton College is a private liberal arts college; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table does report OOS (1,042 admits / 2,907 applicants = 35.8445%), but the value is not actionable for applicants. Prior legacy DB value (35.84%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 38.78,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2023-24 Section C21: Carleton offers Early Decision ("Yes" checked) — two plans: ED I closes 11/15 (12/15 notification); ED II closes 1/15 (2/15 notification). Fall 2023 entering class combined: 247 admits / 637 ED applications = 38.7755% (rounded to 38.78%). CORRECTION UP from prior DB (36.58%, sourced from a different/newer CDS PDF). Tier upgraded from LEGACY_DB to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2023-24 Section C22: Carleton College does NOT offer a nonbinding Early Action plan ("No" selected). DB value was already null; provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 to authoritative CDS_OFFICIAL pull marked UNAVAILABLE-terminal/NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(carleton.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: CARLETON_CDS_URL,
  };

  await prisma.school.update({
    where: { id: carleton.id },
    data: {
      acceptanceRate: new Prisma.Decimal('22.28'),
      sat25: 1440,
      sat75: 1530,
      intlAcceptanceRate: new Prisma.Decimal('5.15'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('38.78'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=22.28, sat25=1440, sat75=1530, intlAR=5.15, oosAR=N/A, edAR=38.78, eaAR=NOT_OFFERED)',
  );

  const after = await prisma.school.findUnique({
    where: { id: carleton.id },
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
