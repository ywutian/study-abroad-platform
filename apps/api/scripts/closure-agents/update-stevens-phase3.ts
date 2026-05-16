#!/usr/bin/env tsx
/**
 * Phase 3 — Stevens Institute of Technology end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: Stevens Institute of Technology CDS 2023-2024 (Fall 2023 entering
 *   class). This is the most recent FILLED CDS published by Stevens —
 *   the 2024-2025 PDF on stevens.edu is a blank fillable template
 *   (Common_Data_Set_2024-2025_June_-25_Update_PDF.pdf has zero data
 *   in the C1/C9/C21/C22 form fields and no widget values).
 *   URL: https://assets.stevens.edu/mviowpldu823/8g2creKHAYezWQm7Qgapu/369b640de25d98e2222b6abce45d0d4f/CDS_2024.pdf
 *
 * Stevens is PRIVATE (RESEARCH_UNIVERSITY) -> oosAcceptanceRate marked
 *   UNAVAILABLE/TERMINAL per closure-pipeline private-school convention.
 *
 * Stevens is test-flexible (CDS C8A "Yes" — most programs test-optional,
 *   accelerated pre-med and pre-law require scores). SAT bands recorded as
 *   OFFICIAL per closure-pipeline convention for descriptive use.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 43.44   -> 43.44  (CDS 2023-24 C1: 6,156 / 14,170 =
 *                          43.4439%. Value matches; tier upgraded
 *                          VERIFIED_REAL/LEGACY_DB -> OFFICIAL/CDS_OFFICIAL.)
 *   - sat25             : 1360    -> 1380   (CDS 2023-24 C9: SAT Composite
 *                          25th = 1380 reported directly. CORRECTION UP +20
 *                          from prior 1360. EBRW 670 + Math 700 = 1370
 *                          differs because composite quantile != section sum.)
 *   - sat75             : 1490    -> 1485   (CDS 2023-24 C9: SAT Composite
 *                          75th = 1485 reported directly. CORRECTION DOWN -5
 *                          from prior 1490. EBRW 730 + Math 770 = 1500
 *                          differs because composite quantile != section sum.)
 *   - intlAcceptanceRate: 27.39   -> 27.39  (CDS 2023-24 C1 residency: 424 /
 *                          1,548 = 27.3902%. Value matches; tier upgraded.)
 *   - oosAcceptanceRate : 41.75   -> null   (Stevens is private; in-state vs.
 *                          out-of-state distinction carries no policy meaning
 *                          (no in-state tuition advantage). Per closure-
 *                          pipeline convention, private schools mark
 *                          UNAVAILABLE/TERMINAL. Prior legacy DB value
 *                          cleared. CDS C1 residency does report OOS
 *                          2,628/6,295 = 41.7474%, recorded in reason but not
 *                          stored as a public field.)
 *   - edAcceptanceRate  : 55.41   -> 55.41  (CDS 2023-24 C21: Stevens offers
 *                          ED ("Yes"); two plans (ED I closes 11/1
 *                          notification 12/15, ED II closes 1/15
 *                          notification 2/15). Fall 2023: 435 admits / 785
 *                          ED apps = 55.4140% (rounded to 55.41%). Value
 *                          matches prior DB; tier upgraded.)
 *   - eaAcceptanceRate  : null    -> null   (CDS 2023-24 C22: Stevens marked
 *                          "Yes" for EA with dates 11/1 closing, 2/1
 *                          notification — BUT reported 0 applications, 0
 *                          admits, 0 enrolled. EA plan is offered but no
 *                          measurable cohort. Field stays cleared;
 *                          provenance refreshed to UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://assets.stevens.edu/mviowpldu823/8g2creKHAYezWQm7Qgapu/369b640de25d98e2222b6abce45d0d4f/CDS_2024.pdf';
const CYCLE_YEAR = 2023; // CDS 2023-2024 = Fall 2023 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8in5000pz0tiefcdnmfi';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Stevens) not found`);
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
    generatedBy: 'phase3-stevens-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 43.44,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2023-24 Section C1: 6,156 admits / 14,170 applicants = 43.4439% (rounded to 43.44%). Value matches prior DB; tier upgraded from VERIFIED_REAL/LEGACY_DB_VALUE (sourceUrl pointed to 2023-2024 CDS PDF) to OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1380,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2023-24 Section C9: SAT Composite 25th = 1380 (reported directly; EBRW 670 + Math 700 sum = 1370 differs because composite quantiles != section sums). CORRECTION UP +20 from prior 1360 (LEGACY_DB heuristic). 40% (411) of Fall 2023 enrolled submitted SAT under test-flexible policy (most programs test-optional; accelerated pre-med/pre-law require scores).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1485,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2023-24 Section C9: SAT Composite 75th = 1485 (reported directly; EBRW 730 + Math 770 sum = 1500 differs because composite quantiles != section sums). CORRECTION DOWN -5 from prior 1490 (LEGACY_DB heuristic).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 27.39,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2023-24 Section C1 residency table: 424 international admits / 1,548 international applicants = 27.3902% (rounded to 27.39%). Value matches prior DB; tier upgraded from VERIFIED_REAL/LEGACY_DB_VALUE to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Stevens Institute of Technology is a private research university; in-state vs. out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table does report OOS (2,628 admits / 6,295 applicants = 41.7474%), but the value is not actionable for applicants. Prior legacy DB value (41.75%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 55.41,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2023-24 Section C21: Stevens offers Early Decision ("Yes") with two plans — ED I closes 11/1 (12/15 notification), ED II closes 1/15 (2/15 notification). Fall 2023 entering class combined totals: 435 admits / 785 ED applications = 55.4140% (rounded to 55.41%). Value matches prior DB; tier upgraded from VERIFIED_REAL/LEGACY_DB_VALUE to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2023-24 Section C22: Stevens marked "Yes" for Early Action with dates 11/1 closing and 2/1 notification, BUT reported 0 EA applications, 0 admits, 0 enrolled for the Fall 2023 entering class — no measurable EA cohort. Restrictive: No. Field stays cleared; tier upgraded from prior CDS_LLM_EXTRACT_2026_04 (with value=undefined) to authoritative UNAVAILABLE/OFFICIAL_BLANK_SECTION.',
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
      acceptanceRate: new Prisma.Decimal('43.44'),
      sat25: 1380,
      sat75: 1485,
      intlAcceptanceRate: new Prisma.Decimal('27.39'),
      oosAcceptanceRate: null, // private school -> TERMINAL
      edAcceptanceRate: new Prisma.Decimal('55.41'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true, // CDS C21 "Yes"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=43.44, sat25=1380, sat75=1485, intlAR=27.39, oosAR=N/A, edAR=55.41, eaAR=NOT_REPORTED)',
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
