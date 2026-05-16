#!/usr/bin/env tsx
/**
 * Phase 3 — Emory University end-to-end closure of the 7 prediction-critical
 * fields. PRIVATE university.
 *
 * Source: Emory CDS 2024-2025
 *   URL: https://provost.emory.edu/planning-administration/_includes/documents/sections/institutional-data/emory-common-data-set-2024-2025.pdf
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 14.5     -> 10.29  (CDS C1: 3,562 / 34,614 =
 *                          10.2906%. CORRECTION DOWN -4.21pp from prior 14.5
 *                          (LEGACY_DB, likely an earlier cycle value). Tier
 *                          LEGACY_DB_VALUE -> OFFICIAL.)
 *   - sat25             : 1430     -> 1480  (CDS C9: SAT Composite 25th =
 *                          1480. CORRECTION UP +50 from prior 1430.)
 *   - sat75             : 1530     -> 1540  (CDS C9: SAT Composite 75th =
 *                          1540. CORRECTION UP +10 from prior 1530.)
 *   - intlAcceptanceRate: 6.33     -> 6.33   (CDS C1 residency: 520 intl
 *                          admits / 8,221 intl applicants = 6.3253%. Matches
 *                          prior DB; tier LEGACY_DB_VALUE -> OFFICIAL.)
 *   - oosAcceptanceRate : 11.3     -> null   (Emory is a private research
 *                          university; in-state/out-of-state distinction
 *                          carries no policy meaning. CDS C1 residency does
 *                          report OOS (2528/22362 = 11.30%) but per closure-
 *                          pipeline convention private institutions ->
 *                          UNAVAILABLE/TERMINAL. Prior DB value cleared.)
 *   - edAcceptanceRate  : 23.23    -> 23.23  (CDS C21: Emory offers ED with
 *                          ED I (closing 11/1, notification 12/15) and ED II
 *                          (closing 1/1, notification 2/15). Combined Fall 2024
 *                          totals: 974 admits / 4,193 ED applications =
 *                          23.2292% (rounded 23.23). Matches prior DB; tier
 *                          upgraded LEGACY_DB_VALUE -> OFFICIAL.)
 *   - eaAcceptanceRate  : 24.85    -> null   (CDS C22: Emory does NOT offer
 *                          a nonbinding EA plan ("No" checked). Prior DB value
 *                          24.85 (OFFICIAL_SCHOOL) appears stale/cross-cycle;
 *                          per current CDS EA is not offered. Field cleared
 *                          (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED).)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://provost.emory.edu/planning-administration/_includes/documents/sections/institutional-data/emory-common-data-set-2024-2025.pdf';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmn1htkoj000ovqf226pta7or';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Emory) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}`);
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
    generatedBy: 'phase3-emory-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 10.29,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 3,562 admits / 34,614 applicants = 10.2906% (rounded 10.29%). CORRECTION DOWN -4.21pp from prior 14.5 (LEGACY_DB, likely earlier cycle). Tier upgraded LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1480,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1480 (reported directly). CORRECTION UP +50 from prior 1430 (LEGACY_DB).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1540,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1540 (reported directly). CORRECTION UP +10 from prior 1530 (LEGACY_DB).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 6.33,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 520 international admits / 8,221 international applicants = 6.3253% (rounded 6.33%). Matches prior DB; tier upgraded LEGACY_DB_VALUE -> OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Emory University is a private research university; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table does report OOS (2,528 admits / 22,362 applicants = 11.3048%), but the value is not actionable for applicants. Prior legacy DB value (11.3%) cleared. Field marked UNAVAILABLE/TERMINAL per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 23.23,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2024-25 Section C21: Emory offers Early Decision ("Yes") with two plans — ED I closing 11/1 (notification 12/15) and ED II closing 1/1 (notification 2/15). CDS reports combined ED I + ED II totals for Fall 2024 entering class: 974 admits / 4,193 ED applications = 23.2292% (rounded 23.23%). Matches prior DB; tier upgraded LEGACY_DB_VALUE -> OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: Emory does NOT offer a nonbinding Early Action plan ("No" checked). Prior DB value 24.85 (OFFICIAL_SCHOOL) appears stale/cross-cycle; per current CDS EA is not offered. Field cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED).',
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
      acceptanceRate: new Prisma.Decimal('10.29'),
      sat25: 1480,
      sat75: 1540,
      intlAcceptanceRate: new Prisma.Decimal('6.33'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('23.23'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=10.29, sat25=1480, sat75=1540, intlAR=6.33, oosAR=N/A, edAR=23.23, eaAR=NOT_OFFERED)',
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
    const pp = prov[f];
    console.log(
      `  ${f.padEnd(22)} tier=${pp?.tier ?? 'NULL'}  source=${pp?.source ?? 'NULL'}  cycle=${pp?.cycleYear ?? '-'}`,
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
