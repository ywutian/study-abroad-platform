#!/usr/bin/env tsx
/**
 * Phase 3 — Case Western Reserve University end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Sources (CDS 2024-2025, parsed from official PDFs):
 *   Original: https://case.edu/ir/sites/default/files/2025-01/CWRU%202024%20-%2025%20CDS.pdf
 *   Adjusted: https://case.edu/ir/sites/default/files/2025-05/CWRU%202024%20-%2025%20CDS%20ADJ.pdf
 *   (Original had a data-entry artifact "8/14" in C21 admits cell; the May 2025
 *    adjusted version corrects it to 298. We use the adjusted figures.)
 *
 * Value changes vs. existing DB:
 *   - acceptanceRate    : 37.78  → 37.78  (CDS C1: 14,010 / 37,082 = 37.7758%.
 *                          Value matches; tier upgraded to OFFICIAL.)
 *   - sat25             : 1380   → 1450   (CDS C9 SAT Composite 25th = 1450.
 *                          CORRECTION UP +70.)
 *   - sat75             : 1510   → 1530   (CDS C9 SAT Composite 75th = 1530.
 *                          CORRECTION UP +20.)
 *   - intlAcceptanceRate: 22.93  → 22.93  (CDS C1 residency: 2,426 / 10,579 =
 *                          22.9322%. Value matches; tier upgraded to OFFICIAL.)
 *   - oosAcceptanceRate : 45.7   → null   (private LAC; OOS distinction not
 *                          policy-meaningful. UNAVAILABLE/TERMINAL.)
 *   - edAcceptanceRate  : 1      → 37.06  (CDS C21 adjusted: 298 admits / 804
 *                          apps = 37.0647%. Prior DB value (1) was clearly
 *                          wrong / placeholder. CORRECTION UP +36.06pp.)
 *   - eaAcceptanceRate  : 37     → null   (CDS C22 confirms EA offered (Yes),
 *                          closing 11/1, notification 12/21, non-restrictive.
 *                          But CDS C22 does NOT collect EA application/admit
 *                          counts. Prior DB value (37) had no CDS support.
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CWRU_CDS_URL =
  'https://case.edu/ir/sites/default/files/2025-05/CWRU%202024%20-%2025%20CDS%20ADJ.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const cwru = await prisma.school.findFirst({
    where: { id: 'cmnwr8ilz0002z0tiwrsmrdi7' },
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
  if (!cwru) throw new Error('Case Western Reserve not found');
  console.log(`Updating ${cwru.name} (${cwru.id})`);
  console.log(
    `  current AR=${cwru.acceptanceRate?.toString()} sat25=${cwru.sat25} sat75=${cwru.sat75}`,
  );
  console.log(
    `  current intlAR=${cwru.intlAcceptanceRate?.toString()} oosAR=${cwru.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${cwru.edAcceptanceRate?.toString()} eaAR=${cwru.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: CWRU_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-cwru-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 37.78,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 14,010 admits / 37,082 applicants = 37.7758% (rounded to 37.78%). Value matches prior DB; tier and provenance refreshed to OFFICIAL/CDS_OFFICIAL with current cycle metadata.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1450,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1450 (reported directly; EBRW 700 + Math 740 sum = 1440 differs because composite quantiles ≠ section sums). CORRECTION UP from prior 1380. 46% of enrollees (745 students) submitted SAT under test-optional policy.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1530,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1530 (reported directly; EBRW 760 + Math 790 sum = 1550 differs because composite quantiles ≠ section sums). CORRECTION UP from prior 1510.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 22.93,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 2,426 international admits / 10,579 international applicants = 22.9322% (rounded to 22.93%). Value matches prior DB; tier and provenance refreshed to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Case Western Reserve is a private research university (CDS A2: Private nonprofit checked). In-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency does report OOS (10,537 admits / 23,059 applicants = 45.6915%) but the value is not actionable for applicants. Prior legacy DB value (45.7%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 37.06,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21 (adjusted May 2025 publication): CWRU offers Early Decision ("Yes" checked) with one plan listed — closing 11/1, notification 12/5. Fall 2024 entering class: 298 admits / 804 ED applications = 37.0647% (rounded to 37.06%). Original January 2025 CDS contained a data-entry artifact ("8/14") in the admits cell; the May 2025 adjusted (ADJ) version corrects the value to 298, used here. CORRECTION UP from prior DB value 1.0 (placeholder/wrong).',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: CWRU offers nonbinding Early Action ("Yes" checked), closing 11/1, notification 12/21, non-restrictive ("No" to restrictive). However, CDS C22 collects only Yes/No + dates + restrictive flag — it does NOT collect EA application or admit counts. Therefore an authoritative EA admit rate cannot be derived from CDS. Prior DB value (37%) had no CDS provenance. Field cleared and marked UNAVAILABLE-terminal/OFFICIAL_BLANK_SECTION (plan offered but admit count not reportable from CDS).',
      realDataStatus: 'NOT_REPORTED',
    },
  };

  const existingMeta = toRecord(cwru.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: CWRU_CDS_URL,
  };

  await prisma.school.update({
    where: { id: cwru.id },
    data: {
      acceptanceRate: new Prisma.Decimal('37.78'),
      sat25: 1450,
      sat75: 1530,
      intlAcceptanceRate: new Prisma.Decimal('22.93'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('37.06'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=37.78, sat25=1450, sat75=1530, intlAR=22.93, oosAR=N/A, edAR=37.06, eaAR=NOT_REPORTED)',
  );

  // verify
  const after = await prisma.school.findUnique({
    where: { id: cwru.id },
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
