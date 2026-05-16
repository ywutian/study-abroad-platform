#!/usr/bin/env tsx
/**
 * Phase 3 — Northeastern University end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: Northeastern University CDS 2024-2025
 *   URL: http://uds.northeastern.edu/wp-content/uploads/2026/03/CDS-2024-25.pdf
 *
 * Value changes vs. existing DB:
 *   - acceptanceRate    : 5      → 5.22   (CDS C1: 5,133 / 98,425 = 5.2152%.
 *                          Refines prior placeholder 5; tier upgraded to
 *                          OFFICIAL. CORRECTION UP +0.22pp.)
 *   - sat25             : 1420   → 1450   (CDS C9 SAT Composite 25th = 1450.
 *                          CORRECTION UP +30.)
 *   - sat75             : 1530   → 1520   (CDS C9 SAT Composite 75th = 1520.
 *                          CORRECTION DOWN -10.)
 *   - intlAcceptanceRate: 3.81   → 3.81   (CDS C1 residency: 671/17,616 =
 *                          3.8090%. Value matches; tier upgraded OFFICIAL.)
 *   - oosAcceptanceRate : 4.56   → null   (private; UNAVAILABLE/TERMINAL.)
 *   - edAcceptanceRate  : 43.05  → 43.05  (CDS C21: ED I + ED II combined.
 *                          1,492 admits / 3,466 ED apps = 43.0467%. Value
 *                          matches; tier upgraded to OFFICIAL.)
 *   - eaAcceptanceRate  : null   → null   (CDS C22: EA offered ("Yes"),
 *                          non-restrictive, 11/1 closing, 2/15 notification.
 *                          But CDS C22 does NOT collect EA application/admit
 *                          counts. Refresh provenance.
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const NEU_CDS_URL =
  'http://uds.northeastern.edu/wp-content/uploads/2026/03/CDS-2024-25.pdf';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const neu = await prisma.school.findFirst({
    where: { id: 'cmnwr8im30004z0tip77mx1gm' },
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
  if (!neu) throw new Error('Northeastern University not found');
  console.log(`Updating ${neu.name} (${neu.id})`);
  console.log(
    `  current AR=${neu.acceptanceRate?.toString()} sat25=${neu.sat25} sat75=${neu.sat75}`,
  );
  console.log(
    `  current intlAR=${neu.intlAcceptanceRate?.toString()} oosAR=${neu.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${neu.edAcceptanceRate?.toString()} eaAR=${neu.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: NEU_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-northeastern-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 5.22,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 5,133 admits / 98,425 applicants = 5.2152% (rounded to 5.22%). Refines prior DB placeholder value 5. Tier upgraded from LEGACY_DB to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1450,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1450 (reported directly; EBRW 710 + Math 730 sum = 1440 differs because composite quantiles ≠ section sums). CORRECTION UP from prior 1420. 24% of enrollees (653 students) submitted SAT under test-optional policy.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1520,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1520 (reported directly; EBRW 760 + Math 780 sum = 1540 differs because composite quantiles ≠ section sums). CORRECTION DOWN from prior 1530.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 3.81,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 671 international admits / 17,616 international applicants = 3.8090% (rounded to 3.81%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Northeastern University is a private research university (CDS A2: Private nonprofit checked). In-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency does report OOS (3,076 admits / 67,424 applicants = 4.5621%) but the value is not actionable for applicants. Prior legacy DB value (4.56%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 43.05,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2024-25 Section C21: Northeastern offers Early Decision ("Yes" checked) with two plans — ED I closes 11/1 (1/1 notification), ED II closes 1/1 (3/1 notification). Fall 2024 entering class combined totals: 1,492 admits / 3,466 ED applications = 43.0467% (rounded to 43.05%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with refreshed cycle metadata.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: Northeastern offers nonbinding Early Action ("Yes" checked), closing 11/1, notification 2/15, non-restrictive ("No" to restrictive). However, CDS C22 collects only Yes/No + dates + restrictive flag — it does NOT collect EA application or admit counts. Therefore an authoritative EA admit rate cannot be derived from CDS. Field stays null and marked UNAVAILABLE-terminal/OFFICIAL_BLANK_SECTION (plan offered but admit count not reportable from CDS). Provenance refreshed with current cycle metadata.',
      realDataStatus: 'NOT_REPORTED',
    },
  };

  const existingMeta = toRecord(neu.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: NEU_CDS_URL,
  };

  await prisma.school.update({
    where: { id: neu.id },
    data: {
      acceptanceRate: new Prisma.Decimal('5.22'),
      sat25: 1450,
      sat75: 1520,
      intlAcceptanceRate: new Prisma.Decimal('3.81'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('43.05'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=5.22, sat25=1450, sat75=1520, intlAR=3.81, oosAR=N/A, edAR=43.05, eaAR=NOT_REPORTED)',
  );

  const after = await prisma.school.findUnique({
    where: { id: neu.id },
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
