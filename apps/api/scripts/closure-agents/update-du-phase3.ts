#!/usr/bin/env tsx
/**
 * Phase 3 — University of Denver (DU) end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: University of Denver CDS 2024-2025 (parsed by Claude from PDF)
 *   URL: https://www.du.edu/sites/default/files/2025-01/CDS_2024_2025_1.pdf
 *
 * NOTE: Prior DB had sourceUrl pointing to CU Denver
 * (ucdenver.edu/docs/librariesprovider192/...cds-24-25.pdf) — wrong
 * institution. This pass corrects every provenance row to the actual DU CDS.
 *
 * All 7 fields upgraded to OFFICIAL (or UNAVAILABLE-terminal where DU
 * structurally cannot publish the value, e.g. private school OOS, or CDS
 * blank fields).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 74.68 → 77.29 (CDS C1 totals: 14,519 admits /
 *                          18,785 applicants = 77.2877%. CORRECTION UP
 *                          +2.61pp. Prior LEGACY_DB value pointed to
 *                          CU Denver, not DU.)
 *   - sat25             : 1240  → 1210  (CDS C9 SAT Composite 25th = 1210
 *                          reported directly. Prior SEED/PR-15 heuristic.
 *                          CORRECTION DOWN -30. 24% of Fall 2024 enrolled
 *                          (323 students) submitted SAT under test-optional.)
 *   - sat75             : 1410  → 1380  (CDS C9 SAT Composite 75th = 1380
 *                          reported directly. CORRECTION DOWN -30 from
 *                          prior SEED/PR-15 heuristic.)
 *   - intlAcceptanceRate: 34.03 → 48.79 (CDS C1 residency: 424 intl admits /
 *                          869 intl applicants = 48.7917%. CORRECTION UP
 *                          +14.76pp. Prior LEGACY_DB value pointed to
 *                          CU Denver.)
 *   - oosAcceptanceRate : 81.27 → null  (DU is a private research university;
 *                          in-state / out-of-state distinction carries no
 *                          policy meaning. CDS C1 residency does report OOS
 *                          (9,840 / 12,075 = 81.49%), but per closure-pipeline
 *                          convention, private schools → UNAVAILABLE/TERMINAL.
 *                          Prior LEGACY_DB value (CU Denver) cleared.)
 *   - edAcceptanceRate  : 90.3  → 76.77 (CDS C21 Fall 2024 entering class:
 *                          238 admits / 310 ED applications = 76.7742%.
 *                          ED I (close 11/1, notify 12/15) + ED II
 *                          (close 1/15, notify 2/20) combined. CORRECTION
 *                          DOWN -13.53pp from prior LEGACY_DB.)
 *   - eaAcceptanceRate  : 60.0  → null  (CDS C22: DU offers nonbinding EA
 *                          ("Yes" checked; close 11/1, notify 1/15,
 *                          non-restrictive). However, CDS C22 template does
 *                          NOT collect EA application/admit counts — only
 *                          plan existence and dates. Prior LEGACY_DB value
 *                          (60.0%) had no source attestation. Field cleared
 *                          and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION:
 *                          plan exists but CDS does not publish numbers.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const DU_CDS_URL =
  'https://www.du.edu/sites/default/files/2025-01/CDS_2024_2025_1.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iud003yz0tinuqfaa54';

const prisma = new PrismaClient();

async function main() {
  const du = await prisma.school.findFirst({
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
  if (!du) throw new Error('University of Denver not found');
  console.log(`Updating ${du.name} (${du.id})`);
  console.log(
    `  current AR=${du.acceptanceRate?.toString()} sat25=${du.sat25} sat75=${du.sat75}`,
  );
  console.log(
    `  current intlAR=${du.intlAcceptanceRate?.toString()} oosAR=${du.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${du.edAcceptanceRate?.toString()} eaAR=${du.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: DU_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-batch17-claude',
    generatedBy: 'phase3-du-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 77.29,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 14,519 admits / 18,785 applicants = 77.2877% (rounded to 77.29%). Men 5,942/7,885; Women 8,577/10,900. Tier upgraded from LEGACY_DB (value 74.68, sourceUrl WRONGLY pointed to ucdenver.edu — CU Denver, not DU) to OFFICIAL. CORRECTION UP +2.61pp.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1210,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1210 reported directly (EBRW 610 + Math 580 = 1190; composite quantiles ≠ section sums). CORRECTION DOWN -30 from prior 1240 (SEED/PR-15 heuristic). 24% of Fall 2024 enrolled (323 students) submitted SAT under test-optional policy.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1380,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1380 reported directly (EBRW 700 + Math 690 = 1390; composite quantiles ≠ section sums). CORRECTION DOWN -30 from prior 1410 (SEED/PR-15 heuristic).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 48.79,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 424 international admits / 869 international applicants = 48.7917% (rounded to 48.79%). CORRECTION UP +14.76pp. Tier upgraded from LEGACY_DB (value 34.03, sourceUrl WRONGLY pointed to ucdenver.edu — CU Denver, not DU) to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'University of Denver is a private research university; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table does report OOS (9,840 admits / 12,075 applicants = 81.49%), but the value is not actionable for applicants. Prior LEGACY_DB value (81.27% — sourceUrl pointed to CU Denver) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 76.77,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2024-25 Section C21: DU offers Early Decision ("Yes" checked) with two plans — ED I closes 11/1 (12/15 notification), ED II closes 1/15 (2/20 notification). Fall 2024 entering class combined totals: 238 admits / 310 ED applications = 76.7742% (rounded to 76.77%). CORRECTION DOWN -13.53pp from prior LEGACY_DB (90.3%).',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: DU offers nonbinding Early Action ("Yes" checked; closing 11/1, notification 1/15; not restrictive). However, the CDS C22 template does NOT collect EA application/admit counts — only plan existence and dates. Prior LEGACY_DB value (60.0%) had no verifiable source attestation in the CDS. Field cleared and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION: plan exists but CDS does not publish admit numbers.',
      realDataStatus: 'NOT_PUBLISHED',
    },
  };

  const existingMeta = toRecord(du.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: DU_CDS_URL,
  };

  await prisma.school.update({
    where: { id: du.id },
    data: {
      acceptanceRate: new Prisma.Decimal('77.29'),
      sat25: 1210,
      sat75: 1380,
      intlAcceptanceRate: new Prisma.Decimal('48.79'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('76.77'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true, // confirmed CDS C21 "Yes"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=77.29, sat25=1210, sat75=1380, intlAR=48.79, oosAR=N/A, edAR=76.77, eaAR=BLANK_SECTION)',
  );

  const after = await prisma.school.findUnique({
    where: { id: du.id },
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
