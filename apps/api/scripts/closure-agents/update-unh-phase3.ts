#!/usr/bin/env tsx
/**
 * Phase 3 — University of New Hampshire (UNH) end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: UNH CDS 2024-2025 (Fall 2024 entering class) — most recent posted
 *   by the Office of Institutional Research.
 *   URL: https://www.unh.edu/institutional-research/sites/default/files/media/2025-02/cds-2024-2025-2.12.25_0.pdf
 *
 * UNH is a PUBLIC flagship research university (University System of New
 * Hampshire):
 *   - isPrivate=false  ->  oosAcceptanceRate is in eligible scope, MUST carry
 *     a real OFFICIAL number from CDS C1 residency table.
 *
 * UNH is **test-blind** per CDS C8A ("Does your institution make use of SAT
 *   or ACT scores in admission decisions" — NO). SAT band is still recorded
 *   as OFFICIAL for descriptive applicant-profile use (not as a gating
 *   threshold).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 88.2   -> 88.16  (CDS C1: 18,667 admits / 21,175
 *                          applicants = 88.1582%. Minor precision adjustment,
 *                          tier LEGACY_DB->OFFICIAL.)
 *   - sat25             : 1100   -> 1100   (CDS C9: SAT Composite 25th = 1100
 *                          confirmed. Tier corrected: previous OFFICIAL/
 *                          CDS_PDF_AUTO pointed to prepscholar URL — replaced
 *                          with authoritative UNH CDS source.)
 *   - sat75             : 1320   -> 1320   (CDS C9: SAT Composite 75th = 1320
 *                          confirmed. Same URL correction as sat25.)
 *   - intlAcceptanceRate: 85.8   -> 85.83  (CDS C1 residency: 418 intl admits
 *                          / 487 intl applicants = 85.8316%. Minor precision
 *                          adjustment, tier LEGACY_DB->OFFICIAL.)
 *   - oosAcceptanceRate : 88.8   -> 88.80  (CDS C1 residency: 14,376 OOS
 *                          admits / 16,189 OOS applicants = 88.8011%. Tier
 *                          LEGACY_DB->OFFICIAL. UNH is a PUBLIC flagship —
 *                          IS/OOS distinction is real policy meaning.)
 *   - edAcceptanceRate  : null   -> null   (CDS C21: "No" — UNH does NOT
 *                          offer Early Decision. Field cleared, marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION. DB
 *                          hasEarlyDecision corrected from true to false.)
 *   - eaAcceptanceRate  : null   -> null   (CDS C22: "Yes" — UNH offers a
 *                          nonbinding EA plan (closing 11/15, notification
 *                          1/30, non-restrictive). However, CDS C22
 *                          admits/applicants fields are BLANK. Marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *
 * NOTE on hasEarlyDecision: existing DB has true; correct to false to match
 *   CDS C21 = No (UNH is EA-only, not ED).
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.unh.edu/institutional-research/sites/default/files/media/2025-02/cds-2024-2025-2.12.25_0.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ipr001tz0ti8x7z840u';

const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findUnique({
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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UNH) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC NH flagship]`);
  console.log(
    `  current AR=${school.acceptanceRate?.toString()} sat25=${school.sat25} sat75=${school.sat75}`,
  );
  console.log(
    `  current intlAR=${school.intlAcceptanceRate?.toString()} oosAR=${school.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${school.edAcceptanceRate?.toString() ?? 'null'} eaAR=${school.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-unh-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 88.16,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 18,667 admits / 21,175 applicants = 88.1582% (rounded to 88.16%). Tier upgraded from LEGACY_DB (value 88.2) to OFFICIAL with minor precision adjustment.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1100,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1100 (reported directly). Value confirmed; provenance corrected from CDS_PDF_AUTO (pointing to prepscholar.com — non-authoritative) to CDS_OFFICIAL with canonical UNH CDS URL. NOTE: UNH is TEST-BLIND per CDS C8A ("No" — SAT/ACT scores not used in admission decisions); SAT band is recorded for descriptive applicant-profile use only, not as a gating threshold.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1320,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1320 (reported directly). Value confirmed; provenance corrected from CDS_PDF_AUTO (prepscholar.com URL) to CDS_OFFICIAL with canonical UNH CDS URL. NOTE: UNH is test-blind; SAT band is descriptive only.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 85.83,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 418 international admits / 487 international applicants = 85.8316% (rounded to 85.83%). Tier upgraded from LEGACY_DB (value 85.8) to OFFICIAL with minor precision adjustment.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 88.8,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 14,376 out-of-state admits / 16,189 out-of-state applicants = 88.8011% (rounded to 88.80%). UNH is a PUBLIC flagship research university — in-state vs. out-of-state residency carries real policy meaning (different tuition, residency-preference pathways), so this field is in eligible scope and MUST carry a real CDS number. Tier upgraded LEGACY_DB (value 88.8) -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO. UNH does not offer Early Decision (EA-only). Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). DB hasEarlyDecision corrected from true to false to match CDS. Provenance refreshed to 2024-25 cycle.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Yes" — UNH offers a nonbinding Early Action plan (closing 11/15, notification 1/30, non-restrictive). However, the CDS C22 EA admits/applicants fields are BLANK in the published document. Marked UNAVAILABLE/OFFICIAL_BLANK_SECTION per closure pipeline convention (CDS section exists and is "Yes" but the per-section counts are not published). Field value cleared.',
      realDataStatus: 'NOT_PUBLISHED',
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
      acceptanceRate: new Prisma.Decimal('88.16'),
      sat25: 1100,
      sat75: 1320,
      intlAcceptanceRate: new Prisma.Decimal('85.83'),
      oosAcceptanceRate: new Prisma.Decimal('88.80'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — UNH does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=88.16, sat25=1100, sat75=1320, intlAR=85.83, oosAR=88.80, edAR=NOT_OFFERED, eaAR=NOT_PUBLISHED, hasED=false)',
  );

  const after = await prisma.school.findUnique({
    where: { id: school.id },
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
