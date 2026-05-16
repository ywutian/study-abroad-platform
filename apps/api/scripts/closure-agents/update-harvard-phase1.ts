#!/usr/bin/env tsx
/**
 * Phase 1 — Harvard end-to-end validation of the closure pipeline.
 *
 * Source: Harvard CDS 2024-2025 (manually parsed by Claude from PDF)
 *   URL: https://oira.harvard.edu/files/2025/06/HarvardUniversity_CDS_2024-2025.pdf
 *
 * Updates 6 of 7 prediction-critical fields with OFFICIAL or UNAVAILABLE
 * provenance. eaAcceptanceRate is left untouched (CDS confirms REA policy
 * but does not report admit rate numbers — Agent C fallback territory).
 *
 * Value changes:
 *   - sat25: 1480 → 1510 (CDS C9: SAT EBRW 25th=740 + Math 25th=770)
 *   All other field values unchanged; only provenance upgraded.
 */
import { PrismaClient } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const HARVARD_CDS_URL =
  'https://oira.harvard.edu/files/2025/06/HarvardUniversity_CDS_2024-2025.pdf';
const CYCLE_YEAR = '2024-2025';
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const harvard = await prisma.school.findFirst({
    where: { name: { contains: 'Harvard' }, country: 'US' },
    select: { id: true, name: true, sat25: true, sat75: true, metadata: true },
  });
  if (!harvard) throw new Error('Harvard not found');
  console.log(`Updating ${harvard.name} (${harvard.id})`);
  console.log(`  current sat25=${harvard.sat25} sat75=${harvard.sat75}`);

  const baseProv = {
    sourceUrl: HARVARD_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase1-claude',
    generatedBy: 'phase1-harvard-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 3.65,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 1,970 admitted / 54,008 applicants = 3.65%.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1510,
      policyLabel: 'SAT composite 25th percentile (EBRW+Math sum)',
      reason:
        'CDS 2024-25 Section C9: SAT EBRW 25th=740, SAT Math 25th=770. Combined = 1510. CORRECTION from prior 1480.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1580,
      policyLabel: 'SAT composite 75th percentile (EBRW+Math sum)',
      reason:
        'CDS 2024-25 Section C9: SAT EBRW 75th=780, SAT Math 75th=800. Combined = 1580.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1.94,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 325 international admitted / 16,760 international applicants = 1.94%.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Harvard is private; in-state/out-of-state distinction does not apply. Field marked UNAVAILABLE-terminal.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: Harvard does NOT offer an Early Decision plan ("No" checked). Field marked UNAVAILABLE-terminal.',
      realDataStatus: 'NOT_OFFERED',
    },
    // eaAcceptanceRate intentionally NOT updated here — CDS C22 confirms REA
    // policy exists but does NOT report admit rate numbers. Will be handled by
    // Agent C (Tavily fallback to Harvard press releases).
  };

  // Merge new provenance into existing metadata.provenance, preserving other
  // fields' provenance entries.
  const existingMeta = toRecord(harvard.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
  };

  // Bypass SchoolWriteService — its default Prisma update SELECTs all columns,
  // which fails because worktree schema.prisma is ahead of live DB (drift on
  // housingAvailable etc.). Use a minimal update with explicit select.
  await prisma.school.update({
    where: { id: harvard.id },
    data: {
      sat25: 1510, // value correction (was 1480)
      hasEarlyDecision: false, // confirmed from CDS C21
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 6 fields (acceptanceRate, sat25, sat75, intlAR, oosAR=N/A, edAR=N/A)',
  );
  console.log(
    '  ⏳ eaAcceptanceRate deferred to Agent C (REA numbers not in CDS)',
  );

  // verify
  const after = await prisma.school.findUnique({
    where: { id: harvard.id },
    select: {
      sat25: true,
      sat75: true,
      hasEarlyDecision: true,
      metadata: true,
    },
  });
  console.log('');
  console.log('=== After update ===');
  console.log(
    `  sat25=${after?.sat25} sat75=${after?.sat75} hasEarlyDecision=${after?.hasEarlyDecision}`,
  );
  const prov = (after?.metadata as any)?.provenance ?? {};
  for (const f of [
    'acceptanceRate',
    'sat25',
    'sat75',
    'intlAcceptanceRate',
    'oosAcceptanceRate',
    'edAcceptanceRate',
  ]) {
    const p = prov[f];
    console.log(
      `  ${f.padEnd(22)} tier=${p?.tier ?? 'NULL'}  source=${p?.source ?? 'NULL'}`,
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
