#!/usr/bin/env tsx
/**
 * Phase 3 — University of Southern Mississippi end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: University of Southern Mississippi CDS 2024-2025 (Fall 2024)
 *   URL: https://www.usm.edu/institutional-research/cds_2024_2025_final.pdf
 *
 * USM is a PUBLIC Mississippi research university (R1).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 93     -> 99.12  (CDS 2024-25 C1: 2,582 men + 4,466
 *                          women = 7,048 applied; 2,551 + 4,435 = 6,986 admitted.
 *                          AR = 6,986 / 7,048 = 99.1203%. USM is essentially
 *                          open-admission (per C7 only GPA + test scores are
 *                          "Very Important"; C6 explicitly "Other:No" for open
 *                          admission). Prior DB 93 was close but stale; tier
 *                          upgraded LEGACY_DB_VALUE -> OFFICIAL.)
 *   - sat25             : 990    -> null   (CDS 2024-25 C9: SAT Composite
 *                          25th/50th/75th cells are LEFT BLANK. Only ACT
 *                          reported (98.62% submitted ACT = 1,721 of 1,745
 *                          enrolled). The SAT submission rate is below CDS
 *                          publication threshold (<25 students for SAT means
 *                          USM suppresses SAT percentiles). Per rules
 *                          C9 prefers Composite; USM publishes no SAT.
 *                          Prior DB sat25=990 was sourced from PrepScholar
 *                          (not CDS); cleared to null with
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *   - sat75             : 1190   -> null   (Same as sat25 — CDS 2024-25 C9
 *                          SAT Composite 75th cell BLANK. PrepScholar prior
 *                          value cleared. Tier OFFICIAL/CDS_PDF_AUTO ->
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/
 *                          NOT_REPORTED_BY_CDS.)
 *   - intlAcceptanceRate: 88.35  -> null   (CDS 2024-25 C1 residency table:
 *                          APPLIED and ADMITTED rows show TOTAL=0 — only the
 *                          ENROLLED row is populated (in-state 1,147, OOS 384,
 *                          international 200, total 1,731). USM does not
 *                          publish residency breakdown for applied/admitted.
 *                          Prior DB 88.35 was PERMANENT_HEURISTIC. Cleared to
 *                          null with UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *   - oosAcceptanceRate : 94.86  -> null   (Same as intlAR — C1 residency
 *                          APPLIED/ADMITTED rows are blank in CDS 2024-25.
 *                          Cannot derive OOS admit rate. Prior DB 94.86 was
 *                          PERMANENT_HEURISTIC. Cleared to null with
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *   - edAcceptanceRate  : null   -> null   (CDS 2024-25 C21: ED checkbox
 *                          unchecked AND all date/count fields blank.
 *                          USM does not offer ED. Tier transitions
 *                          OFFICIAL/CDS_LLM_EXTRACT_2026_04 (stale assertion)
 *                          -> UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : null   -> null   (CDS 2024-25 C22: "Do you have a
 *                          nonbinding early action plan?" — NO checked.
 *                          USM does not offer EA.)
 *
 * NOTE on hasEarlyDecision: existing DB true is incorrect per CDS C21.
 *   Correcting to false.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.usm.edu/institutional-research/cds_2024_2025_final.pdf';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8isj0037z0tihc4cw8ue';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (USM) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC Mississippi R1]`);
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
    generatedBy: 'phase3-batch27-usm',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 99.12,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 7,048 applied (2,582 men + 4,466 women); 6,986 admitted (2,551 + 4,435). AR = 6,986 / 7,048 = 99.1203% (rounded to 99.12%). USM is essentially open-admission (CDS C6 Other:No, C7 only Academic GPA + Standardized test scores rated "Very Important", everything else "Not Considered"). Prior DB 93 was close but stale (~6pp low). Tier upgraded LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th/50th/75th percentile cells are LEFT BLANK. Only ACT submitted (98.62% = 1,721 of 1,745 enrolled). SAT submission rate is below the CDS publication threshold (<25 SAT submitters), so USM suppresses SAT percentiles per CDS convention. Prior DB sat25=990 was sourced from PrepScholar (NOT a CDS source). Cleared to null. Tier OFFICIAL/CDS_PDF_AUTO (with wrong source URL) -> UNAVAILABLE/OFFICIAL_BLANK_SECTION. NOTE: ACT Composite 25/50/75 IS available (20/24/29) but ACT fields are out of scope for sat25/sat75.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    sat75: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th cell BLANK (SAT suppressed due to <25 submitters; USM is ACT-dominant per Mississippi practice). Prior DB sat75=1190 was PrepScholar-sourced, not CDS. Cleared to null with UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_REPORTED_BY_CDS.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: the APPLIED and ADMITTED rows show TOTAL=0 (USM left in-state/OOS/intl APPLIED and ADMITTED columns BLANK). Only the ENROLLED row is populated (in-state 1,147, OOS 384, international 200, total 1,731). USM does not publish residency breakdown for applicants/admits in CDS 2024-25. Cannot derive a CDS-official intl admit rate. Prior DB 88.35 was INFERRED/PERMANENT_HEURISTIC. Cleared to null with UNAVAILABLE/OFFICIAL_BLANK_SECTION.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: APPLIED/ADMITTED rows blank for all residency columns (only ENROLLED row populated). Cannot derive OOS admit rate. Prior DB 94.86 was INFERRED/PERMANENT_HEURISTIC. Cleared to null with UNAVAILABLE/OFFICIAL_BLANK_SECTION. Field stays open for next CDS cycle.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — both Yes/No checkboxes unchecked AND all date/count fields blank. Per CDS convention, blank + no application count => no ED plan. USM does not offer Early Decision. Stale CDS_LLM_EXTRACT_2026_04 OFFICIAL provenance refreshed to UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. USM does not offer Early Action.',
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
      acceptanceRate: new Prisma.Decimal('99.12'),
      sat25: null,
      sat75: null,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 ED not offered — correct stale DB true.
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=99.12, sat25=NULL, sat75=NULL, intlAR=NULL, oosAR=NULL, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
