#!/usr/bin/env tsx
/**
 * Phase 3 — Wayne State University closure of OPEN prediction-critical fields.
 *
 * Source: Wayne State Common Data Set 2024-2025 (Fall 2024 entering class),
 *   published by Office of Institutional Research and Data Analytics.
 *   PDF: https://irda.wayne.edu/common-data-set/2024-2025-cds-final.pdf
 *
 * Wayne State is a PUBLIC research university (Michigan).
 *
 * Closure rule: DO NOT override fields already closed. Already closed at
 *   OFFICIAL: sat25, sat75, edAR, eaAR. Touch only open fields (currently
 *   VERIFIED_REAL): AR, intlAR, oosAR.
 *
 * CDS 2024-25 Section C1 confirmed values:
 *   - Total applied (C117): 17,089
 *   - Total admitted (C118): 13,781 → AR = 80.64% (13781/17089 = 0.80643)
 *     CORRECTION UP +2.78 from prior DB value 77.86 (stale LEGACY_DB_VALUE).
 *   - OOS applied (C123): 1,242 | OOS admitted (C124): 831 → oosAR = 66.91%
 *     (831/1242 = 0.66908) — matches DB.
 *   - Intl applied (C126): 899 | Intl admitted (C127): 444 → intlAR = 49.39%
 *     (444/899 = 0.49388) — matches DB.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://irda.wayne.edu/common-data-set/2024-2025-cds-final.pdf';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8isa0032z0tiytg48wsw';

const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findUnique({
    where: { id: SCHOOL_ID },
    select: { id: true, name: true, metadata: true },
  });
  if (!school) throw new Error(`School ${SCHOOL_ID} (Wayne State) not found`);
  console.log(`Updating ${school.name} (${school.id})`);

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-batch26-claude',
    generatedBy: 'phase3-wayne-state-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 80.64,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1 (C117/C118): 17,089 first-time, first-year applicants and 13,781 admits = 80.64% (13781/17089 = 0.80643). CORRECTION UP +2.78 from prior DB value 77.86 (stale LEGACY_DB_VALUE). Tier upgraded VERIFIED_REAL/LEGACY_DB_VALUE -> OFFICIAL/CDS_OFFICIAL anchored to Wayne State CDS PDF.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 49.39,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency (C126/C127): 899 international applicants, 444 admits = 49.39% (444/899 = 0.49388). Re-anchored from VERIFIED_REAL/LEGACY_DB_VALUE to OFFICIAL/CDS_OFFICIAL. No value change.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 66.91,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency (C123/C124): 1,242 OOS applicants, 831 admits = 66.91% (831/1242 = 0.66908). Wayne State is PUBLIC (Michigan) — OOS distinction is policy-meaningful. Re-anchored from VERIFIED_REAL/LEGACY_DB_VALUE to OFFICIAL/CDS_OFFICIAL. No value change.',
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
      acceptanceRate: new Prisma.Decimal('80.64'),
      intlAcceptanceRate: new Prisma.Decimal('49.39'),
      oosAcceptanceRate: new Prisma.Decimal('66.91'),
      // sat25/sat75/edAR/eaAR LEFT UNCHANGED (already OFFICIAL).
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  updated 3 open fields (AR=80.64 CORRECTION +2.78, intlAR=49.39, oosAR=66.91) -> OFFICIAL/CDS_OFFICIAL',
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
