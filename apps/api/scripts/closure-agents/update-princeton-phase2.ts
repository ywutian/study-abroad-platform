#!/usr/bin/env tsx
/**
 * Phase 2 — Princeton OFFICIAL-tier upgrade.
 *
 * Source: Princeton CDS 2025-2026 (manually parsed by Claude from PDF)
 *   URL: https://ir.princeton.edu/sites/g/files/toruqf2041/files/documents/CDS_2526_Princeton_v1.3.pdf
 *
 * Fields upgraded to OFFICIAL: acceptanceRate, sat25, sat75, intlAcceptanceRate
 * Fields upgraded to UNAVAILABLE-terminal: oosAcceptanceRate (Princeton is
 *   private; current DB value 5.48 is meaningless for prediction).
 *
 * Fields NOT touched (already closed):
 *   - edAcceptanceRate: tier=NOT_APPLICABLE (Princeton offers no ED — confirmed
 *     by CDS 2025-26 C21 = "No"). Existing provenance already cites CDS 25-26.
 *   - eaAcceptanceRate: tier=OFFICIAL/source=TERMINAL/NO_PUBLIC_ROUND_RATE.
 *     CDS 25-26 C22 confirms Restrictive EA exists but counts are not reported
 *     in CDS (the EA application/admit count rows are blank). Already counted
 *     as closed.
 *
 * Value corrections (Phase 2 source-of-truth vs. legacy DB):
 *   - acceptanceRate    4.5  -> 4.42 (1868 / 42303)
 *   - sat25            1510 -> 1500 (EBRW 25=740 + Math 25=760)
 *   - sat75            1570 -> 1580 (EBRW 75=780 + Math 75=800)
 *   - intlAcceptanceRate 2.11 -> 2.28 (241 / 10567)
 *   - oosAcceptanceRate 5.48 -> null (UNAVAILABLE-terminal, private school)
 */
import { PrismaClient } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const PRINCETON_CDS_URL =
  'https://ir.princeton.edu/sites/g/files/toruqf2041/files/documents/CDS_2526_Princeton_v1.3.pdf';
const CYCLE_YEAR = '2025-2026';
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const princeton = await prisma.school.findFirst({
    where: { name: { contains: 'Princeton' }, country: 'US' },
    select: {
      id: true,
      name: true,
      isPrivate: true,
      acceptanceRate: true,
      sat25: true,
      sat75: true,
      intlAcceptanceRate: true,
      oosAcceptanceRate: true,
      metadata: true,
    },
  });
  if (!princeton) throw new Error('Princeton not found');
  console.log(`Updating ${princeton.name} (${princeton.id})`);
  console.log(
    `  current AR=${princeton.acceptanceRate?.toString()} sat25=${princeton.sat25} sat75=${princeton.sat75} intlAR=${princeton.intlAcceptanceRate?.toString()} oosAR=${princeton.oosAcceptanceRate?.toString()}`,
  );

  const baseProv = {
    sourceUrl: PRINCETON_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase2-claude',
    generatedBy: 'phase2-princeton-cds-2526',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 4.42,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2025-26 Section C1: 1,868 admitted / 42,303 applicants = 4.42%. CORRECTION from prior 4.5.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1500,
      policyLabel: 'SAT composite 25th percentile (EBRW+Math sum)',
      reason:
        'CDS 2025-26 Section C9: SAT EBRW 25th=740, SAT Math 25th=760. Combined = 1500. CORRECTION from prior 1510.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1580,
      policyLabel: 'SAT composite 75th percentile (EBRW+Math sum)',
      reason:
        'CDS 2025-26 Section C9: SAT EBRW 75th=780, SAT Math 75th=800. Combined = 1580. CORRECTION from prior 1570.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 2.28,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2025-26 Section C1 residency table: 241 international admitted / 10,567 international applicants = 2.28%. CORRECTION from prior 2.11.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Princeton is private (CDS 2025-26 Section A2 = "Private (nonprofit)"); in-state/out-of-state distinction does not apply for admit-rate prediction. Field marked UNAVAILABLE-terminal. (CDS 2025-26 C1 does report an out-of-state breakdown — 1,398 admitted / 27,134 OOS applicants = 5.15% — but this is not a prediction signal for private schools.) Prior DB value 5.48 cleared.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    // edAcceptanceRate intentionally NOT updated — already tier=NOT_APPLICABLE
    // (CDS 25-26 C21 = "No" confirmed); existing provenance cites same source.
    // eaAcceptanceRate intentionally NOT updated — already tier=OFFICIAL/source=
    // TERMINAL/NO_PUBLIC_ROUND_RATE; CDS 25-26 C22 confirms Restrictive EA exists
    // but no admit-rate numbers are reported (counts blank).
  };

  const existingMeta = toRecord(princeton.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
  };

  // Bypass SchoolWriteService — schema drift on worktree blocks full-row writes.
  // Minimal Prisma update with explicit select (Harvard Phase 1 precedent).
  await prisma.school.update({
    where: { id: princeton.id },
    data: {
      acceptanceRate: 4.42, // 1868 / 42303
      sat25: 1500, // EBRW 25 + Math 25
      sat75: 1580, // EBRW 75 + Math 75
      intlAcceptanceRate: 2.28, // 241 / 10567
      oosAcceptanceRate: null, // private school -> N/A
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 5 fields (acceptanceRate, sat25, sat75, intlAR, oosAR=N/A)',
  );
  console.log(
    '  ⏭️  edAR not touched (already NOT_APPLICABLE - no ED program)',
  );
  console.log(
    '  ⏭️  eaAR not touched (already OFFICIAL/TERMINAL - REA counts withheld)',
  );

  const after = await prisma.school.findUnique({
    where: { id: princeton.id },
    select: {
      acceptanceRate: true,
      sat25: true,
      sat75: true,
      intlAcceptanceRate: true,
      oosAcceptanceRate: true,
      metadata: true,
    },
  });
  console.log('');
  console.log('=== After update ===');
  console.log(
    `  AR=${after?.acceptanceRate?.toString()} sat25=${after?.sat25} sat75=${after?.sat75} intlAR=${after?.intlAcceptanceRate?.toString()} oosAR=${after?.oosAcceptanceRate?.toString() ?? 'null'}`,
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
