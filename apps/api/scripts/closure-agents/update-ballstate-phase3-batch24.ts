#!/usr/bin/env tsx
/**
 * Phase 3 — Ball State University (Muncie, IN) end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: Ball State University Common Data Set 2024-2025 (Fall 2024 entering
 *   class) published by Office of Institutional Research and Decision Support.
 *   PDF: https://www.bsu.edu/-/media/www/departmentalcontent/oirds/files/common-data-set/2024-2025-cds.pdf
 *
 * Ball State is a PUBLIC research university (A2 "Public" checked) — oosAR is
 *   in eligible scope and carries the real CDS number, not TERMINAL.
 *
 * Value validation (vs. existing DB):
 *   - acceptanceRate    : 85.5    ~  85.50 (CDS C1: 18,034 admits / 21,093
 *                          first-time, first-year applicants = 85.4975%
 *                          (rounded 85.50). Tier LEGACY_DB_VALUE -> OFFICIAL.)
 *   - sat25             : 1080    =  1080 (CDS C9: SAT Composite 25th = 1080.
 *                          NO CHANGE. Tier OFFICIAL via wrong URL
 *                          (clastify.com) -> OFFICIAL anchored to official CDS
 *                          PDF.)
 *   - sat75             : 1240    =  1240 (CDS C9: SAT Composite 75th = 1240.
 *                          NO CHANGE. Tier re-anchored.)
 *   - intlAcceptanceRate: 100     =  100.00 (CDS C1 residency: 1065 intl
 *                          admits / 1065 intl applicants = 100.00%. Surprising
 *                          but exact match — Ball State admitted every intl
 *                          applicant in the Fall 2024 cycle. NO CHANGE. Tier
 *                          LEGACY_DB_VALUE -> OFFICIAL.)
 *   - oosAcceptanceRate : 56.4    ~  56.44 (CDS C1 residency: 3,961 OOS
 *                          admits / 7,018 OOS applicants = 56.4406%
 *                          (rounded 56.44). PUBLIC — real policy meaning.
 *                          Tier LEGACY_DB_VALUE -> OFFICIAL, minor precision
 *                          bump.)
 *   - edAcceptanceRate  : null    -> null  (CDS C21: "No" — Ball State does
 *                          NOT offer Early Decision. Already null in DB.
 *                          Existing OFFICIAL CDS_LLM_EXTRACT_2026_04 tier
 *                          stays correctly NULL but re-stamped as explicit
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : 85.5    -> null  (CDS C22: "No" — Ball State does
 *                          NOT offer Early Action either. DB value 85.5 from
 *                          TAVILY_ENRICHMENT is spurious (likely conflated
 *                          with overall AR). Clear value, mark NOT_OFFERED.)
 *
 * NOTE on hasEarlyDecision: current DB value is TRUE, but CDS C21 = "No" and
 *   C22 = "No". Ball State offers only rolling/regular admission. Setting to
 *   FALSE to match CDS.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.bsu.edu/-/media/www/departmentalcontent/oirds/files/common-data-set/2024-2025-cds.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ir4002hz0tibdz0myoo';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Ball State) not found`);
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
    generatedBy: 'phase3-ballstate-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 85.5,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 18,034 admits / 21,093 first-time, first-year applicants = 85.4975% (rounded to 85.50%, displayed as 85.5). Tier LEGACY_DB_VALUE -> OFFICIAL anchored to the official Ball State CDS PDF.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1080,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1080 (reported directly). Re-anchored from prior OFFICIAL provenance that wrongly cited clastify.com aggregator to the official Ball State CDS PDF. Value unchanged.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1240,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1240 (reported directly). Re-anchored from prior OFFICIAL provenance that wrongly cited clastify.com aggregator to the official Ball State CDS PDF. Value unchanged.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 100.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 1,065 international admits / 1,065 international applicants = 100.0000%. Ball State admitted every international first-time, first-year applicant in Fall 2024. Surprising but verbatim from the official CDS. Tier LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 56.44,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 3,961 out-of-state admits / 7,018 out-of-state applicants = 56.4406% (rounded to 56.44%). Ball State is a PUBLIC research university (Muncie, IN) — in-state vs. out-of-state distinction carries policy meaning. Tier LEGACY_DB_VALUE (56.4) -> OFFICIAL with full precision from CDS.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. Ball State does NOT offer Early Decision (only regular/rolling admission). Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Re-stamped from prior CDS_LLM_EXTRACT_2026_04 OFFICIAL to explicit NOT_OFFERED to align with closure-pipeline convention.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. Ball State does NOT offer Early Action. Prior DB value of 85.5 (TAVILY_ENRICHMENT) is spurious — likely conflated with overall acceptance rate. Cleared to null and marked NOT_OFFERED.',
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
      acceptanceRate: new Prisma.Decimal('85.50'),
      sat25: 1080,
      sat75: 1240,
      intlAcceptanceRate: new Prisma.Decimal('100.00'),
      oosAcceptanceRate: new Prisma.Decimal('56.44'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" and C22 "No" — Ball State offers only rolling/regular
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=85.50, sat25=1080, sat75=1240, intlAR=100.00, oosAR=56.44, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
