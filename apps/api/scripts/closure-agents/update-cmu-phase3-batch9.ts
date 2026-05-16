#!/usr/bin/env tsx
/**
 * Phase 3 — Carnegie Mellon University end-to-end closure of the 7
 * prediction-critical fields. PRIVATE university.
 *
 * Source: CMU CDS 2024-2025
 *   URL: https://www.cmu.edu/ira/CDS/pdf/cds_2024-25/common-data-set-2024-2025-21feb2025.pdf
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 11.66    -> 11.66   (CDS C1: 3,959 / 33,941 =
 *                          11.6643%. Matches prior LEGACY_DB. Tier upgraded
 *                          LEGACY_DB_VALUE -> OFFICIAL.)
 *   - sat25             : 1490     -> 1510   (CDS C9: SAT Composite 25th =
 *                          1510. CORRECTION UP +20 from prior 1490
 *                          (LEGACY_DB).)
 *   - sat75             : 1560     -> 1560   (CDS C9: SAT Composite 75th =
 *                          1560. Matches prior LEGACY_DB. Tier upgraded
 *                          LEGACY_DB_VALUE -> OFFICIAL.)
 *   - intlAcceptanceRate: 4.4      -> null   (CMU CDS C1 residency table is
 *                          BLANK — no residency breakdown for applicants/
 *                          admits/enrolled. Field reset and marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION. Prior 4.4 came
 *                          from PERMANENT_HEURISTIC (INFERRED), not authoritative.)
 *   - oosAcceptanceRate : 11       -> null   (CMU is a private research
 *                          university; in-state/out-of-state distinction
 *                          carries no policy meaning. CDS C1 residency table is
 *                          also blank. Field reset and marked
 *                          UNAVAILABLE/TERMINAL per closure-pipeline
 *                          convention for private institutions.)
 *   - edAcceptanceRate  : 13.84    -> 13.84  (CDS C21: ED offered ("Yes"),
 *                          single plan, closing 11/1, notification 12/15.
 *                          612 admits / 4,423 applications = 13.8367%
 *                          (rounded 13.84). Matches prior DB. Tier upgraded
 *                          LEGACY_DB_VALUE -> OFFICIAL.)
 *   - eaAcceptanceRate  : 13.62    -> null   (CDS C22: CMU does NOT offer a
 *                          nonbinding EA plan ("No" checked). Existing DB value
 *                          13.62 was from earlier OFFICIAL_SCHOOL pull
 *                          (possibly cross-cycle or non-CDS source). Field
 *                          reset to null and marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.cmu.edu/ira/CDS/pdf/cds_2024-25/common-data-set-2024-2025-21feb2025.pdf';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmn1htkoh000nvqf2uj3pjgxw';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (CMU) not found`);
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
    generatedBy: 'phase3-cmu-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 11.66,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 3,959 admits / 33,941 applicants = 11.6643% (rounded to 11.66%). Value matches prior LEGACY_DB; tier upgraded to OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1510,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1510 (reported directly). CORRECTION UP +20 from prior 1490 (LEGACY_DB).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1560,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1560 (reported directly). Matches prior LEGACY_DB; tier upgraded to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table is BLANK — CMU does not publish applicant/admit/enrolled residency breakdown in its CDS. International admit rate cannot be computed from CDS. Field cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Prior DB value 4.4 was PERMANENT_HEURISTIC (INFERRED tier), not authoritative.',
      realDataStatus: 'NOT_REPORTED',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Carnegie Mellon is a private research university; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table is also blank. Per closure-pipeline convention private institutions -> UNAVAILABLE/TERMINAL. Prior DB value 11 (PERMANENT_HEURISTIC) cleared.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 13.84,
      policyLabel: 'Early Decision admit rate (single plan)',
      reason:
        'CDS 2024-25 Section C21: CMU offers Early Decision ("Yes"), single plan, closing 11/1, notification 12/15. Fall 2024 entering class: 612 admits / 4,423 ED applications = 13.8367% (rounded 13.84%). Matches prior DB; tier upgraded LEGACY_DB_VALUE -> OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: CMU does NOT offer a nonbinding Early Action plan ("No" checked). Prior DB value 13.62 (OFFICIAL_SCHOOL) appears to be cross-cycle/legacy; per current CDS EA is not offered. Field cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED).',
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
      acceptanceRate: new Prisma.Decimal('11.66'),
      sat25: 1510,
      sat75: 1560,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('13.84'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=11.66, sat25=1510, sat75=1560, intlAR=N/R, oosAR=N/A, edAR=13.84, eaAR=NOT_OFFERED)',
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
