#!/usr/bin/env tsx
/**
 * Phase 3 — University of Houston (public research university, Texas)
 * End-to-end closure of the 7 prediction-critical fields.
 *
 * Source: U. Houston CDS 2024-2025 (Excel workbook, published by Institutional
 *   Research):
 *     https://www.uh.edu/ir/reports/common-data-sets/cds-data/common-data-set_2024-2025_final.xlsx
 *   Index: https://uh.edu/ir/reports/common-data-sets/
 *
 * U. Houston is public (isPrivate=false) — oosAcceptanceRate IS in eligible
 * scope. HOWEVER, U. Houston does NOT disaggregate the C1 residency table
 * (the In-State / Out-of-State / International columns are blank). Per the
 * pipeline rule for public schools with blank CDS section, oosAR and intlAR
 * are recorded as UNAVAILABLE/OFFICIAL_BLANK_SECTION (the CDS has the
 * structural slot but the institution did not populate it).
 *
 * Test policy: C8A SAT/ACT "Not required for admission, but considered if
 * submitted" — test-optional. C9 SAT Composite percentiles recorded as
 * OFFICIAL for descriptive applicant-profile use.
 *
 * Value changes:
 *   - acceptanceRate    : 66     -> 73.93   (CDS C1: 23,446 admits / 31,716
 *                          applicants = 73.9311%, rounded 73.93%. SIZABLE
 *                          UPWARD CORRECTION from prior LEGACY_DB 66 (stale
 *                          older-cycle estimate). Tier LEGACY_DB ->
 *                          OFFICIAL.)
 *   - sat25             : 1080   -> 1170    (CDS C9 SAT Composite 25th =
 *                          1170. UPWARD CORRECTION from prior 1080 (SEED/
 *                          HEURISTIC:PR-15). Tier SEED -> OFFICIAL.)
 *   - sat75             : 1320   -> 1330    (CDS C9 SAT Composite 75th =
 *                          1330. Trivial UPWARD CORRECTION from prior 1320
 *                          (SEED/HEURISTIC:PR-15). Tier SEED -> OFFICIAL.)
 *   - intlAcceptanceRate: 62.7   -> null    (CDS C1 residency table:
 *                          International column blank. U. Houston does not
 *                          disaggregate residency in CDS. Prior 62.7 from
 *                          PERMANENT_HEURISTIC has no source backing. Clear
 *                          value, mark UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *   - oosAcceptanceRate : 67.32  -> null    (CDS C1 residency table:
 *                          Out-of-State column blank. Same rationale as
 *                          intlAR. PUBLIC SCHOOL BUT BLANK CDS SECTION:
 *                          per pipeline rule, mark UNAVAILABLE/OFFICIAL_
 *                          BLANK_SECTION. Prior 67.32 from
 *                          PERMANENT_HEURISTIC has no source backing.)
 *   - edAcceptanceRate  : null   -> null    (CDS C21 = "No" — U. Houston
 *                          does not offer ED. Already UNAVAILABLE/OFFICIAL_
 *                          BLANK_SECTION cycle 2024; reason tightened to
 *                          NOT_OFFERED.)
 *   - eaAcceptanceRate  : null   -> null    (CDS C22 = "No" — U. Houston
 *                          does not offer EA. Already UNAVAILABLE/OFFICIAL_
 *                          BLANK_SECTION cycle 2024; reason tightened to
 *                          NOT_OFFERED.)
 *
 * NOTE on hasEarlyDecision: current DB value is true, but CDS C21 = "No".
 *   Setting to false to match CDS reality.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.uh.edu/ir/reports/common-data-sets/cds-data/common-data-set_2024-2025_final.xlsx';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iq2001zz0tiix4lbz86';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (U. Houston) not found`);
  console.log(`Updating ${school.name} (${school.id}) [public]`);

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-uhouston-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 73.93,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 23,446 admits / 31,716 applicants = 73.9311% (rounded to 73.93%). SIZABLE UPWARD CORRECTION from prior LEGACY_DB value 66 (stale older-cycle estimate). Tier LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1170,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1170 (reported directly). UPWARD CORRECTION from prior 1080 (SEED/HEURISTIC:PR-15). Tier SEED -> OFFICIAL. NOTE: U. Houston is test-optional (CDS C8A "Not required for admission, but considered if submitted"); SAT band is descriptive applicant-profile data, not a gating threshold.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1330,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1330 (reported directly). Trivial UPWARD CORRECTION from prior 1320 (SEED/HEURISTIC:PR-15). Tier SEED -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: the In-State / Out-of-State / International columns are STRUCTURALLY BLANK — U. Houston does not disaggregate residency in its published CDS. Prior DB value 62.7 (HEURISTIC tier, PERMANENT_HEURISTIC source) had no official backing. CORRECTION: clear DB value to null, mark UNAVAILABLE/OFFICIAL_BLANK_SECTION. The structural slot exists in CDS but the institution left it unpopulated.',
      realDataStatus: 'OFFICIAL_BLANK_SECTION',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: the Out-of-State column is STRUCTURALLY BLANK — U. Houston does not disaggregate residency. Although U. Houston is a PUBLIC research university and oosAR is normally in eligible scope, per pipeline rule for public schools with blank CDS section, mark UNAVAILABLE/OFFICIAL_BLANK_SECTION. Prior DB value 67.32 (HEURISTIC tier, PERMANENT_HEURISTIC source) had no official backing. CORRECTION: clear DB value to null.',
      realDataStatus: 'OFFICIAL_BLANK_SECTION',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. U. Houston does not offer Early Decision. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance refreshed to 2024-25 cycle, realDataStatus tightened to NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. U. Houston does not offer Early Action. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance refreshed to 2024-25 cycle, realDataStatus tightened to NOT_OFFERED.',
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
      acceptanceRate: new Prisma.Decimal('73.93'),
      sat25: 1170,
      sat75: 1330,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated (AR=73.93, sat25=1170, sat75=1330, intlAR=BLANK, oosAR=BLANK, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
  console.log('=== After update ===');
  console.log(
    `  AR=${after?.acceptanceRate?.toString()} sat25=${after?.sat25} sat75=${after?.sat75} intlAR=${after?.intlAcceptanceRate?.toString() ?? 'null'} oosAR=${after?.oosAcceptanceRate?.toString() ?? 'null'} edAR=${after?.edAcceptanceRate?.toString() ?? 'null'} eaAR=${after?.eaAcceptanceRate?.toString() ?? 'null'} hasED=${after?.hasEarlyDecision}`,
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
