#!/usr/bin/env tsx
/**
 * Phase 3 — Worcester Polytechnic Institute (WPI) end-to-end closure of the
 * 7 prediction-critical fields.
 *
 * Source: WPI CDS 2024-2025 (parsed by Claude from PDF)
 *   URL: https://www.wpi.edu/sites/default/files/2025-02/WPI_CDS_2024-2025_2-27-25.pdf
 *
 * WPI is test-optional (per CDS C8A "Consider if Submitted") but did NOT
 * populate Section C9 SAT/ACT score percentiles — the C9 table is BLANK.
 * Likewise, C22 (Early Action) plan exists with ED I + ED II rows of dates,
 * but the CDS C22 template does not collect EA application/admit counts.
 *
 * All 7 fields upgraded to OFFICIAL (or UNAVAILABLE-terminal where WPI
 * structurally cannot publish the value).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 60.2  → 60.16 (CDS C1 totals: 7,555 admits /
 *                          12,559 applicants = 60.1561%. Rounded to 60.16%.
 *                          Tier upgraded LEGACY_DB → OFFICIAL. Marginal
 *                          refinement -0.04pp.)
 *   - sat25             : 1080  → null  (CDS C9 SAT Composite 25th = BLANK.
 *                          WPI is test-optional and chose not to publish
 *                          score percentiles in the 2024-25 CDS. Prior
 *                          SEED/PR-15 heuristic cleared. Marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *   - sat75             : 1320  → null  (CDS C9 SAT Composite 75th = BLANK,
 *                          same reason as sat25.)
 *   - intlAcceptanceRate: 41.3  → 41.30 (CDS C1 residency: 660 intl admits /
 *                          1,598 intl applicants = 41.3017%. Rounded to
 *                          41.30%. Value matches prior DB; tier upgraded
 *                          LEGACY_DB → OFFICIAL.)
 *   - oosAcceptanceRate : 64.6  → null  (WPI is a private research
 *                          university; in-state / out-of-state distinction
 *                          carries no policy meaning. CDS C1 residency does
 *                          report OOS (4,384 / 6,790 = 64.57%), but per
 *                          closure-pipeline convention, private schools →
 *                          UNAVAILABLE/TERMINAL. Prior LEGACY_DB cleared.)
 *   - edAcceptanceRate  : 75.63 → 75.63 (CDS C21 Fall 2024 entering class:
 *                          211 admits / 279 ED applications = 75.6272%.
 *                          ED I (close 11/1, notify 12/15) + ED II
 *                          (close 1/5, notify 2/15) combined. Value matches
 *                          prior DB; tier upgraded LEGACY_DB → OFFICIAL.)
 *   - eaAcceptanceRate  : 68.89 → null  (CDS C22: WPI offers nonbinding EA
 *                          ("Yes" checked; EA I close 11/1 notify 2/1, EA II
 *                          close 1/5 notify 3/1; non-restrictive). However,
 *                          the CDS C22 template does NOT collect EA
 *                          application/admit counts — only plan existence
 *                          and dates. Prior LEGACY_DB value (68.89%) had no
 *                          verifiable source attestation. Field cleared and
 *                          marked UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const WPI_CDS_URL =
  'https://www.wpi.edu/sites/default/files/2025-02/WPI_CDS_2024-2025_2-27-25.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iu0003uz0ti43l07p17';

const prisma = new PrismaClient();

async function main() {
  const wpi = await prisma.school.findFirst({
    where: { id: SCHOOL_ID },
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
  if (!wpi) throw new Error('WPI not found');
  console.log(`Updating ${wpi.name} (${wpi.id})`);
  console.log(
    `  current AR=${wpi.acceptanceRate?.toString()} sat25=${wpi.sat25} sat75=${wpi.sat75}`,
  );
  console.log(
    `  current intlAR=${wpi.intlAcceptanceRate?.toString()} oosAR=${wpi.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${wpi.edAcceptanceRate?.toString() ?? 'null'} eaAR=${wpi.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: WPI_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-batch17-claude',
    generatedBy: 'phase3-wpi-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 60.16,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 7,555 admits / 12,559 applicants = 60.1561% (rounded to 60.16%). Men 5,105/8,795; Women 2,439/3,752; Another Gender 11/12. Tier upgraded from LEGACY_DB (60.2%) to OFFICIAL with refreshed provenance. Marginal refinement -0.04pp.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = BLANK. WPI is test-optional (CDS C8A "Consider if Submitted") and chose not to publish score percentiles in the 2024-25 CDS — all C9 SAT/ACT cells are empty. Prior value 1080 was a SEED/PR-15 heuristic with no source attestation; cleared. Field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION.',
      realDataStatus: 'NOT_PUBLISHED',
    },
    sat75: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = BLANK. WPI is test-optional; CDS C9 not populated. Prior value 1320 was a SEED/PR-15 heuristic; cleared. Field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION.',
      realDataStatus: 'NOT_PUBLISHED',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 41.3,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 660 international admits / 1,598 international applicants = 41.3017% (rounded to 41.30%). Value matches prior DB (41.3); tier upgraded from LEGACY_DB to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Worcester Polytechnic Institute is a private research university; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table does report OOS (4,384 admits / 6,790 applicants = 64.57%), but the value is not actionable for applicants. Prior LEGACY_DB value (64.6%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 75.63,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2024-25 Section C21: WPI offers Early Decision ("Yes" checked) with two plans — ED I closes 11/1 (12/15 notification), ED II closes 1/5 (2/15 notification). Fall 2024 entering class combined totals: 211 admits / 279 ED applications = 75.6272% (rounded to 75.63%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: WPI offers nonbinding Early Action ("Yes" checked; EA I closes 11/1 with 2/1 notification, EA II closes 1/5 with 3/1 notification; non-restrictive). However, the CDS C22 template does NOT collect EA application/admit counts — only plan existence and dates. Prior LEGACY_DB value (68.89%) had no verifiable source attestation in the CDS. Field cleared and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION: plan exists but CDS does not publish admit numbers.',
      realDataStatus: 'NOT_PUBLISHED',
    },
  };

  const existingMeta = toRecord(wpi.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: WPI_CDS_URL,
  };

  await prisma.school.update({
    where: { id: wpi.id },
    data: {
      acceptanceRate: new Prisma.Decimal('60.16'),
      sat25: null,
      sat75: null,
      intlAcceptanceRate: new Prisma.Decimal('41.30'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('75.63'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=60.16, sat25=BLANK_SECTION, sat75=BLANK_SECTION, intlAR=41.30, oosAR=N/A, edAR=75.63, eaAR=BLANK_SECTION)',
  );

  const after = await prisma.school.findUnique({
    where: { id: wpi.id },
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
    `  intlAR=${after?.intlAcceptanceRate?.toString() ?? 'null'} oosAR=${after?.oosAcceptanceRate?.toString() ?? 'null'} edAR=${after?.edAcceptanceRate?.toString() ?? 'null'} eaAR=${after?.eaAcceptanceRate?.toString() ?? 'null'} hasED=${after?.hasEarlyDecision}`,
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
