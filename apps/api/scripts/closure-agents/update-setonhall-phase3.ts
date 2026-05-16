#!/usr/bin/env tsx
/**
 * Phase 3 — Seton Hall University end-to-end closure of the 7 prediction-
 * critical fields.
 *
 * IMPORTANT — NO PUBLIC CDS: Seton Hall University's Office of Institutional
 * Research no longer publishes Common Data Sets publicly. The most recent
 * publicly posted CDS on shu.edu is **2004-2005** (verified via
 * https://www.shu.edu/institutional-research/reports.html and via Google
 * `"Seton Hall" "Common Data Set" filetype:pdf site:shu.edu`). The OIR home
 * page (https://www.shu.edu/institutional-research/index.html) lists no CDS
 * link. The previous DB sourceUrl pointed to the 2003-2004 CDS — extremely
 * stale.
 *
 * Best authoritative substitute sources used here:
 *   1) Seton Hall University 2022-23 Data Trends (Office of Institutional
 *      Research, most recent published institutional data book covering Fall
 *      2018 → Fall 2022):
 *      https://www.shu.edu/documents/2022-23_Data_Trends.pdf
 *      - 5-Year Freshman Admission Trends table (page 17 of the PDF, p.21 of
 *        binder): Fall 2022 Applied 25,732 / Accepted 19,315 / Enrolled 1,511
 *        → AR = 19,315 / 25,732 = 75.0622% (rounded 75.06%).
 *      - Avg SAT 2022 (28% submitting): 1310. No 25/75 percentile bands
 *        published; SAT band cells in trend table show distribution counts but
 *        no percentile cutoffs.
 *      - Residency of enrolled (NJ 1,125 / OOS 361 / Intl 25) — these are
 *        **enrolled**, not the admit pool, so cannot derive intlAR or oosAR.
 *   2) Seton Hall news release — "Welcome to the Class of 2029" (Fall 2025
 *      entering): https://www.shu.edu/news/move-in-day-welcome-the-class-of-2029.html
 *      - "More than 28,000 students applied", "admission rate 69%", ~1,625
 *        enrolled. Average SAT 1323 (28% submitted), Average ACT 29.53.
 *      Used only as confirmatory signal for AR trend; not used as primary
 *      authority for the seven fields.
 *   3) Seton Hall application checklist:
 *      https://www.shu.edu/undergraduate-admissions/application-checklist.html
 *      - Confirms Seton Hall offers Early Action I (11/15) and Early Action II
 *        (12/15), both non-binding. Does NOT offer Early Decision.
 *
 * Institution facts:
 *   - PRIVATE Catholic research university (New Jersey)
 *   - In-state/out-of-state distinction carries no policy meaning → oosAR =
 *     UNAVAILABLE/TERMINAL
 *   - No published CDS C1 residency breakdown of admits → intlAR likewise
 *     marked UNAVAILABLE/OFFICIAL_BLANK_SECTION
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 81.86    → 75.06   (Data Trends 2022-23, Fall 2022:
 *                          19,315 admits / 25,732 applicants = 75.0622%. Tier
 *                          stays VERIFIED_REAL but sourceUrl refreshed from
 *                          2003-04 CDS to 2022-23 Data Trends. Prior value
 *                          81.86 was unverifiable against any cycle; corrected
 *                          to the most-recent officially-published institutional
 *                          number. DOWNWARD CORRECTION −6.80pp.)
 *   - sat25             : 1240     → null    (Data Trends 2022-23 publishes
 *                          only Average SAT (1310 for Fall 2022) and distribution
 *                          band counts (1400-1600, 1300-1399, etc.); no 25th
 *                          percentile cutoff is reported. Prior DB value 1240
 *                          claimed tier=OFFICIAL but sourceUrl pointed to
 *                          PrepScholar.com (third-party aggregator, not Seton
 *                          Hall), so cannot be trusted as OFFICIAL. Field marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION pending Seton
 *                          Hall publishing CDS data again.)
 *   - sat75             : 1380     → null    (Same as sat25 — no 75th percentile
 *                          cutoff published in Data Trends 2022-23. Prior
 *                          PrepScholar-sourced value cleared.)
 *   - intlAcceptanceRate: 72.2     → null    (Data Trends 2022-23 publishes
 *                          residency only for ENROLLED students (Intl 25 of
 *                          1,511 in Fall 2022); does NOT publish intl
 *                          applicant or admit counts. Prior INFERRED value 72.2
 *                          cleared. Field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *   - oosAcceptanceRate : 77.52    → null    (Seton Hall is PRIVATE Catholic;
 *                          in-state vs. out-of-state distinction carries no
 *                          policy meaning. Data Trends 2022-23 reports
 *                          residency only for enrolled students. Prior INFERRED
 *                          value 77.52 cleared. Field marked UNAVAILABLE/TERMINAL
 *                          per closure-pipeline convention for private institutions.)
 *   - edAcceptanceRate  : null     → null    (Application checklist page
 *                          confirms Seton Hall does NOT offer Early Decision —
 *                          only Early Action I/II. Field stays cleared.
 *                          Provenance refreshed from NO_PUBLIC_ROUND_RATE/TERMINAL
 *                          (with WashU sourceUrl, clearly wrong) to authoritative
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION marked
 *                          NOT_OFFERED.)
 *   - eaAcceptanceRate  : null     → null    (Seton Hall offers Early Action I
 *                          (11/15) and Early Action II (12/15) per application
 *                          checklist, but does not publish round-level admit
 *                          counts (no CDS released). Field stays cleared.
 *                          Provenance refreshed from NO_PUBLIC_ROUND_RATE/TERMINAL
 *                          to UNAVAILABLE/OFFICIAL_BLANK_SECTION marked
 *                          OFFERED_NOT_REPORTED.)
 *
 * hasEarlyDecision correction: DB shows true; application checklist confirms
 *   Seton Hall offers only EA (non-binding), not ED → setting to false.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const SHU_DATA_TRENDS_URL =
  'https://www.shu.edu/documents/2022-23_Data_Trends.pdf';
const SHU_APP_CHECKLIST_URL =
  'https://www.shu.edu/undergraduate-admissions/application-checklist.html';
const CYCLE_YEAR = 2022; // Most recent Data Trends published cycle = Fall 2022
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ioi001fz0tivlt104p7';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Seton Hall) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}`);
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
    sourceUrl: SHU_DATA_TRENDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 0.9, // not a CDS, but most recent OIR-published institutional source
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-setonhall-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'INSTITUTIONAL_DATA_TRENDS',
      value: 75.06,
      policyLabel: 'Overall admit rate (Fall 2022 most-recent published)',
      reason:
        'Seton Hall University 2022-23 Data Trends (Office of Institutional Research), 5-Year Freshman Admission Trends table: Fall 2022 Applied 25,732 / Accepted 19,315 / Enrolled 1,511 → 19,315 / 25,732 = 75.0622% (rounded 75.06%). NOTE: Seton Hall no longer publishes a public Common Data Set — most recent CDS on shu.edu is 2004-2005. The Data Trends institutional data book is the most-recent OIR-published authoritative source. Prior DB value 81.86 (LEGACY_DB pointing to 2003-04 CDS) was extremely stale. DOWNWARD CORRECTION −6.80pp. Confirmatory signal: Class of 2029 news (Fall 2025) reports 69% admit rate / 28,000+ apps — directional trend matches.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'Seton Hall does not publish SAT 25th-percentile cutoffs in any current OIR document. 2022-23 Data Trends reports only Average SAT (1310 for Fall 2022) and SAT score band distribution counts (1400-1600, 1300-1399, etc.), but no percentile cutoffs. Prior DB value 1240 claimed tier=OFFICIAL but sourceUrl pointed to PrepScholar.com (third-party aggregator, not Seton Hall), so tier was misattributed. Field cleared and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION until Seton Hall resumes publishing CDS.',
      realDataStatus: 'NOT_REPORTED',
    },
    sat75: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'Same as sat25 — no 75th percentile cutoff published in 2022-23 Data Trends or any current Seton Hall OIR document. Prior 1380 from PrepScholar third-party aggregator cleared.',
      realDataStatus: 'NOT_REPORTED',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        '2022-23 Data Trends publishes residency only for ENROLLED first-time freshmen (Fall 2022: NJ 1,125 / Out-of-State 361 / International 25). Does NOT publish residency breakdown of applicant pool or admit pool, so intlAR cannot be derived. Prior INFERRED value 72.2 cleared. Field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION.',
      realDataStatus: 'NOT_REPORTED',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Seton Hall University is a PRIVATE Catholic research university (Archdiocese of Newark); in-state/out-of-state distinction carries no policy meaning (no in-state tuition advantage). 2022-23 Data Trends reports residency only for enrolled students. Prior INFERRED value 77.52 cleared. Field marked UNAVAILABLE/TERMINAL per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      sourceUrl: SHU_APP_CHECKLIST_URL,
      policyLabel: 'Early Decision admit rate',
      reason:
        'Seton Hall Undergraduate Admissions Application Checklist page (https://www.shu.edu/undergraduate-admissions/application-checklist.html) confirms Seton Hall offers only Early Action I (11/15) and Early Action II (12/15), both non-binding. NO Early Decision plan. Field stays cleared. Provenance refreshed from prior NO_PUBLIC_ROUND_RATE/TERMINAL (with WashU sourceUrl — clearly wrong/cross-contaminated) to authoritative UNAVAILABLE/OFFICIAL_BLANK_SECTION marked NOT_OFFERED. Stale hasEarlyDecision=true flag corrected to false.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      sourceUrl: SHU_APP_CHECKLIST_URL,
      policyLabel: 'Early Action admit rate',
      reason:
        'Application checklist confirms Seton Hall offers EA I (11/15) and EA II (12/15), both non-binding. However, Seton Hall does not publish round-level admit counts (no current public CDS, and Data Trends does not break out applications by round). Field stays cleared. Provenance refreshed from prior NO_PUBLIC_ROUND_RATE/TERMINAL (WashU sourceUrl cross-contamination) to UNAVAILABLE/OFFICIAL_BLANK_SECTION marked OFFERED_NOT_REPORTED.',
      realDataStatus: 'OFFERED_NOT_REPORTED',
    },
  };

  const existingMeta = toRecord(school.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: SHU_DATA_TRENDS_URL,
  };

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('75.06'),
      sat25: null,
      sat75: null,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // Application checklist confirms NO ED — correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=75.06, sat25=N/A, sat75=N/A, intlAR=N/A, oosAR=N/A, edAR=NOT_OFFERED, eaAR=OFFERED_NOT_REPORTED, hasED=false)',
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
