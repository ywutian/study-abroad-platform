#!/usr/bin/env tsx
/**
 * Phase 3 batch 8 — Washington and Lee University end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: Washington and Lee University CDS 2024-2025 (Fall 2024 entering class)
 *   URL: https://my.wlu.edu/document/2024-common-data-set
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 13.97 → 13.97  (CDS C1 Total: 1,147 admits / 8,213
 *                          applicants = 13.9657% (rounded 13.97%). Value
 *                          matches prior DB; tier upgraded LEGACY_DB → OFFICIAL.
 *                          C1 Admits row: 525 men + 622 women = 1,147;
 *                          residency table sums to 1,147 (186+894+67).)
 *   - sat25             : 1380  → 1430   (CDS C9: SAT Composite 25th = 1430
 *                          reported directly; EBRW 710 + Math 720 sum = 1430
 *                          coincides. CORRECTION UP +50 from prior 1380
 *                          (SEED/HEURISTIC:PR-15). Tier upgraded SEED →
 *                          OFFICIAL. 24% of Fall 2024 enrolled (111 students)
 *                          submitted SAT under test-optional policy.)
 *   - sat75             : 1540  → 1540   (CDS C9: SAT Composite 75th = 1540
 *                          reported directly; EBRW 760 + Math 780 sum = 1540
 *                          coincides. Value matches prior DB; tier upgraded
 *                          SEED/HEURISTIC → OFFICIAL.)
 *   - intlAcceptanceRate: 1.9   → 1.90   (CDS C1 residency: 67 intl admits /
 *                          3,524 intl applicants = 1.9013% (rounded 1.90%).
 *                          Value matches prior DB; tier upgraded LEGACY_DB →
 *                          OFFICIAL.)
 *   - oosAcceptanceRate : 23.58 → null   (W&L is a private liberal arts
 *                          college; in-state / out-of-state distinction carries
 *                          no policy meaning. CDS C1 residency does report OOS
 *                          (894/3,792 = 23.5759%) but per closure-pipeline
 *                          convention, private schools → UNAVAILABLE/TERMINAL.
 *                          Prior legacy DB value cleared.)
 *   - edAcceptanceRate  : 33.89 → 33.89  (CDS C21: W&L offers ED ("Yes"). Two
 *                          plans — ED I 11/1 closing (12/15 notification); ED
 *                          II 1/1 closing (2/1 notification). Fall 2024
 *                          entering class combined: 286 admits / 844 ED
 *                          applications = 33.8863% (rounded 33.89%). Value
 *                          matches prior DB; tier upgraded LEGACY_DB → OFFICIAL.)
 *   - eaAcceptanceRate  : null  → null   (CDS C22: Washington and Lee
 *                          University does NOT offer a nonbinding Early Action
 *                          plan ("No" checked for EA plan). DB value was
 *                          already null; provenance refreshed from prior
 *                          CDS_LLM_EXTRACT_2026_04 (value=undefined) to
 *                          authoritative CDS_OFFICIAL pull marked
 *                          UNAVAILABLE-terminal/NOT_OFFERED.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const WLU_CDS_URL = 'https://my.wlu.edu/document/2024-common-data-set';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const wlu = await prisma.school.findFirst({
    where: {
      id: 'cmnwr8ivi004iz0tinveg964v',
      name: 'Washington and Lee University',
    },
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
  if (!wlu) throw new Error('Washington and Lee University not found');
  console.log(`Updating ${wlu.name} (${wlu.id})`);
  console.log(
    `  current AR=${wlu.acceptanceRate?.toString()} sat25=${wlu.sat25} sat75=${wlu.sat75}`,
  );
  console.log(
    `  current intlAR=${wlu.intlAcceptanceRate?.toString()} oosAR=${wlu.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${wlu.edAcceptanceRate?.toString()} eaAR=${wlu.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: WLU_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-wlu-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 13.97,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 1,147 admits / 8,213 applicants = 13.9657% (rounded to 13.97%). C1 Admits row 525 men + 622 women = 1,147; residency table sums to 1,147 (186 in-state + 894 OOS + 67 intl). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1430,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1430 (reported directly; EBRW 710 + Math 720 sum = 1430 coincides). CORRECTION UP +50 from prior 1380 (SEED/HEURISTIC:PR-15). Tier upgraded from SEED/HEURISTIC to OFFICIAL. 24% of Fall 2024 enrolled (111 students) submitted SAT under test-optional policy.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1540,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1540 (reported directly; EBRW 760 + Math 780 sum = 1540 coincides). Value matches prior DB; tier upgraded from SEED/HEURISTIC to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1.9,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 67 international admits / 3,524 international applicants = 1.9013% (rounded to 1.90%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Washington and Lee University is a private liberal arts college; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table does report OOS (894 admits / 3,792 applicants = 23.5759%), but the value is not actionable for applicants. Prior legacy DB value (23.58%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 33.89,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2024-25 Section C21: W&L offers Early Decision ("Yes" checked) — two plans: ED I closes 11/1 (12/15 notification); ED II closes 1/1 (2/1 notification). Fall 2024 entering class combined: 286 admits / 844 ED applications = 33.8863% (rounded to 33.89%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: Washington and Lee University does NOT offer a nonbinding Early Action plan ("No" checked for EA plan). DB value was already null; provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 (value=undefined) to authoritative CDS_OFFICIAL pull marked UNAVAILABLE-terminal/NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(wlu.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: WLU_CDS_URL,
  };

  await prisma.school.update({
    where: { id: wlu.id },
    data: {
      acceptanceRate: new Prisma.Decimal('13.97'),
      sat25: 1430,
      sat75: 1540,
      intlAcceptanceRate: new Prisma.Decimal('1.90'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('33.89'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=13.97, sat25=1430, sat75=1540, intlAR=1.90, oosAR=N/A, edAR=33.89, eaAR=NOT_OFFERED)',
  );

  const after = await prisma.school.findUnique({
    where: { id: wlu.id },
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
