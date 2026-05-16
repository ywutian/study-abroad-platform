#!/usr/bin/env tsx
/**
 * Phase 3 — North Dakota State University (NDSU, Fargo, ND) end-to-end closure
 * of the 7 prediction-critical fields.
 *
 * Source: NDSU Common Data Set 2024-2025 (Fall 2024 entering class), published
 *   by Office of Institutional Research and Analysis.
 *   XLSX: https://www.ndsu.edu/sites/default/files/fileadmin/oira/Common_Data_Set/NDSU_CDS_2024-2025.xlsx
 *
 * NDSU is a PUBLIC land-grant research university — oosAR is in eligible scope
 *   and carries a real CDS number, not TERMINAL.
 *
 * Test policy: NDSU is TEST-OPTIONAL but NOT test-blind. C7 "Standardized test
 *   scores" = "Considered". C8A "Does your institution make use of SAT or ACT
 *   scores in admission decisions?" = "Yes" with SAT or ACT marked as "Not
 *   required for admission, but considered if submitted". C9 SAT Composite
 *   25/75 = 1130 / 1430 (n=13 submitters, 0.59%). C9 ACT Composite 25/75 =
 *   19 / 25 (n=1138 submitters, 51.8%). Per C9 priority, use SAT Composite.
 *
 * Value validation (vs. existing DB):
 *   - acceptanceRate    : 94.96   ~  94.97 (CDS C1: 6,864 admits / 7,228
 *                          applicants = 94.9640% (rounds to 94.96). Tier
 *                          LEGACY_DB_VALUE → OFFICIAL with precise value.
 *                          DB 94.96 already matches.)
 *   - sat25             : 970     -> 1130 (CDS C9 SAT Composite 25th = 1130
 *                          reported directly. Prior LEGACY_DB_VALUE 970 likely
 *                          conflated with an older or different cohort. Tier
 *                          LEGACY_DB_VALUE → OFFICIAL with corrected value.)
 *   - sat75             : 1220    -> 1430 (CDS C9 SAT Composite 75th = 1430.
 *                          Prior LEGACY_DB_VALUE 1220 corrected. Tier
 *                          LEGACY_DB_VALUE → OFFICIAL.)
 *   - intlAcceptanceRate: 86.96   ~  86.96 (CDS C1 residency: 100 intl admits
 *                          / 115 intl applicants = 86.9565% (rounds to 86.96).
 *                          EXACT match. Tier LEGACY_DB_VALUE → OFFICIAL.)
 *   - oosAcceptanceRate : 95.67   ~  95.67 (CDS C1 residency: 4,839 OOS
 *                          admits / 5,058 OOS applicants = 95.6703% (rounds
 *                          to 95.67). PUBLIC — real policy meaning. EXACT
 *                          match. Tier LEGACY_DB_VALUE → OFFICIAL.)
 *   - edAcceptanceRate  : null    -> null  (CDS C21: "No" — NDSU does NOT
 *                          offer Early Decision. Already null. Re-stamped
 *                          as NOT_OFFERED.)
 *   - eaAcceptanceRate  : null    -> null  (CDS C22: "No" — NDSU does NOT
 *                          offer Early Action. Already null. Re-stamped
 *                          as NOT_OFFERED.)
 *
 * NOTE on hasEarlyDecision: current DB value is TRUE, but CDS C21 = "No" and
 *   C22 = "No". NDSU offers only regular admission. Setting to FALSE to match
 *   CDS.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.ndsu.edu/sites/default/files/fileadmin/oira/Common_Data_Set/NDSU_CDS_2024-2025.xlsx';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8is3002yz0ti9qk8f21x';

const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findUnique({
    where: { id: SCHOOL_ID },
    select: { id: true, name: true, metadata: true },
  });
  if (!school) throw new Error(`School ${SCHOOL_ID} (NDSU) not found`);
  console.log(`Updating ${school.name} (${school.id})`);

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-batch25-claude',
    generatedBy: 'phase3-ndsu-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 94.96,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 6,864 first-time, first-year admits / 7,228 applicants = 94.9640% (rounds to 94.96%). Tier LEGACY_DB_VALUE (94.96) → OFFICIAL anchored to official NDSU CDS XLSX. Value unchanged.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1130,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1130 (reported directly; n=13 submitters, 0.59% of enrolled). Per C9 priority Composite is preferred. NDSU is test-optional but DOES use submitted scores (C7 "Considered", C8A "Not required for admission, but considered if submitted"). Prior LEGACY_DB_VALUE 970 likely conflated with an older/wrong-cohort SAT distribution; corrected to 1130 per official 2024-25 CDS.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1430,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1430 (reported directly). Prior LEGACY_DB_VALUE 1220 corrected to 1430 per official 2024-25 CDS.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 86.96,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 100 international admits / 115 international applicants = 86.9565% (rounds to 86.96%). EXACT match with prior LEGACY_DB_VALUE 86.96. Tier LEGACY_DB_VALUE → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 95.67,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 4,839 out-of-state admits / 5,058 out-of-state applicants = 95.6703% (rounds to 95.67%). NDSU is a PUBLIC land-grant university (Fargo, ND) — in-state vs. out-of-state distinction carries policy meaning. EXACT match with prior LEGACY_DB_VALUE 95.67. Tier LEGACY_DB_VALUE → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. NDSU does NOT offer Early Decision (only regular admission). Re-stamped from prior OFFICIAL/CDS_LLM_EXTRACT_2026_04 (NULL) to explicit NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. NDSU does NOT offer Early Action. Re-stamped from prior OFFICIAL/CDS_LLM_EXTRACT_2026_04 (NULL) to explicit NOT_OFFERED.',
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
      acceptanceRate: new Prisma.Decimal('94.96'),
      sat25: 1130,
      sat75: 1430,
      intlAcceptanceRate: new Prisma.Decimal('86.96'),
      oosAcceptanceRate: new Prisma.Decimal('95.67'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=94.96, sat25=1130, sat75=1430, intlAR=86.96, oosAR=95.67, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
