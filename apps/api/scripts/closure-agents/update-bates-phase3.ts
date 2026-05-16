#!/usr/bin/env tsx
/**
 * Phase 3 — Bates College end-to-end closure of the 7 prediction-critical
 * fields.
 *
 * Source: Bates College CDS 2025-2026 (parsed by Claude from PDF)
 *   URL: https://www.bates.edu/research/files/2026/04/CDS_2025-2026.pdf
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 14.83 → 14.83 (CDS C1: 1433 admits / 9660 apps =
 *                          14.8344%. Value matches prior DB; tier upgraded
 *                          LEGACY_DB → OFFICIAL with cycle metadata.)
 *   - sat25             : 1380  → 1325  (CDS C9 SAT Composite 25th = 1325
 *                          reported directly. CORRECTION DOWN -55 from prior
 *                          1380 SEED/PR-15 heuristic. 12.98% of Fall 2025
 *                          enrolled (64 students) submitted SAT under test-
 *                          optional policy.)
 *   - sat75             : 1540  → 1510  (CDS C9 SAT Composite 75th = 1510
 *                          reported directly. CORRECTION DOWN -30 from prior
 *                          1540 SEED/PR-15 heuristic.)
 *   - intlAcceptanceRate: 3.18  → 3.18  (CDS C1 residency: 160 intl admits /
 *                          5039 intl apps = 3.1753%. Value matches prior DB;
 *                          tier upgraded LEGACY_DB → OFFICIAL.)
 *   - oosAcceptanceRate : 27.64 → null  (Bates is a private LAC; per closure
 *                          pipeline convention private schools → UNAVAILABLE/
 *                          TERMINAL. CDS C1 residency does report OOS
 *                          (1178/4262 = 27.64%) but value is not actionable
 *                          for applicants. Prior LEGACY_DB value cleared.)
 *   - edAcceptanceRate  : 41.73 → 33.51 (CDS C21: Bates offers ED ("Yes") with
 *                          two plans — ED I closes 11/15 (12/20 notification),
 *                          ED II closes 1/10 (2/15 notification). Fall 2024
 *                          entering class combined totals (CDS C21 only
 *                          provides combined ED I + ED II line, not split):
 *                          318 admits / 949 ED apps = 33.5089% (rounded to
 *                          33.51%). CORRECTION DOWN -8.22pp from prior 41.73
 *                          LEGACY_DB value.)
 *   - eaAcceptanceRate  : null  → null  (CDS C22: Bates does NOT offer a
 *                          nonbinding Early Action plan ("No" checked). Field
 *                          stays null; provenance refreshed from prior
 *                          CDS_LLM_EXTRACT_2026_04 to authoritative
 *                          CDS_OFFICIAL pull marked UNAVAILABLE-terminal /
 *                          NOT_OFFERED.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const BATES_CDS_URL =
  'https://www.bates.edu/research/files/2026/04/CDS_2025-2026.pdf';
const CYCLE_YEAR = 2025; // CDS 2025-2026 = Fall 2025 entering class
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const bates = await prisma.school.findFirst({
    where: { id: 'cmnwr8ivl004kz0tiv0vgf6c6', name: 'Bates College' },
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
  if (!bates) throw new Error('Bates College not found');
  console.log(`Updating ${bates.name} (${bates.id})`);
  console.log(
    `  current AR=${bates.acceptanceRate?.toString()} sat25=${bates.sat25} sat75=${bates.sat75}`,
  );
  console.log(
    `  current intlAR=${bates.intlAcceptanceRate?.toString()} oosAR=${bates.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${bates.edAcceptanceRate?.toString()} eaAR=${bates.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: BATES_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-bates-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 14.83,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2025-26 Section C1: 1,433 admits / 9,660 applicants = 14.8344% (rounded to 14.83%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance and current cycle metadata.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1325,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2025-26 Section C9: SAT Composite 25th = 1325 reported directly. CORRECTION DOWN from prior 1380 (SEED/PR-15 heuristic). 12.98% of Fall 2025 enrolled (64 students) submitted SAT under test-optional policy.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1510,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2025-26 Section C9: SAT Composite 75th = 1510 reported directly. CORRECTION DOWN from prior 1540 (SEED/PR-15 heuristic).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 3.18,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2025-26 Section C1 residency table: 160 international admits / 5,039 international applicants = 3.1753% (rounded to 3.18%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Bates College is a private liberal arts college; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table does report OOS (1,178 admits / 4,262 applicants = 27.6396%), but the value is not actionable for applicants. Prior LEGACY_DB value (27.64%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 33.51,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2025-26 Section C21: Bates offers Early Decision ("Yes" checked) with two plans — ED I closes 11/15 (12/20 notification), ED II closes 1/10 (2/15 notification). Fall 2024 entering class combined totals (CDS C21 only provides a single combined ED I+II line, not split): 318 admits / 949 ED applications = 33.5089% (rounded to 33.51%). CORRECTION DOWN -8.22pp from prior LEGACY_DB value (41.73%).',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2025-26 Section C22: Bates College does NOT offer a nonbinding Early Action plan ("No" checked for EA plan). DB value was already null; provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 (with value=undefined) to authoritative CDS_OFFICIAL pull marked UNAVAILABLE-terminal / NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(bates.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: BATES_CDS_URL,
  };

  await prisma.school.update({
    where: { id: bates.id },
    data: {
      acceptanceRate: new Prisma.Decimal('14.83'),
      sat25: 1325,
      sat75: 1510,
      intlAcceptanceRate: new Prisma.Decimal('3.18'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('33.51'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  updated 7 fields (AR=14.83, sat25=1325, sat75=1510, intlAR=3.18, oosAR=N/A, edAR=33.51, eaAR=NOT_OFFERED)',
  );

  const after = await prisma.school.findUnique({
    where: { id: bates.id },
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
