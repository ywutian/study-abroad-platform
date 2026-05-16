#!/usr/bin/env tsx
/**
 * Phase 3 — University of Maine (Orono) end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: UMaine and UMaine Machias Combined CDS 2024-2025 (Fall 2024 entering
 *   class) published by UMaine OIRA (Office of Institutional Research and
 *   Assessment).
 *   Landing: https://umaine.edu/oira/common-data-set/
 *   Archive page: https://umaine.edu/oira/resource/umaine-and-umaine-machias-combined-cds-2024-2025/
 *   Direct PDF (anonymous SharePoint share): https://umainesystem.sharepoint.com/:b:/s/UM-OnlineDocs/ERhJPWCAJPVLtEOpMcFhgZsBn0887t8-aQ-N5PinSB8eRA
 *
 * UMaine is a PUBLIC land-grant research university (CDS A2 "Public" checked) —
 *   oosAR is in eligible scope and carries the real CDS number, not TERMINAL.
 *
 * NOTE on prior DB drift:
 *   - isPrivate is currently TRUE in DB — INCORRECT. UMaine is the flagship
 *     PUBLIC land-grant of the University of Maine System. This script does not
 *     modify isPrivate (out of scope for closure pipeline), but flags the drift.
 *     A separate cleanup task should set isPrivate=false and revisit
 *     institutionType (LIBERAL_ARTS -> RESEARCH_UNIVERSITY likely correct).
 *   - Several existing OFFICIAL provenances point at WRONG URLs (prepscholar,
 *     clastify, maine.gov K-12 monitoring report) — clear drift. This script
 *     re-anchors all 7 fields to the official CDS PDF.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 94.16  -> 96.64 (CDS 2024-25 C1: 13,572 admits /
 *                          14,044 first-time, first-year applicants =
 *                          96.6390%. Tier LEGACY_DB_VALUE -> OFFICIAL.)
 *   - sat25             : 1060   -> 1060  (CDS 2024-25 C9 SAT Composite 25th =
 *                          1060. NO CHANGE. Tier OFFICIAL via wrong-URL
 *                          (prepscholar) -> OFFICIAL anchored to real CDS PDF.)
 *   - sat75             : 1280   -> 1280  (CDS 2024-25 C9 SAT Composite 75th =
 *                          1280. NO CHANGE. Tier OFFICIAL anchored to real
 *                          CDS PDF.)
 *   - intlAcceptanceRate: 77.3   -> 77.31 (CDS 2024-25 C1 residency table: 627
 *                          intl admits / 811 intl applicants = 77.3119%.
 *                          Re-anchored to CDS; minor precision adjustment.)
 *   - oosAcceptanceRate : 93.84  -> 97.64 (CDS 2024-25 C1 residency table:
 *                          9,202 out-of-state admits / 9,424 out-of-state
 *                          applicants = 97.6443%. Tier PERMANENT_HEURISTIC
 *                          -> OFFICIAL. PUBLIC SCHOOL — oosAR is real OFFICIAL.)
 *   - edAcceptanceRate  : null   -> null  (CDS 2024-25 C21: "No" — UMaine does
 *                          NOT offer Early Decision. Replace prior provenance
 *                          (source=CDS_LLM_EXTRACT_2026_04 OFFICIAL with wrong
 *                          maine.gov K-12 URL) with explicit UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : 92     -> null  (CDS 2024-25 C22: "Yes" — UMaine
 *                          offers Early Action (12/1 closing, 1/15 notification,
 *                          nonrestrictive) but does NOT publish EA applicant/
 *                          admit counts. Replace TAVILY_ENRICHMENT estimate
 *                          with UNAVAILABLE/OFFICIAL_BLANK_SECTION per closure
 *                          policy.)
 *
 * NOTE on hasEarlyDecision: current DB value is TRUE, but CDS C21 is "No" —
 *   UMaine does NOT offer Early Decision. Setting to FALSE to match CDS.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

// Use the umaine.edu archive landing URL as the citable closure source (stable,
// publicly browsable). The actual PDF redirects to a SharePoint anonymous
// share; we record the umaine.edu landing for human traceability.
const CDS_URL =
  'https://umaine.edu/oira/resource/umaine-and-umaine-machias-combined-cds-2024-2025/';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iqi0026z0tin3vtpw1p';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UMaine) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(
    `  isPrivate=${school.isPrivate}  [NOTE: should be FALSE — PUBLIC land-grant; not modified here]`,
  );
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
    verifiedBy: 'closure-pipeline-phase3-batch23-claude',
    generatedBy: 'phase3-umaine-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 96.64,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 13,572 admits / 14,044 first-time, first-year applicants = 96.6390% (rounded to 96.64%). Tier upgraded from VERIFIED_REAL/LEGACY_DB_VALUE (94.16, anchored to UMaine CDS 2022-23 wrong cycle) to OFFICIAL with CDS 2024-25 direct numbers.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1060,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1060 (reported directly). Re-anchored from prior OFFICIAL provenance that wrongly cited prepscholar.com aggregator to the official UMaine CDS PDF. Value unchanged.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1280,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1280 (reported directly). Re-anchored from prior OFFICIAL provenance that wrongly cited prepscholar.com aggregator to the official UMaine CDS PDF. Value unchanged.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 77.31,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 627 international admits / 811 international applicants = 77.3119% (rounded to 77.31%). Re-anchored from prior OFFICIAL provenance that wrongly cited clastify.com aggregator to the official UMaine CDS PDF. Minor precision adjustment from 77.3.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 97.64,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 9,202 out-of-state admits / 9,424 out-of-state applicants = 97.6443% (rounded to 97.64%). UMaine is the PUBLIC land-grant research university of the University of Maine System (Orono, ME) — in-state vs. out-of-state distinction carries policy meaning (different tuition). Tier upgraded from PERMANENT_HEURISTIC (93.84) to OFFICIAL with real CDS numbers.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. UMaine does NOT offer Early Decision (offers Early Action only). Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Replaces prior provenance (source=CDS_LLM_EXTRACT_2026_04 marked OFFICIAL but anchored to an unrelated maine.gov K-12 monitoring report URL) with the official UMaine CDS PDF.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — YES checked (Early action closing 12/1, notification 1/15, nonrestrictive). However, UMaine does NOT publish EA applicant/admit counts — only dates. Field cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION) per closure policy. Replaces prior TAVILY_ENRICHMENT estimate of 92 (not from CDS).',
      realDataStatus: 'OFFICIAL_BLANK_SECTION',
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
      acceptanceRate: new Prisma.Decimal('96.64'),
      sat25: 1060,
      sat75: 1280,
      intlAcceptanceRate: new Prisma.Decimal('77.31'),
      oosAcceptanceRate: new Prisma.Decimal('97.64'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — UMaine does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=96.64, sat25=1060, sat75=1280, intlAR=77.31, oosAR=97.64, edAR=NOT_OFFERED, eaAR=OFFICIAL_BLANK_SECTION, hasED=false)',
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
