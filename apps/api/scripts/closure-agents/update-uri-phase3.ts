#!/usr/bin/env tsx
/**
 * Phase 3 — University of Rhode Island (Public, Kingston, RI)
 *
 * Source: University of Rhode Island Common Data Set 2024-2025 (Fall 2024
 *   entering class), Section C — First-Time, First-Year (Freshman) Admission.
 *   URL: https://web.uri.edu/ir/wp-content/uploads/sites/276/CDS-2024-2025-fillable.pdf
 *   Hosted by URI Office of Institutional Research (web.uri.edu/ir/data/common/).
 *
 *   This is a CYCLE UPGRADE: existing DB provenance points at the prior
 *   2023-2024 CDS (URI_CDS_2023-2024Final20250211-PTFNumbersUpdated.pdf). The
 *   2024-2025 CDS supersedes it.
 *
 * URI is a PUBLIC institution (CDS A2 "Public"; isPrivate=false). The CDS
 *   2024-25 C1 residency sub-table IS populated with full In-State / OOS /
 *   International disaggregation (no Unknown bucket needed — totals match).
 *
 * URI is TEST-OPTIONAL (CDS C8A "Considered if Submitted" for SAT/ACT; C8F:
 *   "Students will not be required to submit standardized test scores").
 *   Unlike UH Mānoa, URI DOES publish C9 percentiles — 27.4% (820) of enrolled
 *   FTICs submitted SAT scores, sufficient for reporting. SAT band carries
 *   OFFICIAL tier as descriptive applicant-profile use.
 *
 * NOTE on Early Decision (C21): URI's CDS 2024-25 C21 shows ED closing/
 *   notification dates filled in (11/1 / 12/1) BUT explicitly notes "Early
 *   decision is new for fall 2025" — meaning ED program first activates for
 *   the Fall 2025 entering class. For the Fall 2024 cohort reported in this
 *   CDS, NO ED applicant/admit counts are published (fields blank). edAR for
 *   cycle 2024 is recorded as UNAVAILABLE/OFFICIAL_BLANK_SECTION with
 *   realDataStatus=NOT_REPORTED (program announced but not yet operative for
 *   reported cycle). hasEarlyDecision=true is RETAINED — reflects current /
 *   forward-looking institutional policy effective Fall 2025.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 77.1   -> 72.16  (CDS 2024-25 C1: 19,475 admits /
 *                          26,987 applicants = 72.1607%. DOWNWARD CORRECTION
 *                          ~5pp from prior 77.1 (LEGACY_DB, 2023-24 cycle).
 *                          Tier LEGACY_DB -> OFFICIAL. Reflects more selective
 *                          Fall 2024 cycle.)
 *   - sat25             : 1020   -> 1020   (CDS 2024-25 C9: SAT Composite 25th
 *                          = 1020 (reported directly; EBRW 520 + Math 500).
 *                          Same value at 0dp. Tier OFFICIAL (sourceUrl was
 *                          edurank.org aggregator — mis-tagged) -> OFFICIAL
 *                          with URL corrected to real URI CDS.)
 *   - sat75             : 1280   -> 1260   (CDS 2024-25 C9: SAT Composite 75th
 *                          = 1260 (reported directly; EBRW 650 + Math 630).
 *                          MINOR CORRECTION DOWN -20 from prior 1280
 *                          (edurank.org aggregator scrape). Tier OFFICIAL
 *                          with URL corrected.)
 *   - intlAcceptanceRate: 72.8   -> 67.41  (CDS 2024-25 C1 residency table:
 *                          362 international admits / 537 international
 *                          applicants = 67.4115%. CORRECTION DOWN -5pp from
 *                          prior 72.8 (LEGACY_DB, 2023-24 cycle). Tier
 *                          LEGACY_DB -> OFFICIAL.)
 *   - oosAcceptanceRate : 77.4   -> 71.80  (CDS 2024-25 C1 residency table:
 *                          15,824 out-of-state admits / 22,040 OOS applicants
 *                          = 71.7967%. CORRECTION DOWN -5.6pp from prior 77.4
 *                          (LEGACY_DB, 2023-24 cycle). URI is a PUBLIC land-
 *                          grant institution — in-state (RI) vs OOS
 *                          distinction carries real policy meaning (different
 *                          tuition, NEBHE Regional Student Program tier).
 *                          In-state context: 3,289/4,410 = 74.58% (modestly
 *                          higher than OOS). Tier LEGACY_DB -> OFFICIAL.)
 *   - edAcceptanceRate  : null   -> null   (CDS 2024-25 C21: ED announced as
 *                          "new for fall 2025" with closing 11/1 / notif 12/1
 *                          but applicant/admit counts BLANK for Fall 2024
 *                          entering class. ED program not yet operative for
 *                          reported cycle. UNAVAILABLE/OFFICIAL_BLANK_SECTION.
 *                          NOTE: hasEarlyDecision=true RETAINED (reflects
 *                          forward-looking institutional policy effective
 *                          Fall 2025 onward).)
 *   - eaAcceptanceRate  : null   -> null   (CDS 2024-25 C22: "Yes" — URI
 *                          offers Early Action (closing 12/1; notification
 *                          12/15; non-restrictive). However, CDS C22 does NOT
 *                          require institutions to publish EA applicant/admit
 *                          counts and URI provides none. UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION (EA program confirmed
 *                          exists; admit numbers not officially published).)
 *
 * NOTE on hasEarlyDecision: current DB value is true. Per URI's CDS note "Early
 *   decision is new for fall 2025", URI IS now an ED-offering institution
 *   going forward. RETAIN hasEarlyDecision=true (forward-looking).
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://web.uri.edu/ir/wp-content/uploads/sites/276/CDS-2024-2025-fillable.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iqa0022z0ti9ad68xp2';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (URI) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC]`);
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
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-uri-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 72.16,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 19,475 admits / 26,987 applicants = 72.1607% (rounded to 72.16%). DOWNWARD CORRECTION ~5pp from prior 77.1 (LEGACY_DB based on 2023-24 cycle). Reflects more selective Fall 2024 admission cycle. Tier LEGACY_DB -> OFFICIAL. Source URL refreshed from 2023-24 PDF to current 2024-25 PDF.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1020,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1020 (reported directly; EBRW 520 + Math 500). Same value at 0dp as prior 1020. 27.4% (820) of enrolled FTICs submitted SAT scores. URI is test-optional (CDS C8A "Considered if Submitted"; C8F: "Students will not be required to submit standardized test scores") — SAT band recorded for descriptive applicant-profile use, not as a gating threshold. Prior tier was OFFICIAL but sourceUrl was edurank.org aggregator (mis-tagged); refreshed with authoritative URI CDS URL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1260,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1260 (reported directly; EBRW 650 + Math 630). MINOR CORRECTION DOWN -20 from prior 1280 (edurank.org aggregator scrape). Tier OFFICIAL with URL refreshed to authoritative URI CDS.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 67.41,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 362 international admits / 537 international applicants = 67.4115% (rounded to 67.41%). CORRECTION DOWN ~5pp from prior 72.8 (LEGACY_DB based on 2023-24 cycle). Tier LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 71.8,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 15,824 out-of-state admits / 22,040 OOS applicants = 71.7967% (rounded to 71.80%). CORRECTION DOWN ~5.6pp from prior 77.4 (LEGACY_DB, 2023-24 cycle). URI is a PUBLIC land-grant institution — in-state (RI) vs OOS distinction carries real policy meaning (different tuition; NEBHE Regional Student Program reduced-tuition tier for neighboring NE states), so this field is in eligible scope and MUST carry a real CDS number. (In-state context: 3,289/4,410 = 74.58% — modestly higher than OOS, consistent with public-school residency preference.) Tier LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: ED announced with closing 11/1 / notification 12/1, BUT institutional note explicitly states "Early decision is new for fall 2025" — meaning the ED program first activates for the Fall 2025 entering class. For the Fall 2024 cohort reported in this CDS, NO ED applicant/admit counts are published (fields blank). Recorded as UNAVAILABLE/OFFICIAL_BLANK_SECTION with realDataStatus=NOT_REPORTED. NOTE: hasEarlyDecision=true RETAINED to reflect URI\'s forward-looking institutional policy effective Fall 2025 onward.',
      realDataStatus: 'NOT_REPORTED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Yes" — URI offers Early Action (closing 12/1; notification 12/15; non-restrictive). However, CDS C22 does NOT require institutions to publish EA applicant/admit counts (template only asks for dates and the restrictive-plan flag) and URI provides none. UNAVAILABLE/OFFICIAL_BLANK_SECTION (EA program confirmed exists; admit numbers not officially published).',
      realDataStatus: 'NOT_REPORTED',
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
      acceptanceRate: new Prisma.Decimal('72.16'),
      sat25: 1020,
      sat75: 1260,
      intlAcceptanceRate: new Prisma.Decimal('67.41'),
      oosAcceptanceRate: new Prisma.Decimal('71.80'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // hasEarlyDecision retained as true — URI's ED program activates Fall 2025
      // (CDS 2024-25 C21 explicitly notes "Early decision is new for fall 2025")
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=72.16, sat25=1020, sat75=1260, intlAR=67.41, oosAR=71.80, edAR=NOT_REPORTED_fall24, eaAR=NOT_REPORTED, hasED=true [retained])',
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
