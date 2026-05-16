#!/usr/bin/env tsx
/**
 * Phase 3 batch6 — Haverford College end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: Haverford College CDS 2024-2025 (parsed from PDF)
 *   URL: https://www.haverford.edu/sites/default/files/Office/President/CDS_2024-2025.pdf
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 12.37    → 12.37 (CDS C1 totals: 908 admits /
 *                          7,341 applicants = 12.3689%. Matches DB; tier
 *                          upgraded LEGACY_DB → OFFICIAL.)
 *   - sat25             : 1380     → 1470 (CDS C9 SAT Composite 25 = 1470.
 *                          CORRECTION UP +90 from prior SEED/PR-15
 *                          heuristic.)
 *   - sat75             : 1540     → 1540 (CDS C9 SAT Composite 75 = 1540.
 *                          Matches DB; tier upgraded SEED → OFFICIAL.)
 *   - intlAcceptanceRate: 3.55     → 3.55  (CDS C1 residency: 125 intl
 *                          admits / 3,521 intl applicants = 3.5501%.
 *                          Matches DB; tier upgraded LEGACY_DB → OFFICIAL.)
 *   - oosAcceptanceRate : 22.15    → null  (Private LAC — UNAVAILABLE-
 *                          terminal per pipeline convention.)
 *   - edAcceptanceRate  : 29.4     → 29.40 (CDS C21: ED I + ED II combined
 *                          totals — 219 admits / 745 ED applications =
 *                          29.3960%. CDS only reports the combined total
 *                          (no separate ED I vs ED II breakdown). Value
 *                          matches DB; tier upgraded LEGACY_DB → OFFICIAL.)
 *   - eaAcceptanceRate  : 33.12    → null  (CDS C22 No — Haverford does
 *                          NOT offer EA. Prior DB value 33.12 was
 *                          incorrect (likely contaminated from a non-EA
 *                          metric). Cleared. UNAVAILABLE-terminal
 *                          NOT_OFFERED.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const HAVERFORD_CDS_URL =
  'https://www.haverford.edu/sites/default/files/Office/President/CDS_2024-2025.pdf';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const haverford = await prisma.school.findFirst({
    where: { id: 'cmnwr8iv7004cz0tiy7lyda2g', name: 'Haverford College' },
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
  if (!haverford) throw new Error('Haverford College not found');
  console.log(`Updating ${haverford.name} (${haverford.id})`);
  console.log(
    `  current AR=${haverford.acceptanceRate?.toString()} sat25=${haverford.sat25} sat75=${haverford.sat75}`,
  );
  console.log(
    `  current intlAR=${haverford.intlAcceptanceRate?.toString()} oosAR=${haverford.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${haverford.edAcceptanceRate?.toString()} eaAR=${haverford.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: HAVERFORD_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-batch6-claude',
    generatedBy: 'phase3-batch6-haverford-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 12.37,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1 totals (men+women): admits 402+506 = 908; applicants 3,636+3,705 = 7,341. 908 / 7,341 = 12.3689% (rounded to 12.37%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1470,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1470 (reported directly; EBRW 720 + Math 740 sum = 1460 differs because composite quantiles ≠ section sums). CORRECTION UP from prior 1380 (SEED/PR-15 heuristic). 39% of Fall 2024 enrolled (151 students) submitted SAT under test-optional policy.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1540,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1540 (reported directly; EBRW 770 + Math 780 sum = 1550 differs because composite quantiles ≠ section sums). Value matches prior DB; tier upgraded from SEED/PR-15 to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 3.55,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 125 international admits / 3,521 international applicants = 3.5501% (rounded to 3.55%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Haverford College is a private liberal arts college; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table does report OOS (704 admits / 3,179 applicants = 22.1453%), but the value is not actionable for applicants. Prior legacy DB value (22.15%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 29.4,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2024-25 Section C21: Haverford offers Early Decision ("Yes" checked) with two plans — ED I closes 11/15 (12/15 notification), ED II closes 1/5 (2/15 notification). Haverford reports ED apps/admits as combined totals only (no separate ED I/ED II breakdown). Fall 2024 entering class combined totals: 219 admits / 745 ED applications = 29.3960% (rounded to 29.40%). Value matches prior DB (29.4); tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: Haverford College does NOT offer a nonbinding Early Action plan ("No" checked for EA plan). Prior DB value 33.12 was incorrect — the source provenance pointed at a 2023-2024 CDS variant (sourceUrl had typo "CDS_2023-2034.pdf") and Haverford has never published an EA plan per any extant CDS. Field cleared and marked UNAVAILABLE-terminal/NOT_OFFERED with authoritative 2024-25 CDS pull.',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(haverford.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: HAVERFORD_CDS_URL,
  };

  await prisma.school.update({
    where: { id: haverford.id },
    data: {
      acceptanceRate: new Prisma.Decimal('12.37'),
      sat25: 1470,
      sat75: 1540,
      intlAcceptanceRate: new Prisma.Decimal('3.55'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('29.40'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=12.37, sat25=1470, sat75=1540, intlAR=3.55, oosAR=N/A, edAR=29.40, eaAR=NOT_OFFERED)',
  );

  const after = await prisma.school.findUnique({
    where: { id: haverford.id },
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
