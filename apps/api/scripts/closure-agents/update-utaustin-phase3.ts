#!/usr/bin/env tsx
/**
 * Phase 3 — University of Texas at Austin end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: UT Austin CDS 2024-2025 (Fall 2024 entering class).
 *   URL: https://utexas.app.box.com/s/d9izqb6s8dw2xxg5h5sunxyhrnef2ay6
 *   Direct PDF: https://utexas.app.box.com/index.php?rm=box_download_shared_file&shared_name=d9izqb6s8dw2xxg5h5sunxyhrnef2ay6&file_id=f_1812286540077
 *   Index: https://reports.utexas.edu/common-data-set/pdf
 *
 * UT Austin is a PUBLIC state flagship (University of Texas System).
 *   - isPrivate=false  ->  oosAcceptanceRate carries a real OFFICIAL number
 *     from CDS C1 residency table. NOT marked UNAVAILABLE/TERMINAL.
 *
 * NOTE on test policy: For Fall 2024 entering class (this CDS), UT Austin
 *   was TEST-OPTIONAL. CDS C8A indicates "Required to be considered for
 *   admission" for SAT or ACT — but C8A is dated for students applying for
 *   Fall 2026 (forward-looking). For Fall 2024, UT Austin was test-optional
 *   per their public admissions policy. UT Austin RESTORED test requirement
 *   for Fall 2025+ admissions.
 *
 * NOTE on C9 BLANK: UT Austin LEFT THE ENTIRE C9 SAT/ACT SCORE TABLE BLANK
 *   in this CDS — neither percentile quantiles nor range distributions
 *   reported. This is a deliberate institutional choice during the test-
 *   optional era; UT Austin no longer publishes a freshman class score
 *   profile (no Office of Admissions class profile page online for the
 *   Fall 2024 cohort). Prior DB sat25=1280, sat75=1450 came from LEGACY_DB
 *   with no source URL — not from any UT Austin-published source.
 *   Per closure-pipeline convention (UCSB precedent): when CDS C9 is blank
 *   AND no authoritative institutional publication exists, clear to null
 *   and mark UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_REPORTED.
 *
 * ED/EA (CDS C21/C22):
 *   - C21 Early Decision: "No" — UT Austin does NOT offer ED.
 *   - C22 Early Action: NEITHER Yes NOR No checked (both cells blank).
 *     Per UT Austin's public admissions policy, the institution does NOT
 *     offer Early Action — only Regular Decision (closing 12/1, notification
 *     2/15) and automatic admission for top Texas high school graduates
 *     (Texas Education Code subsection 51.803, ~top 6% per current threshold).
 *     The 32% "EA" rate in DB (TAVILY_ENRICHMENT) is invalid — UT does not
 *     have an EA program. Cleared to null and marked
 *     UNAVAILABLE/OFFICIAL_BLANK_SECTION.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 30     -> 26.64  (CDS 2024-25 C1: 19,417 admits /
 *                          72,885 applicants = 26.6406%. Tier upgraded
 *                          LEGACY_DB -> OFFICIAL. CORRECTION DOWN -3.36pp.
 *                          Prior 30% was round-number heuristic.)
 *   - sat25             : 1280   -> null   (CDS 2024-25 C9 SAT Composite
 *                          25th percentile cell BLANK. UT Austin did not
 *                          report any SAT/ACT score percentiles or range
 *                          distributions in this CDS. Prior LEGACY_DB
 *                          value 1280 (no source URL) is not from any
 *                          UT-published source. Field cleared and marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_REPORTED.
 *                          (UCSB precedent.))
 *   - sat75             : 1450   -> null   (CDS 2024-25 C9 SAT Composite
 *                          75th percentile cell BLANK. Same reasoning as
 *                          sat25. Field cleared and marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_REPORTED.)
 *   - intlAcceptanceRate: 56.53  -> 12.87  (CDS 2024-25 C1 residency: 894
 *                          intl admits / 6,944 intl applicants = 12.8745%.
 *                          MAJOR CORRECTION DOWN -43.66pp. Prior 56.53%
 *                          sourceUrl pointed to abpa.tamu.edu (Texas A&M
 *                          CDS — WRONG INSTITUTION). Tier upgraded
 *                          LEGACY_DB -> OFFICIAL.)
 *   - oosAcceptanceRate : 48.71  -> 10.13  (CDS 2024-25 C1 residency: 2,332
 *                          OOS admits / 23,015 OOS applicants = 10.1325%.
 *                          MAJOR CORRECTION DOWN -38.58pp. Prior 48.71%
 *                          sourceUrl pointed to abpa.tamu.edu (Texas A&M
 *                          CDS — WRONG INSTITUTION). UT Austin is a PUBLIC
 *                          state flagship — oosAR carries the real OFFICIAL
 *                          number, never TERMINAL. Texas residency-preference
 *                          policy (auto-admit top % of Texas HS class) makes
 *                          OOS admit rate much lower than in-state.)
 *   - edAcceptanceRate  : null   -> null   (CDS C21: "No" — UT Austin does
 *                          not offer ED. Field stays cleared
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION. Provenance
 *                          refreshed.)
 *   - eaAcceptanceRate  : 32     -> null   (CDS C22 NEITHER Yes nor No
 *                          checked, but UT Austin's public policy confirms
 *                          NO Early Action — only RD and automatic admission
 *                          for top Texas HS graduates. Prior 32%
 *                          (TAVILY_ENRICHMENT) is invalid. Cleared to null
 *                          and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://utexas.app.box.com/index.php?rm=box_download_shared_file&shared_name=d9izqb6s8dw2xxg5h5sunxyhrnef2ay6&file_id=f_1812286540077';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmn1htkp1000vvqf2iogfyk82';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UT Austin) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(
    `  isPrivate=${school.isPrivate}  [PUBLIC — oosAR carries real number]`,
  );
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
    generatedBy: 'phase3-utaustin-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 26.64,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 19,417 admits / 72,885 applicants = 26.6406% (rounded to 26.64%). Tier upgraded from LEGACY_DB (value 30, round-number heuristic) to OFFICIAL. CORRECTION DOWN -3.36pp.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'CDS 2024-25 Section C9: UT Austin LEFT THE ENTIRE C9 SAT/ACT SCORE TABLE BLANK — neither percentile quantiles nor range distributions are reported. UT Austin was TEST-OPTIONAL for the Fall 2024 entering class (test requirement restored for Fall 2025+); the institution did not publish a freshman class score profile for this cohort, and no authoritative UT Austin Office of Admissions publication reports SAT/ACT percentiles for this year. Prior DB value 1280 (LEGACY_DB, no source URL) is not from any UT-published source. Field cleared to null and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_REPORTED per closure-pipeline convention (UCSB precedent: CDS C9 blank → null).',
      realDataStatus: 'NOT_REPORTED',
    },
    sat75: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'CDS 2024-25 Section C9: SAT/ACT score table entirely BLANK. Same reasoning as sat25: UT Austin test-optional for Fall 2024, no published profile. Prior 1450 (LEGACY_DB) not from any UT-published source. Field cleared to null and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_REPORTED.',
      realDataStatus: 'NOT_REPORTED',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 12.87,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 894 international admits / 6,944 international applicants = 12.8745% (rounded to 12.87%). MAJOR CORRECTION DOWN -43.66pp from prior 56.53% — prior LEGACY_DB sourceUrl pointed to abpa.tamu.edu (Texas A&M CDS), WRONG INSTITUTION. Tier upgraded from LEGACY_DB to OFFICIAL with correct UT Austin CDS source.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 10.13,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 2,332 out-of-state admits / 23,015 out-of-state applicants = 10.1325% (rounded to 10.13%). MAJOR CORRECTION DOWN -38.58pp from prior 48.71% — prior LEGACY_DB sourceUrl pointed to abpa.tamu.edu (Texas A&M CDS), WRONG INSTITUTION. UT Austin is a PUBLIC state flagship (University of Texas System) — in-state vs. out-of-state distinction carries real policy meaning. Texas Education Code subsection 51.803 provides automatic admission for top % of Texas HS graduating class (in-state preference), driving OOS admit rate (10.13%) far below in-state admit rate (16,191/42,926 = 37.72%). Tier upgraded LEGACY_DB -> OFFICIAL. (Public-school convention: oosAR carries the real number, never marked TERMINAL.)',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. UT Austin does not offer Early Decision. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance refreshed.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        "CDS 2024-25 Section C22 has both Yes and No cells BLANK, but UT Austin's public admissions policy confirms NO Early Action program — only Regular Decision (closing 12/1, notification 2/15) and Texas Education Code 51.803 automatic admission for top % of Texas HS graduates. Prior DB value 32% (TAVILY_ENRICHMENT, sourceUrl pointed to UT-Austin Box CDS but UT does not have an EA program) is invalid. Cleared to null and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.",
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
      acceptanceRate: new Prisma.Decimal('26.64'),
      sat25: null,
      sat75: null,
      intlAcceptanceRate: new Prisma.Decimal('12.87'),
      oosAcceptanceRate: new Prisma.Decimal('10.13'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — UT Austin does not offer ED; confirm hasEarlyDecision stays false
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=26.64, sat25=null[CDS C9 blank], sat75=null, intlAR=12.87, oosAR=10.13, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
