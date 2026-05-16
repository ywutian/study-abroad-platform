#!/usr/bin/env tsx
/**
 * Phase 3 — Syracuse University end-to-end closure of the 7 prediction-critical
 * fields.
 *
 * IMPORTANT — Syracuse University does NOT publish a Common Data Set.
 * Discovery: Syracuse's institutional research offices
 *   - https://institutionaldata.syr.edu/key-data/
 *   - https://researchandassessment.syracuse.edu/
 *   - https://effectiveness.syr.edu/
 * none host a current CDS. The previously-referenced
 * https://effectiveness.syr.edu/wp-content/uploads/2024/02/syracuse_university_cds_2023-2024.pdf
 * returns HTTP 404 (the file has been removed and there is no Wayback snapshot).
 * Secondary trackers (College Transitions, GradGPT, CollegeData) confirm
 * Syracuse "has opted out of publishing the Common Data Set" for recent
 * cycles. The prior DB sourceUrl pointed to a Syracuse *City Schools* K-12
 * SCEP PDF — a misattribution unrelated to Syracuse University.
 *
 * Authoritative substitute: IPEDS via NCES College Navigator (institution id
 * 196413) for Fall 2024 admissions cycle — government-collected official data
 * that is the same cycle a CDS 2024-25 would cover.
 *
 * Source: NCES College Navigator — Syracuse University (IPEDS id 196413)
 *   URL: https://nces.ed.gov/collegenavigator/?id=196413
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 52      → 46.00  (IPEDS Fall 2024: 20,461 admits /
 *                          44,480 applicants = 46.00%. Tier upgraded
 *                          LEGACY_DB (sourceUrl=shiksha.com aggregator) →
 *                          OFFICIAL. CORRECTION DOWN -6.00pp.)
 *   - sat25             : 1250    → 1270   (IPEDS Fall 2024 section scores:
 *                          EBRW 25th = 640, Math 25th = 630, sum = 1270. No
 *                          true SAT Composite 25th is published; section-sum
 *                          approximation per IPEDS convention. CORRECTION UP
 *                          +20 from prior 1250 LEGACY_DB.)
 *   - sat75             : 1400    → 1440   (IPEDS Fall 2024 section scores:
 *                          EBRW 75th = 720, Math 75th = 720, sum = 1440.
 *                          Section-sum approximation per IPEDS convention.
 *                          CORRECTION UP +40 from prior 1400 LEGACY_DB.)
 *   - intlAcceptanceRate: 57.2    → null   (No official Syracuse residency
 *                          breakdown is published. IPEDS only reports
 *                          enrolled student percentages (9% U.S. Nonresident
 *                          undergrads, 6% first-time foreign-country) —
 *                          enrollment ratios are NOT an admit-rate
 *                          residency table. Prior LEGACY_DB value 57.2 came
 *                          from shiksha.com aggregator — unreliable.
 *                          Cleared; marked UNAVAILABLE / OFFICIAL_BLANK_SECTION.)
 *   - oosAcceptanceRate : 41.6    → null   (Syracuse University is a private
 *                          research university; in-state / out-of-state
 *                          distinction carries no policy meaning. Prior
 *                          PERMANENT_HEURISTIC value 41.6 cleared. Field
 *                          UNAVAILABLE-terminal per closure-pipeline
 *                          convention for private institutions.)
 *   - edAcceptanceRate  : 56.19   → null   (Syracuse OFFERS Early Decision
 *                          (ED I + ED II) per
 *                          https://www.syracuse.edu/admissions-aid/application-process/undergraduate/enrollment-options/early-decision/
 *                          — hasEarlyDecision stays true. However, Syracuse
 *                          does not publish ED applicant/admit counts (no
 *                          CDS, no IPEDS field for ED counts, no press
 *                          release with disaggregated ED numbers). Prior DB
 *                          value 56.19 came from TAVILY_ENRICHMENT with a
 *                          sourceUrl pointing to Syracuse *City Schools*
 *                          (K-12 SCEP) — a misattributed citation.
 *                          Cleared; marked UNAVAILABLE / OFFICIAL_BLANK_SECTION.)
 *   - eaAcceptanceRate  : null    → null   (Syracuse does NOT offer Early
 *                          Action — only Early Decision I and II are
 *                          available per official enrollment-options page.
 *                          Field stays null; provenance refreshed from
 *                          prior CDS_LLM_EXTRACT_2026_04 (whose sourceUrl
 *                          pointed to a Syracuse City Schools K-12 PDF) to
 *                          UNAVAILABLE-terminal / NOT_OFFERED.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const SYR_NCES_URL = 'https://nces.ed.gov/collegenavigator/?id=196413';
const SYR_ENROLLMENT_OPTIONS_URL =
  'https://www.syracuse.edu/admissions-aid/application-process/undergraduate/enrollment-options/';
const CYCLE_YEAR = 2024; // IPEDS Fall 2024 entering class (equivalent of CDS 2024-25)
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findFirst({
    where: { id: 'cmnwr8imi000cz0tifntjkili' },
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
  if (!school) throw new Error('Syracuse University not found');
  console.log(`Updating ${school.name} (${school.id})`);
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
    sourceUrl: SYR_NCES_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 0.95, // IPEDS instead of CDS — slightly lower confidence than CDS_OFFICIAL
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-syracuse-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'IPEDS_OFFICIAL',
      value: 46.0,
      policyLabel: 'Overall admit rate',
      reason:
        'IPEDS Fall 2024 (via NCES College Navigator, institution id 196413): 20,461 admitted / 44,480 applicants = 46.00%. Used as the authoritative source because Syracuse University does not publish a Common Data Set — secondary trackers (College Transitions, GradGPT) confirm Syracuse "opted out of publishing the CDS" for recent cycles. Tier upgraded from LEGACY_DB (value 52, sourceUrl pointed to shiksha.com aggregator) to OFFICIAL. CORRECTION DOWN -6.00pp.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'IPEDS_OFFICIAL',
      value: 1270,
      policyLabel: 'SAT composite 25th percentile (section-sum approximation)',
      reason:
        'IPEDS Fall 2024 (NCES id 196413) reports SAT section scores: EBRW 25th = 640, Math 25th = 630. Section-sum = 1270 used as composite approximation (Syracuse does not publish a true CDS Composite quantile — IPEDS only collects section ranges; section quantiles do not exactly equal composite quantiles, but this is the standard approximation when CDS is unavailable). Note: only 22% (861) of enrolled first-time students submitted SAT under test-optional policy. CORRECTION UP +20 from prior 1250 (LEGACY_DB).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'IPEDS_OFFICIAL',
      value: 1440,
      policyLabel: 'SAT composite 75th percentile (section-sum approximation)',
      reason:
        'IPEDS Fall 2024 (NCES id 196413) reports SAT section scores: EBRW 75th = 720, Math 75th = 720. Section-sum = 1440 used as composite approximation (Syracuse does not publish a true CDS Composite quantile). CORRECTION UP +40 from prior 1400 (LEGACY_DB).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'Syracuse University does not publish a Common Data Set, and IPEDS does not collect international-applicant admit rates (it only reports enrolled student percentages: 9% U.S. Nonresident undergrads, 6% first-time foreign-country — enrollment ratios are NOT an admit-rate residency table). Prior LEGACY_DB value 57.2 came from shiksha.com aggregator (unreliable). Cleared and marked UNAVAILABLE — no authoritative source publishes Syracuse intl admit rate.',
      realDataStatus: 'NOT_PUBLISHED',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Syracuse University is a private research university (Syracuse, NY); in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). Prior PERMANENT_HEURISTIC value 41.6 cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions. (Separately, Syracuse does not publish a CDS C1 residency table.)',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'Syracuse University OFFERS Early Decision (ED I closes 11/15, ED II closes 1/5) per https://www.syracuse.edu/admissions-aid/application-process/undergraduate/enrollment-options/early-decision/ — hasEarlyDecision stays true. However, Syracuse does NOT publish ED applicant/admit counts: no CDS exists for Fall 2024, IPEDS does not collect ED counts, and no press release with disaggregated ED numbers is available. Prior DB value 56.19 came from TAVILY_ENRICHMENT with a sourceUrl pointing to "Syracuse City Schools ITC 2024-25 SCEP" — a K-12 school district document unrelated to Syracuse University (misattributed citation). Cleared and marked UNAVAILABLE.',
      realDataStatus: 'NOT_PUBLISHED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'Syracuse University does NOT offer Early Action — only Early Decision I and II are available per official enrollment-options page (https://www.syracuse.edu/admissions-aid/application-process/undergraduate/enrollment-options/). Field stays null. Prior provenance had source=CDS_LLM_EXTRACT_2026_04 with a sourceUrl pointing to "Syracuse City Schools ITC 2024-25 SCEP" — a K-12 document misattributed as Syracuse University CDS. Refreshed to UNAVAILABLE-terminal / NOT_OFFERED with correct semantic.',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(school.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: SYR_NCES_URL,
    closureNote:
      'Syracuse University does not publish a Common Data Set; IPEDS via NCES College Navigator (id 196413) used as authoritative substitute for Fall 2024 admissions.',
  };

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('46.00'),
      sat25: 1270,
      sat75: 1440,
      intlAcceptanceRate: null, // no official source publishes intl admit rate
      oosAcceptanceRate: null, // private institution → not applicable
      edAcceptanceRate: null, // ED offered but counts not published anywhere
      eaAcceptanceRate: null, // EA not offered (CDS C22 would be "No")
      hasEarlyDecision: true, // confirm — Syracuse offers ED I + ED II
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=46.00, sat25=1270, sat75=1440, intlAR=N/A, oosAR=N/A, edAR=BLANK, eaAR=NOT_OFFERED)',
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
