#!/usr/bin/env tsx
/**
 * Phase 2 — MIT end-to-end closure of the 7 prediction-critical fields.
 *
 * Source: MIT CDS 2024-2025 (HTML, parsed by Claude via WebFetch)
 *   URL: https://ir.mit.edu/projects/2024-25-common-data-set/
 *
 * Supplemental source for EA (CDS C22 has no numbers):
 *   MIT EA press release for Class of 2028
 *   URL: https://mitadmissions.org/blogs/entry/mit-early-action-decisions-now-available-online-5/
 *
 * Notes on MIT's CDS quirks:
 *   - MIT publishes CDS as a single HTML page on its IR site — there is no PDF.
 *   - C1 residency breakdown table is structurally PRESENT but every cell
 *     is BLANK (same in 2023-24 CDS). MIT does not officially publish
 *     intl applicants/admits via CDS, so intlAcceptanceRate cannot be
 *     OFFICIAL — marked UNAVAILABLE (OFFICIAL_BLANK_SECTION).
 *   - C21 explicitly checks "No" for Early Decision → UNAVAILABLE / NOT_OFFERED.
 *   - C22 EA plan exists (dates given) but CDS lists no applicant/admit counts.
 *     Numbers come from MIT's own press release (treated as OFFICIAL: same
 *     publisher, same cycle, signed-off public stats).
 *
 * Value changes vs. existing DB:
 *   - acceptanceRate: 4.55 → unchanged (CDS confirms 1,284 / 28,232 = 4.547%)
 *   - sat25: 1530 → 1520 (CDS C9: EBRW 25th=740 + Math 25th=780 = 1520).
 *     Prior value 1530 was off by 10 (likely transposed Math 25th=790).
 *   - sat75: 1580 → unchanged (CDS C9: EBRW 75th=780 + Math 75th=800 = 1580)
 *   - intlAcceptanceRate: 1.96 → DB value left numerically, but provenance
 *     downgraded to UNAVAILABLE because MIT CDS leaves residency blank.
 *     Numeric column is kept (historic value) but tier flags it not-real.
 *   - oosAcceptanceRate: 4.55 → unchanged numerically; tier UNAVAILABLE
 *     (MIT is private; in-state/out-of-state distinction N/A).
 *   - edAcceptanceRate: undefined → unchanged; tier UNAVAILABLE / NOT_OFFERED
 *   - eaAcceptanceRate: 5.98 → 5.26 (661 / 12,563 from MIT EA press release)
 */
import { PrismaClient } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const MIT_CDS_URL = 'https://ir.mit.edu/projects/2024-25-common-data-set/';
const MIT_EA_RELEASE_URL =
  'https://mitadmissions.org/blogs/entry/mit-early-action-decisions-now-available-online-5/';
const CYCLE_YEAR = '2024-2025';
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const mit = await prisma.school.findFirst({
    where: {
      name: { contains: 'Massachusetts Institute of Technology' },
      country: 'US',
    },
    select: {
      id: true,
      name: true,
      sat25: true,
      sat75: true,
      eaAcceptanceRate: true,
      metadata: true,
    },
  });
  if (!mit) throw new Error('MIT not found');
  console.log(`Updating ${mit.name} (${mit.id})`);
  console.log(
    `  current sat25=${mit.sat25} sat75=${mit.sat75} eaAR=${mit.eaAcceptanceRate?.toString()}`,
  );

  const baseProv = {
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase2-claude',
    generatedBy: 'phase2-mit-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      sourceUrl: MIT_CDS_URL,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 4.55,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 1,284 admitted / 28,232 applicants = 4.547% (rounded to 4.55%).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      sourceUrl: MIT_CDS_URL,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1520,
      policyLabel: 'SAT composite 25th percentile (EBRW+Math sum)',
      reason:
        'CDS 2024-25 Section C9: SAT EBRW 25th=740, SAT Math 25th=780. Combined = 1520. CORRECTION from prior 1530.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      sourceUrl: MIT_CDS_URL,
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
      sourceUrl: MIT_CDS_URL,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table is present but every cell is BLANK (same pattern in 2023-24 CDS). MIT does not publish residency-split admit data via CDS. Numeric column retains prior value but tier flags it as unavailable from official CDS.',
      realDataStatus: 'UNVERIFIED',
    },
    oosAcceptanceRate: {
      ...baseProv,
      sourceUrl: MIT_CDS_URL,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      policyLabel: 'Out-of-state admit rate',
      reason:
        'MIT is private; in-state/out-of-state distinction does not apply. Field marked UNAVAILABLE-terminal.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      sourceUrl: MIT_CDS_URL,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: MIT does NOT offer an Early Decision plan ("No" checked). Field marked UNAVAILABLE-terminal.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      sourceUrl: MIT_EA_RELEASE_URL,
      tier: 'OFFICIAL',
      source: 'OFFICIAL_PRESS_RELEASE',
      value: 5.26,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22 confirms MIT offers EA (Nov 1 deadline, non-restrictive) but lists no applicant/admit counts. Numbers from MIT Admissions official EA decision press release for Class of 2028: 661 admitted / 12,563 applicants = 5.26%. CORRECTION from prior 5.98.',
      realDataStatus: 'VERIFIED_REAL',
    },
  };

  const existingMeta = toRecord(mit.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
  };

  // Bypass SchoolWriteService (schema drift on housingAvailable etc.). Use a
  // minimal update with explicit select.
  await prisma.school.update({
    where: { id: mit.id },
    data: {
      sat25: 1520, // value correction (was 1530)
      eaAcceptanceRate: 5.26, // value correction (was 5.98)
      hasEarlyDecision: false, // confirmed from CDS C21
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  updated 7 fields (acceptanceRate, sat25, sat75, intlAR=blank, oosAR=N/A, edAR=N/A, eaAR)',
  );

  // verify
  const after = await prisma.school.findUnique({
    where: { id: mit.id },
    select: {
      sat25: true,
      sat75: true,
      eaAcceptanceRate: true,
      hasEarlyDecision: true,
      metadata: true,
    },
  });
  console.log('');
  console.log('=== After update ===');
  console.log(
    `  sat25=${after?.sat25} sat75=${after?.sat75} eaAR=${after?.eaAcceptanceRate?.toString()} hasEarlyDecision=${after?.hasEarlyDecision}`,
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
