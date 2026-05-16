#!/usr/bin/env tsx
/**
 * Phase 3 — Yale University end-to-end closure of the 7 prediction-critical
 * fields.
 *
 * Source: Yale University CDS 2025-2026 Section C (parsed by Claude from PDF)
 *   URL: https://oir.yale.edu/sites/default/files/yale_cds_2025-26_md_20260410_0.pdf
 *
 * Cross-check: Yale CDS 2024-25 (prior cycle, used to confirm residency-blank
 * is a structural pattern, not a one-off omission)
 *   URL: https://oir.yale.edu/sites/default/files/yale_cds_2024-25_rmd_20250612.pdf
 *
 * All 7 fields upgraded to OFFICIAL (or UNAVAILABLE-terminal where Yale
 * structurally does not publish the value).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 3.73   → 4.75   (CDS 2025-26 C1: 2,387 admits /
 *                          50,264 applicants = 4.7488%. CORRECTION UP from
 *                          prior 3.73 (legacy collegekickstart blog source for
 *                          Class of 2028). Tier upgraded LEGACY_DB→OFFICIAL.)
 *   - sat25             : 1500   → 1470   (CDS 2025-26 C9 SAT Composite 25th
 *                          = 1470 reported directly. CORRECTION DOWN from
 *                          prior 1500 (LEGACY_DB). Prior CDS 2024-25 had 1480;
 *                          new cycle data is authoritative.)
 *   - sat75             : 1570   → 1560   (CDS 2025-26 C9 SAT Composite 75th
 *                          = 1560 reported directly. CORRECTION DOWN from
 *                          prior 1570 (LEGACY_DB). Prior CDS 2024-25 also 1560.)
 *   - intlAcceptanceRate: 1.94   → null   (CDS 2025-26 C1 residency table is
 *                          ENTIRELY BLANK — Yale does not publish residency
 *                          breakdown in CDS. The prior DB value 1.94 had
 *                          sourceUrl pointing to Yale CDS 2024-25, BUT that
 *                          PDF's residency table is also blank — the value
 *                          appears to be derived/fabricated, not directly from
 *                          Yale. Field marked UNAVAILABLE-terminal /
 *                          OFFICIAL_BLANK_SECTION.)
 *   - oosAcceptanceRate : 4.03   → null   (Yale is a private research
 *                          university; in-state / out-of-state distinction
 *                          carries no policy meaning (no in-state tuition
 *                          advantage). CDS 2025-26 C1 residency also blank
 *                          (Yale does not publish OOS). Prior DB value 4.03
 *                          cleared. Field marked UNAVAILABLE-terminal per
 *                          closure-pipeline convention for private institutions.)
 *   - edAcceptanceRate  : null   → null   (CDS 2025-26 C21: Yale does NOT
 *                          offer Early Decision ("No" checked). Yale offers
 *                          Single-Choice Early Action (SCEA/REA), which is
 *                          captured under C22 EA. Field stays null, provenance
 *                          refreshed to UNAVAILABLE-terminal / NOT_OFFERED
 *                          from prior NOT_APPLICABLE.)
 *   - eaAcceptanceRate  : 10.82  → null   (CDS 2025-26 C22: Yale DOES offer
 *                          a restrictive nonbinding EA plan (SCEA/REA) — "Yes"
 *                          checked, closing 11/1, notification 12/15, restrictive
 *                          = Yes. HOWEVER, the C22 admit/applicant counts are
 *                          NOT FILLED IN — Yale withholds REA-specific
 *                          numbers in the CDS form. Prior DB value 10.82
 *                          (sourceUrl: admissions.yale.edu/single-choice-early-
 *                          action press release) likely derived from a press
 *                          release for a single cycle; not refreshable from
 *                          current CDS. Field cleared and marked UNAVAILABLE-
 *                          terminal — Yale's REA admit rate is not officially
 *                          published in a structured manner.)
 *
 * Note: hasEarlyDecision stays false (correct per C21 "No"). Yale's early
 * plan is SCEA/REA, an EA variant, not ED.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const YALE_CDS_URL =
  'https://oir.yale.edu/sites/default/files/yale_cds_2025-26_md_20260410_0.pdf';
const CYCLE_YEAR = 2025; // CDS 2025-2026 = Fall 2025 entering class
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const yale = await prisma.school.findFirst({
    where: { name: 'Yale University' },
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
  if (!yale) throw new Error('Yale University not found');
  console.log(`Updating ${yale.name} (${yale.id})`);
  console.log(
    `  current AR=${yale.acceptanceRate?.toString()} sat25=${yale.sat25} sat75=${yale.sat75}`,
  );
  console.log(
    `  current intlAR=${yale.intlAcceptanceRate?.toString()} oosAR=${yale.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${yale.edAcceptanceRate?.toString() ?? 'null'} eaAR=${yale.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: YALE_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-yale-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 4.75,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2025-26 Section C1: 2,387 admits / 50,264 applicants = 4.7488% (rounded to 4.75%). CORRECTION UP from prior 3.73% (LEGACY_DB sourced from collegekickstart blog for Class of 2028). Tier upgraded LEGACY_DB→OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1470,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2025-26 Section C9: SAT Composite 25th = 1470 (reported directly; EBRW 730 + Math 740 sum = 1470). CORRECTION DOWN from prior 1500 (LEGACY_DB). Prior CDS 2024-25 had 1480; new cycle data is authoritative.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1560,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2025-26 Section C9: SAT Composite 75th = 1560 (reported directly; EBRW 780 + Math 790 sum = 1570 differs because composite quantiles ≠ section sums). CORRECTION DOWN from prior 1570 (LEGACY_DB). CDS 2024-25 also reported 1560.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        "CDS 2025-26 Section C1 residency table is ENTIRELY BLANK — Yale does not publish in-state/out-of-state/international applicant or admit breakdown in CDS. Cross-checked CDS 2024-25 — also blank, confirming structural pattern (not one-off omission). Prior DB value 1.94% had sourceUrl pointing to Yale CDS 2024-25, but that PDF's residency table is also blank; the value appears derived/fabricated, not directly sourced from Yale. Field cleared and marked UNAVAILABLE-terminal / OFFICIAL_BLANK_SECTION.",
      realDataStatus: 'NOT_PUBLISHED',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Yale University is a private research institution; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS 2025-26 C1 residency table is also blank (Yale does not publish OOS counts). Prior DB value 4.03% cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2025-26 Section C21: Yale does NOT offer an Early Decision plan ("No" checked). Yale\'s early-application option is Single-Choice Early Action (SCEA/REA), reported under C22 (Early Action), not C21 (Early Decision). Field cleared and marked UNAVAILABLE-terminal / NOT_OFFERED. Provenance refreshed from prior NOT_APPLICABLE / POLICY_DETERMINATION.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate (SCEA/REA)',
      reason:
        'CDS 2025-26 Section C22: Yale DOES offer a restrictive nonbinding Early Action plan (Single-Choice EA / Restrictive EA) — "Yes" checked, closing 11/1, notification 12/15, restrictive = Yes. HOWEVER, the C22 admit/applicant counts are NOT FILLED IN in the CDS form (Yale withholds REA-specific numbers). Prior DB value 10.82% (sourceUrl: admissions.yale.edu press release for a single cycle) is not refreshable from current CDS and not consistently published. Field cleared and marked UNAVAILABLE-terminal — Yale\'s REA admit rate is not officially published in a structured, repeatable manner.',
      realDataStatus: 'NOT_PUBLISHED',
    },
  };

  const existingMeta = toRecord(yale.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: YALE_CDS_URL,
  };

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: yale.id },
    data: {
      acceptanceRate: new Prisma.Decimal('4.75'),
      sat25: 1470,
      sat75: 1560,
      intlAcceptanceRate: null, // CDS residency blank — Yale does not publish
      oosAcceptanceRate: null, // private school + residency blank
      edAcceptanceRate: null, // C21 "No" — Yale does not offer ED
      eaAcceptanceRate: null, // C22 "Yes" but admit counts not filled
      hasEarlyDecision: false, // re-confirm from CDS C21 "No"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=4.75, sat25=1470, sat75=1560, intlAR=BLANK, oosAR=N/A, edAR=NOT_OFFERED, eaAR=NOT_PUBLISHED)',
  );

  // verify
  const after = await prisma.school.findUnique({
    where: { id: yale.id },
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
