#!/usr/bin/env tsx
/**
 * Phase 3 — Colorado State University (CSU, Fort Collins) end-to-end closure
 * of the 7 prediction-critical fields.
 *
 * Source: Colorado State University Common Data Set FY2026 (Fall 2025 entering
 *   class) — March 2026 release from CSU Institutional Research, Planning and
 *   Effectiveness.
 *   Index: https://www.ir.colostate.edu/common-data-set/
 *   PDF:   https://www.ir.colostate.edu/wp-content/uploads/sites/21/2026/03/CSU_CDS_FY2026_Access.pdf
 *
 * CRITICAL: Prior DB provenance was CROSS-CONTAMINATED with COLORADO COLLEGE
 *   data — intlAR/oosAR sourceUrl pointed to coloradocollege.edu (a private
 *   liberal arts college in Colorado Springs, NOT Colorado State University in
 *   Fort Collins). All prior LEGACY_DB values for intlAR/oosAR (7.02 / 24.25)
 *   were Colorado College numbers, not CSU. sat25/sat75 (1140/1280) sourced
 *   from prepexpert.com (third-party blog) also unreliable. This pull replaces
 *   cross-contaminated and third-party data with authoritative CSU CDS FY2026.
 *
 * Institution facts:
 *   - PUBLIC land-grant research university (Colorado State University System)
 *   - In-state vs. out-of-state distinction carries real policy meaning
 *     (different tuition, residency pathways) → oosAR is in eligible scope
 *   - CSU is TEST-BLIND (CDS C8A: "Not considered for admission, even if
 *     submitted") — even stronger than test-optional; scores are not used at
 *     all in admission decisions
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 88.54  → 88.64   (CDS FY2026 C1: 34,004 admits /
 *                          38,365 applicants = 88.6353% (rounded to 88.64%).
 *                          Minor +0.10pp precision adjustment. Tier upgraded
 *                          LEGACY_DB → OFFICIAL.)
 *   - sat25             : 1140   → null    (CSU CDS C9 verbatim: "As stand-
 *                          ardized test scores are not considered for admission
 *                          to CSU, these data are not reported." CSU does not
 *                          publish SAT percentile bands. Prior LEGACY_DB value
 *                          1140 sourced from prepexpert.com third-party blog
 *                          (unreliable). Field cleared and marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION (test-blind
 *                          institution chose not to report).)
 *   - sat75             : 1280   → null    (As above. Prior 1280 cleared.)
 *   - intlAcceptanceRate: 7.02   → null    (CSU CDS FY2026 C1 residency
 *                          breakdown: BLANK — CSU explicitly stated "N/A"
 *                          under the residency breakdown section. CSU did not
 *                          publish In-State / Out-of-State / International
 *                          column breakdown. Prior LEGACY_DB value 7.02 was
 *                          CROSS-CONTAMINATED from Colorado College data
 *                          (sourceUrl pointed to coloradocollege.edu).
 *                          Field cleared and marked UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION (in eligible scope, but CSU
 *                          chose not to publish residency breakdown).)
 *   - oosAcceptanceRate : 24.25  → null    (As above — CDS C1 residency = N/A.
 *                          NOTE: CSU is a PUBLIC land-grant institution; OOS
 *                          distinction DOES carry policy meaning (different
 *                          tuition, ~$13,486 in-state vs ~$36,376 OOS at CSU
 *                          2024-25); oosAR is in eligible scope. Field marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION (NOT TERMINAL —
 *                          this distinguishes a public school that legitimately
 *                          did not publish from a private school whose field is
 *                          not applicable). Prior LEGACY_DB value 24.25 cleared
 *                          (cross-contaminated from Colorado College).)
 *   - edAcceptanceRate  : null   → null    (CDS FY2026 C21: "Does your
 *                          institution offer an early decision plan?" — NO
 *                          checked. CSU does not offer Early Decision. Field
 *                          stays cleared. Provenance refreshed from prior
 *                          OFFICIAL_BLANK_SECTION (with correct ir.colostate.edu
 *                          sourceUrl) to authoritative FY2026 cycle marked
 *                          UNAVAILABLE/NOT_OFFERED.)
 *   - eaAcceptanceRate  : null   → null    (CDS FY2026 C22: "Do you have a
 *                          nonbinding early action plan?" — YES checked. CSU
 *                          offers Early Action (closes 11/15, notification
 *                          1/15, NOT restrictive). However CDS C22 in this
 *                          cycle does not include EA applicant/admit count
 *                          fields; CSU does not publish a round-level EA admit
 *                          rate. Field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION
 *                          as OFFERED_NOT_REPORTED. (Correction: prior
 *                          provenance was UNAVAILABLE/OFFICIAL_BLANK_SECTION
 *                          marked NOT_OFFERED — that was incorrect since CSU
 *                          DOES offer EA; this pull reclassifies as
 *                          OFFERED_NOT_REPORTED.))
 *
 * hasEarlyDecision correction: DB shows true; CDS C21 = No → setting to false.
 *   (Stale true was likely inherited from cross-contaminated Colorado College
 *   data, which DOES offer ED.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CSU_CDS_INDEX_URL = 'https://www.ir.colostate.edu/common-data-set/';
const CSU_CDS_PDF_URL =
  'https://www.ir.colostate.edu/wp-content/uploads/sites/21/2026/03/CSU_CDS_FY2026_Access.pdf';
const CYCLE_YEAR = 2025; // CDS FY2026 = Fall 2025 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ipv001vz0tiqnippgu6';

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
      `School ${SCHOOL_ID} (Colorado State University) not found`,
    );
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
    sourceUrl: CSU_CDS_INDEX_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-colorado-state-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 88.64,
      policyLabel: 'Overall admit rate',
      reason:
        'Colorado State University CDS FY2026 (Fall 2025 entering class) Section C1: TOTAL applicants 38,365; TOTAL admits 34,004; TOTAL enrolled 5,376. AR = 34,004 / 38,365 = 88.6353% (rounded to 88.64%). Minor +0.10pp precision adjustment vs prior 88.54. Tier upgraded LEGACY_DB → OFFICIAL with authoritative ir.colostate.edu sourceUrl (prior LEGACY_DB provenance lacked sourceUrl).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CSU CDS FY2026 Section C9 verbatim: "As standardized test scores are not considered for admission to CSU, these data are not reported." CSU is TEST-BLIND (CDS C8: "Not considered for admission, even if submitted" — stronger than test-optional). CSU does not publish SAT percentile bands. Prior value 1140 was sourced from prepexpert.com (third-party blog, source=CDS_PDF_AUTO mis-labeled) — cleared as unreliable. Field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION (test-blind institution chose not to report).',
      realDataStatus: 'NOT_REPORTED',
    },
    sat75: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CSU CDS FY2026 Section C9: data not reported (test-blind institution). Prior value 1280 (prepexpert.com third-party) cleared. Field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION.',
      realDataStatus: 'NOT_REPORTED',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'CSU CDS FY2026 Section C1 residency breakdown: BLANK — CSU explicitly stated "N/A" under the residency breakdown section, leaving In-State / Out-of-State / International column breakdown empty. Prior LEGACY_DB value 7.02 was CROSS-CONTAMINATED from COLORADO COLLEGE (a different institution — private liberal arts college in Colorado Springs; prior sourceUrl pointed to coloradocollege.edu/offices/ipe/documents/CDS_2024-2025.pdf). Field cleared and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION (in eligible scope, but CSU did not publish residency breakdown).',
      realDataStatus: 'NOT_REPORTED',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Colorado State University is a PUBLIC land-grant research university (Colorado State University System); in-state/out-of-state distinction carries real policy meaning (different tuition: ~$13,486 in-state vs. ~$36,376 OOS for 2024-25; residency-based pathways). oosAR is in eligible scope. HOWEVER, CDS FY2026 Section C1 residency breakdown explicitly states "N/A" — CSU did not publish residency breakdown of applicants/admits/enrolled. Prior LEGACY_DB value 24.25 was CROSS-CONTAMINATED from Colorado College (different institution). Field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION (NOT TERMINAL — distinguishes public-school legitimately-blank from private-school not-applicable).',
      realDataStatus: 'NOT_REPORTED',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CSU CDS FY2026 Section C21: "Does your institution offer an early decision plan?" — NO checked. Colorado State University does NOT offer Early Decision. DB value already null; provenance refreshed to authoritative FY2026 cycle marked UNAVAILABLE/NOT_OFFERED. Stale hasEarlyDecision=true flag (likely inherited from cross-contaminated Colorado College data, which does offer ED) corrected to false.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CSU CDS FY2026 Section C22: "Do you have a nonbinding early action plan?" — YES checked. CSU offers Early Action (closes 11/15, notification 1/15, NOT restrictive). However CDS C22 in this cycle does not include EA applicant/admit count fields (only Yes/No + dates + restrictive flag); CSU does not publish a round-level EA admit rate. Field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION as OFFERED_NOT_REPORTED. (Reclassification: prior provenance incorrectly marked NOT_OFFERED — CSU does offer EA.)',
      realDataStatus: 'OFFERED_NOT_REPORTED',
    },
  };

  const existingMeta = toRecord(school.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: CSU_CDS_INDEX_URL,
    closureSourcePdf: CSU_CDS_PDF_URL,
  };

  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('88.64'),
      sat25: null,
      sat75: null,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — CSU does NOT offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=88.64, sat25=BLANK, sat75=BLANK, intlAR=BLANK, oosAR=BLANK, edAR=NOT_OFFERED, eaAR=OFFERED_NOT_REPORTED, hasED=false)',
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
