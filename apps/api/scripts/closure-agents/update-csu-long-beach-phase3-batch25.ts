#!/usr/bin/env tsx
/**
 * Phase 3 — California State University, Long Beach (CSULB) end-to-end closure
 * of the 7 prediction-critical fields.
 *
 * Source: CSULB Common Data Set 2024-2025 (Fall 2024 entering class), published
 *   by Institutional Research and Analytics.
 *   PDF: https://www.csulb.edu/sites/default/files/2025/documents/CDS%202024%20-%202025%20%28PDF%29.pdf
 *
 * CSULB is a PUBLIC university (CSU system) — oosAR is in eligible scope and
 *   carries a real CDS number, not TERMINAL.
 *
 * Test policy: CSU system is officially TEST-BLIND. C7 "Standardized test
 *   scores" = "Not Considered". C8A "Does your institution make use of SAT or
 *   ACT scores in admission decisions?" = "No". C9 SAT Composite 25/75 cells
 *   are entirely BLANK (CSULB did not report SAT distribution at all). Per
 *   closure convention for test-blind public schools, sat25/sat75 = NULL with
 *   UNAVAILABLE/OFFICIAL_BLANK_SECTION (NOT_COLLECTED).
 *
 * Value validation (vs. existing DB):
 *   - acceptanceRate    : 46.3    ~  46.28 (CDS C1: 38,854 admits / 83,951
 *                          applicants = 46.2818% (rounds to 46.28). Prior
 *                          VERIFIED_REAL/LEGACY_DB_VALUE 46.3 → OFFICIAL with
 *                          precise 46.28.)
 *   - sat25             : 1250    -> null  (TEST-BLIND CSU policy. Prior
 *                          SEED HEURISTIC:PR-15 value cleared.)
 *   - sat75             : 1450    -> null  (TEST-BLIND CSU policy. Same.)
 *   - intlAcceptanceRate: 35.6    ~  35.62 (CDS C1 residency: 572 intl admits
 *                          / 1,606 intl applicants = 35.6164% (rounds to 35.62).
 *                          Tier LEGACY_DB_VALUE → OFFICIAL with precise value.)
 *   - oosAcceptanceRate : 73.2    ~  73.16 (CDS C1 residency: 1,390 OOS admits
 *                          / 1,900 OOS applicants = 73.1579% (rounds to 73.16).
 *                          PUBLIC CSU — real policy meaning. Tier LEGACY_DB_VALUE
 *                          → OFFICIAL, minor precision correction (73.2 → 73.16).)
 *   - edAcceptanceRate  : null    -> null  (CDS C21: "No" — CSULB does NOT
 *                          offer Early Decision. Already null in DB.
 *                          Re-stamped as NOT_OFFERED.)
 *   - eaAcceptanceRate  : null    -> null  (CDS C22: "No" — CSULB does NOT
 *                          offer Early Action. Already null. Re-stamped as
 *                          NOT_OFFERED.)
 *
 * NOTE on hasEarlyDecision: current DB value is TRUE, but CDS C21 = "No" and
 *   C22 = "No". CSULB offers only rolling/regular admission (CSU-wide policy).
 *   Setting to FALSE to match CDS.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.csulb.edu/sites/default/files/2025/documents/CDS%202024%20-%202025%20%28PDF%29.pdf';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iry002wz0tiljzfdqu7';

const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findUnique({
    where: { id: SCHOOL_ID },
    select: { id: true, name: true, metadata: true },
  });
  if (!school)
    throw new Error(`School ${SCHOOL_ID} (CSU Long Beach) not found`);
  console.log(`Updating ${school.name} (${school.id})`);

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-batch25-claude',
    generatedBy: 'phase3-csu-long-beach-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 46.28,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 38,854 first-time, first-year admits / 83,951 applicants = 46.2818% (rounds to 46.28%). Tier LEGACY_DB_VALUE (46.3) → OFFICIAL anchored to official CSULB CDS PDF with precision-corrected value.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'CSULB / CSU system is TEST-BLIND. CDS 2024-25 Section C7 marks "Standardized test scores" = "Not Considered". CDS Section C8A: "Does your institution make use of SAT or ACT scores in admission decisions?" = "No". CDS Section C9 SAT Composite 25/50/75 cells are entirely BLANK (CSULB did not even report a SAT distribution). Prior SEED HEURISTIC:PR-15 value of 1250 was a heuristic guess that does not reflect CSULB policy. Cleared to NULL and marked NOT_COLLECTED for admission scoring.',
      realDataStatus: 'NOT_COLLECTED',
    },
    sat75: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'CSULB / CSU system is TEST-BLIND (see sat25 reason). Prior SEED HEURISTIC:PR-15 value of 1450 cleared to NULL and marked NOT_COLLECTED for admission scoring.',
      realDataStatus: 'NOT_COLLECTED',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 35.62,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 572 international admits / 1,606 international applicants = 35.6164% (rounds to 35.62%). Tier LEGACY_DB_VALUE (35.6) → OFFICIAL with precise CDS-derived rounded value.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 73.16,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 1,390 out-of-state admits / 1,900 out-of-state applicants = 73.1579% (rounds to 73.16%). CSULB is a PUBLIC CSU campus — in-state vs. out-of-state distinction carries policy meaning. Tier LEGACY_DB_VALUE (73.2) → OFFICIAL, minor precision correction (73.2 → 73.16).',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. CSULB does NOT offer Early Decision (CSU system uses only the priority application window plus rolling/regular admission). Re-stamped from prior OFFICIAL/CDS_LLM_EXTRACT_2026_04 (NULL) to explicit NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. CSULB does NOT offer Early Action. Re-stamped from prior OFFICIAL/CDS_LLM_EXTRACT_2026_04 (NULL) to explicit NOT_OFFERED.',
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
      acceptanceRate: new Prisma.Decimal('46.28'),
      sat25: null,
      sat75: null,
      intlAcceptanceRate: new Prisma.Decimal('35.62'),
      oosAcceptanceRate: new Prisma.Decimal('73.16'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=46.28, sat25=NULL test-blind, sat75=NULL test-blind, intlAR=35.62, oosAR=73.16, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
