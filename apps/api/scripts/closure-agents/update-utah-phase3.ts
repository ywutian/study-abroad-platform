#!/usr/bin/env tsx
/**
 * Phase 3 — University of Utah end-to-end closure of the 7 prediction-critical
 * fields.
 *
 * Source: University of Utah CDS 2024-2025 (Fall 2024 entering class),
 *   Office of Budget & Institutional Analysis (data.utah.edu).
 *   URL: https://data.utah.edu/wp-content/uploads/sites/61/2025/07/CDS-2024-2025-Template-for-Website.pdf
 *
 * University of Utah is a PUBLIC flagship research university (Salt Lake
 *   City, UT).
 *   - isPrivate=false  ->  oosAcceptanceRate is in eligible scope and MUST
 *     carry a real OFFICIAL number extracted from CDS C1 residency table.
 *
 * Test policy (CDS C8A): TEST-OPTIONAL — Utah's PDF form fields do not
 *   expose which C8A radio is checked, but the combined SAT+ACT submission
 *   rate of ~48% (10% SAT + 38% ACT) confirms a test-optional regime. Per
 *   closure-pipeline convention, SAT band is still recorded as OFFICIAL for
 *   descriptive applicant-profile use (not a gating threshold).
 *
 * ED/EA (CDS C21/C22, via PDF form fields):
 *   - C21 AD_EDEC = '/N' — Utah does NOT offer Early Decision.
 *     (Existing DB hasEarlyDecision=true is STALE — being corrected to false.)
 *   - C22 AD_EACT = '/Y' — Utah offers nonbinding EA. Closing 12/1,
 *     notification 1/15, AP_EACT_RESTRICT = '/N' (non-restrictive).
 *     EA applicant/admit count fields (AP_RECD_EDEC_N, AP_ADMT_EDEC_N) and
 *     the corresponding EA-specific fields are empty — admit counts not
 *     published in CDS. Per closure-pipeline convention:
 *     UNAVAILABLE/OFFICIAL_BLANK_SECTION.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 85.98  -> 85.98  (CDS 2024-25 C1: AP_ADMT_1ST_N
 *                          23,062 / AP_RECD_1ST_N 26,822 = 85.9817% (rounds
 *                          to 85.98%) — matches prior. Tier upgraded
 *                          LEGACY_DB -> OFFICIAL with verified cycle/source.)
 *   - sat25             : 1120   -> 1200   (CDS 2024-25 C9: SAT1_COMP_25TH_P
 *                          = 1200 reported directly. CORRECTION UP +80 from
 *                          prior 1120 (LEGACY_DB heuristic — likely from an
 *                          older cycle). Utah test-optional: 10% submitted SAT.)
 *   - sat75             : 1340   -> 1370   (CDS 2024-25 C9: SAT1_COMP_75TH_P
 *                          = 1370 reported directly. CORRECTION UP +30 from
 *                          prior 1340.)
 *   - intlAcceptanceRate: 92.7   -> 92.70  (CDS 2024-25 C1 residency:
 *                          AP_ADMT_INTL_1ST_N 711 / AP_RECD_INTL_1ST_N 767
 *                          = 92.6988% (rounded to 92.70%). Tier upgraded
 *                          LEGACY_DB -> OFFICIAL with no value change.)
 *   - oosAcceptanceRate : 84.52  -> 84.52  (CDS 2024-25 C1 residency:
 *                          AP_ADMT_NRES_1ST_N 14,429 / AP_RECD_NRES_1ST_N
 *                          17,071 = 84.5235% (rounded to 84.52%) — matches
 *                          prior. Utah is a PUBLIC flagship — oosAR carries
 *                          a real number. In-state cohort: 7,922/8,984 =
 *                          88.18%. Tier upgraded LEGACY_DB -> OFFICIAL.)
 *   - edAcceptanceRate  : null   -> null   (CDS C21 AD_EDEC = '/N' — Utah
 *                          does not offer ED. Field stays cleared
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION. Provenance
 *                          refreshed to verified 2024-25 cycle pull.)
 *   - eaAcceptanceRate  : 86     -> null   (CDS C22 AD_EACT = '/Y' — Utah
 *                          offers EA (closing 12/1; non-restrictive) BUT EA
 *                          applicant/admit count fields are empty — admit
 *                          counts not published in CDS. Prior 86.0% was
 *                          TAVILY_ENRICHMENT — not authoritative for EA
 *                          (Utah's overall AR is 85.98%, so 86 looks like an
 *                          erroneous re-extraction of the overall rate). Cleared
 *                          to null and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *
 * NOTE on hasEarlyDecision: current DB value is true, but CDS C21 AD_EDEC
 *   = '/N'. Setting to false to match CDS reality.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://data.utah.edu/wp-content/uploads/sites/61/2025/07/CDS-2024-2025-Template-for-Website.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iob001dz0ti3go71xpz';

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
    throw new Error(`School ${SCHOOL_ID} (University of Utah) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC]`);
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
    generatedBy: 'phase3-utah-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 85.98,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1 (PDF form fields): AP_ADMT_1ST_N 23,062 / AP_RECD_1ST_N 26,822 = 85.9817% (rounded to 85.98%) — matches prior DB value. Tier upgraded from LEGACY_DB to OFFICIAL with verified cycle/source.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1200,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9 (PDF form field SAT1_COMP_25TH_P): SAT Composite 25th = 1200 (reported directly). CORRECTION UP +80 from prior 1120 (LEGACY_DB heuristic, likely from older cycle). NOTE: Utah is test-optional — only 10% (574) submitted SAT vs 38% (2,252) submitted ACT (ACT Composite 25/75 = 22/29). SAT band recorded for descriptive applicant-profile use only, not as a gating threshold.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1370,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9 (PDF form field SAT1_COMP_75TH_P): SAT Composite 75th = 1370 (reported directly). CORRECTION UP +30 from prior 1340 (LEGACY_DB heuristic). Utah test-optional: 10% submitted SAT. SAT band descriptive only.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 92.7,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table (PDF form fields): AP_ADMT_INTL_1ST_N 711 / AP_RECD_INTL_1ST_N 767 = 92.6988% (rounded to 92.70%). Tier upgraded from LEGACY_DB (value 92.7) to OFFICIAL with no value change.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 84.52,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table (PDF form fields): AP_ADMT_NRES_1ST_N 14,429 / AP_RECD_NRES_1ST_N 17,071 = 84.5235% (rounded to 84.52%) — matches prior. Utah is a PUBLIC flagship — in-state vs out-of-state distinction carries real policy meaning (different tuition; in-state cohort 7,922/8,984 = 88.18%). Tier upgraded LEGACY_DB -> OFFICIAL with verified cycle/source.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21 (PDF form field AD_EDEC = "/N"): "Does your institution offer an early decision plan?" — NO. Utah does not offer Early Decision. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance refreshed to verified 2024-25 cycle pull. NOTE: existing DB hasEarlyDecision=true is STALE — being corrected to false in this update.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22 (PDF form field AD_EACT = "/Y"; closing 12/1; AP_EACT_RESTRICT = "/N", non-restrictive): Utah offers nonbinding EA. However, EA applicant/admit count fields are empty in the form — admit counts not published in CDS. Prior DB value 86.0% was TAVILY_ENRICHMENT — not authoritative (notably suspicious because Utah\'s overall AR is 85.98%, so 86 appears to be an erroneous re-extraction of the overall AR rather than a real EA-specific number). Cleared to null and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION (EA program confirmed exists; admit numbers not officially published).',
      realDataStatus: 'NOT_REPORTED',
    },
  };

  const existingMeta = toRecord(school.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: CDS_URL,
  };

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('85.98'),
      sat25: 1200,
      sat75: 1370,
      intlAcceptanceRate: new Prisma.Decimal('92.70'),
      oosAcceptanceRate: new Prisma.Decimal('84.52'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 AD_EDEC = '/N' — Utah does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=85.98, sat25=1200, sat75=1370, intlAR=92.70, oosAR=84.52, edAR=NOT_OFFERED, eaAR=NOT_REPORTED, hasED=false)',
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
