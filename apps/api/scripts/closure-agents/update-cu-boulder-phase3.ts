#!/usr/bin/env tsx
/**
 * Phase 3 — University of Colorado Boulder (CU Boulder) end-to-end closure
 * attempt for the 7 prediction-critical fields.
 *
 * BLOCKER: CU Boulder has migrated their entire CDS distribution to a
 *   SharePoint-authenticated portal (data.colorado.edu). ALL public file
 *   URLs under colorado.edu/oda/ now return HTTP 301 -> data.colorado.edu
 *   (which itself gates the CDS behind IdentiKey login). Specifically tested
 *   and confirmed redirected/blocked:
 *     - https://www.colorado.edu/oda/sites/default/files/attached-files/cds_2024-2025.pdf
 *     - https://www.colorado.edu/oda/sites/default/files/attached-files/cds_2025-2026.pdf
 *     - https://www.colorado.edu/oda/sites/default/files/attached-files/cds.pdf
 *     - 7 additional filename variants (CDS_*, cds-*, cds24-25, etc.)
 *
 *   The third-party aggregator https://www.gradgpt.com/common-data-set/
 *   university-of-colorado-boulder cites the underlying URL
 *   `cds_2025-2026.pdf` as their source for the SAT 1180-1390 range, but
 *   we cannot independently verify the underlying CDS Section C values.
 *
 * Best available PUBLIC data (Fall 2024 entering class, Class of 2028):
 *   - 57,541 applicants, 81.1% admit rate, 7,546 enrolled, 16.2% yield
 *     (CU Boulder Today + multiple secondary aggregators)
 *   - SAT 25/75 = 1160-1380, ACT 25/75 = 27-32 (PrepScholar)
 *   - GPA average 3.76-3.79
 *   - 4,017 Colorado resident first-year enrolled (BizWest/CU Today)
 *   - No CDS-verified residency-breakdown admit rates for in-state / OOS /
 *     international available publicly.
 *
 * AUTHORITATIVE structural data (from www.colorado.edu/admissions/process/
 *   first-year/apply — public, non-gated):
 *   - CU Boulder does NOT offer Early Decision.
 *   - CU Boulder DOES offer Early Action (closes 11/15, notification 2/1,
 *     non-restrictive).
 *
 * DECISION: Conservative update — refresh provenance metadata to reflect
 *   true source state. Do NOT overwrite numeric DB values with unverified
 *   third-party numbers. Set hasEarlyDecision=false (currently true in DB,
 *   but confirmed false per official CU Boulder admissions page). Mark
 *   ED/EA explicitly per public structural confirmation.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 18.47   -> 18.47  (UNCHANGED — current DB value
 *                          appears severely stale or wrong-metric; Class of
 *                          2028 admit rate is ~81.1% per multiple public
 *                          sources, but CDS PDF is auth-walled. Do NOT
 *                          overwrite with unverified third-party numbers. Tier
 *                          remains LEGACY_DB. **WARNING**: this value is
 *                          almost certainly wrong; flagged for re-verification
 *                          once CU Boulder restores public CDS access.)
 *   - sat25             : 1170    -> 1170  (UNCHANGED — current DB value
 *                          plausibly close to public-source range (1160-1380).
 *                          Tier remains LEGACY_DB pending CDS access.)
 *   - sat75             : 1370    -> 1370  (UNCHANGED — matches public-source
 *                          75th percentile 1380 closely. Tier remains
 *                          LEGACY_DB pending CDS access.)
 *   - intlAcceptanceRate: 7.02    -> 7.02  (UNCHANGED — no public source
 *                          confirms residency-broken-out admit rates for CU
 *                          Boulder. Tier remains LEGACY_DB pending CDS access.)
 *   - oosAcceptanceRate : 24.25   -> 24.25 (UNCHANGED — no public source
 *                          confirms OOS-specific admit rate. CU Boulder is
 *                          public Research-1, OOS distinction carries real
 *                          policy meaning (~3x tuition gap). Tier remains
 *                          LEGACY_DB pending CDS access. **WARNING**: 24.25%
 *                          is implausibly low given 81% overall admit rate.)
 *   - edAcceptanceRate  : null    -> null   (CONFIRMED — CU Boulder does NOT
 *                          offer Early Decision per official admissions page
 *                          (www.colorado.edu/admissions/process/first-year/
 *                          apply). Field stays cleared (UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION). Tier already correct.)
 *   - eaAcceptanceRate  : null    -> null   (CONFIRMED — CU Boulder DOES offer
 *                          Early Action (closes 11/15, notif 2/1, non-
 *                          restrictive) but does not publish admit counts on
 *                          public site. CDS template's C22 EA section does
 *                          not collect counts. Field stays cleared
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *
 * Boolean change:
 *   - hasEarlyDecision  : true    -> false  (CORRECTION — CU Boulder does NOT
 *                          offer ED per official admissions page. Current DB
 *                          true is wrong.)
 */
import { PrismaClient } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const ADMISSIONS_URL =
  'https://www.colorado.edu/admissions/process/first-year/apply';
