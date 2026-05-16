#!/usr/bin/env tsx
/**
 * Phase 3 — Brown University end-to-end closure of the 7 prediction-critical
 * fields (batch 6).
 *
 * Source: Brown University CDS 2024-2025 (Fall 2024 entering class).
 *
 *   NOTE ON SOURCE FORMAT: Brown's Office of Institutional Research has
 *   migrated the CDS 2024-2025 publication to a Tableau-only interactive
 *   dashboard (see https://oir.brown.edu/institutional-data/common-data-set
 *   which embeds the Tableau viz). The historical PDF path
 *   (https://oir.brown.edu/sites/default/files/2025-08/CDS_2024-2025.pdf)
 *   returns HTTP 404 — no static PDF is published for this cycle.
 *   This is the same situation as Pomona (see update-pomona-phase3.ts).
 *
 *   Per closure-pipeline convention, when CDS exists but is in a non-parseable
 *   form, we cite the official landing page + the Tableau dashboard URL as the
 *   authoritative source, with the verbatim numbers extracted from the
 *   Tableau visualization (cross-corroborated by two independent third-party
 *   summaries: cosmic.nyc and koppelmangroup.com, both reporting identical
 *   verbatim values, indicating they sourced from the same official dashboard).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 5.16     → 5.39   (CDS C1: 2,638 admits / 48,904
 *                          applicants = 5.3942%. Prior 5.16 was from a Brown
 *                          news release for Class of 2028 EARLY tallies; the
 *                          official CDS final number is 5.39%. Tier upgraded
 *                          LEGACY_DB → OFFICIAL. CORRECTION UP +0.23pp.)
 *   - sat25             : 1490     → 1510  (CDS C9: SAT Composite 25th = 1510.
 *                          EBRW 740, Math 770. CORRECTION UP +20 from prior
 *                          1490 (LEGACY_DB heuristic).)
 *   - sat75             : 1560     → 1560  (CDS C9: SAT Composite 75th = 1560
 *                          (EBRW 780 + Math 800 = 1580 differs because
 *                          composite quantiles ≠ section sums). Value matches
 *                          prior DB; tier upgraded LEGACY_DB → OFFICIAL.)
 *   - intlAcceptanceRate: 4.3      → 4.35  (CDS C1 residency: 475 intl admits
 *                          / 10,919 intl applicants = 4.3502%. Refined +0.05pp
 *                          from prior 4.3. Tier upgraded LEGACY_DB → OFFICIAL.)
 *   - oosAcceptanceRate : 5.63     → null  (Brown is a private research
 *                          university; in-state / out-of-state distinction
 *                          carries no policy meaning. CDS C1 residency does
 *                          report OOS (2,103/37,382 = 5.6256%) but per
 *                          closure-pipeline convention, private schools →
 *                          UNAVAILABLE/TERMINAL. Prior legacy DB value cleared.)
 *   - edAcceptanceRate  : 14.37    → 14.37 (CDS C21: Brown offers Early
 *                          Decision ("Yes"). Single ED plan (Nov 1 deadline /
 *                          mid-December notification). 898 admits / 6,251 ED
 *                          applications = 14.3657% (rounded to 14.37%). Value
 *                          matches prior DB; provenance refreshed to phase3
 *                          batch 6 CDS_OFFICIAL.)
 *   - eaAcceptanceRate  : null     → null  (CDS C22: Brown does NOT offer a
 *                          nonbinding Early Action plan ("No" checked).
 *                          Field stays null; provenance refreshed to
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION (NOT_OFFERED).)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const BROWN_CDS_LANDING =
  'https://oir.brown.edu/institutional-data/common-data-set';
const BROWN_CDS_TABLEAU =
  'https://tableau.brown.edu/t/PublicContent/views/CommonDataSet/A-Info';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const brown = await prisma.school.findFirst({
    where: { id: 'cmn1htknh0008vqf2i053h8rm' },
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
  if (!brown) throw new Error('Brown University not found');
  if (brown.name !== 'Brown University')
    throw new Error(`Unexpected school name: ${brown.name}`);
  console.log(`Updating ${brown.name} (${brown.id})`);
  console.log(
    `  current AR=${brown.acceptanceRate?.toString()} sat25=${brown.sat25} sat75=${brown.sat75}`,
  );
  console.log(
    `  current intlAR=${brown.intlAcceptanceRate?.toString()} oosAR=${brown.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${brown.edAcceptanceRate?.toString()} eaAR=${brown.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: BROWN_CDS_LANDING,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-brown-validation-batch6',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 5.39,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1 (Tableau dashboard at tableau.brown.edu/.../CommonDataSet/A-Info — Brown migrated CDS publication from PDF to Tableau-only for this cycle): 2,638 admits / 48,904 applicants = 5.3942% (rounded to 5.39%). Cross-corroborated by two independent third-party summaries (cosmic.nyc/blog/brown-admissions-2024-2025 and koppelmangroup.com) reporting identical verbatim numbers, confirming dashboard fidelity. Prior 5.16 came from a Brown news release for Class of 2028 early tallies; refreshed to final CDS figure. Tier upgraded LEGACY_DB → OFFICIAL. CORRECTION UP +0.23pp.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1510,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1510 (EBRW 740, Math 770). Source: Brown CDS Tableau dashboard (PDF deprecated this cycle). CORRECTION UP from prior 1490 (LEGACY_DB heuristic). Tier upgraded LEGACY_DB → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1560,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1560 (EBRW 780 + Math 800 = 1580 differs because composite quantiles ≠ section sums; per convention prefer reported Composite row). Source: Brown CDS Tableau dashboard. Value matches prior DB; tier upgraded LEGACY_DB → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 4.35,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency: 475 international admits / 10,919 international applicants = 4.3502% (rounded to 4.35%). Refined from prior 4.3 (LEGACY_DB). Source: Brown CDS Tableau dashboard. Tier upgraded LEGACY_DB → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Brown University is a private research university; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table does report OOS (2,103 admits / 37,382 applicants = 5.6256%), but the value is not actionable for applicants. Prior legacy DB value (5.63%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 14.37,
      policyLabel: 'Early Decision admit rate (single ED plan)',
      reason:
        'CDS 2024-25 Section C21: Brown offers Early Decision ("Yes" checked). Single ED plan: Nov 1 deadline / mid-December notification (Brown does NOT offer ED II). Fall 2024 entering class: 898 admits / 6,251 ED applications = 14.3657% (rounded to 14.37%). Value matches prior DB; provenance refreshed to phase3 batch 6 CDS_OFFICIAL from Tableau dashboard. Note: task hint suggested "ED policy=No" for Brown, but all sources (Tableau dashboard + cosmic.nyc + koppelmangroup) confirm Brown DOES offer ED — proceeding with verified data.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: Brown University does NOT offer a nonbinding Early Action plan ("No" checked for EA plan). Brown\'s early-application option is Early Decision only (binding). DB value was already null; provenance refreshed to authoritative CDS UNAVAILABLE / OFFICIAL_BLANK_SECTION (NOT_OFFERED).',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(brown.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: BROWN_CDS_LANDING,
    closureSourceTableau: BROWN_CDS_TABLEAU,
  };

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: brown.id },
    data: {
      acceptanceRate: new Prisma.Decimal('5.39'),
      sat25: 1510,
      sat75: 1560,
      intlAcceptanceRate: new Prisma.Decimal('4.35'),
      oosAcceptanceRate: null, // private R1 — N/A per convention
      edAcceptanceRate: new Prisma.Decimal('14.37'),
      eaAcceptanceRate: null, // CDS C22 "No" — Brown does not offer EA
      hasEarlyDecision: true, // re-confirm from CDS C21 "Yes"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=5.39, sat25=1510, sat75=1560, intlAR=4.35, oosAR=N/A, edAR=14.37, eaAR=NOT_OFFERED)',
  );

  // verify
  const after = await prisma.school.findUnique({
    where: { id: brown.id },
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
