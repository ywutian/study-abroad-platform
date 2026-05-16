#!/usr/bin/env tsx
/**
 * Phase 3 — Towson University (Towson, MD) end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: Towson CDS 2024-2025 (Fall 2024 entering class)
 *   URL: https://www.towson.edu/ir/documents/cds_all_2425.pdf
 *
 * Towson is a PUBLIC Maryland university (USM System).
 * oosAcceptanceRate is in eligible scope.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 81.9   -> 81.97  (CDS C1 total: 19,777 applied
 *                          (7,711 men + 12,056 women + 10 unknown) / 16,212
 *                          admitted (6,099 + 10,105 + 8). AR = 16,212 /
 *                          19,777 = 81.9695%, rounds to 81.97%. REFINEMENT
 *                          +0.07. Tier LEGACY_DB_VALUE -> OFFICIAL.)
 *   - sat25             : 950    -> 950    (CDS C9 SAT Composite 25th = 950.
 *                          EXACT MATCH. Prior URL was prepscholar — not CDS.
 *                          Tier upgraded OFFICIAL/CDS_PDF_AUTO -> OFFICIAL/
 *                          CDS_OFFICIAL.)
 *   - sat75             : 1230   -> 1230   (CDS C9 SAT Composite 75th = 1230.
 *                          EXACT MATCH. Same source correction.)
 *   - intlAcceptanceRate: 85.4   -> 85.39  (CDS C1 residency: INTERNATIONAL
 *                          438 applied / 374 admitted. intlAR = 374 / 438 =
 *                          85.3881%, rounds to 85.39%. MINIMAL REFINEMENT
 *                          -0.01. Tier LEGACY_DB_VALUE -> OFFICIAL.)
 *   - oosAcceptanceRate : 79.4   -> 79.44  (CDS C1 residency: OUT-OF-STATE
 *                          4,748 applied / 3,772 admitted. oosAR = 3,772 /
 *                          4,748 = 79.4440%, rounds to 79.44%. REFINEMENT
 *                          +0.04. Tier LEGACY_DB_VALUE -> OFFICIAL. CRITICAL
 *                          OOS CLOSURE for ML scope.)
 *   - edAcceptanceRate  : null   -> null   (CDS C21: "Early Decision —
 *                          Yes/No" — N. Towson does NOT offer Early Decision.
 *                          Tier OFFICIAL/CDS_LLM_EXTRACT_2026_04 (stale — LLM
 *                          erroneously assigned OFFICIAL despite the C21 N
 *                          response) -> UNAVAILABLE/OFFICIAL_BLANK_SECTION/
 *                          NOT_OFFERED.)
 *   - eaAcceptanceRate  : null   -> null   (CDS C22: "Early Action — Yes/No"
 *                          — Y, closing 11/15, notification 1/15, NOT
 *                          restrictive. HOWEVER, Towson did NOT publish EA
 *                          application/admit counts in the CDS — those rows
 *                          are blank. Tier OFFICIAL/CDS_LLM_EXTRACT_2026_04
 *                          (stale) -> UNAVAILABLE/OFFICIAL_BLANK_SECTION.
 *                          Status: OFFERED-BUT-COUNTS-BLANK.)
 *
 * NOTE on hasEarlyDecision: current DB value is true, but CDS C21 is "N".
 *   Correcting to false to match CDS reality. Towson has EA but not ED.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL = 'https://www.towson.edu/ir/documents/cds_all_2425.pdf';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iwt0057z0ti6f0z2hsc';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Towson) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC Maryland]`);

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-batch29-towson',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 81.97,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 19,777 total applied / 16,212 admitted. AR = 16,212 / 19,777 = 81.9695%, rounds to 81.97%. REFINEMENT +0.07 from prior 81.9. Tier LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 950,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'CDS 2024-25 Section C9 SAT Composite 25th percentile = 950. EXACT MATCH. Prior URL was prepscholar.com (not a CDS). Tier upgraded OFFICIAL/CDS_PDF_AUTO -> OFFICIAL/CDS_OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1230,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'CDS 2024-25 Section C9 SAT Composite 75th percentile = 1230. EXACT MATCH. Same source correction as sat25.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 85.39,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency: INTERNATIONAL 438 applied / 374 admitted. intlAR = 374 / 438 = 85.3881%, rounds to 85.39%. MINIMAL REFINEMENT -0.01 from prior 85.4. Tier LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 79.44,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency: OUT-OF-STATE 4,748 applied / 3,772 admitted. oosAR = 3,772 / 4,748 = 79.4440%, rounds to 79.44%. REFINEMENT +0.04 from prior 79.4. Tier LEGACY_DB_VALUE -> OFFICIAL. CRITICAL OOS CLOSURE for ML scope.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21 "Early Decision — Yes/No" — N. Towson does NOT offer Early Decision (only EA per C22). All ED dates/counts are blank. Tier OFFICIAL/CDS_LLM_EXTRACT_2026_04 (stale — LLM erroneously assigned OFFICIAL despite the C21 "N" response) -> UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 0.9,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22 Early Action = Y (closing 11/15, notification 1/15, NOT restrictive). HOWEVER, Towson did NOT publish EA application or admit counts — those rows (C2106) are blank. Cannot derive a CDS-official EA admit rate. Tier OFFICIAL/CDS_LLM_EXTRACT_2026_04 (stale) -> UNAVAILABLE/OFFICIAL_BLANK_SECTION. Status: OFFERED-BUT-COUNTS-BLANK (not NOT_OFFERED). Field stays open if Towson publishes EA counts in a future CDS cycle.',
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
      acceptanceRate: new Prisma.Decimal('81.97'),
      sat25: 950,
      sat75: 1230,
      intlAcceptanceRate: new Prisma.Decimal('85.39'),
      oosAcceptanceRate: new Prisma.Decimal('79.44'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 = "N"; Towson does NOT offer ED. Correct stale DB true.
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  updated 7 fields (AR=81.97 refined +0.07, sat25=950 same, sat75=1230 same, intlAR=85.39 refined, oosAR=79.44 refined, edAR=NOT_OFFERED, eaAR=BLANK-OFFERED, hasED=false)',
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
    },
  });
  console.log('=== After update ===');
  console.log(
    `  AR=${after?.acceptanceRate?.toString()} sat25=${after?.sat25 ?? 'null'} sat75=${after?.sat75 ?? 'null'}`,
  );
  console.log(
    `  intlAR=${after?.intlAcceptanceRate?.toString() ?? 'null'} oosAR=${after?.oosAcceptanceRate?.toString() ?? 'null'} edAR=${after?.edAcceptanceRate?.toString() ?? 'null'} eaAR=${after?.eaAcceptanceRate?.toString() ?? 'null'} hasED=${after?.hasEarlyDecision}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
