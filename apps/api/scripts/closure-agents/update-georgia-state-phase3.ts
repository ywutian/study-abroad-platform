#!/usr/bin/env tsx
/**
 * Phase 3 — Georgia State University end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: GSU CDS 2024-2025 (Fall 2024 entering class).
 *   Index URL: https://oie.gsu.edu/data-reporting-systems/common-data-set/
 *   Published as a Dropbox folder of section PDFs. Canonical bundle URL:
 *     https://www.dropbox.com/scl/fo/rht7ndx4l2nttu7q7kqsx/AFPVzfwvfD44PS6Q_QsSyGg?rlkey=l53pw2dk0jfscrogawf97o1kl&st=ll5k3u0o&dl=0
 *   Section C file: "CDS 2024 C-compressed.pdf" inside the Dropbox folder.
 *
 * GSU is a PUBLIC R1 research university in the University System of Georgia
 * (Atlanta):
 *   - isPrivate=false  ->  oosAcceptanceRate is in eligible scope, MUST carry
 *     a real OFFICIAL number from CDS C1 residency table.
 *
 * ⚠️ CRITICAL CORRECTION: Existing DB provenance pointed ED/EA to GEORGIA
 *   SOUTHERN's CDS URL (https://ww2.georgiasouthern.edu/em/ir/wp-content/...
 *   — wrong school entirely). All ED/EA values were inherited from Georgia
 *   Southern. This script replaces with the correct Georgia State CDS source
 *   and demotes ED/EA to NOT_OFFERED (GSU does not offer either plan).
 *
 * GSU is test-optional per CDS C8A ("Not required for admission, but
 * considered if submitted"). Per CDS C8F clarification: "Georgia State is
 * test-optional for first-year students with a 3.4 or higher GPA." GSU does
 * NOT publish SAT/ACT percentile bands in CDS C9 — the entire table is blank.
 * SAT 25/75 therefore demote to UNAVAILABLE/OFFICIAL_BLANK_SECTION (school
 * deliberately does not report a band).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 67     -> 55.43 (CDS C1 total: 18,545 / 33,455
 *                          = 55.433% (rounded to 55.43%). MAJOR CORRECTION
 *                          DOWN from prior LEGACY_DB 67%. Tier LEGACY_DB ->
 *                          OFFICIAL.)
 *   - sat25             : 940    -> null  (CDS C9: SAT Composite 25th BLANK.
 *                          GSU does not publish SAT band (test-optional for
 *                          GPA >=3.4). Prior 940 was SEED/HEURISTIC — DEMOTE
 *                          to UNAVAILABLE/OFFICIAL_BLANK_SECTION per closure
 *                          convention. Field value cleared.)
 *   - sat75             : 1180   -> null  (CDS C9: SAT Composite 75th BLANK.
 *                          Same as sat25 — UNAVAILABLE/OFFICIAL_BLANK_SECTION.
 *                          Field value cleared.)
 *   - intlAcceptanceRate: 50.42  -> 50.43 (CDS C1 residency: 1,537 intl
 *                          admits / 3,048 intl applicants = 50.4265% (rounded
 *                          to 50.43%). Tiny refinement from LEGACY 50.42.
 *                          Tier LEGACY_DB -> OFFICIAL.)
 *   - oosAcceptanceRate : null   -> 37.36 (CDS C1 residency: 4,243 OOS
 *                          admits / 11,357 OOS applicants = 37.3603% (rounded
 *                          to 37.36%). NEW VALUE — prior PERMANENT_HEURISTIC
 *                          null. GSU is a PUBLIC research university —
 *                          IS/OOS distinction is real policy (different
 *                          tuition tiers), so this field is in eligible scope
 *                          and MUST carry a real CDS number.)
 *   - edAcceptanceRate  : null   -> null  (CDS C21: GSU does NOT offer Early
 *                          Decision. Prior OFFICIAL tier pointed to GEORGIA
 *                          SOUTHERN's CDS URL — entirely wrong school.
 *                          Corrected to UNAVAILABLE/NOT_OFFERED with proper
 *                          GSU source. DB hasEarlyDecision corrected from
 *                          true to false.)
 *   - eaAcceptanceRate  : 31.2   -> null  (CDS C21/C22: GSU does NOT offer
 *                          Early Action. Prior 31.2% came from TAVILY_
 *                          ENRICHMENT but pointed to GEORGIA SOUTHERN's CDS
 *                          URL — wrong school. DEMOTE to UNAVAILABLE/
 *                          NOT_OFFERED per closure pipeline convention. Field
 *                          value cleared.)
 *
 * NOTE on hasEarlyDecision: existing DB has true; correct to false to match
 *   CDS C21 (GSU offers neither ED nor EA — rolling admit only).
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.dropbox.com/scl/fo/rht7ndx4l2nttu7q7kqsx/AFPVzfwvfD44PS6Q_QsSyGg?rlkey=l53pw2dk0jfscrogawf97o1kl&st=ll5k3u0o&dl=0';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ita003iz0ti7ezibmu3';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Georgia State) not found`);
  console.log(`Updating ${school.name} (${school.id})`);

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-georgia-state-validation-batch28',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 55.43,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 18,545 total admits / 33,455 total applicants = 55.433% (rounded to 55.43%). CORRECTION DOWN from prior LEGACY_DB 67%. Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th BLANK. GSU does NOT publish SAT/ACT percentile bands in CDS — the entire C9 table is empty. Per CDS C8F clarification: "Georgia State is test-optional for first-year students with a 3.4 or higher GPA." GSU deliberately omits the SAT band from CDS. Prior 940 was SEED/HEURISTIC — DEMOTED to UNAVAILABLE/OFFICIAL_BLANK_SECTION per closure convention. Field value cleared.',
      realDataStatus: 'NOT_PUBLISHED',
    },
    sat75: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th BLANK. Same as sat25 — GSU does NOT publish SAT band. Prior 1180 was SEED/HEURISTIC. DEMOTED to UNAVAILABLE/OFFICIAL_BLANK_SECTION. Field value cleared.',
      realDataStatus: 'NOT_PUBLISHED',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 50.43,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 1,537 international admits / 3,048 international applicants = 50.4265% (rounded to 50.43%). Tiny refinement from prior LEGACY 50.42. Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 37.36,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 4,243 out-of-state admits / 11,357 out-of-state applicants = 37.3603% (rounded to 37.36%). NEW VALUE — prior PERMANENT_HEURISTIC null. GSU is a PUBLIC R1 research university in the University System of Georgia — in-state vs. out-of-state residency carries real policy meaning (different tuition tiers, residency-preference pathways), so this field is in eligible scope and MUST carry a real CDS number.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        "CDS 2024-25 Section C21: GSU does NOT offer Early Decision (closing/notification dates blank, ED apps/admits blank). CRITICAL CORRECTION: prior DB provenance pointed at GEORGIA SOUTHERN UNIVERSITY's CDS URL (wrong school entirely). Corrected to GSU canonical CDS bundle and demoted to UNAVAILABLE/NOT_OFFERED. DB hasEarlyDecision corrected from true to false to match CDS.",
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        "CDS 2024-25 Section C22: GSU does NOT offer Early Action (closing/notification dates blank, restrictive=blank). CRITICAL CORRECTION: prior DB value 31.2% came from TAVILY_ENRICHMENT but provenance pointed at GEORGIA SOUTHERN's CDS URL (wrong school). DEMOTED to UNAVAILABLE/NOT_OFFERED per closure pipeline convention. Field value cleared.",
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
      acceptanceRate: new Prisma.Decimal('55.43'),
      sat25: null,
      sat75: null,
      intlAcceptanceRate: new Prisma.Decimal('50.43'),
      oosAcceptanceRate: new Prisma.Decimal('37.36'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 (and C22) — GSU offers neither ED nor EA; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=55.43, sat25=BLANK, sat75=BLANK, intlAR=50.43, oosAR=37.36, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
