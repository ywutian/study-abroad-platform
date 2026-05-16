#!/usr/bin/env tsx
/**
 * Phase 3 — Rose-Hulman Institute of Technology end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: Rose-Hulman CDS 2024-2025 (PDF, read directly from disk after
 *         WebFetch saved the binary)
 *   URL: https://www.rose-hulman.edu/academics/academic-affairs/irpa/reports/2024-25-Academic-Year-CDS.pdf
 *
 * Notes on Rose-Hulman's CDS:
 *   - C1 totals match existing DB exactly (4,686 admitted / 6,097 applicants
 *     = 76.86%). No value change for acceptanceRate.
 *   - C1 residency breakdown IS fully populated:
 *       In-state    916 / 1,295  = 70.73%
 *       Out-of-state 3,112 / 3,847 = 80.89%
 *       International 658 / 955   = 68.90%
 *   - Rose-Hulman is private (no in-state/out-of-state distinction in
 *     financial-aid sense), BUT the CDS publishes the breakdown anyway.
 *     Per Phase 2 conventions, private schools mark oosAcceptanceRate as
 *     UNAVAILABLE / TERMINAL even though CDS reports a number, because the
 *     "out-of-state admit rate" concept is a public-school construct.
 *   - C9: SAT Composite IS listed directly:
 *       25th = 1310, 75th = 1490, 50th = 1410, mean = 1388.
 *     Per Phase 2 rule: when CDS has "SAT Composite" row, use Composite.
 *     (As a sanity check: EBRW 25th=630 + Math 25th=660 = 1290, EBRW 75th=720
 *     + Math 75th=780 = 1500 — both off by ±10/20 from the published
 *     Composite. The published Composite reflects per-student totals rather
 *     than independent percentile sums and is the official number.)
 *   - C21: Early Decision = "No" (checked) → UNAVAILABLE / OFFICIAL_BLANK_SECTION.
 *   - C22: Early Action = "Yes" (checked), Nov 1 closing date / Dec 15
 *     notification, NON-restrictive. But CDS provides NO applicant/admit
 *     counts. Per Phase 2 rule for EA=Yes but no numbers → UNAVAILABLE /
 *     TERMINAL (could be revisited via Agent C / Tavily fallback in a later
 *     phase; not handled here).
 *
 * Value changes vs. existing DB:
 *   - acceptanceRate: 76.86 → unchanged (CDS confirms exactly)
 *   - sat25: 1320 → 1310 (CDS C9 SAT Composite 25th)
 *   - sat75: 1500 → 1490 (CDS C9 SAT Composite 75th)
 *   - intlAcceptanceRate: 68.9 → 68.90 (CDS confirms; provenance upgraded
 *     from LEGACY_DB_VALUE to OFFICIAL CDS)
 *   - oosAcceptanceRate: 80.89 → unchanged numerically; tier UNAVAILABLE /
 *     TERMINAL (private school convention)
 *   - edAcceptanceRate: undefined → unchanged; tier UNAVAILABLE / OFFICIAL_BLANK_SECTION
 *   - eaAcceptanceRate: undefined → unchanged; tier UNAVAILABLE / TERMINAL
 *     (EA=Yes but CDS lists no numbers; not Agent-C ready in this pass)
 */
import { PrismaClient } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const ROSE_HULMAN_CDS_URL =
  'https://www.rose-hulman.edu/academics/academic-affairs/irpa/reports/2024-25-Academic-Year-CDS.pdf';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findFirst({
    where: {
      name: { contains: 'Rose-Hulman' },
      country: 'US',
    },
    select: {
      id: true,
      name: true,
      sat25: true,
      sat75: true,
      acceptanceRate: true,
      intlAcceptanceRate: true,
      oosAcceptanceRate: true,
      edAcceptanceRate: true,
      eaAcceptanceRate: true,
      hasEarlyDecision: true,
      metadata: true,
    },
  });
  if (!school) throw new Error('Rose-Hulman not found');
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(
    `  current sat25=${school.sat25} sat75=${school.sat75} AR=${school.acceptanceRate?.toString()}`,
  );
  console.log(
    `  current intlAR=${school.intlAcceptanceRate?.toString()} oosAR=${school.oosAcceptanceRate?.toString()}`,
  );

  const baseProv = {
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-rose-hulman-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      sourceUrl: ROSE_HULMAN_CDS_URL,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 76.86,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 4,686 admitted / 6,097 applicants = 76.86%. Matches existing DB value exactly.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      sourceUrl: ROSE_HULMAN_CDS_URL,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1310,
      policyLabel: 'SAT composite 25th percentile (published Composite)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th percentile = 1310 (directly published row). Per pipeline rule, prefer published Composite over EBRW+Math sum when present. CORRECTION from prior 1320.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      sourceUrl: ROSE_HULMAN_CDS_URL,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1490,
      policyLabel: 'SAT composite 75th percentile (published Composite)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th percentile = 1490 (directly published row). Per pipeline rule, prefer published Composite over EBRW+Math sum when present. CORRECTION from prior 1500.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      sourceUrl: ROSE_HULMAN_CDS_URL,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 68.9,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency breakdown: 658 international admitted / 955 international applicants = 68.90%. Matches existing DB value; provenance upgraded from LEGACY_DB_VALUE to OFFICIAL CDS.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      sourceUrl: ROSE_HULMAN_CDS_URL,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Rose-Hulman is private; in-state/out-of-state distinction does not apply as a public-policy admit-rate concept. CDS C1 residency table does report 3,112 admitted / 3,847 out-of-state applicants = 80.89%, but per pipeline convention private schools mark oosAcceptanceRate UNAVAILABLE-terminal. Numeric column retains historical value.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      sourceUrl: ROSE_HULMAN_CDS_URL,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: Rose-Hulman does NOT offer an Early Decision plan ("No" checked). Field marked UNAVAILABLE-terminal.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      sourceUrl: ROSE_HULMAN_CDS_URL,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: Rose-Hulman DOES offer a non-restrictive Early Action plan (Nov 1 closing date, Dec 15 notification), but CDS lists NO applicant or admit counts for EA. Numbers are not derivable from official CDS in this cycle. Field marked UNAVAILABLE-terminal pending future Agent C / Tavily press-release fallback.',
      realDataStatus: 'UNVERIFIED',
    },
  };

  const existingMeta = toRecord(school.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
  };

  // Bypass SchoolWriteService (schema drift on housingAvailable etc.). Use a
  // minimal update with explicit select.
  await prisma.school.update({
    where: { id: school.id },
    data: {
      sat25: 1310, // value correction (was 1320)
      sat75: 1490, // value correction (was 1500)
      hasEarlyDecision: false, // confirmed from CDS C21
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  updated 7 fields (acceptanceRate, sat25, sat75, intlAR, oosAR=N/A, edAR=N/A, eaAR=terminal)',
  );

  // verify
  const after = await prisma.school.findUnique({
    where: { id: school.id },
    select: {
      sat25: true,
      sat75: true,
      acceptanceRate: true,
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
    `  sat25=${after?.sat25} sat75=${after?.sat75} hasEarlyDecision=${after?.hasEarlyDecision}`,
  );
  console.log(
    `  AR=${after?.acceptanceRate?.toString()} intlAR=${after?.intlAcceptanceRate?.toString()} oosAR=${after?.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  edAR=${after?.edAcceptanceRate?.toString()} eaAR=${after?.eaAcceptanceRate?.toString()}`,
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
      `  ${f.padEnd(22)} tier=${p?.tier ?? 'NULL'}  source=${p?.source ?? 'NULL'}  value=${p?.value ?? 'NULL'}`,
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
