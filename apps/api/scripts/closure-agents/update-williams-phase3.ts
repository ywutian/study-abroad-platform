#!/usr/bin/env tsx
/**
 * Phase 3 — Williams College end-to-end closure of the 7 prediction-critical
 * fields.
 *
 * Source: Williams College CDS 2023-2024 (manually parsed by Claude from PDF)
 *   Index page (broken by Cloudflare for headless agents):
 *     https://www.williams.edu/institutional-research/common-data-set/
 *   2024-25 PDF (Cloudflare-protected, not retrievable from this env):
 *     https://www.williams.edu/institutional-research/files/2025/05/CDS_2024_2025_Williams_V4.pdf
 *   2023-24 PDF (used here, retrieved via web.archive.org snapshot):
 *     https://web.archive.org/web/20250122192545if_/https://www.williams.edu/institutional-research/files/2024/04/CDS_2023_2024_Williams_April2024.pdf
 *
 * All 7 fields upgraded to OFFICIAL / UNAVAILABLE-terminal.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 7.52   → 9.99   (CDS C1: 1,145 / 11,465 = 9.9869%)
 *                         (prior value sourced from collegekickstart blog;
 *                          replaced by Williams' own CDS.)
 *   - sat25             : 1460   → 1480   (CDS C9: SAT Composite 25th = 1480
 *                          reported directly; coincides with EBRW 730 + Math
 *                          740 sum.)
 *   - sat75             : 1570   → 1550   (CDS C9: SAT Composite 75th = 1550
 *                          reported directly; CORRECTION DOWN — composite
 *                          quantile is lower than EBRW 770 + Math 790 sum =
 *                          1560 because composite quantiles ≠ section sums.)
 *   - intlAcceptanceRate: 3.6    → null   (CDS C1 residency breakdown table is
 *                          ENTIRELY BLANK — Williams does not report it. Prior
 *                          heuristic 3.6% cleared.)
 *   - oosAcceptanceRate : 6.3    → null   (Williams is private LAC; in-state /
 *                          out-of-state distinction does not apply. Prior
 *                          heuristic 6.3% cleared.)
 *   - edAcceptanceRate  : 27.04  → 27.04  (unchanged value; refresh provenance
 *                          to CDS_OFFICIAL with current closure metadata. CDS
 *                          C21: 255 admitted / 943 applicants = 27.04%.)
 *   - eaAcceptanceRate  : null   → null   (unchanged; CDS C22: Williams does
 *                          NOT offer Early Action — "No" checked. Already
 *                          TERMINAL; refresh provenance to UNAVAILABLE /
 *                          OFFICIAL_BLANK_SECTION terminology used by closure
 *                          pipeline.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const WILLIAMS_CDS_URL =
  'https://web.archive.org/web/20250122192545if_/https://www.williams.edu/institutional-research/files/2024/04/CDS_2023_2024_Williams_April2024.pdf';
const WILLIAMS_CDS_INDEX_URL =
  'https://www.williams.edu/institutional-research/common-data-set/';
const CYCLE_YEAR = 2023; // CDS 2023-2024 = Fall 2023 entering class
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const williams = await prisma.school.findFirst({
    where: { name: { contains: 'Williams' }, country: 'US' },
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
  if (!williams) throw new Error('Williams not found');
  console.log(`Updating ${williams.name} (${williams.id})`);
  console.log(
    `  current AR=${williams.acceptanceRate?.toString()} sat25=${williams.sat25} sat75=${williams.sat75}`,
  );
  console.log(
    `  current intlAR=${williams.intlAcceptanceRate?.toString()} oosAR=${williams.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${williams.edAcceptanceRate?.toString()} eaAR=${williams.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: WILLIAMS_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-williams-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 9.99,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2023-24 Section C1: 1,145 admitted / 11,465 applicants = 9.9869% (rounded to 9.99%). CORRECTION from prior 7.52% (sourced from college-kickstart blog and treated as legacy DB value).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1480,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2023-24 Section C9: SAT Composite 25th = 1480 (reported directly; coincides with EBRW 730 + Math 740 sum). CORRECTION from prior 1460 (SEED heuristic).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1550,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2023-24 Section C9: SAT Composite 75th = 1550 (reported directly; LOWER than EBRW 770 + Math 790 = 1560 because composite quantiles ≠ section sums). CORRECTION DOWN from prior 1570 (SEED heuristic).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2023-24 Section C1 residency breakdown table (In-State / Out-of-State / International) is ENTIRELY BLANK — Williams does not publish residency-segmented applicant/admit counts. Prior heuristic value (3.6%) cleared.',
      realDataStatus: 'OFFICIAL_BLANK_SECTION',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Williams College is a private liberal arts college (CDS A2: Private (Nonprofit)); in-state / out-of-state distinction does not apply. Prior heuristic value (6.3%) cleared. Field marked UNAVAILABLE-terminal.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 27.04,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2023-24 Section C21: Williams offers ED ("Yes"); 255 admitted / 943 applicants = 27.0414% (rounded to 27.04%). Value matches prior DB; provenance refreshed to closure-pipeline-phase3.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2023-24 Section C22: Williams does NOT offer an Early Action plan ("No" checked). Field marked UNAVAILABLE-terminal.',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(williams.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: WILLIAMS_CDS_INDEX_URL,
  };

  // Bypass SchoolWriteService (schema drift on housingAvailable etc.). Minimal
  // update with explicit select to avoid touching unrelated columns.
  await prisma.school.update({
    where: { id: williams.id },
    data: {
      acceptanceRate: new Prisma.Decimal('9.99'),
      sat25: 1480,
      sat75: 1550,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('27.04'),
      // eaAcceptanceRate is already null/undefined; leave untouched (TERMINAL).
      hasEarlyDecision: true, // re-confirm from CDS C21 "Yes"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=9.99, sat25=1480, sat75=1550, intlAR=BLANK, oosAR=N/A, edAR=27.04, eaAR=NOT_OFFERED)',
  );

  // verify
  const after = await prisma.school.findUnique({
    where: { id: williams.id },
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
