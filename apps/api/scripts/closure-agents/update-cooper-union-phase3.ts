#!/usr/bin/env tsx
/**
 * Phase 3 — The Cooper Union end-to-end closure of the 7 prediction-critical fields.
 *
 * Closure context:
 *   Cooper Union does NOT publish a public Common Data Set (verified via
 *   WebSearch site:cooper.edu and Google CDS search). The institution is
 *   structurally small (~834 undergraduates, three specialized schools:
 *   Architecture, Art, Engineering), and only publishes aggregate fact
 *   sheets / press posts. Per user authorization we fall back to:
 *     1. OFFICIAL fact-sheet PDF for the overall AR (Fall 2025 cycle)
 *     2. College Board BigFuture (SCRAPED, derived from IPEDS / College
 *        Board partner data) for SAT composite range
 *     3. UNAVAILABLE/TERMINAL for fields Cooper Union structurally cannot
 *        publish (residency split, per-round acceptance rates).
 *
 * Sources:
 *   - Cooper Union Fact Sheet 2025-26 (OFFICIAL):
 *       https://cooper.edu/sites/default/files/uploads/assets/admissions/fact_sheet.pdf
 *   - Cooper Union First-Year Profile (OFFICIAL, fall 2025):
 *       https://cooper.edu/admissions/facts/first-year-profile
 *   - College Board BigFuture (SCRAPED, derived from IPEDS):
 *       https://bigfuture.collegeboard.org/colleges/cooper-union-for-the-advancement-of-science-and-art/admissions
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 13     → 11      (Fact Sheet 2025-26 official; CORRECTION from prior LEGACY_DB_VALUE)
 *   - sat25             : 1380   → 1400    (BigFuture SAT range; CORRECTION from prior SEED/HEURISTIC value)
 *   - sat75             : 1540   → 1520    (BigFuture SAT range; CORRECTION from prior SEED/HEURISTIC value)
 *   - intlAcceptanceRate: 5.2    → null    (private; no residency-split admit data published)
 *   - oosAcceptanceRate : 16.26  → null    (private; in-state/OOS distinction does not apply)
 *   - edAcceptanceRate  : 29     → null    (closed UNAVAILABLE/TERMINAL — Cooper Union does not publish a unified ED rate; only per-school press posts and stale)
 *   - eaAcceptanceRate  : -      → -       (does NOT offer EA — only ED + RD; marked OFFICIAL_BLANK_SECTION/NOT_OFFERED)
 *
 *   Note on AR: Fall 2025 entering class (11%) is the most current OFFICIAL value
 *   directly from cooper.edu fact sheet. Per-school AR varies considerably
 *   (Architecture 4%, Art 8%, Engineering 16%); we use the institution-level
 *   value for the prediction system.
 *
 *   Note on SAT: BigFuture's reported range 1400-1520 is treated as the
 *   25th-75th percentile per College Board convention. This is SCRAPED tier
 *   (derived from IPEDS, not Cooper-published CDS). Engineering applicants
 *   only — School of Art and Architecture are test-optional. This reflects
 *   the test-submitting cohort and is the best available external estimate.
 *
 *   Note on oosAR: Cooper Union is a private institution in NY; in-state/OOS
 *   distinction carries no policy meaning (no in-state tuition advantage).
 *   Per Phase 2 convention, private → UNAVAILABLE/TERMINAL.
 *
 *   Note on edAR: Existing provenance already had tier=NO_PUBLIC_ROUND_RATE/
 *   TERMINAL but had a stale numeric value (29) lingering. Cooper Union does
 *   publish per-school ED admit counts in occasional press releases (e.g. the
 *   2013-14 release) but no unified institution-level annual ED admit-rate
 *   data is published. Marked UNAVAILABLE/TERMINAL with value cleared.
 *
 *   Note on eaAR: Cooper Union offers only Early Decision and Regular Decision;
 *   no Early Action program exists. Field marked OFFICIAL_BLANK_SECTION/
 *   NOT_OFFERED.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CU_FACT_SHEET_URL =
  'https://cooper.edu/sites/default/files/uploads/assets/admissions/fact_sheet.pdf';
const CU_FIRST_YEAR_PROFILE_URL =
  'https://cooper.edu/admissions/facts/first-year-profile';
const BIGFUTURE_URL =
  'https://bigfuture.collegeboard.org/colleges/cooper-union-for-the-advancement-of-science-and-art/admissions';

const CYCLE_YEAR_FALL2025 = 2025;
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const cu = await prisma.school.findFirst({
    where: { name: { contains: 'Cooper Union' }, country: 'US' },
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
  if (!cu) throw new Error('Cooper Union not found');
  console.log(`Updating ${cu.name} (${cu.id})`);
  console.log(
    `  current AR=${cu.acceptanceRate?.toString()} sat25=${cu.sat25} sat75=${cu.sat75}`,
  );
  console.log(
    `  current intlAR=${cu.intlAcceptanceRate?.toString()} oosAR=${cu.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${cu.edAcceptanceRate?.toString()} eaAR=${cu.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const officialBase = {
    sourceUrl: CU_FACT_SHEET_URL,
    cycleYear: CYCLE_YEAR_FALL2025,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-cooper-union-validation',
  };

  const scrapedBase = {
    sourceUrl: BIGFUTURE_URL,
    cycleYear: CYCLE_YEAR_FALL2025,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 0.85,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-cooper-union-validation',
  };

  const terminalBase = {
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-cooper-union-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...officialBase,
      tier: 'OFFICIAL',
      source: 'OFFICIAL_FACT_SHEET',
      value: 11.0,
      policyLabel: 'Overall admit rate (institution-level)',
      reason:
        'Cooper Union official Fact Sheet 2025-26 (cooper.edu/admissions): "11% Acceptance Rate" for Fall 2025 entering class (based on total submitted Common Applications). Per-school: Architecture 4%, Art 8%, Engineering 16%. CORRECTION from prior LEGACY_DB_VALUE of 13%. Note: Cooper Union does not publish a Common Data Set; fact sheet is the authoritative source.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...scrapedBase,
      tier: 'SCRAPED',
      source: 'COLLEGE_BOARD_BIGFUTURE',
      value: 1400,
      policyLabel: 'SAT composite 25th percentile (test-submitting cohort)',
      reason:
        'College Board BigFuture reports Cooper Union SAT range 1400-1520 (derived from IPEDS / College Board partner data). Used as 25th-75th composite range. Cooper Union does not publish CDS C9 directly. SAT is required only for School of Engineering (Architecture and Art are test-optional). CORRECTION from prior SEED/HEURISTIC value 1380.',
      realDataStatus: 'SCRAPED_REAL',
    },
    sat75: {
      ...scrapedBase,
      tier: 'SCRAPED',
      source: 'COLLEGE_BOARD_BIGFUTURE',
      value: 1520,
      policyLabel: 'SAT composite 75th percentile (test-submitting cohort)',
      reason:
        'College Board BigFuture reports Cooper Union SAT range 1400-1520. Used as 75th percentile. Cooper Union does not publish CDS C9. SAT required only for engineering admits. CORRECTION from prior SEED/HEURISTIC value 1540.',
      realDataStatus: 'SCRAPED_REAL',
    },
    intlAcceptanceRate: {
      ...terminalBase,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      policyLabel: 'International admit rate',
      reason:
        'Cooper Union does not publish a Common Data Set or residency-segmented application/admit counts. Fact sheet reports U.S. Nonresidents = 12% of enrolled undergraduates but does not provide international applicant or admit counts. Prior DB heuristic value (5.2%) cleared. Field marked UNAVAILABLE-terminal.',
      realDataStatus: 'UNAVAILABLE',
    },
    oosAcceptanceRate: {
      ...terminalBase,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Cooper Union is a private institution in NY; in-state/out-of-state distinction carries no policy meaning (no in-state tuition advantage; uniform tuition $44,550 with 50% half-scholarship for all). Cooper Union does not publish residency-segmented admit data. Prior DB heuristic value (16.26%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...terminalBase,
      sourceUrl: CU_FIRST_YEAR_PROFILE_URL,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      policyLabel: 'Early Decision admit rate',
      reason:
        'Cooper Union offers Early Decision (Nov 1 for Engineering, Dec 1 for Art/Architecture) but does not publish a unified institution-level annual ED admit rate. Per-school ED counts appear only in occasional press releases (most recent traceable: 2013-14). Prior DB value of 29% is stale and not sourceable. Field marked UNAVAILABLE-terminal (no public round rate available).',
      realDataStatus: 'UNAVAILABLE',
    },
    eaAcceptanceRate: {
      ...terminalBase,
      sourceUrl: CU_FIRST_YEAR_PROFILE_URL,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      policyLabel: 'Early Action admit rate',
      reason:
        'Cooper Union does NOT offer Early Action. Admission rounds are limited to Early Decision (binding) and Regular Decision only, per official Cooper Union admissions pages. Field marked UNAVAILABLE-terminal (not offered).',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(cu.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: CU_FACT_SHEET_URL,
  };

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: cu.id },
    data: {
      acceptanceRate: new Prisma.Decimal('11.00'),
      sat25: 1400,
      sat75: 1520,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: null,
      hasEarlyDecision: true, // confirmed: Cooper Union offers ED
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=OFFICIAL, sat25/75=SCRAPED, intlAR=N/A, oosAR=N/A, edAR=N/A, eaAR=NOT_OFFERED)',
  );

  // verify
  const after = await prisma.school.findUnique({
    where: { id: cu.id },
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
    `  intlAR=${after?.intlAcceptanceRate?.toString() ?? 'null'} oosAR=${after?.oosAcceptanceRate?.toString() ?? 'null'}`,
  );
  console.log(
    `  edAR=${after?.edAcceptanceRate?.toString() ?? 'null'} eaAR=${after?.eaAcceptanceRate?.toString() ?? 'null'} hasED=${after?.hasEarlyDecision}`,
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
