#!/usr/bin/env tsx
/**
 * Phase 3 — Santa Clara University end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: Santa Clara University CDS 2024-2025 (parsed by Claude from PDF)
 *   URL: https://www.scu.edu/media/offices/institutional-research/fampf/common-data-set/CDS-2024-2025---Final---Revised-01152026.pdf
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 47.9     → 48.00  (CDS C1 total: 9,105 admits / 18,970
 *                          applicants = 47.9968%. Tier upgraded LEGACY_DB →
 *                          OFFICIAL. CORRECTION UP +0.10pp.)
 *   - sat25             : 1310     → 1360   (CDS C9: SAT Composite 25th = 1360
 *                          reported directly. CORRECTION UP +50 from prior
 *                          1310 (LEGACY_DB).)
 *   - sat75             : 1450     → 1480   (CDS C9: SAT Composite 75th = 1480
 *                          reported directly. CORRECTION UP +30 from prior
 *                          1450 (LEGACY_DB).)
 *   - intlAcceptanceRate: 30.1     → 30.15  (CDS C1 residency: 694 intl admits /
 *                          2,302 intl applicants = 30.1477%. Value essentially
 *                          matches prior DB; tier upgraded LEGACY_DB → OFFICIAL.
 *                          CORRECTION UP +0.05pp.)
 *   - oosAcceptanceRate : 53       → null   (Santa Clara University is a private
 *                          Jesuit research university; in-state / out-of-state
 *                          distinction carries no policy meaning. CDS C1
 *                          residency does report OOS (3,875 admits / 7,310
 *                          applicants = 53.01%) but per closure-pipeline
 *                          convention, private schools → UNAVAILABLE/TERMINAL.
 *                          Prior legacy DB value cleared.)
 *   - edAcceptanceRate  : 80.13    → 80.13  (CDS C21: SCU offers Early Decision
 *                          ("Yes" checked) — ED I and ED II combined: 488
 *                          admits / 609 applications = 80.1314% (rounded to
 *                          80.13%). Value matches prior DB; provenance
 *                          refreshed to closure-pipeline-phase3 CDS_OFFICIAL
 *                          with current cycle metadata.)
 *   - eaAcceptanceRate  : 49.38    → null   (CDS C22: SCU offers nonbinding Early
 *                          Action ("Yes" checked) with EA closing Nov 1 /
 *                          notification Dec 31 (non-restrictive) — BUT no EA
 *                          applicant/admit numbers reported in CDS (the CDS
 *                          template only collects per-cycle counts for ED,
 *                          not EA). Prior DB value 49.38 came from
 *                          TAVILY_ENRICHMENT (not authoritative). Cleared and
 *                          marked UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const SCU_CDS_URL =
  'https://www.scu.edu/media/offices/institutional-research/fampf/common-data-set/CDS-2024-2025---Final---Revised-01152026.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findFirst({
    where: { id: 'cmnwr8im50005z0ti3z02fhjs' },
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
  if (!school) throw new Error('Santa Clara University not found');
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(
    `  current AR=${school.acceptanceRate?.toString()} sat25=${school.sat25} sat75=${school.sat75}`,
  );
  console.log(
    `  current intlAR=${school.intlAcceptanceRate?.toString()} oosAR=${school.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${school.edAcceptanceRate?.toString() ?? 'null'} eaAR=${school.eaAcceptanceRate?.toString() ?? 'null'} hasED=${school.hasEarlyDecision}`,
  );

  const baseProv = {
    sourceUrl: SCU_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-scu-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 48.0,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 9,105 admits (men 3,975 + women 5,130) / 18,970 applicants (men 8,928 + women 10,042) = 47.9968% (rounded to 48.00%). Tier upgraded from LEGACY_DB (value 47.9) to OFFICIAL. CORRECTION UP +0.10pp.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1360,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1360 reported directly (EBRW 670 + Math 680 = 1350 differs because composite quantiles ≠ section sums). CORRECTION UP from prior 1310 (LEGACY_DB). 24% (385 enrolled) submitted SAT under test-optional policy.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1480,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1480 reported directly (EBRW 730 + Math 760 = 1490 differs because composite quantiles ≠ section sums). CORRECTION UP from prior 1450 (LEGACY_DB).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 30.15,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 694 international admits / 2,302 international applicants = 30.1477% (rounded to 30.15%). Value essentially matches prior DB (30.1); tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance. CORRECTION UP +0.05pp.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Santa Clara University is a private Jesuit research university (Santa Clara, CA); in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table does report OOS (3,875 admits / 7,310 applicants = 53.0096%), but the value is not actionable for applicants. Prior legacy DB value (53) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 80.13,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2024-25 Section C21: SCU offers Early Decision ("Yes" checked) with two plans — ED I closes 11/1 (12/31 notification), ED II closes 1/7 (2/15 notification). Fall 2024 entering class combined totals: 488 admits / 609 applications = 80.1314% (rounded to 80.13%). Value matches prior DB; provenance refreshed to closure-pipeline-phase3 CDS_OFFICIAL with current cycle metadata.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: SCU OFFERS a nonbinding Early Action plan ("Yes" checked) with EA closing date Nov 1 and notification Dec 31 (non-restrictive). However, the CDS template does NOT collect EA applicant/admit counts (only ED counts are reported in C21). Prior DB value 49.38 came from TAVILY_ENRICHMENT (not authoritative — likely scraped from a non-CDS press release or aggregator). Cleared and marked UNAVAILABLE — EA plan exists but per-cycle counts not disclosed in official CDS.',
      realDataStatus: 'NOT_PUBLISHED',
    },
  };

  const existingMeta = toRecord(school.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: SCU_CDS_URL,
  };

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('48.00'),
      sat25: 1360,
      sat75: 1480,
      intlAcceptanceRate: new Prisma.Decimal('30.15'),
      oosAcceptanceRate: null, // private institution → not applicable
      edAcceptanceRate: new Prisma.Decimal('80.13'),
      eaAcceptanceRate: null, // CDS C22 "Yes" but no counts reported in template
      hasEarlyDecision: true, // re-confirm from CDS C21 "Yes"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=48.00, sat25=1360, sat75=1480, intlAR=30.15, oosAR=N/A, edAR=80.13, eaAR=BLANK)',
  );

  // verify
  const after = await prisma.school.findUnique({
    where: { id: school.id },
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
