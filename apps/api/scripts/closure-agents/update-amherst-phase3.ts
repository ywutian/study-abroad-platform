#!/usr/bin/env tsx
/**
 * Phase 3 — Amherst College end-to-end closure of the 7 prediction-critical
 * fields.
 *
 * Source: Amherst College CDS 2024-2025 Section C (parsed by Claude from PDF)
 *   URL: https://www.amherst.edu/system/files/C%20First-Time%2C%20First-Year%20Admission_3.pdf
 *   (6-page Section C only; Amherst publishes CDS as separate per-section PDFs.)
 *
 * All 7 fields upgraded to OFFICIAL (or UNAVAILABLE-terminal where Amherst
 * structurally cannot publish the value).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 9      → 9.01   (CDS C1: 1,238 admits / 13,743 applicants
 *                          = 9.0082%. Rounded to 9.01. Minor precision upgrade,
 *                          tier upgraded SEED→OFFICIAL.)
 *   - sat25             : 1460   → 1500   (CDS C9: SAT Composite 25th = 1500
 *                          reported directly. CORRECTION UP from prior 1460
 *                          (SEED/PR-15 heuristic). EBRW 740 + Math 750 sum = 1490
 *                          ≠ composite 25th since quantiles differ; per
 *                          Phase 2/3 convention, prefer reported Composite row.)
 *   - sat75             : 1570   → 1560   (CDS C9: SAT Composite 75th = 1560
 *                          reported directly. CORRECTION DOWN from prior 1570
 *                          (SEED/PR-15 heuristic). EBRW 780 + Math 800 sum = 1580
 *                          ≠ composite 75th; prefer reported Composite row.)
 *   - intlAcceptanceRate: 2.6    → 2.65   (CDS C1 residency: 150 intl admits /
 *                          5,664 intl applicants = 2.6483%. Minor precision
 *                          upgrade, tier LEGACY_DB→OFFICIAL.)
 *   - oosAcceptanceRate : 13.82  → null   (Amherst is a private LAC; in-state /
 *                          out-of-state distinction carries no policy meaning.
 *                          CDS C1 does report OOS (957/6,927 = 13.82%) but
 *                          per closure-pipeline convention, private schools →
 *                          UNAVAILABLE/TERMINAL. Prior legacy DB value cleared.)
 *   - edAcceptanceRate  : 29.39  → 29.39  (CDS C21: ED offered ("Yes"); 216
 *                          admits / 735 applications = 29.3878%. Value matches
 *                          prior DB. Provenance refreshed to closure-pipeline-
 *                          phase3 CDS_OFFICIAL with current cycle metadata.)
 *   - eaAcceptanceRate  : 61     → null   (CDS C22: Amherst does NOT offer EA
 *                          ("No" checked). Prior DB value 61 was stale/cross-
 *                          pollinated (provenance sourceUrl pointed to a UMass
 *                          Amherst aggregator page — not Amherst College). Field
 *                          cleared and marked UNAVAILABLE-terminal/NOT_OFFERED.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const AMHERST_CDS_URL =
  'https://www.amherst.edu/system/files/C%20First-Time%2C%20First-Year%20Admission_3.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const amherst = await prisma.school.findFirst({
    where: { name: 'Amherst College', country: 'US' },
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
  if (!amherst) throw new Error('Amherst College not found');
  console.log(`Updating ${amherst.name} (${amherst.id})`);
  console.log(
    `  current AR=${amherst.acceptanceRate?.toString()} sat25=${amherst.sat25} sat75=${amherst.sat75}`,
  );
  console.log(
    `  current intlAR=${amherst.intlAcceptanceRate?.toString()} oosAR=${amherst.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${amherst.edAcceptanceRate?.toString()} eaAR=${amherst.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: AMHERST_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-amherst-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 9.01,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 1,238 admits / 13,743 applicants = 9.0082% (rounded to 9.01%). Tier upgraded from LEGACY_DB (value 9) to OFFICIAL with minor precision adjustment.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1500,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1500 (reported directly; EBRW 740 + Math 750 sum = 1490 differs because composite quantiles ≠ section sums). CORRECTION UP from prior 1460 (SEED/PR-15 heuristic).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1560,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1560 (reported directly; LOWER than EBRW 780 + Math 800 = 1580 because composite quantiles ≠ section sums). CORRECTION DOWN from prior 1570 (SEED/PR-15 heuristic).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 2.65,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 150 international admits / 5,664 international applicants = 2.6483% (rounded to 2.65%). Tier upgraded from LEGACY_DB (value 2.6) to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Amherst College is a private liberal arts college; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table does report OOS (957 admits / 6,927 applicants = 13.82%), but the value is not actionable for applicants. Prior legacy DB value (13.82%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 29.39,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: Amherst offers Early Decision ("Yes" checked); deadline 11/1, notification 12/15. Fall 2024 entering class: 216 admits / 735 ED applications = 29.3878% (rounded to 29.39%). Value matches prior DB; provenance refreshed to closure-pipeline-phase3 CDS_OFFICIAL with current cycle metadata.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: Amherst College does NOT offer a nonbinding Early Action plan ("No" checked). Prior DB value 61 was stale/cross-pollinated — its provenance sourceUrl pointed to a UMass Amherst aggregator (collegetransitions.com), not Amherst College. Field cleared and marked UNAVAILABLE-terminal (not offered).',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(amherst.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: AMHERST_CDS_URL,
  };

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: amherst.id },
    data: {
      acceptanceRate: new Prisma.Decimal('9.01'),
      sat25: 1500,
      sat75: 1560,
      intlAcceptanceRate: new Prisma.Decimal('2.65'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('29.39'),
      eaAcceptanceRate: null, // CDS C22 "No" — clear stale 61
      hasEarlyDecision: true, // re-confirm from CDS C21 "Yes"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=9.01, sat25=1500, sat75=1560, intlAR=2.65, oosAR=N/A, edAR=29.39, eaAR=NOT_OFFERED)',
  );

  // verify
  const after = await prisma.school.findUnique({
    where: { id: amherst.id },
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
