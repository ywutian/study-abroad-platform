#!/usr/bin/env tsx
/**
 * Phase 3 batch 7 — Colgate University end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: Colgate University CDS 2023-2024 (Fall 2023 entering class)
 *   URL: https://www.colgate.edu/sites/default/files/2024-07/CDS_2023-2024%20FINAL.pdf
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 13.5  → 11.95  (CDS C1 Total: 2,526 admits / 21,130
 *                          applicants = 11.9546% (rounded to 11.95).
 *                          CORRECTION DOWN -1.55pp. Tier upgraded LEGACY_DB
 *                          (sourceUrl pointed to collegekickstart.com
 *                          aggregator) → OFFICIAL.)
 *   - sat25             : 1380  → 1440   (CDS C9: SAT Composite 25th = 1440
 *                          reported directly. CORRECTION UP +60 from prior
 *                          SEED/HEURISTIC:PR-15. Tier upgraded SEED → OFFICIAL.
 *                          22% of Fall 2023 enrolled (178 students) submitted
 *                          SAT under test-optional policy.)
 *   - sat75             : 1540  → 1510   (CDS C9: SAT Composite 75th = 1510
 *                          reported directly; EBRW 750 + Math 780 sum = 1530
 *                          differs because composite quantiles ≠ section sums.
 *                          CORRECTION DOWN -30 from prior SEED/HEURISTIC:PR-15.
 *                          Tier upgraded SEED → OFFICIAL.)
 *   - intlAcceptanceRate: 2.92  → 2.92   (CDS C1 residency: 231 intl admits /
 *                          7,922 intl applicants = 2.9159%. Value matches prior
 *                          DB; tier upgraded LEGACY_DB → OFFICIAL.)
 *   - oosAcceptanceRate : 18.39 → null   (Colgate is a private research
 *                          university; in-state / out-of-state distinction
 *                          carries no policy meaning. CDS C1 residency does
 *                          report OOS (1,731/9,415 = 18.3856%) but per
 *                          closure-pipeline convention, private schools →
 *                          UNAVAILABLE/TERMINAL. Prior legacy DB value cleared.)
 *   - edAcceptanceRate  : 19.49 → 22.94  (CDS C21: Colgate offers ED ("Yes").
 *                          Two plans — ED I 11/15 closing (12/15 notification);
 *                          ED II 1/15 closing (3/1 notification). Fall 2023
 *                          entering class combined: 481 admits / 2,097 ED
 *                          applications = 22.9375% (rounded to 22.94%).
 *                          CORRECTION UP +3.45pp from prior 19.49% (LEGACY_DB
 *                          sourced from a different/newer CDS 2024-25 PDF).
 *                          Tier upgraded LEGACY_DB → OFFICIAL.)
 *   - eaAcceptanceRate  : 5.13  → null   (CDS C22: Colgate does NOT offer a
 *                          nonbinding Early Action plan ("No" checked). Prior
 *                          DB had tier=UNAVAILABLE/OFFICIAL_SCHOOL but with
 *                          residual value=5.13 from CDS 2022-23 sourceUrl that
 *                          should not be displayed. CORRECTION: value cleared,
 *                          provenance refreshed to authoritative CDS_OFFICIAL
 *                          pull marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/
 *                          NOT_OFFERED.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const COLGATE_CDS_URL =
  'https://www.colgate.edu/sites/default/files/2024-07/CDS_2023-2024%20FINAL.pdf';
const CYCLE_YEAR = 2023; // CDS 2023-2024 = Fall 2023 entering class
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const colgate = await prisma.school.findFirst({
    where: { id: 'cmnwr8ivd004fz0tiwbcr93y2', name: 'Colgate University' },
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
  if (!colgate) throw new Error('Colgate University not found');
  console.log(`Updating ${colgate.name} (${colgate.id})`);
  console.log(
    `  current AR=${colgate.acceptanceRate?.toString()} sat25=${colgate.sat25} sat75=${colgate.sat75}`,
  );
  console.log(
    `  current intlAR=${colgate.intlAcceptanceRate?.toString()} oosAR=${colgate.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${colgate.edAcceptanceRate?.toString()} eaAR=${colgate.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: COLGATE_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-colgate-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 11.95,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2023-24 Section C1: 2,526 admits / 21,130 applicants = 11.9546% (rounded to 11.95%). Tier upgraded from LEGACY_DB (value 13.5, sourceUrl pointed to collegekickstart.com aggregator — not Colgate) to OFFICIAL. CORRECTION DOWN -1.55pp. Cycle: Fall 2023 entering class.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1440,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2023-24 Section C9: SAT Composite 25th = 1440 (reported directly). CORRECTION UP from prior 1380 (SEED/HEURISTIC:PR-15). Tier upgraded from SEED/HEURISTIC to OFFICIAL. 22% of Fall 2023 enrolled (178 students) submitted SAT under test-optional policy.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1510,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2023-24 Section C9: SAT Composite 75th = 1510 (reported directly; SAT EBRW 750 + SAT Math 780 sum = 1530 differs because composite quantiles ≠ section sums). CORRECTION DOWN from prior 1540 (SEED/HEURISTIC:PR-15). Tier upgraded from SEED/HEURISTIC to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 2.92,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2023-24 Section C1 residency table: 231 international admits / 7,922 international applicants = 2.9159% (rounded to 2.92%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Colgate University is a private research university; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table does report OOS (1,731 admits / 9,415 applicants = 18.3856%), but the value is not actionable for applicants. Prior legacy DB value (18.39%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 22.94,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2023-24 Section C21: Colgate offers Early Decision ("Yes" checked) — two plans: ED I closes 11/15 (12/15 notification); ED II closes 1/15 (3/1 notification). Fall 2023 entering class combined: 481 admits / 2,097 ED applications = 22.9375% (rounded to 22.94%). CORRECTION UP from prior DB (19.49%, LEGACY_DB sourced from a different/newer CDS 2024-25 PDF). Tier upgraded from LEGACY_DB to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2023-24 Section C22: Colgate University does NOT offer a nonbinding Early Action plan ("No" checked for EA plan). Prior DB had tier=UNAVAILABLE/OFFICIAL_SCHOOL but with residual value=5.13 from CDS 2022-23 stale sourceUrl. CORRECTION: value cleared, provenance refreshed to authoritative CDS_OFFICIAL pull marked UNAVAILABLE-terminal/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(colgate.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: COLGATE_CDS_URL,
  };

  await prisma.school.update({
    where: { id: colgate.id },
    data: {
      acceptanceRate: new Prisma.Decimal('11.95'),
      sat25: 1440,
      sat75: 1510,
      intlAcceptanceRate: new Prisma.Decimal('2.92'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('22.94'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=11.95, sat25=1440, sat75=1510, intlAR=2.92, oosAR=N/A, edAR=22.94, eaAR=NOT_OFFERED)',
  );

  const after = await prisma.school.findUnique({
    where: { id: colgate.id },
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
