#!/usr/bin/env tsx
/**
 * Phase 3 batch 7 — Grinnell College end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: Grinnell College CDS 2023-2024 (Fall 2023 entering class)
 *   URL: https://www.grinnell.edu/sites/default/files/docs/2024-10/Grinnell-College-Common-Data-Set-CDS-2023-2024.pdf
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 12.68 → 12.68  (CDS C1 Total: 1,266 admits / 9,988
 *                          applicants = 12.6752% (rounded to 12.68). Value
 *                          matches prior DB; tier upgraded LEGACY_DB → OFFICIAL.)
 *   - sat25             : 1380  → 1440   (CDS C9: SAT Composite 25th = 1440
 *                          reported directly. CORRECTION UP +60 from prior
 *                          SEED/HEURISTIC:PR-15. Tier upgraded SEED → OFFICIAL.
 *                          30% of Fall 2023 enrolled (136 students) submitted
 *                          SAT under test-optional policy.)
 *   - sat75             : 1540  → 1530   (CDS C9: SAT Composite 75th = 1530
 *                          reported directly; EBRW 760 + Math 790 sum = 1550
 *                          differs because composite quantiles ≠ section sums.
 *                          CORRECTION DOWN -10 from prior SEED/HEURISTIC:PR-15.
 *                          Tier upgraded SEED → OFFICIAL.)
 *   - intlAcceptanceRate: null  → null   (CDS C1 residency table reported with
 *                          all values BLANK — Grinnell did not break out
 *                          applicants/admits by residency in Fall 2023 CDS.
 *                          Prior DB was INFERRED/PERMANENT_HEURISTIC with no
 *                          value. Field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *   - oosAcceptanceRate : null  → null   (Grinnell is a private liberal arts
 *                          college; in-state / out-of-state distinction
 *                          carries no policy meaning. CDS C1 residency also
 *                          blank. Per closure-pipeline convention, private
 *                          schools → UNAVAILABLE/TERMINAL. Prior DB was
 *                          INFERRED/PERMANENT_HEURISTIC with no value.)
 *   - edAcceptanceRate  : 34.18 → 40.80  (CDS C21: Grinnell offers ED ("Yes").
 *                          Two plans — ED I 11/5 closing (12/15 notification);
 *                          ED II 1/5 closing (1/31 notification). Fall 2023
 *                          entering class combined: 297 admits / 728 ED
 *                          applications = 40.7967% (rounded to 40.80%).
 *                          CORRECTION UP from prior 34.18% (LEGACY_DB sourced
 *                          from a different/newer CDS PDF). Tier upgraded
 *                          LEGACY_DB → OFFICIAL.)
 *   - eaAcceptanceRate  : 56.61 → null   (CDS C22: Grinnell does NOT offer a
 *                          nonbinding Early Action plan ("No" checked). Prior
 *                          DB value (56.61% from CDS 2019-20 sourceUrl) was
 *                          stale and contradicts current CDS. CORRECTION:
 *                          cleared, marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/
 *                          NOT_OFFERED.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const GRINNELL_CDS_URL =
  'https://www.grinnell.edu/sites/default/files/docs/2024-10/Grinnell-College-Common-Data-Set-CDS-2023-2024.pdf';
const CYCLE_YEAR = 2023; // CDS 2023-2024 = Fall 2023 entering class
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const grinnell = await prisma.school.findFirst({
    where: { id: 'cmnwr8ivb004ez0tiduer8l0n', name: 'Grinnell College' },
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
  if (!grinnell) throw new Error('Grinnell College not found');
  console.log(`Updating ${grinnell.name} (${grinnell.id})`);
  console.log(
    `  current AR=${grinnell.acceptanceRate?.toString()} sat25=${grinnell.sat25} sat75=${grinnell.sat75}`,
  );
  console.log(
    `  current intlAR=${grinnell.intlAcceptanceRate?.toString()} oosAR=${grinnell.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${grinnell.edAcceptanceRate?.toString()} eaAR=${grinnell.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: GRINNELL_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-grinnell-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 12.68,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2023-24 Section C1: 1,266 admits / 9,988 applicants = 12.6752% (rounded to 12.68%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance. Cycle: Fall 2023 entering class.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1440,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2023-24 Section C9: SAT Composite 25th = 1440 (reported directly). CORRECTION UP from prior 1380 (SEED/HEURISTIC:PR-15). Tier upgraded from SEED/HEURISTIC to OFFICIAL. 30% of Fall 2023 enrolled (136 students) submitted SAT under test-optional policy.',
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
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2023-24 Section C1 residency table: Grinnell did not report applicants/admits broken out by residency (in-state, out-of-state, international) — all cells in the residency breakdown are blank (Total row reports 0/0/0). Cannot derive international admit rate from CDS. Prior DB was INFERRED/PERMANENT_HEURISTIC with no value. Field marked UNAVAILABLE-terminal/OFFICIAL_BLANK_SECTION per closure-pipeline convention.',
      realDataStatus: 'NOT_REPORTED',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Grinnell College is a private liberal arts college; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table is also blank (not reported). Prior DB was INFERRED/PERMANENT_HEURISTIC with no value. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 40.8,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2023-24 Section C21: Grinnell offers Early Decision ("Yes" checked) — two plans: ED I closes 11/5 (12/15 notification); ED II closes 1/5 (1/31 notification). Fall 2023 entering class combined: 297 admits / 728 ED applications = 40.7967% (rounded to 40.80%). CORRECTION UP from prior DB (34.18%, LEGACY_DB sourced from a different/newer CDS 2024-25 PDF). Tier upgraded from LEGACY_DB to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2023-24 Section C22: Grinnell College does NOT offer a nonbinding Early Action plan ("No" checked for EA plan). Prior DB value (56.61% from CDS 2019-20 stale sourceUrl marked OFFICIAL_SCHOOL) was incorrect — Grinnell has not offered EA in current CDS. CORRECTION: value cleared, provenance refreshed to authoritative CDS_OFFICIAL pull marked UNAVAILABLE-terminal/NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(grinnell.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: GRINNELL_CDS_URL,
  };

  await prisma.school.update({
    where: { id: grinnell.id },
    data: {
      acceptanceRate: new Prisma.Decimal('12.68'),
      sat25: 1440,
      sat75: 1530,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('40.80'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=12.68, sat25=1440, sat75=1530, intlAR=BLANK, oosAR=N/A, edAR=40.80, eaAR=NOT_OFFERED)',
  );

  const after = await prisma.school.findUnique({
    where: { id: grinnell.id },
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
