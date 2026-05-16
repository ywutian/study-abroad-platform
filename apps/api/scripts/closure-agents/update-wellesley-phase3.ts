#!/usr/bin/env tsx
/**
 * Phase 3 — Wellesley College end-to-end closure of the 7 prediction-critical
 * fields.
 *
 * Source: Wellesley College CDS 2024-2025 (parsed by Claude from PDF)
 *   URL: https://wellesley-college.files.svdcdn.com/production/administrative-departments/OIR/CDS_2024-2025-FINAL-1.pdf?dm=1741971016
 *   (Full multi-section CDS published by Wellesley Office of Institutional
 *   Research at https://www.wellesley.edu/about-us/offices-departments/office-of-institutional-research/common-data-set)
 *
 * All 7 fields upgraded to OFFICIAL (or UNAVAILABLE-terminal where Wellesley
 * structurally cannot publish the value).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 13       → 14.05   (CDS C1 Total: 1,224 admits / 8,714
 *                          applicants = 14.046%. Rounded to 14.05. Tier
 *                          upgraded LEGACY_DB (sourceUrl pointed to
 *                          collegekickstart.com aggregator) → OFFICIAL.)
 *   - sat25             : 1380     → 1470   (CDS C9: SAT Composite 25th = 1470
 *                          reported directly; EBRW 730 + Math 730 sum = 1460
 *                          ≠ composite 25th since quantiles differ. CORRECTION
 *                          UP from prior 1380 (SEED/PR-15 heuristic).)
 *   - sat75             : 1540     → 1550   (CDS C9: SAT Composite 75th = 1550
 *                          reported directly; EBRW 770 + Math 790 sum = 1560
 *                          ≠ composite 75th. CORRECTION UP from prior 1540
 *                          (SEED/PR-15 heuristic).)
 *   - intlAcceptanceRate: 4.06     → 4.06    (CDS C1 residency: 121 intl admits /
 *                          2,980 intl applicants = 4.0604%. Value matches
 *                          prior DB; tier upgraded LEGACY_DB → OFFICIAL.)
 *   - oosAcceptanceRate : 19.25    → null    (Wellesley is a private LAC; in-
 *                          state / out-of-state distinction carries no policy
 *                          meaning. CDS C1 residency does report OOS (958/4977
 *                          = 19.25%) but per closure-pipeline convention,
 *                          private schools → UNAVAILABLE/TERMINAL. Prior legacy
 *                          DB value cleared.)
 *   - edAcceptanceRate  : 29.82    → 29.82   (CDS C21: ED offered ("Yes"
 *                          checked); two plans — ED I 11/1 closing, mid-Dec
 *                          notification; ED II 1/1 closing, mid-Feb
 *                          notification. Fall 2024 entering class combined
 *                          totals: 308 admits / 1,033 ED applications =
 *                          29.8161%. Value matches prior DB; provenance
 *                          refreshed to closure-pipeline-phase3 CDS_OFFICIAL
 *                          with current cycle metadata.)
 *   - eaAcceptanceRate  : null     → null    (CDS C22: Wellesley does NOT offer
 *                          a nonbinding Early Action plan ("No" checked, both
 *                          for EA plan and restrictive variant). Field stays
 *                          null and is upgraded to UNAVAILABLE/OFFICIAL_BLANK_
 *                          SECTION (NOT_OFFERED). Existing provenance had
 *                          tier=OFFICIAL source=CDS_LLM_EXTRACT_2026_04 with
 *                          value=undefined — semantics preserved, source
 *                          refreshed to authoritative CDS pull.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const WELLESLEY_CDS_URL =
  'https://wellesley-college.files.svdcdn.com/production/administrative-departments/OIR/CDS_2024-2025-FINAL-1.pdf?dm=1741971016';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const wellesley = await prisma.school.findFirst({
    where: { name: 'Wellesley College' },
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
  if (!wellesley) throw new Error('Wellesley College not found');
  console.log(`Updating ${wellesley.name} (${wellesley.id})`);
  console.log(
    `  current AR=${wellesley.acceptanceRate?.toString()} sat25=${wellesley.sat25} sat75=${wellesley.sat75}`,
  );
  console.log(
    `  current intlAR=${wellesley.intlAcceptanceRate?.toString()} oosAR=${wellesley.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${wellesley.edAcceptanceRate?.toString()} eaAR=${wellesley.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: WELLESLEY_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-wellesley-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 14.05,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 1,224 admits / 8,714 applicants = 14.0464% (rounded to 14.05%). Tier upgraded from LEGACY_DB (value 13, sourceUrl pointed to collegekickstart.com aggregator — not Wellesley) to OFFICIAL. CORRECTION UP +1.05pp.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1470,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1470 (reported directly; EBRW 730 + Math 730 sum = 1460 differs because composite quantiles ≠ section sums). CORRECTION UP from prior 1380 (SEED/PR-15 heuristic). 43% of Fall 2024 enrolled (248 students) submitted SAT under test-optional policy.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1550,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1550 (reported directly; EBRW 770 + Math 790 sum = 1560 differs because composite quantiles ≠ section sums). CORRECTION UP from prior 1540 (SEED/PR-15 heuristic).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 4.06,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 121 international admits / 2,980 international applicants = 4.0604% (rounded to 4.06%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Wellesley College is a private liberal arts college; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table does report OOS (958 admits / 4,977 applicants = 19.2486%), but the value is not actionable for applicants. Prior legacy DB value (19.25%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 29.82,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2024-25 Section C21: Wellesley offers Early Decision ("Yes" checked) with two plans — ED I closes 11/1 (mid-December notification), ED II closes 1/1 (mid-February notification). Fall 2024 entering class combined totals: 308 admits / 1,033 ED applications = 29.8161% (rounded to 29.82%). Value matches prior DB; provenance refreshed to closure-pipeline-phase3 CDS_OFFICIAL with current cycle metadata.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: Wellesley College does NOT offer a nonbinding Early Action plan ("No" checked for both EA plan and restrictive variant). DB value was already null; provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 (with value=undefined) to authoritative CDS_OFFICIAL pull marked UNAVAILABLE-terminal/NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(wellesley.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: WELLESLEY_CDS_URL,
  };

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: wellesley.id },
    data: {
      acceptanceRate: new Prisma.Decimal('14.05'),
      sat25: 1470,
      sat75: 1550,
      intlAcceptanceRate: new Prisma.Decimal('4.06'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('29.82'),
      eaAcceptanceRate: null, // CDS C22 "No" — Wellesley does not offer EA
      hasEarlyDecision: true, // re-confirm from CDS C21 "Yes"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=14.05, sat25=1470, sat75=1550, intlAR=4.06, oosAR=N/A, edAR=29.82, eaAR=NOT_OFFERED)',
  );

  // verify
  const after = await prisma.school.findUnique({
    where: { id: wellesley.id },
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
