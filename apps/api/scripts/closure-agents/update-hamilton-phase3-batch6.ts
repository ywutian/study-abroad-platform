#!/usr/bin/env tsx
/**
 * Phase 3 batch6 — Hamilton College end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: Hamilton College CDS 2024-2025 (parsed from PDF)
 *   URL: https://www.hamilton.edu/documents/CDS_2024-2025.pdf
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 13.62    → 13.62 (CDS C1 totals: 1,162 admits /
 *                          8,531 applicants = 13.6209%. Matches DB; tier
 *                          upgraded LEGACY_DB → OFFICIAL.)
 *   - sat25             : 1380     → 1460 (CDS C9 SAT Composite 25 = 1460.
 *                          CORRECTION UP +80 from prior SEED/PR-15
 *                          heuristic.)
 *   - sat75             : 1540     → 1530 (CDS C9 SAT Composite 75 = 1530.
 *                          CORRECTION DOWN -10 from prior SEED/PR-15
 *                          heuristic.)
 *   - intlAcceptanceRate: 2.17     → 2.17  (CDS C1 residency: 70 intl
 *                          admits / 3,227 intl applicants = 2.1693%.
 *                          Matches DB; tier upgraded LEGACY_DB → OFFICIAL.)
 *   - oosAcceptanceRate : 20.85    → null  (Private LAC — UNAVAILABLE-
 *                          terminal per pipeline convention.)
 *   - edAcceptanceRate  : 29.44    → 29.44 (CDS C21: ED I + ED II combined
 *                          totals — 247 admits / 839 ED applications =
 *                          29.4398%. CDS only reports the combined total
 *                          (no separate ED I vs ED II breakdown). Value
 *                          matches DB; tier upgraded LEGACY_DB → OFFICIAL.)
 *   - eaAcceptanceRate  : undefined → null  (CDS C22 No — not offered.
 *                          UNAVAILABLE-terminal NOT_OFFERED.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const HAMILTON_CDS_URL = 'https://www.hamilton.edu/documents/CDS_2024-2025.pdf';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const hamilton = await prisma.school.findFirst({
    where: { id: 'cmnwr8iv5004bz0ti94b7ow5h', name: 'Hamilton College' },
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
  if (!hamilton) throw new Error('Hamilton College not found');
  console.log(`Updating ${hamilton.name} (${hamilton.id})`);
  console.log(
    `  current AR=${hamilton.acceptanceRate?.toString()} sat25=${hamilton.sat25} sat75=${hamilton.sat75}`,
  );
  console.log(
    `  current intlAR=${hamilton.intlAcceptanceRate?.toString()} oosAR=${hamilton.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${hamilton.edAcceptanceRate?.toString()} eaAR=${hamilton.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: HAMILTON_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-batch6-claude',
    generatedBy: 'phase3-batch6-hamilton-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 13.62,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1 totals (men+women+another+unknown): admits 515+645+2 = 1,162; applicants 3,964+4,560+7 = 8,531. 1,162 / 8,531 = 13.6209% (rounded to 13.62%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1460,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1460 (reported directly; EBRW 720 + Math 730 sum = 1450 differs because composite quantiles ≠ section sums). CORRECTION UP from prior 1380 (SEED/PR-15 heuristic). 34% of Fall 2024 enrolled (156 students) submitted SAT under test-optional policy.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1530,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1530 (reported directly; EBRW 770 + Math 780 sum = 1550 differs because composite quantiles ≠ section sums). CORRECTION DOWN from prior 1540 (SEED/PR-15 heuristic).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 2.17,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 70 international admits / 3,227 international applicants = 2.1693% (rounded to 2.17%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Hamilton College is a private liberal arts college; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table does report OOS (763 admits / 3,660 applicants = 20.8470%), but the value is not actionable for applicants. Prior legacy DB value (20.85%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 29.44,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2024-25 Section C21: Hamilton offers Early Decision ("Yes" checked) with two plans — ED I closes 11/15 (12/15 notification), ED II closes 1/3 (2/15 notification). Hamilton reports ED apps/admits as combined totals only (no separate ED I/ED II breakdown). Fall 2024 entering class combined totals: 247 admits / 839 ED applications = 29.4398% (rounded to 29.44%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: Hamilton College does NOT offer a nonbinding Early Action plan ("No" checked for EA plan). DB value was already null/undefined; provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 to authoritative CDS_OFFICIAL pull marked UNAVAILABLE-terminal/NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(hamilton.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: HAMILTON_CDS_URL,
  };

  await prisma.school.update({
    where: { id: hamilton.id },
    data: {
      acceptanceRate: new Prisma.Decimal('13.62'),
      sat25: 1460,
      sat75: 1530,
      intlAcceptanceRate: new Prisma.Decimal('2.17'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('29.44'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=13.62, sat25=1460, sat75=1530, intlAR=2.17, oosAR=N/A, edAR=29.44, eaAR=NOT_OFFERED)',
  );

  const after = await prisma.school.findUnique({
    where: { id: hamilton.id },
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
