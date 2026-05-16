#!/usr/bin/env tsx
/**
 * Phase 3 — UMass Lowell end-to-end closure of the 7 prediction-critical fields.
 *
 * Source: UMass Lowell CDS 2024-2025 (Fall 2024 entering class, dated 4/15/2025)
 *   URL: https://www.uml.edu/docs/CDS_2024-2025%20Final_tcm18-403507.pdf
 *   (Discovered via the UMass Lowell IR Common Data Set page:
 *    https://www.uml.edu/institutional-research/common-data-set.aspx)
 *
 * UMass Lowell is a PUBLIC Massachusetts research university.
 *   - oosAcceptanceRate is in eligible scope and CDS publishes it.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 85.17  -> 82.96  (CDS 2024-25 C1 main residency
 *                          row: 13,676 total applied, 11,345 total admitted.
 *                          AR = 11,345 / 13,676 = 82.9555% (rounded to 82.96%).
 *                          Tier upgraded VERIFIED_REAL/LEGACY_DB_VALUE ->
 *                          OFFICIAL. Prior 85.17 was off by ~2.2pp.)
 *   - sat25             : 1190   -> 1200   (CDS 2024-25 C9 SAT Composite
 *                          25th = 1200. Tier upgraded LEGACY_DB_VALUE ->
 *                          OFFICIAL. +10 correction.)
 *   - sat75             : 1340   -> 1360   (CDS 2024-25 C9 SAT Composite
 *                          75th = 1360. Tier upgraded LEGACY_DB_VALUE ->
 *                          OFFICIAL. +20 correction. NOTE: 27% (550 students)
 *                          submitted SAT — UMass Lowell is test-optional per
 *                          C8A "Not required for admission, but considered
 *                          if submitted".)
 *   - intlAcceptanceRate: 86.06  -> 87.78  (CDS 2024-25 C1 residency
 *                          breakdown table: international 622 applied / 546
 *                          admitted. intlAR = 546 / 622 = 87.7813% (rounded
 *                          to 87.78%). Tier upgraded LEGACY_DB_VALUE ->
 *                          OFFICIAL. +1.72pp correction.)
 *   - oosAcceptanceRate : 85.89  -> 82.50  (CDS 2024-25 C1 residency
 *                          breakdown table: out-of-state 2,783 applied /
 *                          2,296 admitted. oosAR = 2,296 / 2,783 = 82.5009%
 *                          (rounded to 82.50%). Tier upgraded LEGACY_DB_VALUE
 *                          -> OFFICIAL. -3.39pp correction. UMass Lowell is
 *                          a PUBLIC institution where oosAR is in eligible
 *                          scope and CDS provides real numbers.)
 *   - edAcceptanceRate  : null   -> null   (CDS 2024-25 C21: "Does your
 *                          institution offer an early decision plan?" — NO
 *                          checked. UMass Lowell does not offer ED. Field
 *                          stays null. Tier transitions OFFICIAL/CDS_LLM_
 *                          EXTRACT_2026_04 -> UNAVAILABLE/OFFICIAL_BLANK_
 *                          SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : null   -> null   (CDS 2024-25 C22: "Do you have
 *                          a nonbinding early action plan?" — YES checked.
 *                          EA closing date Feb 5, notification date Dec 10.
 *                          HOWEVER, the EA applicant and admit count cells
 *                          are LEFT BLANK in the CDS PDF — UMass Lowell
 *                          publishes EA dates only, not counts. Cannot derive
 *                          eaAR. Marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/
 *                          COUNTS_NOT_PUBLISHED. Field stays open for the
 *                          next CDS cycle if UMass Lowell fills those cells.)
 *
 * NOTE on hasEarlyDecision: current DB value is true, but CDS C21 is "No".
 *   Correcting to false to match CDS reality. NOTE that UMass Lowell DOES
 *   offer Early Action (C22 Yes); the schema's hasEarlyDecision field is
 *   specific to ED and remains false.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.uml.edu/docs/CDS_2024-2025%20Final_tcm18-403507.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8isc0033z0tibp1hnmdi';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UMass Lowell) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC Mass R1]`);
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
    generatedBy: 'phase3-batch26-umass-lowell',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 82.96,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1 main residency row: 13,676 total applied, 11,345 total admitted. AR = 11,345 / 13,676 = 82.9555% (rounded to 82.96%). Tier upgraded LEGACY_DB_VALUE -> OFFICIAL. Prior DB value 85.17 was off by ~2.2pp.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1200,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'CDS 2024-25 Section C9 SAT Composite 25th percentile = 1200. Tier upgraded LEGACY_DB_VALUE -> OFFICIAL. +10 correction from prior 1190.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1360,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'CDS 2024-25 Section C9 SAT Composite 75th percentile = 1360. Tier upgraded LEGACY_DB_VALUE -> OFFICIAL. +20 correction from prior 1340. NOTE: 27% (550 students) submitted SAT — UMass Lowell is test-optional per C8A "Not required for admission, but considered if submitted".',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 87.78,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency breakdown table: international 622 applied / 546 admitted. intlAR = 546 / 622 = 87.7813% (rounded to 87.78%). Tier upgraded LEGACY_DB_VALUE -> OFFICIAL. +1.72pp correction from prior 86.06.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 82.5,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency breakdown table: out-of-state 2,783 applied / 2,296 admitted. oosAR = 2,296 / 2,783 = 82.5009% (rounded to 82.50%). Tier upgraded LEGACY_DB_VALUE -> OFFICIAL. -3.39pp correction from prior 85.89. UMass Lowell is a PUBLIC Massachusetts institution where oosAR is in eligible scope and CDS provides real numbers.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. UMass Lowell does not offer Early Decision. Field stays null. Tier transitions OFFICIAL/CDS_LLM_EXTRACT_2026_04 -> UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED with refreshed provenance.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — YES checked. EA closing date Feb 5, notification date Dec 10. HOWEVER, the EA applicant and admit count cells are LEFT BLANK in the CDS PDF — UMass Lowell publishes EA dates only, not counts. Cannot derive eaAR. Marked UNAVAILABLE/OFFICIAL_BLANK_SECTION (COUNTS_NOT_PUBLISHED). Field stays open for the next CDS cycle if UMass Lowell fills those cells.',
      realDataStatus: 'NOT_APPLICABLE',
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
      acceptanceRate: new Prisma.Decimal('82.96'),
      sat25: 1200,
      sat75: 1360,
      intlAcceptanceRate: new Prisma.Decimal('87.78'),
      oosAcceptanceRate: new Prisma.Decimal('82.50'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — UMass Lowell does not offer ED; correct stale DB true.
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=82.96, sat25=1200, sat75=1360, intlAR=87.78, oosAR=82.50, edAR=NOT_OFFERED, eaAR=BLANK_COUNTS, hasED=false)',
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
