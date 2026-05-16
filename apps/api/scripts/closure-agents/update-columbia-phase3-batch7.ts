#!/usr/bin/env tsx
/**
 * Phase 3 — Columbia University end-to-end closure of the 7 prediction-critical
 * fields (batch 7).
 *
 * Source: Columbia University 2024-2025 CDS (Columbia College + Columbia
 *   Engineering combined), published by Columbia OPIR.
 *   URL: https://opir.columbia.edu/sites/opir.columbia.edu/files/content/
 *        Common%20Data%20Set/2024-25_Columbia_College_and_Columbia_Engineering_CDS.pdf
 *   Cycle: Fall 2024 entering class.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 3.85    → 3.86  (CDS C1: 2,325 admits / 60,247
 *                          applicants = 3.8591%, rounds to 3.86%. Prior 3.85
 *                          off by 0.01pp (rounding from collegekickstart
 *                          aggregator). Tier upgraded LEGACY_DB →
 *                          OFFICIAL. CORRECTION UP +0.01pp.)
 *   - sat25             : 1500    → 1510  (CDS C9: SAT Composite 25th = 1510
 *                          reported directly. EBRW 740 + Math 770 = 1510 also
 *                          coincides. CORRECTION UP +10 from prior 1500
 *                          (LEGACY_DB heuristic).)
 *   - sat75             : 1570    → 1560  (CDS C9: SAT Composite 75th = 1560
 *                          reported directly. EBRW 780 + Math 800 = 1580
 *                          differs (composite quantiles ≠ section sums).
 *                          CORRECTION DOWN -10 from prior 1570 (LEGACY_DB).)
 *   - intlAcceptanceRate: 2.46    → 2.46  (CDS C1 residency: 359 intl admits
 *                          / 14,593 intl applicants = 2.4601%. Value matches
 *                          prior DB; tier upgraded LEGACY_DB → OFFICIAL.)
 *   - oosAcceptanceRate : 4.44    → null  (Columbia is a private Ivy; in-
 *                          state / out-of-state distinction has no policy
 *                          meaning. CDS C1 residency does report OOS (1,620
 *                          admits / 36,521 applicants = 4.4357%) but per
 *                          closure-pipeline convention, private schools →
 *                          UNAVAILABLE/TERMINAL. Prior legacy DB value cleared.)
 *   - edAcceptanceRate  : 13.23   → 13.24 (CDS C21: Columbia offers ED ("Yes"
 *                          checked). Single ED plan: 11/1 closing, 12/15
 *                          notification. Fall 2024: 795 admits / 6,007 ED
 *                          applications = 13.2346%, rounds to 13.23%. Prior
 *                          DB 13.23 matches. Tier upgraded LEGACY_DB →
 *                          OFFICIAL with full cycle metadata.)
 *   - eaAcceptanceRate  : null    → null  (CDS C22: Columbia does NOT offer
 *                          a nonbinding EA plan ("No" checked). Field stays
 *                          null; provenance refreshed to UNAVAILABLE /
 *                          OFFICIAL_BLANK_SECTION (NOT_OFFERED).)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const COLUMBIA_CDS_URL =
  'https://opir.columbia.edu/sites/opir.columbia.edu/files/content/Common%20Data%20Set/2024-25_Columbia_College_and_Columbia_Engineering_CDS.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const columbia = await prisma.school.findFirst({
    where: { id: 'cmn1htkno000bvqf209819ok4' },
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
  if (!columbia) throw new Error('Columbia University not found');
  if (columbia.name !== 'Columbia University')
    throw new Error(`Unexpected school name: ${columbia.name}`);
  console.log(`Updating ${columbia.name} (${columbia.id})`);
  console.log(
    `  current AR=${columbia.acceptanceRate?.toString()} sat25=${columbia.sat25} sat75=${columbia.sat75}`,
  );
  console.log(
    `  current intlAR=${columbia.intlAcceptanceRate?.toString()} oosAR=${columbia.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${columbia.edAcceptanceRate?.toString()} eaAR=${columbia.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: COLUMBIA_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-columbia-validation-batch7',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 3.86,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: total first-time, first-year degree-seeking applicants 60,247 → 2,325 admits = 3.8591% (rounded to 3.86%). Prior 3.85 was off by 0.01pp from collegekickstart.com aggregator. Tier upgraded LEGACY_DB → OFFICIAL with primary OPIR PDF source.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1510,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1510 reported directly (EBRW 740 + Math 770 = 1510 coincides). 44% (653) of Fall 2024 enrolled submitted SAT under test-optional policy (Fall 2026 policy: not required for admission, considered if submitted). CORRECTION UP +10 from prior 1500 (LEGACY_DB heuristic).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1560,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1560 reported directly (EBRW 780 + Math 800 = 1580 differs because composite quantiles ≠ section sums; per convention prefer reported Composite row). CORRECTION DOWN -10 from prior 1570 (LEGACY_DB heuristic).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 2.46,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 359 international admits / 14,593 international applicants = 2.4601% (rounded to 2.46%). Value matches prior DB; tier upgraded LEGACY_DB → OFFICIAL with refreshed provenance from primary OPIR PDF.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Columbia University is a private Ivy League research university; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table does report OOS (1,620 admits / 36,521 applicants = 4.4357%), but the value is not actionable for applicants. Prior legacy DB value (4.44%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 13.23,
      policyLabel: 'Early Decision admit rate (single ED plan)',
      reason:
        'CDS 2024-25 Section C21: Columbia offers Early Decision ("Yes" checked). Single ED plan: closing date November 1, notification date December 15 (no ED II). Fall 2024 entering class: 795 admits / 6,007 ED applications = 13.2346% (rounded to 13.23%). Value matches prior DB; tier upgraded LEGACY_DB → OFFICIAL with full cycle metadata.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: Columbia University does NOT offer a nonbinding Early Action plan ("No" checked for EA plan). Columbia\'s only early-application option is binding Early Decision. DB value was already null; provenance refreshed to authoritative CDS UNAVAILABLE / OFFICIAL_BLANK_SECTION (NOT_OFFERED).',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(columbia.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: COLUMBIA_CDS_URL,
  };

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: columbia.id },
    data: {
      acceptanceRate: new Prisma.Decimal('3.86'),
      sat25: 1510,
      sat75: 1560,
      intlAcceptanceRate: new Prisma.Decimal('2.46'),
      oosAcceptanceRate: null, // private Ivy — N/A per convention
      edAcceptanceRate: new Prisma.Decimal('13.23'),
      eaAcceptanceRate: null, // CDS C22 "No" — Columbia does not offer EA
      hasEarlyDecision: true, // re-confirm from CDS C21 "Yes"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=3.86, sat25=1510, sat75=1560, intlAR=2.46, oosAR=N/A, edAR=13.23, eaAR=NOT_OFFERED)',
  );

  // verify
  const after = await prisma.school.findUnique({
    where: { id: columbia.id },
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
