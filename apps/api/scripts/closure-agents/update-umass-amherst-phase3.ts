#!/usr/bin/env tsx
/**
 * Phase 3 — University of Massachusetts Amherst end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: UMass Amherst CDS 2025-2026 (Fall 2025 entering class).
 *   URL: https://www.umass.edu/uair/media/1062/download
 *   Index: https://www.umass.edu/uair/data-collection-and-reporting/common-data-set
 *
 * UMass Amherst is the flagship PUBLIC research campus of the UMass system:
 *   - isPrivate=false  ->  oosAcceptanceRate is in eligible scope, MUST carry
 *     a real OFFICIAL number from CDS C1 residency table.
 *   - oosAR is NOT marked UNAVAILABLE/TERMINAL.
 *
 * UMass Amherst is test-optional per CDS C8A ("Not required for admission,
 * but considered if submitted"). SAT band is still recorded as OFFICIAL for
 * descriptive applicant-profile use.
 *
 * ⚠️ CRITICAL CORRECTION: Existing DB provenance pointed AR/intlAR/oosAR to
 *   UMass DARTMOUTH's CDS URL (https://www.umassd.edu/.../CDS-2024-2025-...pdf
 *   — wrong school entirely). All five rate values were inherited from
 *   Dartmouth (e.g. AR=90.64 is Dartmouth's open-admission rate; UMass
 *   AMHERST's true rate is 59.89%). This script replaces ALL data with the
 *   correct UMass Amherst CDS 2025-26 source.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 90.64  -> 59.89  (CDS C1 residency: 31,813 admits /
 *                          53,117 applicants = 59.8926%. MAJOR CORRECTION:
 *                          prior value was UMass Dartmouth's 90.64% — entirely
 *                          wrong school. Tier LEGACY_DB->OFFICIAL.)
 *   - sat25             : 1260   -> 1330   (CDS C9: SAT Composite 25th = 1330
 *                          reported directly. CORRECTION UP from prior 1260
 *                          (likely Dartmouth-tier value).)
 *   - sat75             : 1410   -> 1480   (CDS C9: SAT Composite 75th = 1480
 *                          reported directly. CORRECTION UP from prior 1410.)
 *   - intlAcceptanceRate: 90.28  -> 54.13  (CDS C1 residency: 3,634 intl
 *                          admits / 6,714 intl applicants = 54.1257%. MAJOR
 *                          CORRECTION: prior 90.28% was Dartmouth's intl rate.)
 *   - oosAcceptanceRate : 89.54  -> 63.52  (CDS C1 residency: 15,117 OOS
 *                          admits / 23,800 OOS applicants = 63.5168%. MAJOR
 *                          CORRECTION: prior 89.54% was Dartmouth's OOS rate.
 *                          UMass Amherst is a PUBLIC flagship — IS/OOS
 *                          distinction is real policy (different tuition,
 *                          residency-preference admit pathways).)
 *   - edAcceptanceRate  : null   -> null   (CDS C21: "No" — UMass Amherst
 *                          does NOT offer Early Decision. Field cleared.
 *                          DB hasEarlyDecision corrected from true to false.)
 *   - eaAcceptanceRate  : 64     -> null   (CDS C22: "Yes" — EA offered
 *                          (nonbinding, closing 5-Nov, notification 25-Jan,
 *                          non-restrictive). However, CDS C22 admit/applicant
 *                          fields are BLANK in the published document. Prior
 *                          value 64% came from TAVILY_ENRICHMENT and is not
 *                          present in the canonical CDS — DEMOTE to
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION per closure
 *                          convention. Clear field value.)
 *
 * NOTE on hasEarlyDecision: existing DB has true; correct to false to match
 *   CDS C21 = No (UMass Amherst is EA-only, not ED).
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL = 'https://www.umass.edu/uair/media/1062/download';
const CYCLE_YEAR = 2025; // CDS 2025-2026 = Fall 2025 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8imu000jz0ti03zavqgf';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UMass Amherst) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC UMass flagship]`);
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
    generatedBy: 'phase3-umass-amherst-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 59.89,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2025-26 Section C1 residency table: 31,813 total admits (IS 13,062 + OOS 15,117 + Intl 3,634) / 53,117 total applicants (IS 22,603 + OOS 23,800 + Intl 6,714) = 59.8926% (rounded to 59.89%). MAJOR CORRECTION: prior LEGACY_DB value 90.64% was sourced from UMass DARTMOUTH (a different, open-admission school in the UMass system). Tier upgraded LEGACY_DB -> OFFICIAL with corrected source.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1330,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2025-26 Section C9: SAT Composite 25th = 1330 (reported directly on the SAT Composite row). CORRECTION UP from prior 1260. NOTE: UMass Amherst is test-optional (CDS C8A "Not required for admission, but considered if submitted"); SAT band is descriptive only.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1480,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2025-26 Section C9: SAT Composite 75th = 1480 (reported directly on the SAT Composite row). CORRECTION UP from prior 1410.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 54.13,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2025-26 Section C1 residency table: 3,634 international admits / 6,714 international applicants = 54.1257% (rounded to 54.13%). MAJOR CORRECTION: prior 90.28% was sourced from UMass Dartmouth (wrong school).',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 63.52,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2025-26 Section C1 residency table: 15,117 out-of-state admits / 23,800 out-of-state applicants = 63.5168% (rounded to 63.52%). UMass Amherst is the flagship PUBLIC research campus of the UMass system — in-state vs. out-of-state residency carries real policy meaning (different tuition, residency-preference pathways), so this field is in eligible scope and MUST carry a real CDS number. MAJOR CORRECTION: prior 89.54% was sourced from UMass Dartmouth (wrong school).',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2025-26 Section C21: "Does your institution offer an early decision plan?" — NO. UMass Amherst does not offer Early Decision (EA-only). Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). DB hasEarlyDecision corrected from true to false to match CDS. Provenance refreshed to 2025-26 cycle.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2025-26 Section C22: "Yes" — UMass Amherst offers a nonbinding Early Action plan (closing 5-Nov, notification 25-Jan, non-restrictive). However, the CDS C22 EA admits/applicants fields are BLANK in the published document. Prior DB value 64% came from TAVILY_ENRICHMENT (non-CDS source) and is NOT present in the canonical CDS — DEMOTED to UNAVAILABLE/OFFICIAL_BLANK_SECTION per closure pipeline convention (CDS is canonical; non-CDS enrichment is not OFFICIAL). Field value cleared.',
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
      acceptanceRate: new Prisma.Decimal('59.89'),
      sat25: 1330,
      sat75: 1480,
      intlAcceptanceRate: new Prisma.Decimal('54.13'),
      oosAcceptanceRate: new Prisma.Decimal('63.52'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — UMass Amherst does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=59.89, sat25=1330, sat75=1480, intlAR=54.13, oosAR=63.52, edAR=NOT_OFFERED, eaAR=NOT_PUBLISHED, hasED=false)',
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
