#!/usr/bin/env tsx
/**
 * Phase 3 — California State University, Fullerton (CSUF) end-to-end closure of
 * the 7 prediction-critical fields.
 *
 * Source: CSUF Common Data Set 2024-2025 (Fall 2024 entering class), published
 *   by Office of Institutional Research & Analytical Studies.
 *   XLSX: https://www.fullerton.edu/data/institutionalresearch/facts/CDS-Master-2024-2025.xlsx
 *
 * CSUF is a PUBLIC university (CSU system) — oosAR is in eligible scope and
 *   carries a real CDS number, not TERMINAL.
 *
 * Test policy: CSU system is officially TEST-BLIND. C7 "Standardized test
 *   scores" = "Not Considered". C8A "Does your institution make use of SAT or
 *   ACT scores in admission decisions for first-time, first-year, degree-seeking
 *   applicants?" = "No". Although C9 reports SAT Composite 25/75 = 860/1070
 *   (only 4.3% of enrolled students submitted SAT), those scores are NOT used
 *   in admission. Per closure convention for test-blind public schools, we set
 *   sat25/sat75 to NULL with UNAVAILABLE/OFFICIAL_BLANK_SECTION (NOT_COLLECTED).
 *
 * Value validation (vs. existing DB):
 *   - acceptanceRate    : 90.53   ~  90.52 (CDS C1: 48,482 admits / 53,559
 *                          applicants = 90.5208% (rounds to 90.52). DB had
 *                          90.53 with tier OFFICIAL/CDS_OFFICIAL but no value
 *                          recorded — re-anchor with precise 90.52.)
 *   - sat25             : 1080    -> null   (TEST-BLIND CSU policy. Prior tier
 *                          SEED HEURISTIC:PR-15 was a heuristic guess.
 *                          Clear value, mark UNAVAILABLE / OFFICIAL_BLANK_SECTION
 *                          / NOT_COLLECTED.)
 *   - sat75             : 1320    -> null   (TEST-BLIND CSU policy.
 *                          Same treatment as sat25.)
 *   - intlAcceptanceRate: 42.7    ~  42.71 (CDS C1 residency: 161 intl admits
 *                          / 377 intl applicants = 42.7056% (rounds to 42.71).
 *                          Tier OFFICIAL/CDS_OFFICIAL re-anchored with precise
 *                          value 42.71.)
 *   - oosAcceptanceRate : 84.66   ~  84.66 (CDS C1 residency: 1,804 OOS admits
 *                          / 2,131 OOS applicants = 84.6551% (rounds to 84.66).
 *                          PUBLIC CSU — real policy meaning. NO CHANGE in
 *                          rounded value, tier re-anchored.)
 *   - edAcceptanceRate  : null    -> null  (CDS C21: "No" — CSUF does NOT
 *                          offer Early Decision. Existing OFFICIAL/CDS_LLM_EXTRACT_2026_04
 *                          stays NULL but re-stamped as explicit
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : 86.8    -> null  (CDS C22: "No" — CSUF does NOT
 *                          offer Early Action either. DB value 86.8 from
 *                          TAVILY_ENRICHMENT is spurious. Clear value, mark
 *                          NOT_OFFERED.)
 *
 * NOTE on hasEarlyDecision: current DB value is TRUE, but CDS C21 = "No" and
 *   C22 = "No". CSUF offers only rolling/regular admission (CSU-wide policy).
 *   Setting to FALSE to match CDS.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.fullerton.edu/data/institutionalresearch/facts/CDS-Master-2024-2025.xlsx';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8irx002vz0ti8qpx4iws';

const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findUnique({
    where: { id: SCHOOL_ID },
    select: { id: true, name: true, metadata: true },
  });
  if (!school) throw new Error(`School ${SCHOOL_ID} (CSU Fullerton) not found`);
  console.log(`Updating ${school.name} (${school.id})`);

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-batch25-claude',
    generatedBy: 'phase3-csu-fullerton-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 90.52,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 48,482 first-time, first-year admits / 53,559 applicants = 90.5208% (rounds to 90.52%). Prior DB value 90.53 re-anchored with precise CDS-derived rounded value.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'CSUF / CSU system is TEST-BLIND. CDS 2024-25 Section C7 marks "Standardized test scores" = "Not Considered". CDS Section C8A: "Does your institution make use of SAT or ACT scores in admission decisions?" = "No". Although CDS C9 reports a SAT Composite 25th of 860 from the 4.3% of enrolled students who voluntarily submitted scores, those scores are NOT used in admission decisions. Prior SEED HEURISTIC:PR-15 value of 1080 was a heuristic guess that does not reflect CSUF policy. Cleared to NULL and marked NOT_COLLECTED for admission scoring.',
      realDataStatus: 'NOT_COLLECTED',
    },
    sat75: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'CSUF / CSU system is TEST-BLIND (see sat25 reason). Prior SEED HEURISTIC:PR-15 value of 1320 cleared to NULL and marked NOT_COLLECTED for admission scoring.',
      realDataStatus: 'NOT_COLLECTED',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 42.71,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 161 international admits / 377 international applicants = 42.7056% (rounds to 42.71%). Prior DB value 42.7 re-anchored with precise CDS-derived rounded value.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 84.66,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 1,804 out-of-state admits / 2,131 out-of-state applicants = 84.6551% (rounds to 84.66%). CSUF is a PUBLIC CSU campus — in-state vs. out-of-state distinction carries policy meaning. NO CHANGE in rounded value, tier re-anchored from OFFICIAL/CDS_OFFICIAL (no value recorded) to OFFICIAL with explicit 84.66.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. CSUF does NOT offer Early Decision (CSU system uses only the priority application window plus rolling/regular admission). Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Re-stamped from prior OFFICIAL/CDS_LLM_EXTRACT_2026_04 (NULL) to explicit NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. CSUF does NOT offer Early Action. Prior DB value of 86.8 (TAVILY_ENRICHMENT) is spurious — likely conflated with the priority application admit window. Cleared to null and marked NOT_OFFERED.',
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

  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('90.52'),
      sat25: null,
      sat75: null,
      intlAcceptanceRate: new Prisma.Decimal('42.71'),
      oosAcceptanceRate: new Prisma.Decimal('84.66'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=90.52, sat25=NULL test-blind, sat75=NULL test-blind, intlAR=42.71, oosAR=84.66, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
