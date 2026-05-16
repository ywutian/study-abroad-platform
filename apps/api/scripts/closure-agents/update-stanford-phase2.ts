#!/usr/bin/env tsx
/**
 * Phase 2 — Stanford end-to-end closure of the 7 prediction-critical fields.
 *
 * Source: Stanford CDS 2025-2026 (manually parsed by Claude from PDF)
 *   IRDS index : https://irds.stanford.edu/data-findings/cds
 *   Drive file : https://drive.google.com/file/d/1GIPKgVj1d86dkmLkHI_mZVCk_iY6kiCp/view?usp=sharing
 *
 * All 7 fields upgraded to OFFICIAL (or UNAVAILABLE-terminal where Stanford
 * structurally cannot publish the value).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 3.91   → 3.80  (CDS C1: 2,302/60,646 = 3.797%)
 *   - sat25             : 1510   → 1520  (CDS C9: SAT Composite 25th percentile)
 *   - sat75             : 1570   → 1570  (unchanged; CDS C9 SAT Composite 75th)
 *   - intlAcceptanceRate: 1.48   → null  (CDS C1 residency table left blank by Stanford)
 *   - oosAcceptanceRate : 3.7    → null  (private; in-state/out-of-state N/A)
 *
 *   Note: sat25=1520 comes from the *Composite* row, not the sum of EBRW+Math
 *   25th percentiles (which would be 750+770=1520 — happens to match). We
 *   prefer the reported Composite row because Stanford treats it as authoritative.
 *   The 75th percentile Composite (1570) is LOWER than EBRW+Math sum (780+800=1580)
 *   because Stanford uses superscored composite quantiles, not section sums.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const STANFORD_CDS_DRIVE_URL =
  'https://drive.google.com/file/d/1GIPKgVj1d86dkmLkHI_mZVCk_iY6kiCp/view?usp=sharing';
const STANFORD_CDS_INDEX_URL = 'https://irds.stanford.edu/data-findings/cds';
const CYCLE_YEAR = '2025-2026';
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const stanford = await prisma.school.findFirst({
    where: { name: { contains: 'Stanford' }, country: 'US' },
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
  if (!stanford) throw new Error('Stanford not found');
  console.log(`Updating ${stanford.name} (${stanford.id})`);
  console.log(
    `  current AR=${stanford.acceptanceRate?.toString()} sat25=${stanford.sat25} sat75=${stanford.sat75}`,
  );
  console.log(
    `  current intlAR=${stanford.intlAcceptanceRate?.toString()} oosAR=${stanford.oosAcceptanceRate?.toString()}`,
  );

  const baseProv = {
    sourceUrl: STANFORD_CDS_DRIVE_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase2-claude',
    generatedBy: 'phase2-stanford-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 3.8,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2025-26 Section C1: 2,302 admitted / 60,646 applicants = 3.797% (rounded to 3.80%). CORRECTION from prior 3.91%.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1520,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2025-26 Section C9: SAT Composite 25th percentile = 1520 (reported directly; coincides with EBRW 750 + Math 770). CORRECTION from prior 1510.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1570,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2025-26 Section C9: SAT Composite 75th percentile = 1570 (reported directly; lower than EBRW 780 + Math 800 = 1580 because composite quantiles ≠ section sums).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2025-26 Section C1 residency breakdown: International and Unknown columns are blank — Stanford does not publish residency-segmented applicant/admit counts. Prior DB heuristic value (1.48%) cleared.',
      realDataStatus: 'OFFICIAL_BLANK_SECTION',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Stanford is a private institution; in-state/out-of-state distinction does not apply. Prior DB heuristic value (3.7%) cleared. Field marked UNAVAILABLE-terminal.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2025-26 Section C21: Stanford does NOT offer an Early Decision plan ("No" checked). Field marked UNAVAILABLE-terminal.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action / REA admit rate',
      reason:
        'CDS 2025-26 Section C22: Stanford offers Restrictive Early Action ("Yes" + restrictive=Yes) but the CDS does NOT publish REA applicant/admit counts (Fall 2025 numbers blank). Field marked UNAVAILABLE-terminal at the CDS layer; downstream Agent C may fill from press releases if Stanford publishes externally.',
      realDataStatus: 'OFFICIAL_BLANK_SECTION',
    },
  };

  const existingMeta = toRecord(stanford.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    // Pin the source we used for traceability.
    closureSourceIndex: STANFORD_CDS_INDEX_URL,
  };

  // Bypass SchoolWriteService (schema drift on housingAvailable etc.). Use a
  // minimal update with explicit select to avoid touching unrelated columns.
  await prisma.school.update({
    where: { id: stanford.id },
    data: {
      acceptanceRate: new Prisma.Decimal('3.8'),
      sat25: 1520,
      sat75: 1570,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      hasEarlyDecision: false, // re-confirm from CDS C21
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR, sat25, sat75, intlAR=BLANK, oosAR=N/A, edAR=NOT_OFFERED, eaAR=BLANK)',
  );

  // verify
  const after = await prisma.school.findUnique({
    where: { id: stanford.id },
    select: {
      acceptanceRate: true,
      sat25: true,
      sat75: true,
      intlAcceptanceRate: true,
      oosAcceptanceRate: true,
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
    `  intlAR=${after?.intlAcceptanceRate?.toString() ?? 'null'} oosAR=${after?.oosAcceptanceRate?.toString() ?? 'null'} hasED=${after?.hasEarlyDecision}`,
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
