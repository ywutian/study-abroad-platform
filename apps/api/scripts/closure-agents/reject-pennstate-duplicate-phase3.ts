#!/usr/bin/env tsx
/**
 * Phase 3 (batch14) — Pennsylvania State University DUPLICATE ROW cleanup.
 *
 * Context:
 *   The DB contains two rows for Pennsylvania State University:
 *     - cmnwr8imx000lz0tiez2ik9eg  (canonical row: "Pennsylvania State
 *       University", rank 61, processed by separate phase3 agent in same
 *       batch round)
 *     - cmnwr8itr003qz0tihoo9onta  (duplicate row: "Penn State University",
 *       rank 67, this script)
 *
 *   Both rows describe the same Penn State University Park campus and have
 *   substantially identical CDS-sourced fields (AR 60.56, intlAR 64.37,
 *   oosAR 59.24, etc.) — both reference the same opair.psu.edu CDS PDF.
 *   The duplicate row would pollute candidate selection in next-batch.ts /
 *   check-closure if left active. To prevent that, we:
 *
 *     1. Set dataReviewStatus = REJECTED so check-closure / next-batch
 *        auto-excludes this row (next-batch.ts line 164:
 *        `if (s.dataReviewStatus === 'REJECTED') continue;`).
 *     2. Mark all 7 prediction-critical fields' provenance as
 *        UNAVAILABLE / source=DUPLICATE_ROW_OF_cmnwr8imx000lz0tiez2ik9eg,
 *        so any future consumer reading metadata.provenance sees the
 *        explicit "duplicate" reason rather than a stale value.
 *
 *   We DO NOT delete the row (foreign-key safety: other tables may reference
 *   this schoolId, e.g. school_lists, rankings, deadlines, etc.).
 *
 *   Numeric column values are left untouched per scope; only
 *   dataReviewStatus + metadata.provenance change. They will be ignored
 *   by check-closure once dataReviewStatus=REJECTED excludes the row.
 */
import { PrismaClient } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const DUP_SCHOOL_ID = 'cmnwr8itr003qz0tihoo9onta';
const CANONICAL_SCHOOL_ID = 'cmnwr8imx000lz0tiez2ik9eg';
const NOW = new Date().toISOString();

const PROVENANCE_BASE = {
  tier: 'UNAVAILABLE' as const,
  source: `DUPLICATE_ROW_OF_${CANONICAL_SCHOOL_ID}`,
  confidence: 1.0,
  fetchedAt: NOW,
  verifiedAt: NOW,
  verifiedBy: 'closure-pipeline-phase3-batch14-claude',
  generatedBy: 'phase3-batch14-pennstate-duplicate-reject',
  reason: `Duplicate DB row of Pennsylvania State University ${CANONICAL_SCHOOL_ID} (canonical name "Pennsylvania State University", rank 61). This row ("Penn State University", rank 67) describes the same University Park campus with the same CDS source. dataReviewStatus set to REJECTED so check-closure / next-batch auto-excludes this row. Numeric column values retained for FK safety; not used downstream.`,
  realDataStatus: 'NOT_APPLICABLE' as const,
};

const FIELDS = [
  'acceptanceRate',
  'sat25',
  'sat75',
  'intlAcceptanceRate',
  'oosAcceptanceRate',
  'edAcceptanceRate',
  'eaAcceptanceRate',
] as const;

const prisma = new PrismaClient();

async function main() {
  const [dup, canonical] = await Promise.all([
    prisma.school.findUnique({
      where: { id: DUP_SCHOOL_ID },
      select: {
        id: true,
        name: true,
        dataReviewStatus: true,
        isPrivate: true,
        usNewsRank: true,
        metadata: true,
      },
    }),
    prisma.school.findUnique({
      where: { id: CANONICAL_SCHOOL_ID },
      select: {
        id: true,
        name: true,
        dataReviewStatus: true,
        usNewsRank: true,
      },
    }),
  ]);
  if (!dup)
    throw new Error(`Duplicate Penn State row ${DUP_SCHOOL_ID} not found`);
  if (!canonical)
    throw new Error(
      `Canonical Penn State row ${CANONICAL_SCHOOL_ID} not found (sanity check failed)`,
    );

  console.log(`Rejecting duplicate row: ${dup.name} (${dup.id})`);
  console.log(
    `  current dataReviewStatus=${dup.dataReviewStatus} rank=${dup.usNewsRank}`,
  );
  console.log(
    `  canonical row preserved: ${canonical.name} (${canonical.id}) status=${canonical.dataReviewStatus} rank=${canonical.usNewsRank}`,
  );

  const provenance: Record<string, any> = {};
  for (const f of FIELDS) {
    provenance[f] = { ...PROVENANCE_BASE, policyLabel: f };
  }

  const existingMeta = toRecord(dup.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    duplicateOf: CANONICAL_SCHOOL_ID,
  };

  await prisma.school.update({
    where: { id: dup.id },
    data: {
      dataReviewStatus: 'REJECTED',
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    `  ✅ dataReviewStatus → REJECTED; 7 fields provenance → UNAVAILABLE/DUPLICATE_ROW_OF_${CANONICAL_SCHOOL_ID}`,
  );

  // verify
  const after = await prisma.school.findUnique({
    where: { id: dup.id },
    select: { dataReviewStatus: true, metadata: true },
  });
  console.log('');
  console.log('=== After update ===');
  console.log(`  dataReviewStatus: ${after?.dataReviewStatus}`);
  const prov = (after?.metadata as any)?.provenance ?? {};
  for (const f of FIELDS) {
    const p = prov[f];
    console.log(
      `  ${f.padEnd(22)} tier=${p?.tier ?? 'NULL'}  source=${p?.source ?? 'NULL'}  realDataStatus=${p?.realDataStatus ?? '-'}`,
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
