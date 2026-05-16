#!/usr/bin/env tsx
/**
 * Phase 3 — Pepperdine University end-to-end closure of the 7 prediction-critical
 * fields.
 *
 * Source: Pepperdine University CDS 2024-2025 (parsed by Claude from PDF)
 *   URL: https://drive.google.com/file/d/138B9EfnEdtzKXSMPJJfyBl2jrrrFt7LN/view
 *   (Pepperdine official CDS page links to this Google Drive PDF; filename
 *    cds2024-25.pdf, hosted by Office of Institutional Effectiveness.)
 *   Discovery: https://www.pepperdine.edu/oie/institutional-research/common-data-set.htm
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 63       → 62.86  (CDS C1 total: 7,245 admits / 11,526
 *                          applicants = 62.8579%. Tier upgraded LEGACY_DB
 *                          (sourceUrl=nextgenadmit.com aggregator) → OFFICIAL.
 *                          CORRECTION DOWN -0.14pp.)
 *   - sat25             : 1290     → 1300   (CDS C9: SAT Composite 25th = 1300
 *                          reported directly. CORRECTION UP +10 from prior
 *                          1290 (LEGACY_DB).)
 *   - sat75             : 1440     → 1440   (CDS C9: SAT Composite 75th = 1440
 *                          reported directly. Value matches prior DB; tier
 *                          upgraded LEGACY_DB → OFFICIAL.)
 *   - intlAcceptanceRate: 50       → null   (CDS C1 residency table is BLANK
 *                          (Pepperdine did not publish residency split for
 *                          Fall 2024). Prior LEGACY_DB value 50% almost
 *                          certainly wrong (nextgenadmit.com aggregator).
 *                          Cleared; marked UNAVAILABLE / OFFICIAL_BLANK_SECTION.)
 *   - oosAcceptanceRate : 30.2     → null   (Pepperdine is a private research
 *                          university; in-state/out-of-state distinction
 *                          carries no policy meaning. Prior value cleared.
 *                          UNAVAILABLE/TERMINAL per private-institution
 *                          convention.)
 *   - edAcceptanceRate  : undef    → null   (CDS C21: Pepperdine does NOT offer
 *                          Early Decision ("No" checked). hasEarlyDecision
 *                          flag corrected from true → false. Field marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : undef    → null   (CDS C22: Pepperdine offers Early
 *                          Action ("Yes" checked) with EA closing Nov 1 /
 *                          notification Jan 10 — BUT no EA applicant/admit
 *                          numbers reported in CDS. Field stays null but
 *                          provenance refreshed to OFFICIAL_BLANK_SECTION
 *                          (EA offered but counts not disclosed).)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const PEPPERDINE_CDS_URL =
  'https://drive.google.com/file/d/138B9EfnEdtzKXSMPJJfyBl2jrrrFt7LN/view';
const PEPPERDINE_CDS_DISCOVERY_URL =
  'https://www.pepperdine.edu/oie/institutional-research/common-data-set.htm';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findFirst({
    where: { id: 'cmnwr8imn000fz0ti5zassqtj' },
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
  if (!school) throw new Error('Pepperdine not found');
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
    sourceUrl: PEPPERDINE_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-pepperdine-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 62.86,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 7,245 admits / 11,526 applicants = 62.8579% (rounded to 62.86%). Tier upgraded from LEGACY_DB (value 63, sourceUrl pointed to nextgenadmit.com aggregator — not Pepperdine) to OFFICIAL. CORRECTION DOWN -0.14pp.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1300,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1300 reported directly (EBRW 650 + Math 640 = 1290 differs because composite quantiles ≠ section sums). CORRECTION UP from prior 1290 (LEGACY_DB). 18% (149 enrolled) submitted SAT under test-optional policy.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1440,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1440 reported directly (EBRW 710 + Math 740 = 1450 differs because composite quantiles ≠ section sums). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table is BLANK — Pepperdine did not publish In-State / Out-of-State / International splits for Fall 2024 (only the Total row 11,526/7,245/843 is populated). Prior LEGACY_DB value 50% was sourced from nextgenadmit.com aggregator and is implausible (would imply intl admit rate ~80% of overall — unreliable). Field cleared and marked UNAVAILABLE — official source has blank cells.',
      realDataStatus: 'NOT_PUBLISHED',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Pepperdine University is a private research university (Malibu, CA); in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). Prior legacy DB value (30.2%, source PERMANENT_HEURISTIC) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions. (Separately, CDS C1 residency table is also blank — no OOS row would be available even if relevant.)',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: Pepperdine does NOT offer an Early Decision plan ("No" checked for ED plan). hasEarlyDecision flag corrected from true → false based on official CDS. Prior DB value was already null/undefined; provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 to authoritative CDS_OFFICIAL pull marked UNAVAILABLE-terminal / NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: Pepperdine OFFERS a nonbinding Early Action plan ("Yes" checked) with EA closing date Nov 1 and notification Jan 10 (non-restrictive). However, the CDS does NOT report EA applicant/admit counts (only the standard C21 cell for ED counts exists; EA counts are not collected by the CDS template). Field stays null; provenance refreshed to OFFICIAL_BLANK_SECTION (EA plan exists but per-cycle counts not disclosed in CDS).',
      realDataStatus: 'NOT_PUBLISHED',
    },
  };

  const existingMeta = toRecord(school.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: PEPPERDINE_CDS_URL,
    closureDiscoveryUrl: PEPPERDINE_CDS_DISCOVERY_URL,
  };

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('62.86'),
      sat25: 1300,
      sat75: 1440,
      intlAcceptanceRate: null, // CDS C1 residency row blank → unavailable
      oosAcceptanceRate: null, // private institution → not applicable
      edAcceptanceRate: null, // CDS C21 "No" — Pepperdine does not offer ED
      eaAcceptanceRate: null, // CDS C22 "Yes" but no counts reported
      hasEarlyDecision: false, // correct from true based on CDS C21 "No"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=62.86, sat25=1300, sat75=1440, intlAR=N/A, oosAR=N/A, edAR=NOT_OFFERED, eaAR=BLANK)',
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
