#!/usr/bin/env tsx
/**
 * Phase 3 — ArtCenter College of Design reclassification.
 *
 * Context:
 *   ArtCenter College of Design (Pasadena, CA) is a portfolio-first art/design
 *   institution. Per Tier 4 closure policy, portfolio/audition-first admissions
 *   are NOT in scope of the 7-field prediction system — prediction is not
 *   applicable, since admit outcome is driven by portfolio review, not by
 *   GPA/test/round-rate statistical signal.
 *
 *   The DB currently mislabels institutionType as RESEARCH_UNIVERSITY, so it
 *   leaked into the check-closure "in-scope: 228" set and the next-batch
 *   candidate list. This script:
 *     1. Sets institutionType → ART_DESIGN (so check-closure auto-excludes it)
 *     2. Marks all 7 prediction-critical fields with provenance
 *        UNAVAILABLE / NOT_APPLICABLE_TIER_4_PORTFOLIO_FIRST, so any future
 *        consumer reading metadata.provenance sees the explicit "not
 *        applicable" reason rather than a stale heuristic value.
 *
 *   Underlying numeric column values (acceptanceRate=76.18, sat25=1080, etc.)
 *   are left untouched per scope; only provenance is rewritten. They will be
 *   ignored by check-closure once institutionType=ART_DESIGN excludes the
 *   school upstream (see check-closure.ts isPortfolioFirst()).
 */
import { PrismaClient } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const SCHOOL_ID = 'cmnwr8ivx004qz0ti7xo8qk4m';
const NOW = new Date().toISOString();

const PROVENANCE_BASE = {
  tier: 'UNAVAILABLE',
  source: 'NOT_APPLICABLE_TIER_4_PORTFOLIO_FIRST',
  confidence: 1.0,
  fetchedAt: NOW,
  verifiedAt: NOW,
  verifiedBy: 'closure-pipeline-phase3-reclassify',
  generatedBy: 'reclassify-artcenter-phase3',
  reason:
    'Portfolio/audition-first admission (art/design); prediction not applicable per Tier 4 design.',
  realDataStatus: 'NOT_APPLICABLE',
} as const;

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
  const s = await prisma.school.findFirst({
    where: { id: SCHOOL_ID, country: 'US' },
    select: {
      id: true,
      name: true,
      institutionType: true,
      metadata: true,
    },
  });
  if (!s) throw new Error(`ArtCenter not found by id ${SCHOOL_ID}`);
  console.log(`Reclassifying ${s.name} (${s.id})`);
  console.log(`  current institutionType: ${s.institutionType}`);

  const provenance: Record<string, any> = {};
  for (const f of FIELDS) {
    provenance[f] = { ...PROVENANCE_BASE, policyLabel: f };
  }

  const existingMeta = toRecord(s.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
  };

  await prisma.school.update({
    where: { id: s.id },
    data: {
      institutionType: 'ART_DESIGN',
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    `  ✅ institutionType → ART_DESIGN; 7 fields provenance → UNAVAILABLE/NOT_APPLICABLE_TIER_4_PORTFOLIO_FIRST`,
  );

  // verify
  const after = await prisma.school.findUnique({
    where: { id: s.id },
    select: {
      institutionType: true,
      metadata: true,
    },
  });
  console.log('');
  console.log('=== After update ===');
  console.log(`  institutionType: ${after?.institutionType}`);
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
