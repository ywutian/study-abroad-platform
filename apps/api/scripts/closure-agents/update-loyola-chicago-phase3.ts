#!/usr/bin/env tsx
/**
 * Phase 3 — Loyola University Chicago end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: Loyola University Chicago Common Data Set 2024-2025
 *   URL: https://www.luc.edu/media/lucedu/oie/CDS%202024-25%20Loyola%20University%20Chicago.pdf
 *
 * Loyola Chicago is PRIVATE (Jesuit/Catholic research university).
 * isPrivate=true.
 *   - oosAcceptanceRate -> UNAVAILABLE/TERMINAL per private-school convention
 *     (no in-state tuition policy meaning).
 *
 * Loyola Chicago is test-optional (C8A "Not required for admission, but
 * considered if submitted"). 23% submitted SAT (623 students).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 81.6   -> 81.60  (CDS 2024-25 C1: 32,081 admits /
 *                          39,316 applicants = 81.5963%. Same to 2dp. Tier
 *                          LEGACY_DB -> OFFICIAL.)
 *   - sat25             : 1170   -> 1180   (CDS 2024-25 C9: SAT Composite 25th
 *                          = 1180 reported directly. CORRECTION UP from prior
 *                          1170 (SEED/PR-15 heuristic). EBRW 600 + Math 570 =
 *                          1170 differs (composite quantiles != section sums).)
 *   - sat75             : 1360   -> 1350   (CDS 2024-25 C9: SAT Composite 75th
 *                          = 1350 reported directly. CORRECTION DOWN from prior
 *                          1360 (SEED/PR-15 heuristic). EBRW 690 + Math 670 =
 *                          1360 differs.)
 *   - intlAcceptanceRate: 38.78  -> 38.78  (CDS 2024-25 C1 residency: 1,181
 *                          intl admits / 3,045 intl applicants = 38.7849%.
 *                          Value matches; tier LEGACY_DB -> OFFICIAL.)
 *   - oosAcceptanceRate : 89.17  -> null   (Loyola Chicago is PRIVATE; in-
 *                          state/OOS distinction carries no policy meaning.
 *                          CDS C1 residency does report OOS (15,774/17,689 =
 *                          89.1741%) but per closure-pipeline convention,
 *                          private schools -> UNAVAILABLE/TERMINAL. Prior
 *                          legacy DB value 89.17 cleared.)
 *   - edAcceptanceRate  : null   -> null   (CDS 2024-25 C21: "No" — Loyola
 *                          Chicago does not offer ED. Field stays cleared
 *                          (UNAVAILABLE/OFFICIAL_BLANK_SECTION). hasEarlyDecision
 *                          corrected from stale DB true to false. Provenance
 *                          refreshed from CDS_LLM_EXTRACT_2026_04 to
 *                          CDS_OFFICIAL.)
 *   - eaAcceptanceRate  : 82     -> null   (CDS 2024-25 C22: "No" — Loyola
 *                          Chicago does NOT offer a nonbinding EA plan. Prior
 *                          DB value 82 (TAVILY_ENRICHMENT) was incorrect —
 *                          appears to confuse Loyola Chicago with another
 *                          school. Cleared. Field marked UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *
 * NOTE on hasEarlyDecision: current DB value is true, but CDS C21 is "No".
 *   Setting to false to match CDS reality.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.luc.edu/media/lucedu/oie/CDS%202024-25%20Loyola%20University%20Chicago.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ipa001oz0tionb7y3gm';

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
    throw new Error(`School ${SCHOOL_ID} (Loyola Chicago) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PRIVATE SCHOOL]`);
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
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-loyola-chicago-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 81.6,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 32,081 admits / 39,316 applicants = 81.5963% (rounded to 81.60%). Tier upgraded from LEGACY_DB (value 81.6) to OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1180,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1180 (reported directly; EBRW 600 + Math 570 = 1170 differs because composite quantiles != section sums). CORRECTION UP from prior 1170 (SEED/PR-15 heuristic). 23% of Fall 2024 enrolled (623 students) submitted SAT under test-optional policy.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1350,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1350 (reported directly; EBRW 690 + Math 670 = 1360 differs). CORRECTION DOWN from prior 1360 (SEED/PR-15 heuristic).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 38.78,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 1,181 international admits / 3,045 international applicants = 38.7849% (rounded to 38.78%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Loyola University Chicago is a private Jesuit/Catholic research university; in-state vs. out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table does report OOS (15,774 admits / 17,689 applicants = 89.1741%) but the value is not actionable for applicants. Prior legacy DB value (89.17) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. Loyola Chicago does not offer Early Decision. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). hasEarlyDecision corrected from stale DB true to false. Provenance refreshed from CDS_LLM_EXTRACT_2026_04 to CDS_OFFICIAL.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. Loyola Chicago does NOT offer Early Action. Prior DB value 82 (TAVILY_ENRICHMENT) was incorrect — likely confused with another school. Cleared. Field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
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
      acceptanceRate: new Prisma.Decimal('81.60'),
      sat25: 1180,
      sat75: 1350,
      intlAcceptanceRate: new Prisma.Decimal('38.78'),
      oosAcceptanceRate: null,
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — Loyola Chicago does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=81.60, sat25=1180, sat75=1350, intlAR=38.78, oosAR=N/A, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
