#!/usr/bin/env tsx
/**
 * Phase 3 — University of North Carolina at Chapel Hill (UNC) closure of
 * the 7 prediction-critical fields.
 *
 * Source: UNC-CH CDS 2024-2025 (Fall 2024 entering class), published by
 *   UNC Office of Institutional Research and Assessment (OIRA).
 *   URL: https://oira.unc.edu/wp-content/uploads/sites/297/2025/08/CDS_UNCCH_2024-25_20250829.pdf
 *
 * UNC is PUBLIC. Per closure convention, oosAR is in eligible scope and
 * carries the real CDS residency number.
 *
 * Early plan profile: UNC does NOT offer Early Decision (C21 "No"). UNC
 * offers non-restrictive Early Action (C22 "Yes", restrictive=No, closing
 * 10/15, notification 1/31). However the CDS does not publish EA
 * application/admit counts, so eaAR is marked UNAVAILABLE /
 * OFFICIAL_BLANK_SECTION even though the EA plan exists. (Prior DB value
 * eaAR=20 came from TAVILY_ENRICHMENT — not from CDS, cleared.)
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 15.34  -> 15.34 (CDS C1: 10,209 / 66,535 =
 *                          15.3438%. Confirmed. Tier upgraded LEGACY_DB ->
 *                          OFFICIAL.)
 *   - sat25             : 1360   -> 1400  (CDS C9 SAT Composite 25th = 1400
 *                          reported directly. CORRECTION UP +40 from prior
 *                          LEGACY_DB 1360.)
 *   - sat75             : 1490   -> 1530  (CDS C9 SAT Composite 75th = 1530
 *                          reported directly. CORRECTION UP +40 from prior
 *                          LEGACY_DB 1490.)
 *   - intlAcceptanceRate: 6.4    -> 14.28 (CDS C1 residency Intl: 1,128 /
 *                          7,897 = 14.2839%. BIG CORRECTION UP. Prior 6.4%
 *                          LEGACY_DB appears to have been derived from
 *                          enrollment-vs-applicant rather than admit-vs-
 *                          applicant, or from an outdated cycle. Tier
 *                          upgraded LEGACY_DB -> OFFICIAL.)
 *   - oosAcceptanceRate : 6.63   -> 6.63  (CDS C1 residency OOS: 2,792 /
 *                          42,085 = 6.6320%. Value matches; tier upgraded
 *                          LEGACY_DB -> OFFICIAL. As expected for a public
 *                          flagship with strong in-state preference (UNC's
 *                          in-state admit rate is 6,289/16,553 = 37.99% for
 *                          context — 5.7x the OOS rate).)
 *   - edAcceptanceRate  : null   -> null  (CDS C21 "No" — UNC does not
 *                          offer ED. UNAVAILABLE / NOT_OFFERED.)
 *   - eaAcceptanceRate  : 20     -> null  (CDS C22 "Yes" non-restrictive,
 *                          but C22 application/admit counts BLANK. Prior
 *                          value 20% (TAVILY_ENRICHMENT, not CDS) cleared.
 *                          Marked UNAVAILABLE / OFFICIAL_BLANK_SECTION.)
 *
 * hasEarlyDecision: false (re-confirm CDS C21 "No").
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://oira.unc.edu/wp-content/uploads/sites/297/2025/08/CDS_UNCCH_2024-25_20250829.pdf';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmn1htkoe000mvqf2odaszvmk';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UNC) not found`);
  console.log(
    `Updating ${school.name} (${school.id})  isPrivate=${school.isPrivate}`,
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
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-unc-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 15.34,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 10,209 admits / 66,535 applicants = 15.3438% (rounded to 15.34%). Value matches prior DB; tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1400,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1400 (reported directly; EBRW 690 + Math 700 sum = 1390 differs because composite quantiles ≠ section sums). CORRECTION UP +40 from prior 1360 (LEGACY_DB). 28% of Fall 2024 enrolled (1,320 students) submitted SAT under SAT-optional policy.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1530,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1530 (reported directly; EBRW 750 + Math 780 sum = 1530 also coincides). CORRECTION UP +40 from prior 1490 (LEGACY_DB).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 14.28,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 1,128 international admits / 7,897 international applicants = 14.2839% (rounded to 14.28%). BIG CORRECTION UP from prior LEGACY_DB 6.4%. Prior value appears to have been derived from international enrolled (274) divided by international applicants — not the admit/applicant ratio — or from an outdated cycle. Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 6.63,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 2,792 out-of-state admits / 42,085 out-of-state applicants = 6.6320% (rounded to 6.63%). UNC-CH is a PUBLIC flagship subject to the NC state cap on out-of-state freshman enrollment (~18%), driving a sharp in-state vs. OOS admit-rate gap (in-state 6,289/16,553 = 37.99% for context — 5.7x the OOS rate). Value matches prior DB; tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. UNC-CH does not offer Early Decision. UNAVAILABLE / OFFICIAL_BLANK_SECTION (NOT_OFFERED). Provenance refreshed to 2024-25 cycle.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: UNC-CH offers nonbinding non-restrictive Early Action (closing 10/15, notification 1/31, restrictive=No). However the C22 application/admit/enrollment count fields are BLANK in the published CDS. Cannot extract an EA admit rate from the source. Prior DB value eaAR=20% came from TAVILY_ENRICHMENT (not CDS) and is cleared. Marked UNAVAILABLE / OFFICIAL_BLANK_SECTION even though the EA plan exists.',
      realDataStatus: 'OFFICIALLY_BLANK',
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
      acceptanceRate: new Prisma.Decimal('15.34'),
      sat25: 1400,
      sat75: 1530,
      intlAcceptanceRate: new Prisma.Decimal('14.28'),
      oosAcceptanceRate: new Prisma.Decimal('6.63'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      hasEarlyDecision: false, // CDS C21 "No"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=15.34, sat25=1400, sat75=1530, intlAR=14.28, oosAR=6.63 OFFICIAL, edAR=NOT_OFFERED, eaAR=BLANK)',
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
