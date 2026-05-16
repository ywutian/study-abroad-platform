#!/usr/bin/env tsx
/**
 * Phase 3 — Florida International University (FIU) end-to-end closure of the
 * 7 prediction-critical fields.
 *
 * Source: FIU CDS 2024-2025 (Fall 2024 entering class).
 *   URL: https://aim.fiu.edu/cds/CDS2024.pdf
 *
 * FIU is a PUBLIC R1 research university in the Florida State University
 * System (Miami):
 *   - isPrivate=false  ->  oosAcceptanceRate is in eligible scope, MUST carry
 *     a real OFFICIAL number from CDS C1 residency table.
 *
 * Existing DB already had AR/intlAR/oosAR pointing at the correct FIU CDS URL
 * with OFFICIAL tier — values match the canonical CDS so we refresh provenance
 * (verifiedAt, generatedBy, reason) without changing numbers. SAT 25/75 were
 * SEED/HEURISTIC and are upgraded to OFFICIAL. ED/EA are both NO per CDS C21
 * and C22 — fields cleared and demoted to UNAVAILABLE/NOT_OFFERED.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 54.66  -> 54.66 (unchanged; CDS C1 total: 17,957 /
 *                          32,855 = 54.658% — refreshed provenance only.)
 *   - sat25             : 1070   -> 1070  (CDS C9 SAT Composite 25th = 1070
 *                          reported directly. Tier SEED/HEURISTIC -> OFFICIAL.)
 *   - sat75             : 1260   -> 1250  (CDS C9 SAT Composite 75th = 1250
 *                          reported directly. CORRECTION DOWN from prior 1260
 *                          (heuristic). Tier SEED/HEURISTIC -> OFFICIAL.)
 *   - intlAcceptanceRate: 29.21  -> 29.21 (CDS C1 residency: 1,685 intl
 *                          admits / 5,769 intl applicants = 29.2078%
 *                          — refreshed provenance only.)
 *   - oosAcceptanceRate : 27.15  -> 27.15 (CDS C1 residency: 2,181 OOS
 *                          admits / 8,032 OOS applicants = 27.1539%
 *                          — refreshed provenance only. FIU is a PUBLIC
 *                          flagship — IS/OOS distinction is real policy.)
 *   - edAcceptanceRate  : null   -> null  (CDS C21: "No" — FIU does NOT
 *                          offer Early Decision. Demote prior OFFICIAL/
 *                          CDS_LLM_EXTRACT tier to UNAVAILABLE/NOT_OFFERED
 *                          since the field is structurally absent on CDS.
 *                          DB hasEarlyDecision corrected from true to false.)
 *   - eaAcceptanceRate  : 55     -> null  (CDS C22: "No" — FIU does NOT
 *                          offer a nonbinding Early Action plan. Prior value
 *                          55% came from TAVILY_ENRICHMENT (non-CDS source)
 *                          and is NOT present in the canonical CDS — DEMOTE
 *                          to UNAVAILABLE/NOT_OFFERED per closure pipeline
 *                          convention. Clear field value.)
 *
 * NOTE on hasEarlyDecision: existing DB has true; correct to false to match
 *   CDS C21 = No (FIU is rolling-admit; no ED, no EA).
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL = 'https://aim.fiu.edu/cds/CDS2024.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8it5003hz0tie38swawv';

const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findUnique({
    where: { id: SCHOOL_ID },
    select: {
      id: true,
      name: true,
      isPrivate: true,
      hasEarlyDecision: true,
      metadata: true,
    },
  });
  if (!school) throw new Error(`School ${SCHOOL_ID} (FIU) not found`);
  console.log(`Updating ${school.name} (${school.id})`);

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-fiu-validation-batch28',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 54.66,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 17,957 total admits / 32,855 total applicants = 54.658% (rounded to 54.66%). Value matches existing DB — provenance refreshed to current cycle.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1070,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1070 (reported directly on the SAT Composite row). Tier upgraded SEED/HEURISTIC -> OFFICIAL. FIU requires SAT or ACT for admission per CDS C8A.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1250,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1250 (reported directly on the SAT Composite row). CORRECTION DOWN from prior 1260 (heuristic). Tier upgraded SEED/HEURISTIC -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 29.21,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 1,685 international admits / 5,769 international applicants = 29.2078% (rounded to 29.21%). Value matches existing DB — provenance refreshed.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 27.15,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 2,181 out-of-state admits / 8,032 out-of-state applicants = 27.1539% (rounded to 27.15%). FIU is a PUBLIC R1 research university in the Florida State University System — in-state vs. out-of-state residency carries real policy meaning (different tuition, residency-preference pathways), so this field is in eligible scope and MUST carry a real CDS number. Value matches existing DB — provenance refreshed.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO (closing/notification dates blank, ED apps/admits blank). FIU does not offer Early Decision. Field cleared (UNAVAILABLE/NOT_OFFERED). Prior OFFICIAL/CDS_LLM_EXTRACT tier was inappropriate since the field is structurally absent — corrected. DB hasEarlyDecision corrected from true to false to match CDS.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO (closing/notification dates blank). FIU does not offer Early Action. Prior DB value 55% came from TAVILY_ENRICHMENT (non-CDS source) and is NOT present in the canonical CDS — DEMOTED to UNAVAILABLE/NOT_OFFERED per closure pipeline convention (CDS is canonical; non-CDS enrichment is not OFFICIAL). Field value cleared.',
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
      acceptanceRate: new Prisma.Decimal('54.66'),
      sat25: 1070,
      sat75: 1250,
      intlAcceptanceRate: new Prisma.Decimal('29.21'),
      oosAcceptanceRate: new Prisma.Decimal('27.15'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — FIU does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=54.66, sat25=1070, sat75=1250, intlAR=29.21, oosAR=27.15, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
