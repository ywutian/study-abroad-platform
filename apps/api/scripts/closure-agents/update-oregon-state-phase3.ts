#!/usr/bin/env tsx
/**
 * Phase 3 — Oregon State University (OSU, Corvallis) end-to-end closure of
 * the 7 prediction-critical fields.
 *
 * Source: Oregon State University Common Data Set 2024-2025 (Fall 2024
 *   entering class) — hosted by OSU Institutional Research.
 *   PDF: https://institutionalresearch.oregonstate.edu/sites/institutionalresearch.oregonstate.edu/files/2025-07/cds_2024-25.pdf
 *
 * NOTE: This is the SAME PDF previously referenced by OSU's LEGACY_DB
 *   provenance. The prior values were largely correct OSU numbers; this pull
 *   upgrades all tiers to OFFICIAL with full C1 residency / C9 SAT / C21 ED /
 *   C22 EA extraction. ALSO: this clears the stale TERMINAL sat25/sat75
 *   (which incorrectly had Olin sourceUrl — cross-contamination) and replaces
 *   with the real Composite percentiles published by OSU's CDS C9.
 *
 * Institution facts:
 *   - PUBLIC land-grant research university (Oregon University System
 *     successor), ~22,000 undergraduates
 *   - In-state vs. out-of-state distinction carries real policy meaning
 *     (different tuition: ~$13,599 in-state vs. ~$36,624 OOS for 2024-25;
 *     residency-based pathways) → oosAR is in eligible scope and CARRIES a
 *     REAL CDS NUMBER (NOT marked TERMINAL).
 *   - OSU is TEST-OPTIONAL (CDS C8A: "Not required for admission, but
 *     considered if submitted"). C9 SAT percentiles still recorded as OFFICIAL
 *     for descriptive applicant-profile use (not as a gating threshold).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 77.3   → 77.30   (CDS 2024-25 C1: 23,418 admits /
 *                          30,293 applicants = 77.3017%. Minor precision
 *                          (77.3 → 77.30). Tier upgraded LEGACY_DB → OFFICIAL.)
 *   - sat25             : null   → 1160    (CDS 2024-25 C9: SAT Composite
 *                          25th = 1160 reported. CORRECTION: prior TERMINAL/
 *                          NO_PUBLIC_SOURCE with Olin sourceUrl
 *                          (cross-contamination from a completely different
 *                          institution) was wrong — OSU DOES publish SAT
 *                          percentiles. 10% of Fall 2024 enrolled (476
 *                          students) submitted SAT under OSU test-optional
 *                          policy.)
 *   - sat75             : null   → 1390    (CDS 2024-25 C9: SAT Composite
 *                          75th = 1390 reported. Same correction.)
 *   - intlAcceptanceRate: 30.42  → 30.42   (CDS 2024-25 C1 residency: 439
 *                          intl admits / 1,443 intl applicants = 30.4227%
 *                          (rounded 30.42%). No value change; tier upgraded
 *                          LEGACY_DB → OFFICIAL.)
 *   - oosAcceptanceRate : 77.37  → 77.37   (CDS 2024-25 C1 residency: 15,681
 *                          OOS admits / 20,268 OOS applicants = 77.3683%
 *                          (rounded 77.37%). No value change; tier upgraded
 *                          LEGACY_DB → OFFICIAL. NOTE: OSU is a PUBLIC
 *                          land-grant institution — OOS distinction has real
 *                          policy meaning; oosAR is in eligible scope and
 *                          carries a REAL CDS number (NOT TERMINAL).)
 *   - edAcceptanceRate  : null   → null    (CDS 2024-25 C21: "Does your
 *                          institution offer an early decision plan?" — NO
 *                          checked (X). OSU does NOT offer Early Decision.
 *                          Field stays cleared. Provenance refreshed from
 *                          CDS_LLM_EXTRACT_2026_04 to authoritative
 *                          CDS_OFFICIAL pull marked UNAVAILABLE/NOT_OFFERED.)
 *   - eaAcceptanceRate  : 88     → null    (CDS 2024-25 C22: "Do you have a
 *                          nonbinding early action plan?" — YES checked (X).
 *                          OSU offers Early Action (closes 11/1, notification
 *                          12/15, NOT restrictive). However CDS C22 in this
 *                          cycle does not include EA applicant/admit count
 *                          fields (only Yes/No + dates + restrictive flag);
 *                          OSU does not publish a round-level EA admit rate.
 *                          Prior LEGACY_DB value 88 (via TAVILY_ENRICHMENT —
 *                          likely a generic "early admit rate" web scrape)
 *                          cleared as unverifiable. Field marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION as
 *                          OFFERED_NOT_REPORTED.)
 *
 * hasEarlyDecision correction: DB shows true; CDS C21 = No → setting to false.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const OSU_CDS_URL =
  'https://institutionalresearch.oregonstate.edu/sites/institutionalresearch.oregonstate.edu/files/2025-07/cds_2024-25.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ipm001sz0tixvcr2p30';

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
    throw new Error(`School ${SCHOOL_ID} (Oregon State University) not found`);
  if (school.dataReviewStatus === 'REJECTED') {
    console.log(
      `Skipping closed/rejected school ${school.name} (status=${school.dataReviewStatus})`,
    );
    return;
  }
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC land-grant]`);
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
    sourceUrl: OSU_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-oregon-state-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 77.3,
      policyLabel: 'Overall admit rate',
      reason:
        'Oregon State University CDS 2024-25 (Fall 2024 entering class) Section C1: TOTAL applicants 30,293; TOTAL admits 23,418; TOTAL enrolled 4,778. AR = 23,418 / 30,293 = 77.3017% (rounded to 77.30%). Tier upgraded LEGACY_DB → OFFICIAL with full extraction; sourceUrl unchanged (OSU IR-hosted PDF).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1160,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'OSU CDS 2024-25 Section C9: SAT Composite 25th = 1160 (reported directly). CORRECTION: prior provenance was TERMINAL/NO_PUBLIC_SOURCE with sourceUrl pointing to olin.edu (Franklin W. Olin College — a completely different institution; cross-contamination). OSU DOES publish SAT percentiles. 10% of Fall 2024 enrolled (476 students) submitted SAT under OSU test-optional policy. NOTE: OSU is test-optional (CDS C8A "Not required for admission, but considered if submitted"); SAT band is recorded for descriptive applicant-profile use only.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1390,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'OSU CDS 2024-25 Section C9: SAT Composite 75th = 1390 (reported directly). CORRECTION: prior TERMINAL with Olin sourceUrl (cross-contamination) cleared. NOTE: OSU is test-optional; SAT band is descriptive only.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 30.42,
      policyLabel: 'International admit rate',
      reason:
        'OSU CDS 2024-25 Section C1 residency table: 439 international admits / 1,443 international applicants = 30.4227% (rounded to 30.42%). No value change vs prior LEGACY_DB 30.42; tier upgraded LEGACY_DB → OFFICIAL with full extraction.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 77.37,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Oregon State University is a PUBLIC land-grant research university; in-state/out-of-state distinction carries real policy meaning (different tuition: ~$13,599 in-state vs. ~$36,624 OOS for 2024-25; residency-based pathways). oosAR is in eligible scope and carries a REAL CDS number (NOT TERMINAL). CDS 2024-25 Section C1 residency table: 15,681 OOS admits / 20,268 OOS applicants = 77.3683% (rounded to 77.37%). No value change vs prior LEGACY_DB 77.37; tier upgraded LEGACY_DB → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'OSU CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked (X). Oregon State University does NOT offer Early Decision. DB value already null; provenance refreshed from CDS_LLM_EXTRACT_2026_04 to authoritative CDS_OFFICIAL pull marked UNAVAILABLE/NOT_OFFERED. Stale hasEarlyDecision=true flag corrected to false.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'OSU CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — YES checked (X). OSU offers Early Action (closes 11/1, notification 12/15, NOT restrictive). However CDS C22 in this cycle does not include EA applicant/admit count fields (only Yes/No + dates + restrictive flag); OSU does not publish a round-level EA admit rate. Prior LEGACY_DB value 88 (via TAVILY_ENRICHMENT — likely an unverifiable third-party scrape) cleared. Field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION as OFFERED_NOT_REPORTED.',
      realDataStatus: 'OFFERED_NOT_REPORTED',
    },
  };

  const existingMeta = toRecord(school.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: OSU_CDS_URL,
  };

  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('77.30'),
      sat25: 1160,
      sat75: 1390,
      intlAcceptanceRate: new Prisma.Decimal('30.42'),
      oosAcceptanceRate: new Prisma.Decimal('77.37'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — OSU does NOT offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=77.30, sat25=1160, sat75=1390, intlAR=30.42, oosAR=77.37, edAR=NOT_OFFERED, eaAR=OFFERED_NOT_REPORTED, hasED=false)',
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