const CDS_PORTAL_URL = 'https://data.colorado.edu/reports/common-data-set';
const CYCLE_YEAR = 2024; // Fall 2024 entering class (Class of 2028)
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ing000vz0tizgajtqeo';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (CU Boulder) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(
    `  isPrivate=${school.isPrivate}  [PUBLIC — but CDS PDF auth-walled]`,
  );
  console.log(
    `  current AR=${school.acceptanceRate?.toString()} sat25=${school.sat25} sat75=${school.sat75}`,
  );
  console.log(
    `  current intlAR=${school.intlAcceptanceRate?.toString()} oosAR=${school.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${school.edAcceptanceRate?.toString() ?? 'null'} eaAR=${school.eaAcceptanceRate?.toString() ?? 'null'} hasED=${school.hasEarlyDecision}`,
  );

  const baseProvNumeric = {
    sourceUrl: CDS_PORTAL_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 0.5, // reduced — value preserved without authoritative re-verification
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-cu-boulder-blocked-cds-portal',
  };

  const baseProvStructural = {
    sourceUrl: ADMISSIONS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-cu-boulder-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProvNumeric,
      tier: 'LEGACY_DB',
      source: 'LEGACY_DB_VALUE',
      value: 18.47,
      policyLabel: 'Overall admit rate',
      reason:
        'CU Boulder CDS 2024-25 PDF is auth-walled behind data.colorado.edu SharePoint portal (verified 7 URL variants under colorado.edu/oda/ all return 301 -> data.colorado.edu). Public secondary sources (CU Today, BizWest, PrepScholar, CollegeData) report Fall 2024 admit rate of 80.5%-81.1% (54,756-57,541 applicants, 44,053-46,665 admits), but cannot be CDS-verified. Current DB value of 18.47% is severely stale (likely a much earlier cycle when CU Boulder was much more selective; modern CU Boulder is openly classified as "lightly selective"). PRESERVED unchanged pending CDS portal restoration; flagged for re-verification.',
      realDataStatus: 'NEEDS_REVERIFICATION',
    },
    sat25: {
      ...baseProvNumeric,
      tier: 'LEGACY_DB',
      source: 'LEGACY_DB_VALUE',
      value: 1170,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CU Boulder CDS 2024-25 PDF auth-walled. Current DB value 1170 plausibly close to public-source middle-50% lower bound (1160 per PrepScholar; 1180 per third-party aggregator citing cds_2025-2026.pdf). Preserved unchanged.',
      realDataStatus: 'NEEDS_REVERIFICATION',
    },
    sat75: {
      ...baseProvNumeric,
      tier: 'LEGACY_DB',
      source: 'LEGACY_DB_VALUE',
      value: 1370,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CU Boulder CDS 2024-25 PDF auth-walled. Current DB value 1370 plausibly close to public-source middle-50% upper bound (1380 per PrepScholar; 1390 per third-party aggregator citing cds_2025-2026.pdf). Preserved unchanged.',
      realDataStatus: 'NEEDS_REVERIFICATION',
    },
    intlAcceptanceRate: {
      ...baseProvNumeric,
      tier: 'LEGACY_DB',
      source: 'LEGACY_DB_VALUE',
      value: 7.02,
      policyLabel: 'International admit rate',
      reason:
        "CU Boulder CDS 2024-25 PDF auth-walled; no public source publishes residency-broken admit rates. Current DB value 7.02% is implausibly low given CU Boulder's 80%+ overall admit rate and likely stale. Preserved unchanged pending CDS portal restoration.",
      realDataStatus: 'NEEDS_REVERIFICATION',
    },
    oosAcceptanceRate: {
      ...baseProvNumeric,
      tier: 'LEGACY_DB',
      source: 'LEGACY_DB_VALUE',
      value: 24.25,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CU Boulder is a PUBLIC Research-1 institution; in-state vs. out-of-state distinction carries real policy meaning (in-state tuition ~$13,106 vs. OOS ~$40,425, ~3x gap). CU Boulder CDS 2024-25 PDF auth-walled; no public source publishes residency-broken admit rates. Current DB value 24.25% is implausibly low given the 80%+ overall admit rate. Preserved unchanged pending CDS portal restoration; flagged for re-verification.',
      realDataStatus: 'NEEDS_REVERIFICATION',
    },
    edAcceptanceRate: {
      ...baseProvStructural,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'Per official CU Boulder admissions page (www.colorado.edu/admissions/process/first-year/apply, fetched 2026-05): CU Boulder offers ONLY Early Action and Regular Decision — no Early Decision plan. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Tier and source unchanged from prior closure pass; provenance refreshed to reaffirm with current admissions-page citation.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProvStructural,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'Per official CU Boulder admissions page (www.colorado.edu/admissions/process/first-year/apply, fetched 2026-05): CU Boulder offers nonbinding non-restrictive Early Action — closing 11/15, notification 2/1. However, CDS template C22 does not collect EA application/admit counts (only ED is collected under C21), and CU Boulder does not publish EA admit numbers on its public admissions site. Field stays cleared UNAVAILABLE/OFFICIAL_BLANK_SECTION. Tier and source unchanged; provenance refreshed.',
      realDataStatus: 'NOT_REPORTED',
    },
  };

  const existingMeta = toRecord(school.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: CDS_PORTAL_URL,
  };

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  // NUMERIC VALUES PRESERVED — only provenance metadata + hasEarlyDecision correction.
  await prisma.school.update({
    where: { id: school.id },
    data: {
      // Numeric values intentionally NOT changed (CDS auth-walled, third-party
      // numbers cannot be authoritatively verified).
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // Correct stale DB hasED=true: CU Boulder does NOT offer ED.
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  OK refreshed provenance (numeric values preserved; hasED corrected true->false; edAR/eaAR confirmed structurally per official admissions page)',
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
