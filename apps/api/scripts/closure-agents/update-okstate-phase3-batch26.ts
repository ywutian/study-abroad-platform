#!/usr/bin/env tsx
/**
 * Phase 3 — Oklahoma State University (Stillwater, OK) end-to-end closure of
 *   the 7 prediction-critical fields.
 *
 * Source: Oklahoma State University Common Data Set 2024-2025 (Fall 2024
 *   entering class) published by Institutional Research and Analytics (IRA).
 *   PDF: https://ira.okstate.edu/site-files/documents/cds/cds2425.pdf
 *
 * OSU-Stillwater is a PUBLIC land-grant research university (A2 "Public"
 *   checked) — oosAR is in eligible scope and carries the real CDS number.
 *
 * Value validation (vs. existing DB):
 *   - acceptanceRate    : 72     -> 75.04 (CDS C1: 18,693 admits / 24,910
 *                          first-time, first-year applicants = 75.0421%
 *                          (rounded to 75.04%). Tier LEGACY_DB_VALUE (72) ->
 *                          OFFICIAL with full precision from the official OSU
 *                          IRA CDS PDF. Material correction upward.)
 *   - sat25             : 1040   =  1040 (CDS C9: SAT Composite 25th = 1040
 *                          reported directly. Value unchanged; tier re-anchored
 *                          from CDS_PDF_AUTO (clastify aggregator) to
 *                          CDS_OFFICIAL.)
 *   - sat75             : 1240   ~  1240 (CDS C9: SAT Composite 75th = 1240
 *                          reported directly. Value unchanged; tier re-anchored
 *                          from CDS_PDF_AUTO to CDS_OFFICIAL.)
 *   - intlAcceptanceRate: 12.7   ~  12.70 (CDS C1 residency: 181 intl admits
 *                          / 1,425 intl applicants = 12.7018% (rounded to
 *                          12.70%). Tier LEGACY_DB_VALUE -> OFFICIAL with full
 *                          precision; value unchanged.)
 *   - oosAcceptanceRate : 73.44  -> 80.38 (CDS C1 residency: 11,367 OOS admits
 *                          / 14,141 OOS applicants = 80.3833% (rounded to
 *                          80.38%). Tier PERMANENT_HEURISTIC -> OFFICIAL.
 *                          Heuristic was substantially off — corrected upward.
 *                          PUBLIC land-grant — OOS distinction carries real
 *                          policy meaning.)
 *   - edAcceptanceRate  : null   -> null  (CDS C21: "No" — OSU-Stillwater does
 *                          NOT offer Early Decision. Stays null. Re-stamped
 *                          from CDS_LLM_EXTRACT_2026_04 to explicit
 *                          NOT_OFFERED with canonical OSU IRA PDF URL.)
 *   - eaAcceptanceRate  : null   -> null  (CDS C22: "No" — OSU-Stillwater does
 *                          NOT offer Early Action either. Stays null.
 *                          Re-stamped to NOT_OFFERED.)
 *
 * NOTE on hasEarlyDecision: current DB value is TRUE, but CDS C21 = "No" and
 *   C22 = "No". OSU-Stillwater offers only regular/rolling admission (priority
 *   Nov 1 / final Feb 1 / continued until classes start). Setting to FALSE to
 *   match CDS.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL = 'https://ira.okstate.edu/site-files/documents/cds/cds2425.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ise0034z0tiwz772kaw';

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
  if (!school)
    throw new Error(`School ${SCHOOL_ID} (OSU-Stillwater) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC SCHOOL]`);
  console.log(
    `  current AR=${school.acceptanceRate?.toString()} sat25=${school.sat25} sat75=${school.sat75}`,
  );
  console.log(
    `  current intlAR=${school.intlAcceptanceRate?.toString()} oosAR=${school.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${school.edAcceptanceRate?.toString() ?? 'null'} eaAR=${school.eaAcceptanceRate?.toString() ?? 'null'} hasED=${school.hasEarlyDecision}`,
  );

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-batch26-claude',
    generatedBy: 'phase3-okstate-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 75.04,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 18,693 admits / 24,910 first-time, first-year applicants = 75.0421% (rounded to 75.04%). Material correction from LEGACY_DB_VALUE 72 to OFFICIAL value from the official OSU IRA CDS PDF.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1040,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1040 (reported directly). Value unchanged; tier re-anchored from prior CDS_PDF_AUTO that cited clastify.com aggregator to the official OSU IRA CDS PDF.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1240,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1240 (reported directly). Value unchanged; tier re-anchored from prior CDS_PDF_AUTO (clastify.com) to the official OSU IRA CDS PDF.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 12.7,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 181 international admits / 1,425 international applicants = 12.7018% (rounded to 12.70%). Tier LEGACY_DB_VALUE (12.7) -> OFFICIAL with full precision.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 80.38,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 11,367 out-of-state admits / 14,141 out-of-state applicants = 80.3833% (rounded to 80.38%). OSU-Stillwater is the PUBLIC land-grant flagship of Oklahoma — in-state vs. out-of-state distinction carries real policy meaning. Material correction from PERMANENT_HEURISTIC (73.44) upward to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. OSU-Stillwater does NOT offer Early Decision (admissions are regular/rolling with priority Nov 1 / final Feb 1 deadlines). Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Re-stamped from prior CDS_LLM_EXTRACT_2026_04 to explicit NOT_OFFERED with canonical OSU IRA PDF URL.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. OSU-Stillwater does NOT offer Early Action either. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Re-stamped to NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
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
      acceptanceRate: new Prisma.Decimal('75.04'),
      sat25: 1040,
      sat75: 1240,
      intlAcceptanceRate: new Prisma.Decimal('12.70'),
      oosAcceptanceRate: new Prisma.Decimal('80.38'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" and C22 "No" — OSU-Stillwater offers only regular/rolling
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=75.04, sat25=1040, sat75=1240, intlAR=12.70, oosAR=80.38, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
