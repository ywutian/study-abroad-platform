#!/usr/bin/env tsx
/**
 * Phase 3 — New York University (NYU) end-to-end closure of the 7 prediction-
 * critical fields.
 *
 * Source: NYU CDS 2024-2025 (Office of Institutional Research)
 *   URL: https://www.nyu.edu/content/dam/nyu/institutionalResearch/documents/cds-on-website/2024-2025%20(pdf,%20file%20size%20907KB).pdf
 *
 * NYU is a PRIVATE research university. Per closure-pipeline convention:
 *   - isPrivate=true → oosAcceptanceRate is OUT OF SCOPE; record as
 *     UNAVAILABLE/TERMINAL/NOT_APPLICABLE (in-state vs OOS has no policy
 *     meaning at a private institution — no in-state tuition advantage).
 *
 * Test policy (CDS C8): SAT/ACT "Recommended" (test-optional). 28% of Fall 2024
 *   enrolled submitted SAT, 10% submitted ACT. SAT Composite percentiles are
 *   reported and material (OFFICIAL).
 *
 * Early plans:
 *   - C21 Early Decision: "Yes" — NYU offers TWO ED plans (ED I closes 11/1
 *     with 12/15 notification; ED II closes 1/1 with 2/15 notification).
 *     HOWEVER the C21 "Number of early decision applications received" and
 *     "Number of applicants admitted under early decision plan" cells in this
 *     NYU CDS are intentionally blanked (gray-shaded — NYU OIR redacts ED
 *     counts in its public CDS). Per closure-pipeline convention an offered-
 *     but-unpublished plan is recorded as edAR=null with tier=UNAVAILABLE
 *     source=OFFICIAL_BLANK_SECTION (the CDS section is officially blank for
 *     the metric). Prior stale DB value 30 (from Tavily enrichment with no
 *     CDS-verifiable backing — the same sourceUrl was attached but the CDS
 *     itself does NOT publish this number) is cleared.
 *   - C22 Early Action: "No" — NYU does NOT offer EA. eaAR stays null with
 *     UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.
 *
 * C1 residency breakdown (in-state vs OOS vs international) cells are ALSO
 * blanked in NYU's CDS — NYU OIR does not publish residency-specific admit
 * counts publicly. Therefore:
 *   - oosAR → UNAVAILABLE/TERMINAL/NOT_APPLICABLE (private school convention)
 *   - intlAR → UNAVAILABLE/OFFICIAL_BLANK_SECTION (CDS section blank). Prior
 *     stale DB value 4.88 (HEURISTIC, no CDS backing) is cleared.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 8       → 9.23   (CDS C1 Total: 10,232 admits /
 *                          110,807 applicants = 9.2341%. CORRECTION UP +1.23pp
 *                          from prior 8 (LEGACY_DB_VALUE, collegekickstart
 *                          aggregator). Tier LEGACY_DB → OFFICIAL.)
 *   - sat25             : 1430    → 1480   (CDS C9 SAT Composite 25th = 1480
 *                          reported directly. CORRECTION UP +50 from prior
 *                          1430 (LEGACY_DB heuristic). Tier LEGACY_DB →
 *                          OFFICIAL.)
 *   - sat75             : 1540    → 1550   (CDS C9 SAT Composite 75th = 1550
 *                          reported directly. CORRECTION UP +10 from prior
 *                          1540 (LEGACY_DB heuristic). Tier LEGACY_DB →
 *                          OFFICIAL.)
 *   - intlAcceptanceRate: 4.88    → null   (NYU CDS C1 residency table is
 *                          blank — NYU OIR does not publish residency
 *                          breakdown. Stale HEURISTIC value 4.88 cleared.
 *                          Marked UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *   - oosAcceptanceRate : 12.2    → null   (Private institution — OOS
 *                          distinction carries no policy meaning. Additionally
 *                          CDS C1 residency table is blank. Stale HEURISTIC
 *                          value 12.2 cleared. Marked UNAVAILABLE/TERMINAL/
 *                          NOT_APPLICABLE per closure-pipeline private-school
 *                          convention.)
 *   - edAcceptanceRate  : 30      → null   (NYU offers ED I + ED II (C21
 *                          "Yes") but C21 admit-count cells are intentionally
 *                          blanked in the public CDS. Stale value 30 (Tavily
 *                          enrichment, no CDS backing) cleared. Marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION /
 *                          OFFERED_NOT_REPORTED.)
 *   - eaAcceptanceRate  : null    → null   (CDS C22 "No" — NYU does NOT offer
 *                          EA. Stays UNAVAILABLE/OFFICIAL_BLANK_SECTION/
 *                          NOT_OFFERED.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.nyu.edu/content/dam/nyu/institutionalResearch/documents/cds-on-website/2024-2025%20(pdf,%20file%20size%20907KB).pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmn1htkp9000yvqf29pcl812t';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (NYU) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PRIVATE]`);
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
    generatedBy: 'phase3-nyu-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 9.23,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 10,232 admits / 110,807 applicants = 9.2341% (rounded to 9.23%). CORRECTION UP +1.23pp from prior 8 (LEGACY_DB_VALUE, sourceUrl pointed to collegekickstart.com aggregator). Tier upgraded LEGACY_DB_VALUE → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1480,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1480 (reported directly; EBRW 720 + Math 760 sum = 1480 also coincides). CORRECTION UP +50 from prior 1430 (LEGACY_DB heuristic). 28% of Fall 2024 enrolled (1,598 students) submitted SAT under test-optional policy. Tier upgraded LEGACY_DB → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1550,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1550 (reported directly; EBRW 760 + Math 800 sum = 1560 differs because composite quantiles ≠ section sums). CORRECTION UP +10 from prior 1540 (LEGACY_DB heuristic). Tier upgraded LEGACY_DB → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        "CDS 2024-25 Section C1 residency table (in-state / out-of-state / international column cells) is intentionally blanked in NYU's public CDS — NYU Office of Institutional Research does not publish residency-specific admit counts. Prior stale value 4.88 (HEURISTIC/PERMANENT_HEURISTIC, no CDS backing) cleared. Marked UNAVAILABLE/OFFICIAL_BLANK_SECTION.",
      realDataStatus: 'OFFERED_NOT_REPORTED',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        "NYU is a private research university; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). Additionally CDS C1 residency table is blank in NYU's public CDS. Prior stale value 12.2 (HEURISTIC/PERMANENT_HEURISTIC, no CDS backing) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline private-school convention.",
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2024-25 Section C21: NYU offers Early Decision ("Yes" checked) with two plans — ED I closes 11/1 (12/15 notification), ED II closes 1/1 (2/15 notification). HOWEVER the C21 "Number of early decision applications received" and "Number of applicants admitted under early decision plan" cells are intentionally blanked (gray-shaded) in NYU\'s public CDS — NYU OIR redacts ED counts. Per closure-pipeline convention an offered-but-unpublished plan is recorded as edAR=null with tier=UNAVAILABLE source=OFFICIAL_BLANK_SECTION. Prior stale value 30 (TAVILY_ENRICHMENT — sourceUrl pointed at this NYU CDS but the CDS itself does NOT publish the number; the 30 was inferred from external press releases, not extracted from CDS) cleared.',
      realDataStatus: 'OFFERED_NOT_REPORTED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. NYU does NOT offer Early Action (only the two ED plans in C21). Field stays cleared. UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED. Provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 (value=undefined) to authoritative CDS_OFFICIAL pull.',
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
      acceptanceRate: new Prisma.Decimal('9.23'),
      sat25: 1480,
      sat75: 1550,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "Yes" (ED I+II offered) — re-confirm. hasEarlyDecision already true.
      hasEarlyDecision: true,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=9.23, sat25=1480, sat75=1550, intlAR=BLANK, oosAR=N/A, edAR=OFFERED_NOT_REPORTED, eaAR=NOT_OFFERED)',
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
