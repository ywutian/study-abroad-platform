#!/usr/bin/env tsx
/**
 * Phase 3 — SUNY Binghamton University end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: Binghamton University CDS 2024-2025 (Fall 2024 entering class).
 *   URL: https://www.binghamton.edu/offices/oir/upload_data/cds20242025p.pdf
 *
 * Binghamton is PUBLIC (SUNY) -> oosAcceptanceRate IS in eligible scope and
 *   carries a real OFFICIAL number from CDS C1 residency.
 *
 * Binghamton is test-optional (CDS C8A SAT/ACT "Not required for admission,
 *   but considered if submitted"). SAT bands recorded as OFFICIAL for
 *   descriptive use.
 *
 * Binghamton does NOT offer Early Decision (CDS C21 "No") — current DB has
 *   hasEarlyDecision=true which is WRONG. Setting hasEarlyDecision=false.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 38.61   -> 38.61  (CDS 2024-25 C1: 20,464 admits /
 *                          53,007 applicants = 38.6081%. Value matches; tier
 *                          upgraded LEGACY_DB -> OFFICIAL.)
 *   - sat25             : 1340    -> 1360   (CDS 2024-25 C9: SAT Composite
 *                          25th = 1360 reported. CORRECTION UP +20 from
 *                          prior 1340 (SEED/PR-15 heuristic). 1,423 students
 *                          (44%) submitted SAT.)
 *   - sat75             : 1500    -> 1480   (CDS 2024-25 C9: SAT Composite
 *                          75th = 1480 reported. CORRECTION DOWN -20 from
 *                          prior 1500 (SEED/PR-15 heuristic). EBRW 730 +
 *                          Math 760 = 1490 differs because composite
 *                          quantile != section sum.)
 *   - intlAcceptanceRate: 65.44   -> 65.44  (CDS 2024-25 C1 residency: 1,369
 *                          intl admits / 2,092 intl applicants = 65.4398%.
 *                          Value matches; tier upgraded.)
 *   - oosAcceptanceRate : 79.18   -> 79.18  (CDS 2024-25 C1 residency: 5,076
 *                          OOS admits / 6,411 OOS applicants = 79.1764%.
 *                          Value matches prior DB; tier upgraded LEGACY_DB
 *                          -> OFFICIAL. PUBLIC SUNY school — oosAR carries
 *                          the real OFFICIAL number per pipeline convention.)
 *   - edAcceptanceRate  : null    -> null   (CDS 2024-25 C21: "No" — Bing
 *                          does NOT offer Early Decision. Setting
 *                          hasEarlyDecision=false to correct stale DB value
 *                          true. Field stays cleared (UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION). Existing provenance had
 *                          tier=OFFICIAL/CDS_LLM_EXTRACT_2026_04 — refreshed
 *                          with explicit NOT_OFFERED status.)
 *   - eaAcceptanceRate  : 49.97   -> 49.97  (CDS 2024-25 C22: Bing offers EA
 *                          ("Yes") with closing 11/1 and notification 1/15
 *                          (non-restrictive). Fall 2024 entering class:
 *                          14,214 admits / 28,444 EA applications =
 *                          49.9719% (rounded to 49.97%). Value matches
 *                          prior DB; tier upgraded LEGACY_DB -> OFFICIAL.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.binghamton.edu/offices/oir/upload_data/cds20242025p.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iqv002cz0ti57kn9m2m';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Binghamton) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC SUNY]`);
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
    generatedBy: 'phase3-binghamton-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 38.61,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 20,464 admits / 53,007 applicants = 38.6081% (rounded to 38.61%). Value matches prior DB; tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1360,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1360 (reported directly; EBRW 660 + Math 680 sum = 1340 differs because composite quantiles != section sums). CORRECTION UP +20 from prior 1340 (SEED/PR-15 heuristic). 1,423 students (44% of Fall 2024 enrolled) submitted SAT under test-optional policy (C8A "Not required for admission, but considered if submitted").',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1480,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1480 (reported directly; EBRW 730 + Math 760 sum = 1490 differs because composite quantiles != section sums). CORRECTION DOWN -20 from prior 1500 (SEED/PR-15 heuristic).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 65.44,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 1,369 international admits / 2,092 international applicants = 65.4398% (rounded to 65.44%). Value matches prior DB; tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 79.18,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 5,076 out-of-state admits / 6,411 out-of-state applicants = 79.1764% (rounded to 79.18%). Value matches prior DB; tier upgraded LEGACY_DB -> OFFICIAL. SUNY Binghamton is a PUBLIC institution — in-state vs. out-of-state distinction carries real policy meaning (different tuition, residency-preference admit pathways), so this field is in eligible scope and MUST carry a real CDS number.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. Binghamton does NOT offer Early Decision. Correcting stale DB hasEarlyDecision=true -> false. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Previous provenance had tier=OFFICIAL/CDS_LLM_EXTRACT_2026_04 with value=undefined — refreshed with explicit NOT_OFFERED status.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 49.97,
      policyLabel: 'Early Action admit rate (non-restrictive)',
      reason:
        'CDS 2024-25 Section C22: Binghamton offers Early Action ("Yes") with closing 11/1 and notification 1/15 (non-restrictive — "Is your early action plan a restrictive plan?" = No). Fall 2024 entering class: 14,214 admits / 28,444 EA applications = 49.9719% (rounded to 49.97%). Value matches prior DB; tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
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
      acceptanceRate: new Prisma.Decimal('38.61'),
      sat25: 1360,
      sat75: 1480,
      intlAcceptanceRate: new Prisma.Decimal('65.44'),
      oosAcceptanceRate: new Prisma.Decimal('79.18'),
      edAcceptanceRate: null,
      eaAcceptanceRate: new Prisma.Decimal('49.97'),
      // CDS C21 "No" — Binghamton does NOT offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=38.61, sat25=1360, sat75=1480, intlAR=65.44, oosAR=79.18, edAR=NOT_OFFERED, eaAR=49.97, hasED=false)',
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
