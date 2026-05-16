#!/usr/bin/env tsx
/**
 * Phase 3 — Howard University end-to-end closure of the 7 prediction-critical
 * fields.
 *
 * Source: Howard University CDS 2024-2025 (Fall 2024 entering class)
 *   URL: https://ira.howard.edu/sites/ira.howard.edu/files/2025-04/Howard%20University%20-%20CDS%20PDF%20Format.pdf
 *   Index: https://ira.howard.edu/institutional-research/institutional-data
 *
 * NOTE: Howard is a PRIVATE university (HBCU; isPrivate=true).
 *   - Per closure-pipeline convention, private schools: oosAR is marked
 *     UNAVAILABLE/TERMINAL even when CDS reports the residency breakdown
 *     (in-state / out-of-state distinction carries no policy meaning for
 *     private institutions).
 *   - intlAcceptanceRate IS in scope and recorded from CDS C1 residency
 *     breakdown.
 *   - Howard offers BOTH Early Decision (C21 "Yes") and Early Action (C22
 *     "Yes"). ED Fall 2024 numbers ARE published (348 / 172); EA cells are
 *     blank for applicants/admits.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 41.34   -> 41.34  (CDS 2024-25 C1: 14,144 admits /
 *                          34,211 applicants = 41.3434%. Value matches prior
 *                          DB; tier upgraded LEGACY_DB -> OFFICIAL.)
 *   - sat25             : 1090    -> 1050   (CDS 2024-25 C9: SAT Composite
 *                          25th = 1050 reported directly. CORRECTION DOWN
 *                          from prior 1090 (SEED/PR-15 heuristic).)
 *   - sat75             : 1320    -> 1250   (CDS 2024-25 C9: SAT Composite
 *                          75th = 1250 reported directly. CORRECTION DOWN
 *                          from prior 1320 (SEED/PR-15 heuristic).)
 *   - intlAcceptanceRate: 65.88   -> 65.88  (CDS 2024-25 C1 residency: 894
 *                          intl admits / 1,357 intl applicants = 65.8806%.
 *                          Value matches prior DB; tier upgraded LEGACY_DB
 *                          -> OFFICIAL.)
 *   - oosAcceptanceRate : 40.38   -> null   (Howard is a private HBCU; in-
 *                          state vs. out-of-state distinction carries no
 *                          policy meaning. CDS C1 residency DOES report OOS
 *                          (13,032 / 32,271 = 40.38%) but per closure-pipeline
 *                          private-school convention -> UNAVAILABLE/TERMINAL.
 *                          Prior legacy DB value cleared.)
 *   - edAcceptanceRate  : 49.43   -> 49.43  (CDS 2024-25 C21: "Yes" — Howard
 *                          DOES offer ED (closing 11/1, notification 12/18).
 *                          Fall 2024 entering class: 172 admits / 348 ED
 *                          applications = 49.4253% (rounded 49.43%). Value
 *                          matches prior DB; tier upgraded LEGACY_DB ->
 *                          OFFICIAL.)
 *   - eaAcceptanceRate  : null    -> null   (CDS 2024-25 C22: "Yes" — Howard
 *                          DOES offer EA (closing 11/1, notification 12/18,
 *                          non-restrictive). However the CDS C22 form does
 *                          NOT include applicants/admits cells, and Howard
 *                          did not publish round numbers separately. Field
 *                          stays null marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/
 *                          OFFERED_NOT_PUBLISHED.)
 *
 * NOTE on hasEarlyDecision: current DB true matches CDS C21 "Yes" — retained.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://ira.howard.edu/sites/ira.howard.edu/files/2025-04/Howard%20University%20-%20CDS%20PDF%20Format.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iu3003vz0tig0fa53lf';

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
  if (!school)
    throw new Error(`School ${SCHOOL_ID} (Howard University) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PRIVATE HBCU]`);
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
    generatedBy: 'phase3-howard-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 41.34,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 14,144 admits / 34,211 applicants = 41.3434% (rounded to 41.34%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1050,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1050 (reported directly). CORRECTION DOWN from prior 1090 (SEED/PR-15 heuristic). 47% of Fall 2024 enrolled (1,278 students) submitted SAT under test-optional policy.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1250,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1250 (reported directly). CORRECTION DOWN from prior 1320 (SEED/PR-15 heuristic).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 65.88,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 894 international admits / 1,357 international applicants = 65.8806% (rounded to 65.88%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Howard University is a private HBCU; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table does report OOS (13,032 admits / 32,271 applicants = 40.38%), but the value is not actionable for applicants. Prior legacy DB value (40.38%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 49.43,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Yes" — Howard offers Early Decision (closing 11/1, notification 12/18). Fall 2024 entering class: 172 admits / 348 ED applications = 49.4253% (rounded to 49.43%). Value matches prior DB; tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Yes" — Howard DOES offer a nonbinding Early Action plan (closing 11/1, notification 12/18, non-restrictive). However the CDS C22 form template does NOT include EA applicants/admits cells, and Howard did not separately publish round-level numbers. Field stays null marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/OFFERED_NOT_PUBLISHED. Replaces prior CDS_LLM_EXTRACT_2026_04 provenance (which had value=undefined).',
      realDataStatus: 'OFFERED_NOT_PUBLISHED',
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
      acceptanceRate: new Prisma.Decimal('41.34'),
      sat25: 1050,
      sat75: 1250,
      intlAcceptanceRate: new Prisma.Decimal('65.88'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('49.43'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true, // CDS C21 "Yes"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=41.34, sat25=1050, sat75=1250, intlAR=65.88, oosAR=N/A, edAR=49.43, eaAR=BLANK, hasED=true)',
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
