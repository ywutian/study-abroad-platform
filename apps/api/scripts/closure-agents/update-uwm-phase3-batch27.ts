#!/usr/bin/env tsx
/**
 * Phase 3 — University of Wisconsin–Milwaukee end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: University of Wisconsin–Milwaukee CDS 2024-2025 (Fall 2024)
 *   URL: https://uwm.edu/institutional-research/wp-content/uploads/sites/268/2025/07/2024-2025-CDS-Public.xlsx
 *
 * UWM is a PUBLIC Wisconsin doctoral/research university (R1).
 *
 * NOTE on source format: UWM's 2024-2025 CDS is published as the official
 * CDS Excel template (per UWM IR landing page, the new CDS template format
 * is published as an Excel sheet rather than PDF starting 2024-2025).
 * The Excel was unpacked and the Section C data extracted directly. Section
 * codes referenced below (C1=admissions, C9=test scores, C21=ED, C22=EA) use
 * the standard CDS Section C numbering preserved in the new Excel template.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 94.6   -> 97.11  (CDS 2024-25 C1: 15,059 applied
 *                          (men 6,425 + women 8,615 + another 6 + unknown 13)
 *                          and 14,624 admitted (6,160 + 8,445 + 6 + 13).
 *                          AR = 14,624 / 15,059 = 97.1113%. Prior DB 94.6
 *                          was close but stale. Tier upgraded
 *                          LEGACY_DB_VALUE -> OFFICIAL.)
 *   - sat25             : 990    -> null   (CDS 2024-25 C9 SAT Composite
 *                          25/50/75 ALL BLANK. UWM is test-optional (per
 *                          C8A) and did not publish SAT percentiles — SAT
 *                          submission rate appears to be below the CDS
 *                          publication threshold. Prior DB sat25=990 was
 *                          sourced from a Reddit URL (NOT a CDS source).
 *                          Cleared to null with UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION.)
 *   - sat75             : 1180   -> null   (Same as sat25 — CDS 2024-25 C9
 *                          SAT Composite 75th cell BLANK. Reddit-sourced
 *                          prior value cleared. Tier OFFICIAL/CDS_PDF_AUTO
 *                          (with wrong Reddit source URL) ->
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *   - intlAcceptanceRate: 80.6   -> 79.32  (CDS 2024-25 C1 residency table:
 *                          Nonresidents 1,509 applied / 1,197 admitted.
 *                          intlAR = 1,197 / 1,509 = 79.3240%. Prior DB
 *                          80.6 was close but slightly stale; tier upgraded
 *                          LEGACY_DB_VALUE -> OFFICIAL.)
 *   - oosAcceptanceRate : 96.6   -> 99.22  (CDS 2024-25 C1 residency table:
 *                          Out-of-state 3,351 applied / 3,325 admitted.
 *                          oosAR = 3,325 / 3,351 = 99.2241%. Prior DB 96.6
 *                          was slightly stale; tier upgraded
 *                          LEGACY_DB_VALUE -> OFFICIAL. Public school =
 *                          eligible for oosAR=OFFICIAL per scope rules.)
 *   - edAcceptanceRate  : null   -> null   (CDS 2024-25 C21: H802=No.
 *                          UWM does not offer Early Decision. Tier stays
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : 88.9   -> null   (CDS 2024-25 C22: H802=No. UWM
 *                          does NOT offer Early Action per the official
 *                          CDS Excel. Prior DB 88.9 was from TAVILY_ENRICHMENT
 *                          (web-scrape heuristic), not CDS. Cleared to null
 *                          with UNAVAILABLE/OFFICIAL_BLANK_SECTION/
 *                          NOT_OFFERED.)
 *
 * NOTE on hasEarlyDecision: existing DB true is incorrect per CDS C21=No.
 *   Correcting to false.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://uwm.edu/institutional-research/wp-content/uploads/sites/268/2025/07/2024-2025-CDS-Public.xlsx';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iso003az0tilgsdacqo';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UWM) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC Wisconsin R1]`);
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
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-batch27-uwm',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 97.11,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1 (UWM official Excel template): 15,059 total applied (men 6,425 + women 8,615 + another 6 + unknown 13); 14,624 admitted (6,160 + 8,445 + 6 + 13). AR = 14,624 / 15,059 = 97.1113% (rounded to 97.11%). Prior DB 94.6 was sourced from the old 2023-24 CDS URL (LEGACY_DB_VALUE). Tier upgraded LEGACY_DB_VALUE -> OFFICIAL with refreshed 2024-25 cycle.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'CDS 2024-25 Section C9 (UWM Excel C901–C913): all SAT submission count and SAT Composite/EBRW/Math 25th/50th/75th percentile cells are LEFT BLANK. UWM is test-optional per C8A and did not publish SAT percentiles — SAT submission rate is below the CDS publication threshold. Prior DB sat25=990 was sourced from a Reddit thread URL (NOT a CDS source). Cleared to null with UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_REPORTED_BY_CDS.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    sat75: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'CDS 2024-25 Section C9 SAT Composite 75th cell BLANK (same suppression as sat25). Reddit-sourced prior DB value cleared. Tier OFFICIAL/CDS_PDF_AUTO (with non-official URL) -> UNAVAILABLE/OFFICIAL_BLANK_SECTION.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 79.32,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency breakdown (UWM Excel C126–C131): Nonresidents (international) 1,509 applied / 1,197 admitted. intlAR = 1,197 / 1,509 = 79.3240% (rounded to 79.32%). Prior DB 80.6 was close (LEGACY_DB_VALUE from 2023-24 CDS); tier upgraded LEGACY_DB_VALUE -> OFFICIAL with refreshed 2024-25 cycle.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 99.22,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency breakdown (UWM Excel C123–C125): Out-of-state 3,351 applied / 3,325 admitted. oosAR = 3,325 / 3,351 = 99.2241% (rounded to 99.22%). Public school = in eligible scope for oosAR=OFFICIAL per closure rules. Prior DB 96.6 was LEGACY_DB_VALUE from 2023-24 CDS; tier upgraded LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21 (UWM Excel C2101): H802 = "No". UWM does not offer Early Decision. All ED date and applicant-count fields are blank. Tier stays UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED; refreshed cycle.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22 (UWM Excel C2201): H802 = "No". UWM does NOT offer a nonbinding Early Action plan per the official CDS Excel. Prior DB eaAR=88.9 was from TAVILY_ENRICHMENT (web-scrape heuristic from a non-CDS source), incorrectly asserting UWM has EA. Cleared to null with UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED — CDS supersedes the heuristic.',
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
      acceptanceRate: new Prisma.Decimal('97.11'),
      sat25: null,
      sat75: null,
      intlAcceptanceRate: new Prisma.Decimal('79.32'),
      oosAcceptanceRate: new Prisma.Decimal('99.22'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 ED=No — correct stale DB true.
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=97.11, sat25=NULL, sat75=NULL, intlAR=79.32, oosAR=99.22, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
    `  AR=${after?.acceptanceRate?.toString()} sat25=${after?.sat25 ?? 'null'} sat75=${after?.sat75 ?? 'null'}`,
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
