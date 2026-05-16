#!/usr/bin/env tsx
/**
 * Phase 3 — University of California, Merced (UC Merced) end-to-end closure of
 * the 7 prediction-critical fields.
 *
 * Source: UC Merced CDS 2022-2023 (Fall 2022 entering class).
 *   NOTE: This is the most recent CDS-C section publicly posted by UC Merced's
 *   Center of Institutional Effectiveness as of 2026-05-16. Newer years
 *   (2023-2024, 2024-2025) are NOT yet posted at the canonical URL pattern
 *   (verified by attempting multiple URL variants).
 *   URL: http://cie.ucmerced.edu/sites/g/files/ufvvjh616/f/page/documents/2023_cds_uc_merced_c.pdf
 *   Index: https://cie.ucmerced.edu/analytics-hub/external-reporting
 *
 * UC Merced is a PUBLIC research university in the University of California
 * system.
 *   - isPrivate=false → oosAcceptanceRate IS in eligible scope. HOWEVER, this
 *     CDS's C1 residency breakdown is NOT REPORTED (table absent on the posted
 *     PDF), so per closure-pipeline rule "C1 residency blank → UNAVAILABLE/
 *     OFFICIAL_BLANK_SECTION", intlAR and oosAR cannot be set to OFFICIAL.
 *     Existing DB values 81 and 85.3 (sourced from prior cycles of the UCOP
 *     nonresident-admit legislative report) are CARRIED OVER but tier remains
 *     LEGACY_DB with refreshed provenance noting the CDS-residency gap.
 *   - UC SYSTEM-WIDE TEST-BLIND policy (C8A "No" — SAT/ACT NOT used in
 *     admission decisions). CDS C9 SAT Composite values (1030/1176/1350) ARE
 *     printed on the CDS but reflect only the 8% of enrolled who self-submitted
 *     scores for placement (not admission). Per closure-pipeline convention
 *     for test-blind UC schools: sat25/sat75 = null with tier UNAVAILABLE/
 *     OFFICIAL_BLANK_SECTION (NOT_COLLECTED for admission purposes).
 *   - C21 "No" → No Early Decision. C22 "No" → No Early Action. UC system
 *     operates a single application cycle.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 96     → 89.50  (CDS C1 Fall 2022: 25,862 admits /
 *                          28,895 applicants = 89.5034% (rounded 89.50%).
 *                          CORRECTION DOWN -6.5pp from prior LEGACY_DB 96
 *                          (likely 2020-21 COVID-era figure). Tier upgraded
 *                          LEGACY_DB → OFFICIAL.)
 *   - sat25             : 1020   → null   (UC test-blind, prior LEGACY_DB
 *                          cleared. UNAVAILABLE/OFFICIAL_BLANK_SECTION
 *                          NOT_COLLECTED.)
 *   - sat75             : 1220   → null   (Same.)
 *   - intlAcceptanceRate: 81     → null   (CDS C1 residency breakdown NOT
 *                          REPORTED on UC Merced 2022-23 CDS. Per closure
 *                          rule for "C1 residency blank", marked UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION/NOT_REPORTED. Prior DB
 *                          value 81 cleared. (UCOP nonresident report Fall
 *                          2024 shows UC Merced 3,306 international admits
 *                          but does NOT publish international applicant
 *                          counts at campus level, so no proxy available.))
 *   - oosAcceptanceRate : 85.3   → null   (Same — CDS C1 residency blank.
 *                          Cleared. (UCOP Fall 2024 shows UC Merced 1,296 OOS
 *                          domestic admits, no app counts.))
 *   - edAcceptanceRate  : null   → null   (CDS C21: "No" — UC Merced does NOT
 *                          offer Early Decision. UC system single application
 *                          cycle. Provenance refreshed UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : null   → null   (CDS C22: "No" — UC Merced does NOT
 *                          offer Early Action. Provenance refreshed similarly.)
 *
 * NOTE on hasEarlyDecision: current DB value is true but CDS C21 is "No".
 *   Setting to false to match CDS reality (UC system never offered ED).
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'http://cie.ucmerced.edu/sites/g/files/ufvvjh616/f/page/documents/2023_cds_uc_merced_c.pdf';
const CYCLE_YEAR = 2022; // CDS 2022-2023 = Fall 2022 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8imp000gz0tibbuqx67l';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UC Merced) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC UC — TEST-BLIND]`);
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
    generatedBy: 'phase3-uc-merced-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 89.5,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2022-23 Section C1 (Fall 2022 entering class): 25,862 admits (12,236 men + 13,626 women) / 28,895 applicants (13,865 men + 15,030 women) = 89.5034% (rounded to 89.50%). CORRECTION DOWN -6.5pp from prior LEGACY_DB 96 (likely 2020-21 COVID-era cycle). Tier upgraded LEGACY_DB → OFFICIAL. Latest UC Merced CDS-C posted by Center of Institutional Effectiveness as of 2026-05-16; newer cycles not yet published.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'UC system is TEST-BLIND — UC Merced CDS 2022-23 Section C8A "No" (SAT/ACT NOT used in admission decisions for first-time, first-year, degree-seeking applicants). The CDS C9 SAT Composite 25/50/75 values (1030/1176/1350) reflect only 8% of enrolled students who self-submitted scores for placement, NOT for admission. Per closure-pipeline convention for test-blind UC schools: sat25/sat75 are cleared. Prior LEGACY_DB value 1020 cleared. Marked UNAVAILABLE/OFFICIAL_BLANK_SECTION (NOT_COLLECTED for admission purposes).',
      realDataStatus: 'NOT_COLLECTED',
    },
    sat75: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'UC system is TEST-BLIND — UC Merced CDS 2022-23 Section C8A "No". CDS C9 SAT Composite 75th (1350) reflects only 8% submitting for placement, not admission. Prior LEGACY_DB value 1220 cleared. Marked UNAVAILABLE/OFFICIAL_BLANK_SECTION (NOT_COLLECTED).',
      realDataStatus: 'NOT_COLLECTED',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2022-23 Section C1: residency breakdown table is NOT REPORTED on UC Merced posted CDS-C section (the residency rows that would normally follow the gender totals are absent on this PDF). Per closure-pipeline rule "C1 residency blank → UNAVAILABLE/OFFICIAL_BLANK_SECTION", international admit rate cannot be computed from an OFFICIAL CDS source. Prior LEGACY_DB value 81 cleared. UCOP nonresident-admission legislative report (Fall 2024) reports 3,306 international admits at UC Merced but does NOT publish campus-level international applicant counts, so no proxy denominator is available. Marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_REPORTED.',
      realDataStatus: 'NOT_REPORTED',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2022-23 Section C1: residency breakdown table is NOT REPORTED on UC Merced posted CDS-C. Per closure-pipeline rule "C1 residency blank → UNAVAILABLE/OFFICIAL_BLANK_SECTION", out-of-state admit rate cannot be derived from an OFFICIAL CDS source. UC Merced is a PUBLIC UC and oosAR is normally in eligible scope (different tuition, residency preference), but with no CDS residency row and no campus-level applicant counts in the UCOP legislative report (only admit counts: 1,296 OOS domestic admits Fall 2024), the field must be cleared rather than carry a heuristic. Prior LEGACY_DB value 85.3 cleared. Marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_REPORTED.',
      realDataStatus: 'NOT_REPORTED',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2022-23 Section C21: "No" — UC Merced does NOT offer Early Decision. UC system operates a single application cycle (no ED, no EA). DB value was already undefined; provenance refreshed from CDS_LLM_EXTRACT_2026_04 to authoritative CDS_OFFICIAL pull marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED. Also corrected stale DB hasEarlyDecision=true to false.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2022-23 Section C22: "No" — UC Merced does NOT offer Early Action. UC system operates a single application cycle. Provenance refreshed from CDS_LLM_EXTRACT_2026_04 to CDS_OFFICIAL marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
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
      acceptanceRate: new Prisma.Decimal('89.50'),
      sat25: null,
      sat75: null,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — UC system does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=89.50, sat25=null[BLIND], sat75=null[BLIND], intlAR=null[BLANK], oosAR=null[BLANK], edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
