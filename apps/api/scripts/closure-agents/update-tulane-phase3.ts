#!/usr/bin/env tsx
/**
 * Phase 3 — Tulane University end-to-end closure of the 7 prediction-critical
 * fields.
 *
 * Source: Tulane University CDS 2024-2025 (Office of Assessment & Institutional
 *   Research, downloaded via Box static link)
 *   Landing page: https://oair.tulane.edu/common-data-set
 *   Direct PDF: https://tulane.box.com/shared/static/uzo690yk2rzs7v2tqws50i3cesgz194w.pdf
 *
 * NOTE on isPrivate flag drift: CDS A2 confirms Tulane is "Private (nonprofit)"
 * (checkbox marked). The DB `isPrivate` flag is currently false, which is a
 * pre-existing data quality issue outside this batch's scope (closure pipeline
 * only writes the 7 prediction-critical fields). Per closure-pipeline private-
 * institution convention, oosAR is still marked UNAVAILABLE/TERMINAL here.
 *
 * Value changes vs. existing DB:
 *   - acceptanceRate    : 14.7   → 13.98  (CDS C1: 4,559 / 32,609 = 13.9808%.
 *                          CORRECTION DOWN -0.72pp.)
 *   - sat25             : 1380   → 1410   (CDS C9 SAT Composite 25th = 1410.
 *                          CORRECTION UP +30.)
 *   - sat75             : 1510   → 1500   (CDS C9 SAT Composite 75th = 1500.
 *                          CORRECTION DOWN -10.)
 *   - intlAcceptanceRate: 15.8   → 15.76  (CDS C1 residency: 529 / 3,357 =
 *                          15.7581%. Refined from 15.8 to 15.76.)
 *   - oosAcceptanceRate : 12.84  → null   (private; UNAVAILABLE/TERMINAL.)
 *   - edAcceptanceRate  : 59.4   → 59.40  (CDS C21: ED I + ED II combined.
 *                          1,156 admits / 1,946 ED apps = 59.4039%. Value
 *                          matches; tier upgraded to OFFICIAL.)
 *   - eaAcceptanceRate  : 11     → null   (CDS C22: EA offered ("Yes"),
 *                          non-restrictive, 11/15 closing, 1/10 notification.
 *                          But CDS C22 does NOT collect EA application/admit
 *                          counts. Prior DB value (11) was from TAVILY_ENRICHMENT
 *                          with no CDS support. Cleared and marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const TULANE_CDS_URL =
  'https://tulane.box.com/shared/static/uzo690yk2rzs7v2tqws50i3cesgz194w.pdf';
const TULANE_CDS_LANDING = 'https://oair.tulane.edu/common-data-set';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const tulane = await prisma.school.findFirst({
    where: { id: 'cmnwr8im70006z0ti47aaywzj' },
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
  if (!tulane) throw new Error('Tulane University not found');
  console.log(`Updating ${tulane.name} (${tulane.id})`);
  console.log(
    `  current AR=${tulane.acceptanceRate?.toString()} sat25=${tulane.sat25} sat75=${tulane.sat75}`,
  );
  console.log(
    `  current intlAR=${tulane.intlAcceptanceRate?.toString()} oosAR=${tulane.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${tulane.edAcceptanceRate?.toString()} eaAR=${tulane.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: TULANE_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-tulane-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 13.98,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 4,559 admits / 32,609 applicants = 13.9808% (rounded to 13.98%). Tier upgraded from LEGACY_DB (14.7) to OFFICIAL. CORRECTION DOWN -0.72pp.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1410,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1410 (reported directly; EBRW 700 + Math 700 sum = 1400 differs because composite quantiles ≠ section sums). CORRECTION UP from prior 1380. 13% of enrollees (230 students) submitted SAT under test-optional policy.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1500,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1500 (reported directly; EBRW 750 + Math 770 sum = 1520 differs because composite quantiles ≠ section sums). CORRECTION DOWN from prior 1510.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 15.76,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 529 international admits / 3,357 international applicants = 15.7581% (rounded to 15.76%). Refined from prior 15.8; tier upgraded from LEGACY_DB to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Tulane University is a private research university (CDS A2: Private nonprofit checked). In-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency does report OOS (3,491 admits / 27,187 applicants = 12.8407%) but the value is not actionable for applicants. Prior legacy DB value (12.84%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions. NOTE: schools.isPrivate flag currently false in DB — pre-existing data-quality drift outside this batch scope.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 59.4,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2024-25 Section C21: Tulane offers Early Decision ("Yes" checked) with two plans — ED I closes 11/1 (12/15 notification), ED II closes 1/15 (2/15 notification). Fall 2024 entering class combined totals: 1,156 admits / 1,946 ED applications = 59.4039% (rounded to 59.40%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: Tulane offers nonbinding Early Action ("Yes" checked), closing 11/15, notification 1/10, non-restrictive ("No" to restrictive). However, CDS C22 collects only Yes/No + dates + restrictive flag — it does NOT collect EA application or admit counts. Therefore an authoritative EA admit rate cannot be derived from CDS. Prior DB value (11%) was from TAVILY_ENRICHMENT scraper with no CDS support; cleared. Field marked UNAVAILABLE-terminal/OFFICIAL_BLANK_SECTION (plan offered but admit count not reportable from CDS).',
      realDataStatus: 'NOT_REPORTED',
    },
  };

  const existingMeta = toRecord(tulane.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: TULANE_CDS_LANDING,
  };

  await prisma.school.update({
    where: { id: tulane.id },
    data: {
      acceptanceRate: new Prisma.Decimal('13.98'),
      sat25: 1410,
      sat75: 1500,
      intlAcceptanceRate: new Prisma.Decimal('15.76'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('59.40'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=13.98, sat25=1410, sat75=1500, intlAR=15.76, oosAR=N/A, edAR=59.40, eaAR=NOT_REPORTED)',
  );

  const after = await prisma.school.findUnique({
    where: { id: tulane.id },
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
