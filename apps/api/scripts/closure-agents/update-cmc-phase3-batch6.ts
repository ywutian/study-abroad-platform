#!/usr/bin/env tsx
/**
 * Phase 3 — Claremont McKenna College end-to-end closure of the 7
 * prediction-critical fields (batch 6).
 *
 * Source: Claremont McKenna College CDS 2024-2025 (Fall 2024 entering class).
 *   URL: https://www.cmc.edu/sites/default/files/CDS_2024-2025.pdf
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 9.59     → 9.59   (CDS C1: 626 admits / 6,529 apps
 *                          = 9.5880% (rounded to 9.59%). Value matches prior
 *                          DB; tier upgraded LEGACY_DB → OFFICIAL.)
 *   - sat25             : 1380     → 1490  (CDS C9: SAT Composite 25th = 1490.
 *                          EBRW 720, Math 750. MAJOR CORRECTION UP +110 from
 *                          prior 1380 (SEED/PR-15 heuristic — wildly low).
 *                          Tier upgraded SEED → OFFICIAL.)
 *   - sat75             : 1540     → 1550  (CDS C9: SAT Composite 75th = 1550
 *                          (EBRW 770 + Math 790 = 1560 differs because
 *                          composite quantiles ≠ section sums). CORRECTION UP
 *                          +10 from prior 1540 (SEED/PR-15 heuristic). Tier
 *                          upgraded SEED → OFFICIAL.)
 *   - intlAcceptanceRate: 5.63     → 5.63  (CDS C1 residency: 112 intl admits
 *                          / 1,991 intl applicants = 5.6253% (rounded to
 *                          5.63%). Value matches prior DB; tier upgraded
 *                          LEGACY_DB → OFFICIAL with refreshed provenance.)
 *   - oosAcceptanceRate : 13.78    → null  (CMC is a private liberal arts
 *                          college; in-state / out-of-state distinction
 *                          carries no policy meaning. CDS C1 residency does
 *                          report OOS (277 admits / 2,010 applicants =
 *                          13.7811%) but per closure-pipeline convention,
 *                          private schools → UNAVAILABLE/TERMINAL. Prior
 *                          legacy DB value cleared.)
 *   - edAcceptanceRate  : 23.37    → 23.37 (CDS C21: CMC offers Early Decision
 *                          ("Yes"). TWO plans — ED I 11/1 closing → 12/15
 *                          notification, ED II 1/10 closing → 2/15
 *                          notification. Fall 2024 entering class combined ED:
 *                          226 admits / 967 applications = 23.3713% (rounded
 *                          to 23.37%). Value matches prior DB; tier upgraded
 *                          LEGACY_DB → OFFICIAL.)
 *   - eaAcceptanceRate  : null     → null  (CDS C22: CMC does NOT offer a
 *                          nonbinding Early Action plan ("No" checked).
 *                          Field stays null; provenance refreshed from prior
 *                          CDS_LLM_EXTRACT_2026_04 (with value=undefined) to
 *                          authoritative CDS UNAVAILABLE/OFFICIAL_BLANK_SECTION
 *                          (NOT_OFFERED).)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CMC_CDS_URL = 'https://www.cmc.edu/sites/default/files/CDS_2024-2025.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const cmc = await prisma.school.findFirst({
    where: { id: 'cmnwr8iv4004az0tioxjsp148' },
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
  if (!cmc) throw new Error('Claremont McKenna College not found');
  if (cmc.name !== 'Claremont McKenna College')
    throw new Error(`Unexpected school name: ${cmc.name}`);
  console.log(`Updating ${cmc.name} (${cmc.id})`);
  console.log(
    `  current AR=${cmc.acceptanceRate?.toString()} sat25=${cmc.sat25} sat75=${cmc.sat75}`,
  );
  console.log(
    `  current intlAR=${cmc.intlAcceptanceRate?.toString()} oosAR=${cmc.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${cmc.edAcceptanceRate?.toString()} eaAR=${cmc.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: CMC_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-cmc-validation-batch6',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 9.59,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 626 admits / 6,529 applicants = 9.5880% (rounded to 9.59%). Breakdown by gender: Men 291/2,967 + Women 312/3,225 + Another 11/123 + Unknown 12/214. Value matches prior DB; tier upgraded LEGACY_DB → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1490,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1490 (EBRW 720, Math 750). 26% of enrolled (87 students) submitted SAT under test-optional policy. MAJOR CORRECTION UP +110 from prior 1380 (SEED/PR-15 heuristic — wildly low). Tier upgraded SEED → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1550,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1550 (EBRW 770 + Math 790 = 1560 differs because composite quantiles ≠ section sums; per convention prefer reported Composite row). CORRECTION UP +10 from prior 1540 (SEED/PR-15 heuristic). Tier upgraded SEED → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 5.63,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency: 112 international admits / 1,991 international applicants = 5.6253% (rounded to 5.63%). Value matches prior DB; tier upgraded LEGACY_DB → OFFICIAL with refreshed provenance. CMC is unusual among private LACs in publishing the residency breakdown.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Claremont McKenna is a private liberal arts college; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency does report OOS (277 admits / 2,010 applicants = 13.7811%), but the value is not actionable for applicants. Prior legacy DB value (13.78%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 23.37,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2024-25 Section C21: CMC offers Early Decision ("Yes" checked). TWO plans — ED I closes 11/1 / notification 12/15, ED II closes 1/10 / notification 2/15. Fall 2024 entering class combined ED counts: 226 admits / 967 applications = 23.3713% (rounded to 23.37%). Value matches prior DB; tier upgraded LEGACY_DB → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: Claremont McKenna does NOT offer a nonbinding Early Action plan ("No" checked). DB value was already null; provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 (with value=undefined) to authoritative CDS UNAVAILABLE / OFFICIAL_BLANK_SECTION (NOT_OFFERED).',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(cmc.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: CMC_CDS_URL,
  };

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: cmc.id },
    data: {
      acceptanceRate: new Prisma.Decimal('9.59'),
      sat25: 1490,
      sat75: 1550,
      intlAcceptanceRate: new Prisma.Decimal('5.63'),
      oosAcceptanceRate: null, // private LAC — N/A per convention
      edAcceptanceRate: new Prisma.Decimal('23.37'),
      eaAcceptanceRate: null, // CDS C22 "No" — CMC does not offer EA
      hasEarlyDecision: true, // re-confirm from CDS C21 "Yes"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=9.59, sat25=1490, sat75=1550, intlAR=5.63, oosAR=N/A, edAR=23.37, eaAR=NOT_OFFERED)',
  );

  // verify
  const after = await prisma.school.findUnique({
    where: { id: cmc.id },
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
