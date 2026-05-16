#!/usr/bin/env tsx
/**
 * Phase 3 — San José State University (San José, CA) end-to-end closure of the
 * 7 prediction-critical fields.
 *
 * Source: SJSU Common Data Set 2024-2025 (Fall 2024 entering class) published
 *   by Institutional Research, Strategic Analytics & Analytics (IRSA).
 *   PDF: https://www2.sjsu.edu/irsa/docs/cds/20250411_CDS_2024-2025%20FINAL.pdf
 *
 * SJSU is a PUBLIC California State University campus (A2 "Public" checked) —
 *   oosAR is in eligible scope and carries the real CDS number.
 *
 * Value validation (vs. existing DB):
 *   - acceptanceRate    : 84.6   -> 72.65 (CDS C1: 24,958 admits / 34,356
 *                          first-time, first-year applicants = 72.6452%
 *                          (rounded to 72.65%). DB had LEGACY_DB_VALUE 84.6 —
 *                          that value is incorrect for the Fall 2024 cohort.
 *                          Corrected from the official SJSU CDS PDF.)
 *   - sat25             : 1080 SEED -> 1090 (CDS C9: SAT Composite 25th = 1090
 *                          reported directly (10% of enrolled, 468 students,
 *                          submitted SAT). Promoted from SEED
 *                          HEURISTIC:PR-15 to OFFICIAL.)
 *   - sat75             : 1320 SEED -> 1330 (CDS C9: SAT Composite 75th = 1330
 *                          reported directly. Promoted from SEED
 *                          HEURISTIC:PR-15 (1320) to OFFICIAL with slight
 *                          upward correction.)
 *   - intlAcceptanceRate: 74     -> 33.65 (CDS C1 residency: 431 intl admits
 *                          / 1,281 intl applicants = 33.6456% (rounded to
 *                          33.65%). DB 74 was incorrect — likely a flipped
 *                          or stale value. Corrected.)
 *   - oosAcceptanceRate : 77.6   -> 68.25 (CDS C1 residency: 2,317 OOS admits
 *                          / 3,395 OOS applicants = 68.2474% (rounded to
 *                          68.25%). CSU campus — OOS distinction matters.
 *                          Corrected from LEGACY_DB_VALUE 77.6.)
 *   - edAcceptanceRate  : null   -> null  (CDS C21: "No" — SJSU does NOT
 *                          offer Early Decision. Stays null. Re-stamped
 *                          to explicit NOT_OFFERED with canonical SJSU IR
 *                          PDF URL.)
 *   - eaAcceptanceRate  : null   -> null  (CDS C22: "No" — SJSU does NOT
 *                          offer Early Action either. Stays null. Re-stamped
 *                          to NOT_OFFERED.)
 *
 * NOTE on hasEarlyDecision: current DB value is TRUE, but CDS C21 = "No" and
 *   C22 = "No". SJSU offers only regular CSU Apply admission. Setting to FALSE.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www2.sjsu.edu/irsa/docs/cds/20250411_CDS_2024-2025%20FINAL.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8irt002tz0tiua8akwdq';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (SJSU) not found`);
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
    verifiedBy: 'closure-pipeline-phase3-batch25-claude',
    generatedBy: 'phase3-sjsu-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 72.65,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 24,958 admits / 34,356 first-time, first-year applicants = 72.6452% (rounded to 72.65%). DB had LEGACY_DB_VALUE 84.6 (incorrect for Fall 2024 cohort). Corrected from the official SJSU IRSA CDS PDF.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1090,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1090 reported directly (468 students = 10% of enrolled submitted SAT). Promoted from SEED HEURISTIC:PR-15 (value 1080) to OFFICIAL with slight upward correction from the official SJSU CDS PDF.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1330,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1330 reported directly. Promoted from SEED HEURISTIC:PR-15 (value 1320) to OFFICIAL with slight upward correction.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 33.65,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 431 international admits / 1,281 international applicants = 33.6456% (rounded to 33.65%). DB had LEGACY_DB_VALUE 74 — that value was incorrect (likely a flipped or stale value). Corrected.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 68.25,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 2,317 out-of-state admits / 3,395 out-of-state applicants = 68.2474% (rounded to 68.25%). SJSU is a PUBLIC CSU campus — in-state vs. out-of-state distinction carries real policy meaning. Corrected from LEGACY_DB_VALUE 77.6.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. SJSU does NOT offer Early Decision (admissions via CSU Apply with regular Nov 30 deadline). Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Re-stamped from prior CDS_LLM_EXTRACT_2026_04 to explicit NOT_OFFERED with canonical SJSU IR PDF URL.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. SJSU does NOT offer Early Action either. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Re-stamped to NOT_OFFERED.',
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
      acceptanceRate: new Prisma.Decimal('72.65'),
      sat25: 1090,
      sat75: 1330,
      intlAcceptanceRate: new Prisma.Decimal('33.65'),
      oosAcceptanceRate: new Prisma.Decimal('68.25'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" and C22 "No" — SJSU offers only regular CSU Apply
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=72.65, sat25=1090, sat75=1330, intlAR=33.65, oosAR=68.25, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
