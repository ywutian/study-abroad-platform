#!/usr/bin/env tsx
/**
 * Phase 3 — University of Massachusetts Boston end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: UMass Boston CDS 2023-2024 (Fall 2023 entering class).
 *   URL: https://www.umb.edu/media/umassboston/editor-uploads/institutional-research-assessment-planning/CDS-PDF-23-24.pdf
 *   Index: https://www.umb.edu/oirap/facts/common-data-set/
 *   (The 2024-25 CDS has not been published yet as of this closure run.)
 *
 * UMass Boston is a PUBLIC research campus in the UMass system:
 *   - isPrivate=false  ->  oosAcceptanceRate is in eligible scope, MUST carry
 *     a real OFFICIAL number from CDS C1 residency table.
 *
 * UMass Boston is test-optional per CDS C8A ("Not required for admission, but
 * considered for some"). SAT band is still recorded as OFFICIAL for
 * descriptive applicant-profile use.
 *
 * ⚠️ CORRECTION: Existing DB provenance had AR/intlAR/oosAR with stale
 *   2020-2021 CDS URL and LEGACY_DB tier; SAT band came from collegeiq.com
 *   (non-CDS scraper); ED/EA came from UMB TABLE23 (admissions-by-college
 *   table, NOT the CDS — wrong source convention). All replaced with the
 *   canonical UMass Boston CDS 2023-24.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 79.68  -> 82.96 (CDS C1 total: 17,353 / 20,918
 *                          = 82.957% (rounded to 82.96%). CORRECTION UP from
 *                          prior LEGACY_DB 79.68%. Tier LEGACY_DB -> OFFICIAL.)
 *   - sat25             : 1090   -> 1090  (CDS C9 SAT Composite 25th = 1090
 *                          reported directly. Value matches existing DB —
 *                          source upgraded collegeiq.com scraper -> OFFICIAL
 *                          CDS.)
 *   - sat75             : 1290   -> 1290  (CDS C9 SAT Composite 75th = 1290
 *                          reported directly. Value matches existing DB —
 *                          source upgraded collegeiq.com scraper -> OFFICIAL
 *                          CDS.)
 *   - intlAcceptanceRate: 88.4   -> 88.37 (CDS C1 residency: 1,839 intl
 *                          admits / 2,081 intl applicants = 88.3710% (rounded
 *                          to 88.37%). Tiny refinement from LEGACY 88.4.
 *                          Tier LEGACY_DB -> OFFICIAL.)
 *   - oosAcceptanceRate : 87.1   -> 87.12 (CDS C1 residency: 5,470 OOS
 *                          admits / 6,279 OOS applicants = 87.1158% (rounded
 *                          to 87.12%). Tiny refinement from LEGACY 87.1.
 *                          UMass Boston is a PUBLIC research campus — IS/OOS
 *                          distinction is real policy (different tuition,
 *                          residency-preference pathways). Tier LEGACY_DB ->
 *                          OFFICIAL.)
 *   - edAcceptanceRate  : null   -> null  (CDS C21: blank — UMB does NOT
 *                          offer Early Decision (ED Yes/No checkbox empty,
 *                          closing/notification dates blank, ED apps/admits
 *                          blank). Field stays cleared. Prior OFFICIAL/
 *                          CDS_LLM_EXTRACT pointed to TABLE23 (a UMB
 *                          admissions-by-college report — NOT CDS) — wrong
 *                          source. Corrected to UNAVAILABLE/NOT_OFFERED with
 *                          proper canonical CDS source. DB hasEarlyDecision
 *                          corrected from true to false.)
 *   - eaAcceptanceRate  : null   -> null  (CDS C22: blank — UMB does NOT
 *                          offer a nonbinding Early Action plan. Field stays
 *                          cleared. Same source correction as edAR — prior
 *                          TABLE23 URL replaced with canonical CDS.
 *                          UNAVAILABLE/NOT_OFFERED.)
 *
 * NOTE on hasEarlyDecision: existing DB has true; correct to false to match
 *   CDS C21/C22 (UMass Boston offers neither ED nor EA — rolling admit only
 *   with priority date 11/1, closing 2/15).
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.umb.edu/media/umassboston/editor-uploads/institutional-research-assessment-planning/CDS-PDF-23-24.pdf';
const CYCLE_YEAR = 2023; // CDS 2023-2024 = Fall 2023 entering class (most recent published)
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ite003jz0tijg7j0avf';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UMass Boston) not found`);
  console.log(`Updating ${school.name} (${school.id})`);

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-umass-boston-validation-batch28',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 82.96,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2023-24 Section C1: 17,353 total admits / 20,918 total applicants = 82.957% (rounded to 82.96%). CORRECTION UP from prior LEGACY_DB 79.68%. Tier upgraded LEGACY_DB -> OFFICIAL with stale 2020-21 source URL replaced by canonical 2023-24 CDS.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1090,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2023-24 Section C9: SAT Composite 25th = 1090 (reported directly on the SAT Composite row). Value matches existing DB — source upgraded from collegeiq.com scraper to canonical UMass Boston CDS. NOTE: UMass Boston is test-optional (CDS C8A "Not required for admission, but considered for some"); SAT band is descriptive only.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1290,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2023-24 Section C9: SAT Composite 75th = 1290 (reported directly on the SAT Composite row). Value matches existing DB — source upgraded from collegeiq.com scraper to canonical UMass Boston CDS.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 88.37,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2023-24 Section C1 residency table: 1,839 international admits / 2,081 international applicants = 88.3710% (rounded to 88.37%). Tiny refinement from prior LEGACY 88.4. Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 87.12,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2023-24 Section C1 residency table: 5,470 out-of-state admits / 6,279 out-of-state applicants = 87.1158% (rounded to 87.12%). Tiny refinement from prior LEGACY 87.1. UMass Boston is a PUBLIC research campus in the UMass system — in-state vs. out-of-state residency carries real policy meaning (different tuition, residency-preference pathways), so this field is in eligible scope and MUST carry a real CDS number. Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2023-24 Section C21: Yes/No checkbox blank, closing/notification dates blank, ED apps/admits blank. UMass Boston does NOT offer Early Decision (rolling admit only with priority date 11/1, closing 2/15). Prior OFFICIAL/CDS_LLM_EXTRACT pointed to TABLE23 (a UMB admissions-by-college internal report — NOT the CDS) — wrong source. Corrected to UNAVAILABLE/NOT_OFFERED with proper canonical CDS source. DB hasEarlyDecision corrected from true to false.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2023-24 Section C22: Yes/No checkbox blank, closing/notification dates blank, EA apps/admits blank. UMass Boston does NOT offer a nonbinding Early Action plan. Prior OFFICIAL/CDS_LLM_EXTRACT pointed to TABLE23 (wrong source — not CDS). Corrected to UNAVAILABLE/NOT_OFFERED with proper canonical CDS source.',
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
      acceptanceRate: new Prisma.Decimal('82.96'),
      sat25: 1090,
      sat75: 1290,
      intlAcceptanceRate: new Prisma.Decimal('88.37'),
      oosAcceptanceRate: new Prisma.Decimal('87.12'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21/C22 blank — UMass Boston offers neither ED nor EA; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=82.96, sat25=1090, sat75=1290, intlAR=88.37, oosAR=87.12, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
