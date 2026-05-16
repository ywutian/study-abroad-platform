#!/usr/bin/env tsx
/**
 * Phase 3 (batch13) — University of Minnesota Twin Cities DUPLICATE ROW cleanup.
 *
 * Context:
 *   The DB contains two rows for University of Minnesota Twin Cities:
 *     - cmnwr8ima0008z0ti358pkae1  (canonical row, already closed in phase3
 *       as PUBLIC school — all 7 fields tier=OFFICIAL via CDS 2024-25)
 *     - cmnwr8itq003pz0tirhvysbdj  (duplicate row, this script)
 *
 *   The duplicate row has stale half-merged provenance (some LEGACY_DB,
 *   some CDS_PDF_AUTO with value undefined) and is misleading. To prevent
 *   it from polluting the check-closure pipeline / candidate selection, we:
 *
 *     1. Set dataReviewStatus = REJECTED so check-closure / next-batch
 *        auto-excludes this row (next-batch.ts line 164:
 *        `if (s.dataReviewStatus === 'REJECTED') continue;`).
 *     2. Mark all 7 prediction-critical fields' provenance as
 *        UNAVAILABLE / source=DUPLICATE_ROW_OF_cmnwr8ima0008z0ti358pkae1,
 *        so any future consumer reading metadata.provenance sees the
 *        explicit "duplicate" reason rather than a stale heuristic value.
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

const DUP_SCHOOL_ID = 'cmnwr8itq003pz0tirhvysbdj';
const CANONICAL_SCHOOL_ID = 'cmnwr8ima0008z0ti358pkae1';
const NOW = new Date().toISOString();

const PROVENANCE_BASE = {
  tier: 'UNAVAILABLE' as const,
  source: `DUPLICATE_ROW_OF_${CANONICAL_SCHOOL_ID}`,
  confidence: 1.0,
  fetchedAt: NOW,
  verifiedAt: NOW,
  verifiedBy: 'closure-pipeline-phase3-batch13-claude',
  generatedBy: 'phase3-batch13-umn-duplicate-reject',
  reason: `Duplicate DB row of University of Minnesota Twin Cities ${CANONICAL_SCHOOL_ID}. dataReviewStatus set to REJECTED so check-closure / next-batch auto-excludes this row. Numeric column values retained for FK safety; not used downstream.`,
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
  if (!dup) throw new Error(`Duplicate UMN row ${DUP_SCHOOL_ID} not found`);
  if (!canonical)
    throw new Error(
      `Canonical UMN row ${CANONICAL_SCHOOL_ID} not found (sanity check failed)`,
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
