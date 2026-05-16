#!/usr/bin/env tsx
/**
 * Phase 3 — Grand Valley State University (Allendale, MI) end-to-end closure
 * of the 7 prediction-critical fields.
 *
 * Source: GVSU CDS 2024-2025 (Fall 2024 entering class)
 *   URL: https://www.gvsu.edu/cms4/asset/EFAB4AD2-A926-8D16-A5685AB71E0C7DC3/cds_2024-2025_new.xlsx
 *   Format: .xlsx (CDS-C sheet, machine-readable)
 *
 * Grand Valley State is a PUBLIC Michigan research university.
 * oosAcceptanceRate is in eligible scope.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 83.02  -> 83.02  (CDS C1 total: 27,054 applied
 *                          (10,421 men + 16,606 women + 27 unknown) / 22,459
 *                          admitted (8,599 + 13,843 + 17). AR = 22,459 /
 *                          27,054 = 83.0192%, rounds to 83.02%. EXACT MATCH.
 *                          Tier LEGACY_DB_VALUE -> OFFICIAL.)
 *   - sat25             : 940    -> 940    (CDS C9 SAT Composite 25th = 940.
 *                          EXACT MATCH. Prior URL was prepscholar (not CDS).
 *                          Tier upgraded OFFICIAL/CDS_PDF_AUTO -> OFFICIAL/
 *                          CDS_OFFICIAL.)
 *   - sat75             : 1180   -> 1180   (CDS C9 SAT Composite 75th = 1180.
 *                          EXACT MATCH. Same URL correction.)
 *   - intlAcceptanceRate: 65.34  -> 65.34  (CDS C1 residency: INTERNATIONAL
 *                          1,307 applied / 854 admitted. intlAR = 854 / 1307
 *                          = 65.3404%, rounds to 65.34%. EXACT MATCH. Tier
 *                          LEGACY_DB_VALUE -> OFFICIAL.)
 *   - oosAcceptanceRate : 85.77  -> 85.77  (CDS C1 residency: OUT-OF-STATE
 *                          3,205 applied / 2,749 admitted. oosAR = 2,749 /
 *                          3,205 = 85.7722%, rounds to 85.77%. EXACT MATCH.
 *                          Tier LEGACY_DB_VALUE -> OFFICIAL.)
 *   - edAcceptanceRate  : null   -> null   (CDS C21: "Early Decision —
 *                          Yes/No" — "1" marked in F column (No). GVSU does
 *                          NOT offer Early Decision. Tier OFFICIAL/CDS_LLM_EXTRACT_2026_04
 *                          (stale — LLM had assigned OFFICIAL but C21 is No)
 *                          -> UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : null   -> null   (CDS C22: "Early Action — Yes/No"
 *                          — "1" marked in F column (No). GVSU does NOT offer
 *                          Early Action either. Tier OFFICIAL/CDS_LLM_EXTRACT_2026_04
 *                          -> UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *
 * NOTE on hasEarlyDecision: current DB value is true, but CDS C21 is No.
 *   Correcting to false to match CDS reality. GVSU offers neither ED nor EA.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.gvsu.edu/cms4/asset/EFAB4AD2-A926-8D16-A5685AB71E0C7DC3/cds_2024-2025_new.xlsx';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iws0056z0tial92bfrt';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (GVSU) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC Michigan]`);

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-batch29-gvsu',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 83.02,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 27,054 total applied / 22,459 admitted. AR = 22,459 / 27,054 = 83.0192%, rounds to 83.02%. EXACT MATCH with DB. Tier LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 940,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'CDS 2024-25 Section C9 SAT Composite 25th percentile = 940. EXACT MATCH. Prior URL was prepscholar.com (not a CDS). Tier upgraded OFFICIAL/CDS_PDF_AUTO -> OFFICIAL/CDS_OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1180,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'CDS 2024-25 Section C9 SAT Composite 75th percentile = 1180. EXACT MATCH. Same source correction as sat25.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 65.34,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency: INTERNATIONAL 1,307 applied / 854 admitted. intlAR = 854 / 1307 = 65.3404%, rounds to 65.34%. EXACT MATCH. Tier LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 85.77,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency: OUT-OF-STATE 3,205 applied / 2,749 admitted. oosAR = 2,749 / 3,205 = 85.7722%, rounds to 85.77%. EXACT MATCH. Tier LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21 "Early Decision — Yes/No" — mark in NO column (sheet CDS-C row 327, F-column flag). GVSU does NOT offer Early Decision. Tier OFFICIAL/CDS_LLM_EXTRACT_2026_04 (stale — LLM erroneously assigned OFFICIAL despite the C21 No mark) -> UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22 "Early Action — Yes/No" — mark in NO column (sheet CDS-C row 343, F-column flag). GVSU does NOT offer Early Action either. Tier OFFICIAL/CDS_LLM_EXTRACT_2026_04 (stale) -> UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
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
      acceptanceRate: new Prisma.Decimal('83.02'),
      sat25: 940,
      sat75: 1180,
      intlAcceptanceRate: new Prisma.Decimal('65.34'),
      oosAcceptanceRate: new Prisma.Decimal('85.77'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 = No; GVSU does NOT offer ED. Correct stale DB true.
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  updated 7 fields (AR=83.02 same, sat25=940 same, sat75=1180 same, intlAR=65.34 same, oosAR=85.77 same, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
