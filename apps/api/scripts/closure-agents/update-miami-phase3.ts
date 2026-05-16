#!/usr/bin/env tsx
/**
 * Phase 3 — University of Miami end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: University of Miami CDS 2025-2026 (Fall 2025 entering class for
 *   C1/C9; Fall 2024 entering class for C21 ED — per Miami CDS reporting).
 *   URL: https://irsa.miami.edu/facts-and-information/common-data-set/cds2526.pdf
 *   Submitted by Office of Institutional Research and Strategic Analytics.
 *   Last Updated: February 23, 2026.
 *
 * Miami is PRIVATE (RESEARCH_UNIVERSITY) -> oosAcceptanceRate marked
 *   UNAVAILABLE/TERMINAL per closure-pipeline private-school convention.
 *
 * Miami is test-optional (CDS C8A "Not required for admission, but considered
 *   if submitted"). SAT bands recorded as OFFICIAL for descriptive use.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 19      -> 17.61  (CDS 2025-26 C1: 10,245 admits /
 *                          58,167 applicants = 17.6149%. CORRECTION DOWN
 *                          -1.39pp from prior 19 (LEGACY_DB, sourceUrl
 *                          pointed to collegekickstart.com aggregator —
 *                          not Miami official). Tier LEGACY_DB -> OFFICIAL.)
 *   - sat25             : 1320    -> 1350   (CDS 2025-26 C9: SAT Composite
 *                          25th = 1350 reported. CORRECTION UP +30 from prior
 *                          1320 (LEGACY_DB). EBRW 670 + Math 660 = 1330
 *                          differs because composite quantile != section sum.
 *                          921 students (34%) submitted SAT under test-
 *                          optional policy.)
 *   - sat75             : 1460    -> 1450   (CDS 2025-26 C9: SAT Composite
 *                          75th = 1450 reported. CORRECTION DOWN -10 from
 *                          prior 1460. EBRW 730 + Math 740 = 1470 differs
 *                          because composite quantile != section sum.)
 *   - intlAcceptanceRate: 9.45    -> 9.45   (CDS 2025-26 C1 residency: 808 /
 *                          8,552 = 9.4481%. Value matches prior DB; tier
 *                          upgraded from LEGACY_DB to OFFICIAL.)
 *   - oosAcceptanceRate : 17.45   -> null   (Miami is private; in-state vs.
 *                          out-of-state distinction carries no policy meaning
 *                          (no in-state tuition advantage). Per closure-
 *                          pipeline convention, private schools mark
 *                          UNAVAILABLE/TERMINAL. Prior legacy DB value
 *                          cleared. CDS C1 residency does report OOS
 *                          6,282/36,007 = 17.4466%, recorded in reason but
 *                          not stored as a public field.)
 *   - edAcceptanceRate  : 44.34   -> 44.34  (CDS 2025-26 C21: Miami offers
 *                          ED ("Yes") with two plans (ED I 11/1 closing,
 *                          12/15 notification; ED II 1/5 closing, 2/28
 *                          notification). For the Fall 2024 entering class
 *                          (CDS reports ED one cycle behind C1): 1,062
 *                          admits / 2,395 ED applications = 44.3424%
 *                          (rounded to 44.34%). Value matches prior DB;
 *                          tier upgraded LEGACY_DB -> OFFICIAL.)
 *   - eaAcceptanceRate  : null    -> null   (CDS 2025-26 C22: Miami lists
 *                          EA dates (11/1 closing, 1/31 notification) but
 *                          provides NO applicant/admit counts. Per CDS the
 *                          plan is offered but no measurable EA cohort is
 *                          reported. Field stays cleared; tier upgraded
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://irsa.miami.edu/facts-and-information/common-data-set/cds2526.pdf';
const CYCLE_YEAR = 2025; // CDS 2025-2026 = Fall 2025 entering class (C1/C9)
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8in9000rz0ti2orsdpwi';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Miami) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}`);
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
    generatedBy: 'phase3-miami-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 17.61,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2025-26 Section C1: 10,245 admits / 58,167 applicants = 17.6149% (rounded to 17.61%). CORRECTION DOWN -1.39pp from prior 19 (LEGACY_DB; sourceUrl pointed to collegekickstart.com aggregator — not Miami official). Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1350,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2025-26 Section C9: SAT Composite 25th = 1350 (reported directly; EBRW 670 + Math 660 sum = 1330 differs because composite quantiles != section sums). CORRECTION UP +30 from prior 1320 (LEGACY_DB). 921 students (34% of Fall 2025 enrolled) submitted SAT under test-optional policy (C8A "Not required for admission, but considered if submitted").',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1450,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2025-26 Section C9: SAT Composite 75th = 1450 (reported directly; EBRW 730 + Math 740 sum = 1470 differs because composite quantiles != section sums). CORRECTION DOWN -10 from prior 1460 (LEGACY_DB).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 9.45,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2025-26 Section C1 residency table: 808 international admits / 8,552 international applicants = 9.4481% (rounded to 9.45%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'University of Miami is a private research university; in-state vs. out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table does report OOS (6,282 admits / 36,007 applicants = 17.4466%), but the value is not actionable for applicants. Prior legacy DB value (17.45%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 44.34,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2025-26 Section C21: Miami offers Early Decision ("Yes") with two plans — ED I closes 11/1 (12/15 notification), ED II closes 1/5 (2/28 notification). Per Miami CDS reporting convention, ED data is reported one cycle behind C1: for the Fall 2024 entering class, 1,062 admits / 2,395 ED applications = 44.3424% (rounded to 44.34%). Value matches prior DB; tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2025-26 Section C22: Miami lists EA dates (11/1 closing, 1/31 notification) but provides NO applicant or admit counts — the plan appears offered but no measurable EA cohort is reported in CDS. Field stays cleared; tier upgraded from prior CDS_LLM_EXTRACT_2026_04 (with value=undefined) to authoritative UNAVAILABLE/OFFICIAL_BLANK_SECTION.',
      realDataStatus: 'NOT_REPORTED',
    },
  };

  const existingMeta = toRecord(school.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: CDS_URL,
  };

  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('17.61'),
      sat25: 1350,
      sat75: 1450,
      intlAcceptanceRate: new Prisma.Decimal('9.45'),
      oosAcceptanceRate: null, // private school -> TERMINAL
      edAcceptanceRate: new Prisma.Decimal('44.34'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true, // CDS C21 "Yes"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=17.61, sat25=1350, sat75=1450, intlAR=9.45, oosAR=N/A, edAR=44.34, eaAR=NOT_REPORTED)',
  );

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
