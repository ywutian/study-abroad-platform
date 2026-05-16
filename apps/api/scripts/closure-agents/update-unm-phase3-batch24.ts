#!/usr/bin/env tsx
/**
 * Phase 3 — University of New Mexico (Albuquerque, NM) end-to-end closure of
 * the 7 prediction-critical fields.
 *
 * Source: University of New Mexico Common Data Set 2024-2025 (Fall 2024
 *   entering class) published by Office of Institutional Analytics.
 *   PDF: https://oia.unm.edu/resources/cds_24-25_pdf.pdf
 *
 * UNM is a PUBLIC flagship research university (A2 "Public" checked) — oosAR
 *   is in eligible scope and carries the real CDS number, not TERMINAL.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 79.5    ~  79.47 (CDS C1: 10,431 admits / 13,125
 *                          first-time, first-year applicants = 79.4743%
 *                          (rounded to 79.47%). Tier LEGACY_DB_VALUE ->
 *                          OFFICIAL.)
 *   - sat25             : null   -> 900   (CDS C9: SAT Composite 25th = 900.
 *                          Tier NO_PUBLIC_SOURCE/TERMINAL -> OFFICIAL.
 *                          Previous TERMINAL marker was incorrect — the
 *                          source URL pointed at washcoll.edu fact book,
 *                          unrelated to UNM. UNM publishes a fully populated
 *                          C9 table.)
 *   - sat75             : null   -> 1160  (CDS C9: SAT Composite 75th = 1160.
 *                          Tier NO_PUBLIC_SOURCE/TERMINAL -> OFFICIAL.
 *                          Same correction as sat25.)
 *   - intlAcceptanceRate: 31.6   ~  31.61 (CDS C1 residency: 244 intl
 *                          admits / 772 intl applicants = 31.6062% (rounded
 *                          to 31.61%). Tier LEGACY_DB_VALUE -> OFFICIAL,
 *                          minor precision bump.)
 *   - oosAcceptanceRate : 83.5   ~  83.46 (CDS C1 residency: 4,883 OOS
 *                          admits / 5,851 OOS applicants = 83.4558% (rounded
 *                          to 83.46%). PUBLIC flagship — real policy meaning.
 *                          Tier LEGACY_DB_VALUE -> OFFICIAL.)
 *   - edAcceptanceRate  : null   -> null  (CDS C21: "No" — UNM does NOT offer
 *                          Early Decision. Stays null. Re-stamped from
 *                          CDS_LLM_EXTRACT_2026_04 to explicit NOT_OFFERED.)
 *   - eaAcceptanceRate  : null   -> null  (CDS C22: "No" — UNM does NOT offer
 *                          Early Action either. Stays null. Re-stamped to
 *                          NOT_OFFERED.)
 *
 * NOTE on hasEarlyDecision: current DB value is TRUE, but CDS C21 = "No".
 *   UNM does not offer ED or EA — admissions are regular/rolling. Setting to
 *   FALSE to match CDS.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL = 'https://oia.unm.edu/resources/cds_24-25_pdf.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ir2002gz0tih2v6dubi';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UNM) not found`);
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
    verifiedBy: 'closure-pipeline-phase3-batch24-claude',
    generatedBy: 'phase3-unm-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 79.47,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 10,431 admits / 13,125 first-time, first-year applicants = 79.4743% (rounded to 79.47%). Tier LEGACY_DB_VALUE (79.5) -> OFFICIAL with full precision from the official UNM CDS PDF.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 900,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 900 (reported directly; 1,758 students out of 48% of enrolled cohort submitted SAT). Replaces prior NO_PUBLIC_SOURCE/TERMINAL marker that incorrectly cited a washcoll.edu fact book URL — UNM does publish a populated C9 table in its own CDS.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1160,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1160 (reported directly). Replaces prior NO_PUBLIC_SOURCE/TERMINAL marker that incorrectly cited a washcoll.edu fact book URL — UNM does publish a populated C9 table in its own CDS.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 31.61,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 244 international admits / 772 international applicants = 31.6062% (rounded to 31.61%). Tier LEGACY_DB_VALUE (31.6) -> OFFICIAL with full precision.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 83.46,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 4,883 out-of-state admits / 5,851 out-of-state applicants = 83.4558% (rounded to 83.46%). UNM is the PUBLIC flagship research university of New Mexico — in-state vs. out-of-state distinction carries policy meaning. Tier LEGACY_DB_VALUE (83.5) -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. UNM does NOT offer Early Decision (admissions are regular/rolling). Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Re-stamped from prior CDS_LLM_EXTRACT_2026_04 to explicit NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. UNM does NOT offer Early Action either. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Re-stamped from prior CDS_LLM_EXTRACT_2026_04 to explicit NOT_OFFERED.',
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
      acceptanceRate: new Prisma.Decimal('79.47'),
      sat25: 900,
      sat75: 1160,
      intlAcceptanceRate: new Prisma.Decimal('31.61'),
      oosAcceptanceRate: new Prisma.Decimal('83.46'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" and C22 "No" — UNM offers only regular/rolling
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=79.47, sat25=900, sat75=1160, intlAR=31.61, oosAR=83.46, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
