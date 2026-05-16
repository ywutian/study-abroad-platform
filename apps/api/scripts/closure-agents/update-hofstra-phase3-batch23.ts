#!/usr/bin/env tsx
/**
 * Phase 3 — Hofstra University end-to-end closure of the 7 prediction-critical
 * fields.
 *
 * Source: Hofstra CDS 2024-2025 (Fall 2024 entering class) published by Hofstra
 *   IRSA (Institutional Research and Strategic Analysis).
 *   Landing: https://www.hofstra.edu/institutional-research-strategic-analysis/
 *   Reader (Issuu): https://issuu.com/hofstra/docs/2024-2025_common_data_set_hofstra_university
 *   Publication date per Issuu metadata: 2025-03-31
 *
 * Hofstra is a PRIVATE (nonprofit) research university — oosAR is NOT a
 *   policy-meaningful gate (per closure-pipeline convention: private school
 *   oosAR = TERMINAL).
 *
 * NOTE on prior DB drift: existing OFFICIAL provenances point at WRONG URLs
 *   (cogn-iq.org aggregator, hofstra.edu Title-II teacher prep report) — clear
 *   drift. This script re-anchors all 7 fields to the official CDS source.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 72     -> 68.08 (CDS 2024-25 C1: 17,035 admits /
 *                          25,021 first-time, first-year applicants =
 *                          68.0828%. Tier LEGACY_DB_VALUE -> OFFICIAL.)
 *   - sat25             : 1190   -> 1240  (CDS 2024-25 C9 SAT Composite 25th =
 *                          1240. Tier OFFICIAL via wrong-URL (cogn-iq.org) ->
 *                          OFFICIAL anchored to real CDS. NOTE: Hofstra is
 *                          test-optional; only 26% (449 enrolled freshmen)
 *                          submitted SAT.)
 *   - sat75             : 1370   -> 1380  (CDS 2024-25 C9 SAT Composite 75th =
 *                          1380. Tier OFFICIAL anchored to real CDS PDF.)
 *   - intlAcceptanceRate: 68.4   -> 5.31  (CDS 2024-25 C1 residency table: 137
 *                          intl admits / 2,579 intl applicants = 5.3122%.
 *                          Tier HEURISTIC PERMANENT_HEURISTIC (68.4 grossly
 *                          wrong) -> OFFICIAL. Hofstra is highly selective for
 *                          international applicants.)
 *   - oosAcceptanceRate : 73.44  -> TERMINAL (PRIVATE SCHOOL — per closure
 *                          convention, oosAR is not in scope and is set to
 *                          TERMINAL with reason. Old PERMANENT_HEURISTIC value
 *                          replaced; field cleared to null. CDS C1 residency
 *                          table is informationally 7,776 OOS admits / 10,151
 *                          OOS applicants = 76.6% if anyone needs it for
 *                          provenance audit, but the production field is set
 *                          to TERMINAL.)
 *   - edAcceptanceRate  : null   -> null  (CDS 2024-25 C21: "No" — Hofstra does
 *                          NOT offer Early Decision. Replace prior provenance
 *                          (source=CDS_LLM_EXTRACT_2026_04 OFFICIAL with wrong
 *                          Title-II teacher prep report URL) with explicit
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : 81.4   -> null  (CDS 2024-25 C22: "Yes" — Hofstra
 *                          offers Early Action (EA I closing 11/15/2024,
 *                          notification 12/15/2024; EA II closing 12/15/2024,
 *                          notification 1/15/2025; nonrestrictive) but does NOT
 *                          publish EA applicant/admit counts. Replace
 *                          TAVILY_ENRICHMENT estimate with UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION per closure policy.)
 *
 * NOTE on hasEarlyDecision: current DB value is TRUE, but CDS C21 is "No" —
 *   Hofstra does NOT offer Early Decision. Setting to FALSE to match CDS.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://issuu.com/hofstra/docs/2024-2025_common_data_set_hofstra_university';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iqp0029z0ti2wbplonv';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Hofstra) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PRIVATE SCHOOL]`);
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
    verifiedBy: 'closure-pipeline-phase3-batch23-claude',
    generatedBy: 'phase3-hofstra-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 68.08,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 17,035 admits / 25,021 first-time, first-year applicants = 68.0828% (rounded to 68.08%). Tier upgraded from VERIFIED_REAL/LEGACY_DB_VALUE (72) to OFFICIAL with CDS 2024-25 direct numbers.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1240,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1240 (reported directly). Re-anchored from prior OFFICIAL provenance that wrongly cited cogn-iq.org aggregator to the official Hofstra CDS. NOTE: Hofstra is test-optional; only 26% (449 enrolled freshmen) submitted SAT — submission-biased sample.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1380,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1380 (reported directly). Re-anchored to official Hofstra CDS. Prior DB value 1370 corrected up 10 points. Same test-optional, low-SAT-submission caveat as sat25.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 5.31,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 137 international admits / 2,579 international applicants = 5.3122% (rounded to 5.31%). Tier upgraded from HEURISTIC PERMANENT_HEURISTIC (68.4, grossly wrong) to OFFICIAL. Hofstra is HIGHLY SELECTIVE for international applicants despite a 68% overall AR — a major prediction-critical correction.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel:
        'Out-of-state admit rate (private institution — not in scope)',
      reason:
        'Hofstra is a PRIVATE (nonprofit) research university (Hempstead, NY). Per closure-pipeline convention, oosAR is not a policy-meaningful gate for private institutions and is set to TERMINAL. (For audit reference, CDS 2024-25 C1 residency table does show 7,776 OOS admits / 10,151 OOS applicants = 76.6%, but the production field is intentionally null/TERMINAL.) Replaces prior HEURISTIC PERMANENT_HEURISTIC value of 73.44.',
      realDataStatus: 'TERMINAL_PRIVATE_SCHOOL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. Hofstra does NOT offer Early Decision (offers Early Action I and II only). Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Replaces prior provenance (source=CDS_LLM_EXTRACT_2026_04 OFFICIAL anchored to an unrelated hofstra.edu Title-II teacher-prep report URL) with the official Hofstra CDS.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — YES checked (Early Action I closing 11/15/2024, notification 12/15/2024; Early Action II closing 12/15/2024, notification 1/15/2025; nonrestrictive). However, Hofstra does NOT publish EA applicant/admit counts in C22 — only dates. Field cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION) per closure policy. Replaces prior TAVILY_ENRICHMENT estimate of 81.4 (not from CDS).',
      realDataStatus: 'OFFICIAL_BLANK_SECTION',
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
      acceptanceRate: new Prisma.Decimal('68.08'),
      sat25: 1240,
      sat75: 1380,
      intlAcceptanceRate: new Prisma.Decimal('5.31'),
      oosAcceptanceRate: null, // TERMINAL for private school
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — Hofstra does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=68.08, sat25=1240, sat75=1380, intlAR=5.31, oosAR=TERMINAL/null, edAR=NOT_OFFERED, eaAR=OFFICIAL_BLANK_SECTION, hasED=false)',
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
