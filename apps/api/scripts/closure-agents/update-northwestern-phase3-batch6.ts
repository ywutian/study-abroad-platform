#!/usr/bin/env tsx
/**
 * Phase 3 batch6 — Northwestern University end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: Northwestern University CDS 2024-2025 (parsed from PDF)
 *   URL: https://enrollment.northwestern.edu/data/2024-2025.pdf
 *
 * NOTE: The job manifest referenced https://www.adminplan.northwestern.edu/...
 * which does NOT resolve (NXDOMAIN). The canonical CDS hosting location is
 * enrollment.northwestern.edu — confirmed via Google site:northwestern.edu.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 7.5      → 7.69 (CDS C1 totals: 3,806 admits /
 *                          49,474 applicants = 7.6933%. Tier upgraded
 *                          LEGACY_DB → OFFICIAL.)
 *   - sat25             : 1490     → 1510 (CDS C9 SAT Composite 25 = 1510.)
 *   - sat75             : 1560     → 1560 (CDS C9 SAT Composite 75 = 1560.
 *                          Matches DB; tier upgraded LEGACY_DB → OFFICIAL.)
 *   - intlAcceptanceRate: 3.86     → null (CDS C1 residency table is
 *                          UNREPORTED — all in-state/OOS/intl rows blank
 *                          (totals = 0). Field cleared; UNAVAILABLE-terminal
 *                          OFFICIAL_BLANK_SECTION.)
 *   - oosAcceptanceRate : 6.25     → null (Private research university —
 *                          UNAVAILABLE-terminal per pipeline convention.)
 *   - edAcceptanceRate  : 23.01    → 23.01 (CDS C21: ED I only —
 *                          1,186 admits / 5,154 apps = 23.0113%. Value
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

const NU_CDS_URL = 'https://enrollment.northwestern.edu/data/2024-2025.pdf';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const nu = await prisma.school.findFirst({
    where: { id: 'cmn1htknm000avqf2g8h3sbdp', name: 'Northwestern University' },
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
  if (!nu) throw new Error('Northwestern University not found');
  console.log(`Updating ${nu.name} (${nu.id})`);
  console.log(
    `  current AR=${nu.acceptanceRate?.toString()} sat25=${nu.sat25} sat75=${nu.sat75}`,
  );
  console.log(
    `  current intlAR=${nu.intlAcceptanceRate?.toString()} oosAR=${nu.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${nu.edAcceptanceRate?.toString()} eaAR=${nu.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: NU_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-batch6-claude',
    generatedBy: 'phase3-batch6-northwestern-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 7.69,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1 totals (men+women+another+unknown): admits 1,735+2,070+1+0 = 3,806; applicants 23,774+25,686+14+0 = 49,474. 3,806 / 49,474 = 7.6933% (rounded to 7.69%). Tier upgraded from LEGACY_DB (value 7.5, sourceUrl pointed to collegekickstart.com aggregator) to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1510,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1510 (reported directly; EBRW 740 + Math 770 sum = 1510 also coincides). CORRECTION UP from prior 1490 (LEGACY_DB). 46% of Fall 2024 enrolled (963 students) submitted SAT under test-optional policy.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1560,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1560 (reported directly; EBRW 770 + Math 800 sum = 1570 differs because composite quantiles ≠ section sums). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table is UNREPORTED — Northwestern left in-state, out-of-state, and international rows blank (totals printed as 0). Prior DB value 3.86 came from LEGACY_DB with sourceUrl pointing at this same CDS but the source no longer publishes the breakdown for the 2024-25 cycle. Field cleared and marked UNAVAILABLE-terminal/OFFICIAL_BLANK_SECTION.',
      realDataStatus: 'OFFICIAL_BLANK',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Northwestern University is a private research university; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table is also UNREPORTED (all rows blank). Prior LEGACY_DB value (6.25) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 23.01,
      policyLabel: 'Early Decision admit rate (ED I only)',
      reason:
        'CDS 2024-25 Section C21: Northwestern offers Early Decision ("Yes" checked) with a single ED I plan — closes 11/1 (12/15 notification); no ED II plan. Fall 2024 entering class: 1,186 admits / 5,154 ED applications = 23.0113% (rounded to 23.01%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance (sourceUrl corrected from enrollment.northwestern.edu/data/2024-2025.pdf which is already the canonical CDS URL).',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: Northwestern does NOT offer a nonbinding Early Action plan ("No" checked for EA plan). DB value was already null/undefined; provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 to authoritative CDS_OFFICIAL pull marked UNAVAILABLE-terminal/NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(nu.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: NU_CDS_URL,
  };

  await prisma.school.update({
    where: { id: nu.id },
    data: {
      acceptanceRate: new Prisma.Decimal('7.69'),
      sat25: 1510,
      sat75: 1560,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('23.01'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=7.69, sat25=1510, sat75=1560, intlAR=UNREPORTED, oosAR=N/A, edAR=23.01, eaAR=NOT_OFFERED)',
  );

  const after = await prisma.school.findUnique({
    where: { id: nu.id },
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
