#!/usr/bin/env tsx
/**
 * Phase 3 — Gonzaga University end-to-end closure of the 7 prediction-critical
 * fields.
 *
 * Source: Gonzaga University CDS 2025-2026 (parsed by Claude from PDF via OCR)
 *   URL: https://gonzaga.azureedge.net/-/media/Website/Documents/About/Offices-and-Services/Institutional-Research/Gonzaga-University-CDS-2025-2026.ashx?rev=1df1baba048042c7b7ab3b6838253a5a&hash=469C6498723C19A568DFA15B896737C4
 *   Discovery: https://www.gonzaga.edu/about/offices-services/office-of-institutional-research/reports
 *   (PDF was generated via Microsoft Print-To-PDF — text not selectable; pages rendered at 200dpi and OCR'd with tesseract.)
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 76.15    → 79.62  (CDS C1: 7,091 admits / 8,906
 *                          applicants = 79.6204%. Tier upgraded LEGACY_DB
 *                          (sourceUrl pointed to Gonzaga CDS 2021-22, stale)
 *                          → OFFICIAL. CORRECTION UP +3.47pp (different
 *                          cycle).)
 *   - sat25             : 1190     → 1230   (CDS C9: SAT Composite 25th = 1230
 *                          reported directly (EBRW 630 + Math 590 sum = 1220
 *                          differs because composite quantiles ≠ section sums).
 *                          CORRECTION UP +40 from SEED/PR-15 heuristic.
 *                          Only 19% of Fall 2025 enrolled (218 students)
 *                          submitted SAT under test-optional policy.)
 *   - sat75             : 1380     → 1383   (CDS C9: SAT Composite 75th = 1383
 *                          reported directly (EBRW 710 + Math 690 sum = 1400
 *                          differs because composite quantiles ≠ section sums).
 *                          CORRECTION UP +3 from prior 1380 (SEED/PR-15
 *                          heuristic).)
 *   - intlAcceptanceRate: 51.71    → 51.71  (CDS C1 residency table:
 *                          136 international admits / 263 international
 *                          applicants = 51.7110%. Value matches prior LEGACY_DB
 *                          to 2 decimals exactly (prior pull likely from same
 *                          source); tier upgraded LEGACY_DB → OFFICIAL with
 *                          refreshed cycle/provenance.)
 *   - oosAcceptanceRate : 82.04    → null   (Gonzaga is a private Jesuit
 *                          research university; in-state / out-of-state
 *                          distinction carries no policy meaning (no in-state
 *                          tuition advantage). CDS C1 residency does report
 *                          OOS (4,349 admits / 5,301 applicants = 82.0411%),
 *                          but value not actionable. Prior LEGACY_DB value
 *                          cleared per closure-pipeline private-institution
 *                          convention. UNAVAILABLE/TERMINAL.)
 *   - edAcceptanceRate  : undef    → null   (CDS C21: Gonzaga does NOT offer
 *                          Early Decision ("No" checked). Prior DB flag
 *                          hasEarlyDecision=true CORRECTED to false. Field
 *                          marked UNAVAILABLE/OFFICIAL_BLANK_SECTION /
 *                          NOT_OFFERED.)
 *   - eaAcceptanceRate  : undef    → null   (CDS C22: Gonzaga DOES offer
 *                          nonbinding Early Action (EA closes 11/15,
 *                          notification 12/31; non-restrictive) but does NOT
 *                          publish EA applicant/admit counts. Marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION (offered but
 *                          counts not disclosed).)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const GONZAGA_CDS_URL =
  'https://gonzaga.azureedge.net/-/media/Website/Documents/About/Offices-and-Services/Institutional-Research/Gonzaga-University-CDS-2025-2026.ashx?rev=1df1baba048042c7b7ab3b6838253a5a&hash=469C6498723C19A568DFA15B896737C4';
const GONZAGA_CDS_DISCOVERY_URL =
  'https://www.gonzaga.edu/about/offices-services/office-of-institutional-research/reports';
const CYCLE_YEAR = 2025; // CDS 2025-2026 = Fall 2025 entering class
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const gonzaga = await prisma.school.findFirst({
    where: { id: 'cmnwr8iuk0040z0ti7p8v604n' },
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
  if (!gonzaga) throw new Error('Gonzaga University not found');
  console.log(`Updating ${gonzaga.name} (${gonzaga.id})`);
  console.log(
    `  current AR=${gonzaga.acceptanceRate?.toString()} sat25=${gonzaga.sat25} sat75=${gonzaga.sat75}`,
  );
  console.log(
    `  current intlAR=${gonzaga.intlAcceptanceRate?.toString()} oosAR=${gonzaga.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${gonzaga.edAcceptanceRate?.toString() ?? 'null'} eaAR=${gonzaga.eaAcceptanceRate?.toString() ?? 'null'} hasED=${gonzaga.hasEarlyDecision}`,
  );

  const baseProv = {
    sourceUrl: GONZAGA_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-gonzaga-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 79.62,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2025-26 Section C1: 7,091 admits / 8,906 applicants = 79.6204% (rounded to 79.62%). Tier upgraded from LEGACY_DB (value 76.15, sourceUrl pointed to Gonzaga CDS 2021-22 — stale) to OFFICIAL. CORRECTION UP +3.47pp.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1230,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2025-26 Section C9: SAT Composite 25th = 1230 reported directly (EBRW 630 + Math 590 sum = 1220 differs because composite quantiles ≠ section sums). CORRECTION UP +40 from prior 1190 (SEED/PR-15 heuristic). 19% of Fall 2025 enrolled (218 students) submitted SAT under test-optional policy.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1383,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2025-26 Section C9: SAT Composite 75th = 1383 reported directly (EBRW 710 + Math 690 sum = 1400 differs because composite quantiles ≠ section sums). CORRECTION UP +3 from prior 1380 (SEED/PR-15 heuristic).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 51.71,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2025-26 Section C1 residency table: 136 international admits / 263 international applicants = 51.7110% (rounded to 51.71%). Value matches prior LEGACY_DB to 2 decimals exactly (prior pull likely from same CDS source); tier upgraded LEGACY_DB → OFFICIAL with refreshed cycle/provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Gonzaga University is a private Jesuit research university (Spokane, WA); in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency does report OOS (4,349 admits / 5,301 applicants = 82.0411%), but the value is not actionable for applicants. Prior LEGACY_DB value (82.04) cleared per closure-pipeline private-institution convention. UNAVAILABLE/TERMINAL.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2025-26 Section C21: Gonzaga University does NOT offer an Early Decision plan ("No" checked). DB flag hasEarlyDecision CORRECTED from true to false to match CDS. Field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED. Prior provenance had tier=NO_PUBLIC_ROUND_RATE source=TERMINAL pointing to Williams CDS URL — clearly orphaned/cross-school metadata; refreshed.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2025-26 Section C22: Gonzaga University DOES offer nonbinding Early Action (EA closes 11/15, notification 12/31; non-restrictive) but does NOT publish EA applicant/admit counts in CDS. Field stays null; UNAVAILABLE/OFFICIAL_BLANK_SECTION (offered but counts not disclosed). Prior provenance had tier=NO_PUBLIC_ROUND_RATE source=TERMINAL pointing to Williams CDS URL — orphaned cross-school metadata; refreshed.',
      realDataStatus: 'NOT_REPORTED',
    },
  };

  const existingMeta = toRecord(gonzaga.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: GONZAGA_CDS_URL,
  };

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: gonzaga.id },
    data: {
      acceptanceRate: new Prisma.Decimal('79.62'),
      sat25: 1230,
      sat75: 1383,
      intlAcceptanceRate: new Prisma.Decimal('51.71'),
      oosAcceptanceRate: null,
      edAcceptanceRate: null, // CDS C21 "No" — Gonzaga does not offer ED
      eaAcceptanceRate: null, // CDS C22 "Yes" but counts blank
      hasEarlyDecision: false, // corrected per CDS C21
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=79.62, sat25=1230, sat75=1383, intlAR=51.71, oosAR=N/A, edAR=NOT_OFFERED, eaAR=BLANK_SECTION, hasED=false)',
  );

  // verify
  const after = await prisma.school.findUnique({
    where: { id: gonzaga.id },
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
