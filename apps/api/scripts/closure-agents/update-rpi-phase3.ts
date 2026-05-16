#!/usr/bin/env tsx
/**
 * Phase 3 (batch14) — Rensselaer Polytechnic Institute (RPI) end-to-end
 * closure of the 7 prediction-critical fields.
 *
 * Source: RPI CDS 2025-2026 (Fall 2025 entering class)
 *   URL: https://rpi.app.box.com/s/fkqisnv4wxanikf1yfpw0yvajjtupg2z
 *   (download endpoint:
 *    https://rpi.app.box.com/index.php?rm=box_download_shared_file&shared_name=fkqisnv4wxanikf1yfpw0yvajjtupg2z&file_id=f_2124448461502)
 *   Index: https://provost.rpi.edu/institutional-research-and-assessment
 *
 * NOTE: RPI is a PRIVATE institution (isPrivate=true). Per closure-pipeline
 *   convention, oosAcceptanceRate is OUT of eligible scope and marked
 *   UNAVAILABLE/TERMINAL (no in-state policy meaning at a private LAC/STEM
 *   institution).
 *
 * Existing DB values (pre-update):
 *   - AR=56.1, sat25=1340, sat75=1480, intlAR=53.3, oosAR=56.1, edAR=57.92,
 *     eaAR=57.9 — all SEED/LEGACY tier. CDS 2025-26 gives definitive updates.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 56.1   -> 67.25  (CDS C1: 9,655 admits / 14,356
 *                          applicants = 67.2541%. Tier upgrade
 *                          LEGACY_DB->OFFICIAL. CORRECTION UP +11.15pp —
 *                          RPI's admit rate has trended upward in recent
 *                          cycles per CDS.)
 *   - sat25             : 1340   -> 1380   (CDS C9: SAT Composite 25th =
 *                          1380 reported directly. CORRECTION UP +40 from
 *                          prior 1340 (LEGACY_DB).)
 *   - sat75             : 1480   -> 1500   (CDS C9: SAT Composite 75th =
 *                          1500 reported directly. CORRECTION UP +20 from
 *                          prior 1480 (LEGACY_DB).)
 *   - intlAcceptanceRate: 53.3   -> 56.24  (CDS C1 residency: 613 intl
 *                          admits / 1,090 intl applicants = 56.2385%
 *                          (rounded to 56.24%). Tier upgrade
 *                          HEURISTIC/PERMANENT_HEURISTIC->OFFICIAL.
 *                          CORRECTION UP +2.94pp.)
 *   - oosAcceptanceRate : 56.1   -> null   (RPI is a private STEM-focused
 *                          institution; in-state / out-of-state distinction
 *                          carries no policy meaning. CDS C1 residency does
 *                          report OOS (6,125 admits / 8,947 applicants =
 *                          68.46%) but per closure-pipeline convention,
 *                          private schools -> UNAVAILABLE/TERMINAL. Prior
 *                          legacy HEURISTIC value cleared.)
 *   - edAcceptanceRate  : 57.92  -> 69.09  (CDS C21: "Yes" — RPI offers
 *                          two ED plans: ED I closes 11/1 (12/14
 *                          notification), ED II closes 1/3 (1/25
 *                          notification). For Fall 2024 entering class
 *                          (reported in CDS 2025-26 C21): 219 ED admits /
 *                          317 ED applications = 69.0852% (rounded to
 *                          69.09%). Tier upgrade LEGACY_DB->OFFICIAL.
 *                          CORRECTION UP +11.17pp. NOTE: CDS C21 reports
 *                          PRIOR cycle ED counts (Fall 2024) even in the
 *                          2025-26 CDS — this is per CDS convention.)
 *   - eaAcceptanceRate  : 57.9   -> null   (CDS C22: "Yes" — RPI offers a
 *                          nonbinding Early Action plan with closing 12/1
 *                          and notification 1/29. HOWEVER, CDS C22 does NOT
 *                          report EA applicants or admits (only dates).
 *                          Prior DB value 57.9 (TAVILY_ENRICHMENT) is not
 *                          an authoritative CDS-published EA-cohort admit
 *                          rate. Field cleared to null; tier
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION (plan exists
 *                          but counts not published).)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL = 'https://rpi.app.box.com/s/fkqisnv4wxanikf1yfpw0yvajjtupg2z';
const CDS_INDEX_URL =
  'https://provost.rpi.edu/institutional-research-and-assessment';
const CYCLE_YEAR = 2025; // CDS 2025-2026 = Fall 2025 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8inf000uz0tic8a7s8is';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (RPI) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PRIVATE — oosAR is TERMINAL]`);
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
    verifiedBy: 'closure-pipeline-phase3-batch14-claude',
    generatedBy: 'phase3-batch14-rpi-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 67.25,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2025-26 Section C1: 9,655 admits / 14,356 applicants = 67.2541% (rounded to 67.25%). Tier upgraded from LEGACY_DB (value 56.1) to OFFICIAL. CORRECTION UP +11.15pp — RPI admit rate has trended upward in recent cycles.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1380,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2025-26 Section C9: SAT Composite 25th = 1380 (reported directly). CORRECTION UP +40 from prior 1340 (LEGACY_DB). 53% of Fall 2025 enrolled (733 students) submitted SAT.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1500,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2025-26 Section C9: SAT Composite 75th = 1500 (reported directly). CORRECTION UP +20 from prior 1480 (LEGACY_DB).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 56.24,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2025-26 Section C1 residency table: 613 international admits / 1,090 international applicants = 56.2385% (rounded to 56.24%). Tier upgraded from HEURISTIC/PERMANENT_HEURISTIC (value 53.3) to OFFICIAL. CORRECTION UP +2.94pp.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Rensselaer Polytechnic Institute is a private STEM-focused research institution; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage; ~60% of enrollment is OOS per CDS C1). CDS C1 residency table does report OOS (6,125 admits / 8,947 applicants = 68.46%), but the value is not actionable for applicants. Prior legacy HEURISTIC value (56.1%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 69.09,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2025-26 Section C21: RPI offers Early Decision ("Yes" checked) with two plans — ED I closes 11/1 (12/14 notification), ED II closes 1/3 (1/25 notification). Fall 2024 entering class combined totals (reported in 2025-26 CDS per convention): 219 admits / 317 ED applications = 69.0852% (rounded to 69.09%). Tier upgraded LEGACY_DB (value 57.92) -> OFFICIAL. CORRECTION UP +11.17pp.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2025-26 Section C22: "Yes" — RPI offers a nonbinding Early Action plan (closing 12/1, notification 1/29, not restrictive). HOWEVER, RPI does not publish EA-specific applicant or admit counts in CDS C22 (only dates). Prior DB value 57.9 (TAVILY_ENRICHMENT) is not an authoritative CDS-published EA-cohort admit rate. Field cleared to null; tier UNAVAILABLE/OFFICIAL_BLANK_SECTION (EA plan exists but counts not published in CDS).',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(school.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: CDS_INDEX_URL,
  };

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('67.25'),
      sat25: 1380,
      sat75: 1500,
      intlAcceptanceRate: new Prisma.Decimal('56.24'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('69.09'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true, // re-confirm from CDS C21 "Yes"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=67.25, sat25=1380, sat75=1500, intlAR=56.24, oosAR=N/A-TERMINAL, edAR=69.09, eaAR=OFFERED_NO_COUNTS, hasED=true)',
  );

  // verify
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
