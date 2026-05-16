#!/usr/bin/env tsx
/**
 * Phase 3 — University of North Dakota (UND, Grand Forks, ND) end-to-end
 * closure of the 7 prediction-critical fields. PUBLIC flagship research
 * university (North Dakota University System).
 *
 * CRITICAL: Prior DB provenance for sat25/sat75 was POINTING TO THE WRONG
 *   URL — https://arts-sciences.und.edu/academics/psychology/clinical/_files/
 *   docs/und-clinical-psych-outcome-data-2024-25.pdf — this is the Clinical
 *   Psychology PROGRAM Outcome Data (graduate program internship match rates
 *   etc.), NOT institutional SAT/ACT percentiles. The CDS_LLM_EXTRACT pass
 *   misidentified this URL as the UND CDS. (Same wrong URL was also attached
 *   to edAR/eaAR provenance.)
 *
 * Sources searched (Common Data Set unavailable):
 *   - UND CDS landing page (https://und.edu/analytics-and-planning/data-and-
 *     reports/common-data-set.html) explicitly states "Updated reports will be
 *     available soon." As of May 2026 UND has NO publicly available CDS for
 *     any cycle (the cds-2020-2021.pdf link Google still indexes returns 404).
 *   - UND publishes no SAT/ACT percentiles outside the CDS framework. UND
 *     marketing materials only mention scholarship thresholds (3.0 GPA + 30
 *     ACT for auto-scholarship).
 *   - UND publishes no residency-segmented application/admit counts.
 *   - UND publishes no ED/EA round-level admit rates (test-optional school,
 *     rolling admissions practice).
 *
 * Fallback source (authoritative for headline AR only):
 *   - NCES College Navigator IPEDS data (Fall 2024 cohort):
 *     https://nces.ed.gov/collegenavigator/?id=200280
 *     UNITID=200280; 8,261 applicants / 6,361 admits = 77.0% AR; 73% Men
 *     admit rate, 82% Women admit rate; In-state 38% / OOS 59% / International
 *     3% of FIRST-TIME UNDERGRAD enrolled (this is enrolled-side residency
 *     composition, NOT applicant-side residency admit rates). Test policy:
 *     "Test Optional" (SAT/ACT not required but considered). $35 app fee.
 *
 * Institution facts:
 *   - PUBLIC flagship; in-state/out-of-state distinction carries real policy
 *     meaning (different tuition: $10,951 in-state vs $15,570 OOS 2024-25);
 *     oosAR in eligible scope IF residency-segmented admit counts were
 *     published (they are not).
 *   - Test policy: TEST-OPTIONAL per IPEDS ("SAT/ACT" = "Not required, but
 *     considered"). Not test-blind. UND has not published Fall 2023 or Fall
 *     2024 SAT/ACT percentile bands anywhere accessible.
 *   - DB hasEarlyDecision=true is unverifiable absent CDS C21. Leaving as-is
 *     (DB value reflects a prior unverified claim; will be re-verified when
 *     UND publishes CDS).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 83.00 → 77.00 (CORRECTION DOWN −6.0pp. Prior 83
 *                          was LEGACY_DB_VALUE with NO sourceUrl, NO
 *                          cycleYear — origin unverifiable, likely a stale
 *                          older-cycle figure or generic estimate. NCES
 *                          IPEDS Fall 2024 (UNITID=200280) reports 8,261
 *                          apps / 6,361 admits = 77.0%. Tier SCRAPED with
 *                          confidence 0.85 — closest available authoritative
 *                          public source absent CDS publication.)
 *   - sat25             : 1130 → null (Prior 1130 had OFFICIAL/CDS_PDF_AUTO
 *                          tier but sourceUrl pointed to testbook.com/en-us/
 *                          college/university-of-north-dakota-admissions —
 *                          a third-party admissions-aggregator blog, NOT
 *                          a UND CDS source. Provenance was incorrectly
 *                          labeled CDS_PDF_AUTO; actual source was unreliable
 *                          aggregator. UND publishes no SAT percentile bands
 *                          (no CDS available). Field cleared and marked
 *                          UNAVAILABLE/UPSTREAM_NOT_PUBLISHED.)
 *   - sat75             : 1270 → null (Same testbook.com cross-source as
 *                          sat25. Cleared.)
 *   - intlAcceptanceRate: 78.85 → null (Prior was HEURISTIC/
 *                          PERMANENT_HEURISTIC — never had a sourceUrl, just
 *                          a heuristic estimate. No published intl-applicant /
 *                          intl-admit count exists for UND. Field cleared and
 *                          marked UNAVAILABLE/UPSTREAM_NOT_PUBLISHED.)
 *   - oosAcceptanceRate : 84.66 → null (Prior was HEURISTIC/
 *                          PERMANENT_HEURISTIC. NCES IPEDS reports OOS share
 *                          of enrolled (59%) but NOT applicant/admit OOS
 *                          counts. Field cleared and marked UNAVAILABLE/
 *                          UPSTREAM_NOT_PUBLISHED. NOT TERMINAL — UND is
 *                          public so oosAR is in eligible scope, just not
 *                          published yet.)
 *   - edAcceptanceRate  : null → null (Prior provenance pointed to clinical
 *                          psych outcome PDF — WRONG URL. UND test-optional /
 *                          rolling admissions practice publishes no ED data.
 *                          DB value already null. Provenance refreshed and
 *                          WRONG sourceUrl REMOVED; marked UNAVAILABLE/
 *                          UPSTREAM_NOT_PUBLISHED.)
 *   - eaAcceptanceRate  : null → null (Same wrong-URL fix as edAR. DB
 *                          already null. Provenance refreshed and WRONG
 *                          sourceUrl REMOVED.)
 *
 * hasEarlyDecision: Left as DB current value (true). Cannot verify without
 *   CDS C21; will be re-verified on next CDS publication.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const UND_NCES_URL = 'https://nces.ed.gov/collegenavigator/?id=200280';
const UND_CDS_INDEX_URL =
  'https://und.edu/analytics-and-planning/data-and-reports/common-data-set.html';
const CYCLE_YEAR = 2024; // NCES IPEDS Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ird002kz0tifunyipf1';

const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findUnique({
    where: { id: SCHOOL_ID },
    select: {
      id: true,
      name: true,
      isPrivate: true,
      hasEarlyDecision: true,
      dataReviewStatus: true,
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
    throw new Error(
      `School ${SCHOOL_ID} (University of North Dakota) not found`,
    );
  if (school.dataReviewStatus === 'REJECTED') {
    console.log(
      `Skipping closed/rejected school ${school.name} (status=${school.dataReviewStatus})`,
    );
    return;
  }
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC flagship]`);
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
    sourceUrl: UND_NCES_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-batch24-claude',
    generatedBy: 'phase3-und-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'SCRAPED',
      source: 'IPEDS_NCES',
      confidence: 0.85,
      value: 77.0,
      policyLabel: 'Overall admit rate (IPEDS fallback — no CDS)',
      reason:
        'CDS NOT AVAILABLE: UND CDS landing page explicitly states "Updated reports will be available soon" (as of May 2026 UND has no publicly accessible CDS for any cycle). Fallback to NCES College Navigator (UNITID=200280) Fall 2024 cohort: 8,261 applicants / 6,361 admits = 77.0% AR (gender breakdown: 73% Men admit rate, 82% Women admit rate). CORRECTION DOWN −6.0pp vs prior 83 (LEGACY_DB_VALUE with no sourceUrl, no cycleYear — origin unverifiable, likely stale older-cycle estimate). Tier SCRAPED/IPEDS_NCES with confidence 0.85 — closest available authoritative public source. Will upgrade to OFFICIAL/CDS_OFFICIAL when UND publishes CDS.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'UPSTREAM_NOT_PUBLISHED',
      confidence: 1.0,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'CDS NOT AVAILABLE: UND publishes no CDS C9 SAT percentile bands (no CDS for any cycle accessible). Prior DB value 1130 had OFFICIAL/CDS_PDF_AUTO tier but the sourceUrl pointed to testbook.com/en-us/college/university-of-north-dakota-admissions — a third-party admissions-aggregator blog, NOT a UND official source. CDS_PDF_AUTO provenance label was incorrect; actual source was an unreliable aggregator. UND test policy per NCES IPEDS: "Test Optional" (SAT/ACT not required but considered). Field cleared and marked UNAVAILABLE/UPSTREAM_NOT_PUBLISHED. WRONG aggregator sourceUrl REMOVED. Will upgrade when UND publishes CDS.',
      realDataStatus: 'NOT_PUBLISHED',
    },
    sat75: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'UPSTREAM_NOT_PUBLISHED',
      confidence: 1.0,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'CDS NOT AVAILABLE: Same testbook.com third-party aggregator cross-source as sat25 (prior value 1270). UND publishes no SAT percentile bands. Field cleared and marked UNAVAILABLE/UPSTREAM_NOT_PUBLISHED. WRONG aggregator sourceUrl REMOVED.',
      realDataStatus: 'NOT_PUBLISHED',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'UPSTREAM_NOT_PUBLISHED',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS NOT AVAILABLE: UND publishes no international-applicant / international-admit counts. Prior DB value 78.85 was HEURISTIC/PERMANENT_HEURISTIC (no sourceUrl, no cycleYear — pure heuristic estimate). NCES IPEDS reports international share of enrolled first-time undergrads (3%) but NOT applicant/admit international counts. Field cleared and marked UNAVAILABLE/UPSTREAM_NOT_PUBLISHED. Will upgrade when UND publishes CDS C1 residency breakdown.',
      realDataStatus: 'NOT_PUBLISHED',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'UPSTREAM_NOT_PUBLISHED',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS NOT AVAILABLE: UND is PUBLIC flagship (North Dakota University System) — in-state/out-of-state distinction carries real policy meaning (different tuition: $10,951 in-state vs $15,570 OOS 2024-25); oosAR in eligible scope. HOWEVER UND publishes no residency-segmented applicant/admit counts. Prior DB value 84.66 was HEURISTIC/PERMANENT_HEURISTIC (no sourceUrl, pure heuristic). NCES IPEDS reports OOS share of enrolled (59%) but NOT applicant/admit OOS counts. Field cleared and marked UNAVAILABLE/UPSTREAM_NOT_PUBLISHED (NOT TERMINAL — public school, would be valid if published).',
      realDataStatus: 'NOT_PUBLISHED',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'UPSTREAM_NOT_PUBLISHED',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS NOT AVAILABLE: Prior provenance had OFFICIAL/CDS_LLM_EXTRACT_2026_04 tier but sourceUrl pointed to https://arts-sciences.und.edu/academics/psychology/clinical/_files/docs/und-clinical-psych-outcome-data-2024-25.pdf — this is the Clinical Psychology PROGRAM Outcome Data (graduate program internship match rates), NOT institutional ED/EA data. CDS_LLM_EXTRACT pass misidentified the URL. DB value already null; provenance refreshed and WRONG sourceUrl REMOVED. UND practices test-optional rolling-style admissions and publishes no ED data. Field marked UNAVAILABLE/UPSTREAM_NOT_PUBLISHED. Will be re-verified on next CDS publication.',
      realDataStatus: 'NOT_PUBLISHED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'UPSTREAM_NOT_PUBLISHED',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS NOT AVAILABLE: Same wrong-URL fix as edAR — prior provenance had the Clinical Psych Outcome Data PDF mis-attached. DB value already null; provenance refreshed and WRONG sourceUrl REMOVED. Field marked UNAVAILABLE/UPSTREAM_NOT_PUBLISHED.',
      realDataStatus: 'NOT_PUBLISHED',
    },
  };

  const existingMeta = toRecord(school.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: UND_CDS_INDEX_URL,
    closureSourceFallback: UND_NCES_URL,
  };

  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('77.00'),
      sat25: null,
      sat75: null,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // hasEarlyDecision unchanged — unverifiable without CDS C21
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=77.00 IPEDS-fallback, sat25=NOT_PUBLISHED, sat75=NOT_PUBLISHED, intlAR=NOT_PUBLISHED, oosAR=NOT_PUBLISHED, edAR=NOT_PUBLISHED, eaAR=NOT_PUBLISHED; wrong clinical-psych PDF URL removed)',
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
