#!/usr/bin/env tsx
/**
 * Phase 3 — Olin College of Engineering end-to-end closure of the 7 prediction-critical fields.
 *
 * Source: Olin CDS 2023-2024 (parsed by Claude from PDF — newer than DB's stored 2022-23)
 *   URL: https://www.olin.edu/sites/default/files/2024-05/CDS_2023_2024%20(2).pdf
 *
 * All 7 fields upgraded to OFFICIAL (or UNAVAILABLE-terminal where Olin
 * structurally cannot publish the value or does not offer the program).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 19.14  → 21.66  (CDS C1: 201/928 = 21.659%; CORRECTION from prior 19.14 sourced from 2022-23 CDS)
 *   - sat25             : 1380   → 1500   (CDS C9: SAT Composite 25th percentile; prior SEED/HEURISTIC value)
 *   - sat75             : 1540   → 1560   (CDS C9: SAT Composite 75th percentile; prior SEED/HEURISTIC value)
 *   - intlAcceptanceRate: 6.4    → 12.50  (CDS C1 residency: 21/168 = 12.500%; CORRECTION from prior INFERRED/PERMANENT_HEURISTIC 6.4)
 *   - oosAcceptanceRate : 12     → null   (private school; in-state/OOS distinction does not apply; CDS does report 157/599=26.21% but not actionable)
 *   - edAcceptanceRate  : null   → null   (Olin does NOT offer Early Decision — C21 Yes/No left blank + no ED data reported; hasEarlyDecision corrected to false)
 *   - eaAcceptanceRate  : null   → null   (Olin does NOT offer Early Action — C22 Yes/No left blank + no EA data reported)
 *
 *   Note on C8/C9: Olin's C8 reports "No" — SAT/ACT not used in admissions decisions
 *   (test-blind for admission). However, students may submit scores voluntarily for
 *   academic placement, and CDS C9 still reports percentiles for those who submitted
 *   (46% submitted SAT, n=45). Composite row 1500/1530/1560 is reported directly;
 *   we prefer Composite over EBRW (720+760=1480) + Math (770+790=1560) sum
 *   (composite quantiles ≠ section sums). Per Phase 2/3 convention: when Composite row
 *   exists, use it.
 *
 *   Note on oosAR: CDS C1 residency table DOES break down OOS counts (157 admitted /
 *   599 applicants = 26.21%), but for a private institution the in-state/OOS distinction
 *   carries no policy meaning (no in-state tuition advantage). Per Phase 2/3 convention,
 *   private → UNAVAILABLE/TERMINAL.
 *
 *   Note on ED/EA: Olin College of Engineering does NOT offer Early Decision or Early Action.
 *   The Yes/No dropdowns in C21 and C22 of the 2023-24 CDS are left blank (not "Yes"), and
 *   all ED/EA application/admission count cells are empty. This is consistent with Olin's
 *   public admissions policy (Regular Decision + Candidates' Weekend only). The prior DB
 *   had hasEarlyDecision=true with provenance citing the 2022-23 CDS — likely a misread of
 *   a similarly blank section. We correct hasEarlyDecision=false and mark both fields
 *   UNAVAILABLE-terminal/NOT_OFFERED.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const OLIN_CDS_URL =
  'https://www.olin.edu/sites/default/files/2024-05/CDS_2023_2024%20(2).pdf';
const CYCLE_YEAR = 2023; // CDS 2023-2024 = Fall 2023 entering class
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const olin = await prisma.school.findFirst({
    where: { name: { contains: 'Olin' }, country: 'US' },
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
  if (!olin) throw new Error('Olin not found');
  console.log(`Updating ${olin.name} (${olin.id})`);
  console.log(
    `  current AR=${olin.acceptanceRate?.toString()} sat25=${olin.sat25} sat75=${olin.sat75}`,
  );
  console.log(
    `  current intlAR=${olin.intlAcceptanceRate?.toString()} oosAR=${olin.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${olin.edAcceptanceRate?.toString() ?? 'null'} eaAR=${olin.eaAcceptanceRate?.toString() ?? 'null'} hasED=${olin.hasEarlyDecision}`,
  );

  const baseProv = {
    sourceUrl: OLIN_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-olin-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 21.66,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2023-24 Section C1: 201 admitted / 928 applicants = 21.659% (rounded to 21.66%). CORRECTION from prior 19.14% which was sourced from 2022-23 CDS.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1500,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2023-24 Section C9: SAT Composite 25th percentile = 1500 (reported directly). 46% of enrolled submitted SAT (n=45). CORRECTION from prior SEED/HEURISTIC value 1380.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1560,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2023-24 Section C9: SAT Composite 75th percentile = 1560 (reported directly; matches EBRW 770 + Math 790 sum). CORRECTION from prior SEED/HEURISTIC value 1540. Note: Olin C8 reports "No" — SAT not used in admissions decisions (test-blind for admission); scores are submitted voluntarily for placement.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 12.5,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2023-24 Section C1 residency table: 21 international admitted / 168 international applicants = 12.500%. CORRECTION from prior INFERRED/PERMANENT_HEURISTIC 6.4%.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Olin College of Engineering is a private institution; in-state/out-of-state distinction carries no policy meaning (no in-state tuition advantage). Although CDS 2023-24 C1 residency table does break down OOS counts (157 admitted / 599 applicants = 26.21%), the value is not actionable for applicants. Prior DB heuristic value (12) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2023-24 Section C21: Olin College of Engineering does NOT offer an Early Decision plan. The C21 Yes/No dropdown is left blank (not "Yes"), and all ED application/admission count cells are empty. This is consistent with Olin\'s public admissions policy (Regular Decision + Candidates\' Weekend only). Prior DB had hasEarlyDecision=true which is corrected to false. Field marked UNAVAILABLE-terminal (not offered).',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2023-24 Section C22: Olin College of Engineering does NOT offer a nonbinding Early Action plan. The C22 Yes/No dropdown is left blank (not "Yes"), and all EA application/admission count cells are empty. Field marked UNAVAILABLE-terminal (not offered).',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(olin.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: OLIN_CDS_URL,
  };

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: olin.id },
    data: {
      acceptanceRate: new Prisma.Decimal('21.66'),
      sat25: 1500,
      sat75: 1560,
      intlAcceptanceRate: new Prisma.Decimal('12.50'),
      oosAcceptanceRate: null,
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      hasEarlyDecision: false, // correction: Olin does not offer ED
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR, sat25, sat75, intlAR, oosAR=N/A, edAR=NOT_OFFERED, eaAR=NOT_OFFERED) + hasED=false',
  );

  // verify
  const after = await prisma.school.findUnique({
    where: { id: olin.id },
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
