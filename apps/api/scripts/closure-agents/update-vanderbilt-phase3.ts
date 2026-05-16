#!/usr/bin/env tsx
/**
 * Phase 3 — Vanderbilt University end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: Vanderbilt University CDS 2024-2025 — published as Excel (.xlsx),
 * not PDF. Downloaded via curl and parsed with openpyxl.
 *   URL: https://cdn.vanderbilt.edu/vu-wpfsx/wp-content/uploads/sites/70/2025/11/CDS_2024-2025.xlsx
 *
 * NOTE ON FORMAT: Vanderbilt publishes their CDS as an .xlsx workbook rather
 * than the standard PDF. WebFetch returns binary; processed by:
 *   1. curl -A "Mozilla/5.0" -o /tmp/vandy.xlsx <url>
 *   2. file /tmp/vandy.xlsx → "Microsoft Excel 2007+"
 *   3. python3 openpyxl load_workbook + iter_rows to extract C1, C9, C21, C22
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 5.09    → 5.86  (CDS C1 Total: 2,662 admits (1,238
 *                          men + 1,424 women) / 45,409 applicants (20,851 men
 *                          + 24,553 women + 5 unknown) = 5.8625% (rounded to
 *                          5.86%). CORRECTION UP +0.77pp. Prior LEGACY_DB
 *                          value 5.09 was based on Class of 2028 published
 *                          admit rate (different cohort/methodology). Tier
 *                          upgraded LEGACY_DB → OFFICIAL.)
 *   - sat25             : 1490    → 1510  (CDS C9: SAT Composite 25th =
 *                          1510 (EBRW 730 + Math 770 sum = 1500, but composite
 *                          quantile reported as 1510). 27.4% (447 enrolled) of
 *                          enrolled submitted SAT under test-optional policy.
 *                          CORRECTION UP +20 from prior LEGACY_DB.)
 *   - sat75             : 1560    → 1560  (CDS C9: SAT Composite 75th =
 *                          1560 (EBRW 770 + Math 800 sum = 1570, but composite
 *                          quantile reported as 1560). Value matches prior DB;
 *                          tier upgraded LEGACY_DB → OFFICIAL.)
 *   - intlAcceptanceRate: 4.34    → 4.34  (CDS C1 residency: 362 intl admits /
 *                          8,341 intl applicants = 4.3400% (rounded to 4.34%).
 *                          Value matches prior DB; tier upgraded LEGACY_DB →
 *                          OFFICIAL.)
 *   - oosAcceptanceRate : 5.88    → null   (Vanderbilt is a private research
 *                          university; in-state / out-of-state distinction
 *                          carries no policy meaning. CDS C1 residency does
 *                          report OOS (2,034 admits / 34,605 apps = 5.8777%)
 *                          but per closure-pipeline convention, private
 *                          schools → UNAVAILABLE/TERMINAL. Prior LEGACY value
 *                          cleared.)
 *   - edAcceptanceRate  : 15.38   → 15.38  (CDS C21: ED Yes; single combined
 *                          plan reported in CDS with multiple closing dates
 *                          (First plan 11/1 = ED I, Other plan 1/1 = ED II;
 *                          notification 12/15 / Feb). Fall 2024 entering class
 *                          combined totals: 825 admits / 5,363 ED applications
 *                          = 15.3832% (rounded to 15.38%). Value matches prior
 *                          DB; tier upgraded LEGACY_DB → OFFICIAL.)
 *   - eaAcceptanceRate  : null    → null   (CDS C22: Vanderbilt does NOT
 *                          offer a nonbinding Early Action plan ("No" box
 *                          checked). Field stays null; provenance refreshed.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const VANDERBILT_CDS_URL =
  'https://cdn.vanderbilt.edu/vu-wpfsx/wp-content/uploads/sites/70/2025/11/CDS_2024-2025.xlsx';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const vandy = await prisma.school.findFirst({
    where: { id: 'cmn1htko5000ivqf28d3x9557' },
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
  if (!vandy) throw new Error('Vanderbilt University not found');
  console.log(`Updating ${vandy.name} (${vandy.id})`);
  console.log(
    `  current AR=${vandy.acceptanceRate?.toString()} sat25=${vandy.sat25} sat75=${vandy.sat75}`,
  );
  console.log(
    `  current intlAR=${vandy.intlAcceptanceRate?.toString()} oosAR=${vandy.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${vandy.edAcceptanceRate?.toString() ?? 'null'} eaAR=${vandy.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: VANDERBILT_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-vanderbilt-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 5.86,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1 Total: 2,662 admits (1,238 men + 1,424 women + 0 another gender) / 45,409 applicants (20,851 men + 24,553 women + 5 unknown gender) = 5.8625% (rounded to 5.86%). CORRECTION UP +0.77pp from prior LEGACY_DB value of 5.09 (which was based on the externally-aggregated Class of 2028 admit rate from collegekickstart.com — different methodology). Tier upgraded LEGACY_DB → OFFICIAL/CDS_OFFICIAL. Source format note: Vanderbilt publishes CDS as Excel (.xlsx) not PDF — parsed via openpyxl.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1510,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1510 (reported directly; EBRW 730 + Math 770 sum = 1500 differs because composite quantiles ≠ section sums). 50th=1540, 75th=1560. 27.4% (447 enrolled) of enrolled submitted SAT scores under test-optional policy. CORRECTION UP +20 from prior LEGACY_DB value of 1490. Tier upgraded LEGACY_DB → OFFICIAL/CDS_OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1560,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1560 (reported directly; EBRW 770 + Math 800 sum = 1570 differs because composite quantiles ≠ section sums). Value matches prior DB; tier upgraded LEGACY_DB → OFFICIAL/CDS_OFFICIAL with refreshed cycle metadata.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 4.34,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 362 international admits / 8,341 international applicants = 4.3400% (rounded to 4.34%). Value matches prior DB; tier upgraded LEGACY_DB → OFFICIAL/CDS_OFFICIAL with refreshed cycle metadata.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Vanderbilt University is a private research university in Nashville, TN; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table does report OOS (2,034 admits / 34,605 applicants = 5.8777%), but the value is not actionable for applicants. Prior LEGACY_DB value (5.88%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 15.38,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2024-25 Section C21: Vanderbilt offers Early Decision ("Yes" checked) with two plans reported as a single combined row — ED I closes 11/1 (notification 12/15), ED II closes 1/1 (notification per Other plan dates). Fall 2024 entering class combined totals: 825 admits / 5,363 ED applications = 15.3832% (rounded to 15.38%). Value matches prior DB; tier upgraded LEGACY_DB → OFFICIAL/CDS_OFFICIAL with refreshed cycle metadata.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: Vanderbilt University does NOT offer a nonbinding Early Action plan ("No" box checked for EA plan). DB value was already null; provenance refreshed from prior CDS_LLM_EXTRACT to authoritative CDS_OFFICIAL pull (parsed from .xlsx workbook) marked UNAVAILABLE/OFFICIAL_BLANK_SECTION (NOT_OFFERED).',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(vandy.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: VANDERBILT_CDS_URL,
  };

  await prisma.school.update({
    where: { id: vandy.id },
    data: {
      acceptanceRate: new Prisma.Decimal('5.86'),
      sat25: 1510,
      sat75: 1560,
      intlAcceptanceRate: new Prisma.Decimal('4.34'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('15.38'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=5.86, sat25=1510, sat75=1560, intlAR=4.34, oosAR=N/A, edAR=15.38, eaAR=NOT_OFFERED)',
  );

  // verify
  const after = await prisma.school.findUnique({
    where: { id: vandy.id },
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
