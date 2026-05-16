#!/usr/bin/env tsx
/**
 * Phase 3 — University of Toledo closure of OPEN prediction-critical fields.
 *
 * Source: U Toledo Common Data Set 2024-2025 (Fall 2024 entering class),
 *   published by Office of Institutional Research.
 *   PDF: https://www.utoledo.edu/offices/institutional-research/report-library/common-data-set/docs/cds-2024-2025.pdf
 *
 * U Toledo is a PUBLIC research university (Ohio).
 *
 * Closure rule: DO NOT override fields already closed (OFFICIAL/PARTNER/
 *   UNAVAILABLE/SCRAPED). Already closed at OFFICIAL: sat25, sat75, edAR, eaAR.
 *   Touch only open fields (currently VERIFIED_REAL): AR, intlAR, oosAR.
 *
 * CDS 2024-25 Section C1 (Fall 2024 entering class) — confirmed values:
 *   - Total applied: 11,067 | admitted: 10,184 → AR = 92.02% (rounds; matches DB)
 *   - OOS applied: 2,759 | OOS admitted: 2,602 → oosAR = 94.31% (matches DB)
 *   - Intl applied: 1,666 | Intl admitted: 1,183 → intlAR = 71.01% (matches DB)
 *
 * Values match prior DB — only tier upgrade VERIFIED_REAL/LEGACY_DB_VALUE -> OFFICIAL/CDS_OFFICIAL
 * with proper cycleYear and CDS URL re-anchored.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.utoledo.edu/offices/institutional-research/report-library/common-data-set/docs/cds-2024-2025.pdf';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8is80031z0tizosa0sa8';

const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findUnique({
    where: { id: SCHOOL_ID },
    select: { id: true, name: true, metadata: true },
  });
  if (!school) throw new Error(`School ${SCHOOL_ID} (U Toledo) not found`);
  console.log(`Updating ${school.name} (${school.id})`);

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-batch26-claude',
    generatedBy: 'phase3-utoledo-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 92.02,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 11,067 first-time, first-year applicants and 10,184 admits = 92.02% (10184/11067 = 0.92021). Re-anchored from VERIFIED_REAL/LEGACY_DB_VALUE to OFFICIAL/CDS_OFFICIAL with U Toledo official CDS PDF. No value change.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 71.01,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 1,666 international applicants, 1,183 international admits = 71.01% (1183/1666 = 0.71008). Re-anchored from VERIFIED_REAL/LEGACY_DB_VALUE to OFFICIAL/CDS_OFFICIAL. No value change.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 94.31,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 2,759 OOS applicants, 2,602 OOS admits = 94.31% (2602/2759 = 0.94309). U Toledo is PUBLIC (Ohio) — OOS distinction is policy-meaningful. Re-anchored from VERIFIED_REAL/LEGACY_DB_VALUE to OFFICIAL/CDS_OFFICIAL. No value change.',
      realDataStatus: 'VERIFIED_REAL',
    },
  };

  const existingMeta = toRecord(school.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: CDS_URL,
  };

  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('92.02'),
      intlAcceptanceRate: new Prisma.Decimal('71.01'),
      oosAcceptanceRate: new Prisma.Decimal('94.31'),
      // sat25/sat75/edAR/eaAR LEFT UNCHANGED (already OFFICIAL).
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  updated 3 open fields (AR=92.02, intlAR=71.01, oosAR=94.31) -> OFFICIAL/CDS_OFFICIAL',
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
