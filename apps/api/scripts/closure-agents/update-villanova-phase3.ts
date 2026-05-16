#!/usr/bin/env tsx
/**
 * Phase 3 — Villanova University end-to-end closure of the 7 prediction-
 * critical fields.
 *
 * Source: Villanova University CDS 2024-2025 (Fall 2024 entering class)
 *   URL: https://www.villanova.edu/content/dam/villanova/provost/decision_support/2024-2025-CDS_v2.pdf
 *
 * PRIVATE school — oosAcceptanceRate cleared per closure-pipeline convention
 *   (UNAVAILABLE/TERMINAL). CDS C1 residency does publish OOS (5,062/18,490 =
 *   27.38%) but the value carries no policy meaning at a private institution.
 *
 * Test policy: C8A — SAT/ACT "Required for some" (C8F clarifies "SAT or ACT
 *   are required for homeschool students" only). De facto test-optional for
 *   the general applicant pool. SAT Composite quantiles in C9 recorded as
 *   OFFICIAL for descriptive applicant-profile use.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 26.98    ->  26.98   (CDS C1 Total: 6,274 admits /
 *                          23,256 applicants = 26.9779%. Value matches; tier
 *                          LEGACY_DB->OFFICIAL.)
 *   - sat25             : 1250     ->  1410    (CDS C9 SAT Composite 25th =
 *                          1410 reported directly. LARGE CORRECTION UP +160
 *                          from prior 1250 (SEED/HEURISTIC:PR-15 — was a
 *                          placeholder, never CDS-sourced).)
 *   - sat75             : 1450     ->  1490    (CDS C9 SAT Composite 75th =
 *                          1490 reported directly. CORRECTION UP +40 from
 *                          prior 1450 (SEED/HEURISTIC:PR-15).)
 *   - intlAcceptanceRate: 17.00    ->  17.00   (CDS C1 residency: 152 intl
 *                          admits / 894 intl applicants = 17.0022%. Value
 *                          matches prior DB; tier LEGACY_DB->OFFICIAL.)
 *   - oosAcceptanceRate : 27.38    ->  null    (Private school — oosAR cleared
 *                          per closure-pipeline convention; UNAVAILABLE/
 *                          TERMINAL. CDS does publish OOS 5,062/18,490=27.38%
 *                          but value is not policy-actionable for private
 *                          institution applicants.)
 *   - edAcceptanceRate  : 54.25    ->  54.25   (CDS C21: Villanova offers ED
 *                          ("Yes") with two plans — ED I closing 11/1
 *                          (notification 12/15), ED II closing 1/15
 *                          (notification 3/1). Fall 2024 entering class
 *                          combined totals: 920 admits / 1,696 ED applications
 *                          = 54.2453% (rounded to 54.25%). Value matches prior
 *                          DB; tier LEGACY_DB->OFFICIAL.)
 *   - eaAcceptanceRate  : 15.40    ->  null    (CDS C22 "Yes" — Villanova
 *                          offers nonbinding EA (closing 11/1, notification
 *                          1/20, non-restrictive). However the CDS C22 form
 *                          does NOT publish EA applicant/admit counts (only
 *                          dates). Prior DB value 15.4 came from
 *                          TAVILY_ENRICHMENT (non-CDS scraper) and is not
 *                          authoritative per closure-pipeline convention.
 *                          Cleared to UNAVAILABLE/OFFICIAL_BLANK_SECTION since
 *                          CDS doesn't publish the EA rate.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.villanova.edu/content/dam/villanova/provost/decision_support/2024-2025-CDS_v2.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iun0041z0tin8tw3f6b';

const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findUnique({
    where: { id: SCHOOL_ID },
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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Villanova) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PRIVATE]`);
  console.log(
    `  current AR=${school.acceptanceRate?.toString()} sat25=${school.sat25} sat75=${school.sat75}`,
  );
  console.log(
    `  current intlAR=${school.intlAcceptanceRate?.toString()} oosAR=${school.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${school.edAcceptanceRate?.toString() ?? 'null'} eaAR=${school.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-villanova-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 26.98,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 6,274 admits / 23,256 applicants = 26.9779% (rounded to 26.98%). Value matches prior DB; tier upgraded LEGACY_DB -> OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1410,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1410 (reported directly). LARGE CORRECTION UP +160 from prior 1250 (SEED/HEURISTIC:PR-15 placeholder, never CDS-sourced). NOTE: Villanova is de facto test-optional for general applicants (C8A "Required for some" — C8F clarifies homeschool students only); 19% of Fall 2024 enrolled (323 students) submitted SAT.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1490,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1490 (reported directly). CORRECTION UP +40 from prior 1450 (SEED/HEURISTIC:PR-15 placeholder).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 17.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 152 international admits / 894 international applicants = 17.0022% (rounded to 17.00%). Value matches prior DB; tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Villanova University is a private institution; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency does report OOS (5,062 admits / 18,490 applicants = 27.38%), but the value is not actionable for applicants. Prior legacy DB value (27.38%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 54.25,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2024-25 Section C21: Villanova offers Early Decision ("Yes" checked) with two plans — ED I closes 11/1 (notification 12/15), ED II closes 1/15 (notification 3/1). Fall 2024 entering class combined totals: 920 admits / 1,696 ED applications = 54.2453% (rounded to 54.25%). Value matches prior DB; tier upgraded LEGACY_DB -> OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: Villanova offers nonbinding Early Action ("Yes" checked, closing 11/1, notification 1/20, non-restrictive). However the CDS C22 form does NOT publish EA applicant/admit counts (only the date fields are populated). Prior DB value 15.4 came from TAVILY_ENRICHMENT (non-CDS scraper) and is not authoritative per closure-pipeline convention (CDS is the source of truth). Cleared to UNAVAILABLE/OFFICIAL_BLANK_SECTION since the EA rate is not published in CDS.',
      realDataStatus: 'NOT_PUBLISHED',
    },
  };

  const existingMeta = toRecord(school.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: CDS_URL,
  };

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('26.98'),
      sat25: 1410,
      sat75: 1490,
      intlAcceptanceRate: new Prisma.Decimal('17.00'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('54.25'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true, // re-confirm from CDS C21 "Yes"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=26.98, sat25=1410, sat75=1490, intlAR=17.00, oosAR=N/A, edAR=54.25, eaAR=NOT_PUBLISHED)',
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
