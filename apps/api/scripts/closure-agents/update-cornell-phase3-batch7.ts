#!/usr/bin/env tsx
/**
 * Phase 3 — Cornell University end-to-end closure of the 7 prediction-critical
 * fields (batch 7).
 *
 * Source: Cornell University 2024-2025 CDS published by Cornell IRP.
 *   URL: https://irp.dpb.cornell.edu/wp-content/uploads/2025/07/CDS-2024-2025-v6-print.pdf
 *   Cycle: Fall 2024 entering class.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 8.41    → 8.41  (CDS C1: total applied = 65,612
 *                          (33,387 men + 32,195 women + 30 another); admits =
 *                          5,516 (2,529 men + 2,987 women + 0 another) =
 *                          8.4070% (rounds to 8.41%). Value matches prior
 *                          DB; tier upgraded LEGACY_DB → OFFICIAL.)
 *   - sat25             : 1470    → 1510  (CDS C9: SAT Composite 25th = 1510
 *                          reported directly (EBRW 730 + Math 770 = 1500
 *                          differs; composite quantiles ≠ section sums; per
 *                          convention prefer reported Composite row).
 *                          CORRECTION UP +40 from prior 1470 (LEGACY_DB
 *                          heuristic).)
 *   - sat75             : 1560    → 1560  (CDS C9: SAT Composite 75th = 1560
 *                          reported directly (EBRW 770 + Math 800 = 1570
 *                          differs; per convention prefer reported Composite
 *                          row). Value matches prior DB; tier upgraded
 *                          LEGACY_DB → OFFICIAL.)
 *   - intlAcceptanceRate: 3.49    → 3.49  (CDS C1 residency: 588 intl admits
 *                          / 16,858 intl applicants = 3.4880% (rounds to
 *                          3.49%). Value matches prior DB; tier upgraded
 *                          LEGACY_DB → OFFICIAL.)
 *   - oosAcceptanceRate : 9.11    → null  (Cornell is a private Ivy League
 *                          research university with some statutory contract
 *                          colleges, but Cornell does NOT charge differential
 *                          in-state vs out-of-state tuition for undergrad
 *                          (NY-state residents qualify for state tuition
 *                          subsidies at the four contract colleges, but the
 *                          published admission rate aggregates all schools).
 *                          CDS C1 residency does report OOS (3,372 admits /
 *                          37,032 applicants = 9.1056%), but the value is
 *                          not actionable as an in-state-tuition signal for
 *                          most applicants. Per closure-pipeline convention,
 *                          private schools → UNAVAILABLE/TERMINAL. Prior
 *                          legacy DB value cleared.)
 *   - edAcceptanceRate  : 11.64   → 11.64 (CDS C21: Cornell offers ED ("Yes"
 *                          checked). Single ED plan: 11/1 closing, 12/15
 *                          notification (no ED II). Fall 2024: 1,161 admits
 *                          / 9,973 ED applications = 11.6414% (rounds to
 *                          11.64%). Value matches prior DB; tier upgraded
 *                          LEGACY_DB → OFFICIAL.)
 *   - eaAcceptanceRate  : null    → null  (CDS C22: Cornell does NOT offer
 *                          a nonbinding EA plan ("No" checked, not restrictive).
 *                          Field stays null; provenance refreshed to
 *                          UNAVAILABLE / OFFICIAL_BLANK_SECTION (NOT_OFFERED).)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CORNELL_CDS_URL =
  'https://irp.dpb.cornell.edu/wp-content/uploads/2025/07/CDS-2024-2025-v6-print.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const cornell = await prisma.school.findFirst({
    where: { id: 'cmn1htknq000cvqf2sogobdg1' },
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
  if (!cornell) throw new Error('Cornell University not found');
  if (cornell.name !== 'Cornell University')
    throw new Error(`Unexpected school name: ${cornell.name}`);
  console.log(`Updating ${cornell.name} (${cornell.id})`);
  console.log(
    `  current AR=${cornell.acceptanceRate?.toString()} sat25=${cornell.sat25} sat75=${cornell.sat75}`,
  );
  console.log(
    `  current intlAR=${cornell.intlAcceptanceRate?.toString()} oosAR=${cornell.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${cornell.edAcceptanceRate?.toString()} eaAR=${cornell.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: CORNELL_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-cornell-validation-batch7',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 8.41,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: total first-time, first-year applicants 65,612 (33,387 men + 32,195 women + 30 another gender) → 5,516 admits (2,529 men + 2,987 women + 0 another) = 8.4070% (rounded to 8.41%). Value matches prior DB; tier upgraded LEGACY_DB → OFFICIAL with primary IRP PDF source.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1510,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1510 reported directly (EBRW 730 + Math 770 = 1500 differs; composite quantiles ≠ section sums; per convention prefer reported Composite row). 44.90% (1,583) of Fall 2024 enrolled submitted SAT. CORRECTION UP +40 from prior 1470 (LEGACY_DB heuristic).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1560,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1560 reported directly (EBRW 770 + Math 800 = 1570 differs; per convention prefer reported Composite row). Value matches prior DB; tier upgraded LEGACY_DB → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 3.49,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 588 international admits / 16,858 international applicants = 3.4880% (rounded to 3.49%). Value matches prior DB; tier upgraded LEGACY_DB → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Cornell University is a private Ivy League research university. Although Cornell hosts four NY-state contract colleges (CALS, ILR, Human Ecology, AAP-formerly-statutory) where NY residents receive a state tuition subsidy, the CDS-reported admit rate aggregates all colleges, so the OOS distinction is not actionable as a uniform in-state-tuition signal for applicants. CDS C1 residency table does report OOS (3,372 admits / 37,032 applicants = 9.1056%), but per closure-pipeline convention private institutions → UNAVAILABLE/TERMINAL. Prior legacy DB value (9.11%) cleared.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 11.64,
      policyLabel: 'Early Decision admit rate (single ED plan)',
      reason:
        'CDS 2024-25 Section C21: Cornell offers Early Decision ("Yes" checked). Single ED plan: closing date November 1, notification date December 15 (no ED II — only "first or only" plan fields filled). Fall 2024 entering class: 1,161 admits / 9,973 ED applications = 11.6414% (rounded to 11.64%). Value matches prior DB; tier upgraded LEGACY_DB → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: Cornell University does NOT offer a nonbinding Early Action plan ("No" checked; restrictive plan also "No"). Cornell\'s only early-application option is binding Early Decision. DB value was already null; provenance refreshed to authoritative CDS UNAVAILABLE / OFFICIAL_BLANK_SECTION (NOT_OFFERED).',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(cornell.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: CORNELL_CDS_URL,
  };

  await prisma.school.update({
    where: { id: cornell.id },
    data: {
      acceptanceRate: new Prisma.Decimal('8.41'),
      sat25: 1510,
      sat75: 1560,
      intlAcceptanceRate: new Prisma.Decimal('3.49'),
      oosAcceptanceRate: null, // private Ivy — N/A per convention
      edAcceptanceRate: new Prisma.Decimal('11.64'),
      eaAcceptanceRate: null, // CDS C22 "No" — Cornell does not offer EA
      hasEarlyDecision: true, // re-confirm from CDS C21 "Yes"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=8.41, sat25=1510, sat75=1560, intlAR=3.49, oosAR=N/A, edAR=11.64, eaAR=NOT_OFFERED)',
  );

  const after = await prisma.school.findUnique({
    where: { id: cornell.id },
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
