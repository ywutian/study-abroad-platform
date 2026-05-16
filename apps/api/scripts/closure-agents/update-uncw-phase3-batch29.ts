#!/usr/bin/env tsx
/**
 * Phase 3 — University of North Carolina Wilmington (UNCW) end-to-end closure
 * of the 7 prediction-critical fields.
 *
 * Source: UNCW CDS 2024-2025 (Fall 2024 entering class)
 *   URL: https://uncw.edu/media/pdf/irp/cds-2024-2025.pdf
 *
 * UNCW is a PUBLIC North Carolina university (UNC System).
 * oosAcceptanceRate is in eligible scope.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 74     -> 64.24  (CORRECTION DOWN -9.76. CDS C1
 *                          total: 20,393 applied (6,787 men + 13,602 women +
 *                          0 + 4 unknown) / 13,101 admitted (4,100 + 9,000 +
 *                          0 + 1). AR = 13,101 / 20,393 = 64.2426%, rounds to
 *                          64.24%. Prior 74 was LEGACY_DB_VALUE with no
 *                          source URL — way off. Tier LEGACY_DB_VALUE ->
 *                          OFFICIAL.)
 *   - sat25             : 1230   -> 1230   (CDS C9 SAT Composite 25th = 1230.
 *                          EXACT MATCH. Prior URL was prepscholar — not CDS.
 *                          Tier upgraded OFFICIAL/CDS_PDF_AUTO -> OFFICIAL/
 *                          CDS_OFFICIAL.)
 *   - sat75             : 1340   -> 1340   (CDS C9 SAT Composite 75th = 1340.
 *                          EXACT MATCH. Same source correction.)
 *   - intlAcceptanceRate: 70.3   -> null   (CDS C1 residency: UNCW LEFT the
 *                          International and Unknown columns BLANK — only
 *                          Total/In-State/OOS columns are populated. Prior
 *                          70.3 came from tier INFERRED/PERMANENT_HEURISTIC
 *                          and cannot be verified against CDS. Tier INFERRED/
 *                          PERMANENT_HEURISTIC -> UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *   - oosAcceptanceRate : 41.26  -> 41.26  (CDS C1 residency: OUT-OF-STATE
 *                          8,093 applied / 3,339 admitted. oosAR = 3,339 /
 *                          8,093 = 41.2579%, rounds to 41.26%. EXACT MATCH.
 *                          Tier LEGACY_DB_VALUE -> OFFICIAL. CRITICAL OOS
 *                          CLOSURE for ML scope.)
 *   - edAcceptanceRate  : null   -> null   (CDS C21: "Early Decision —
 *                          Yes/No" — checked NO. UNCW does NOT offer Early
 *                          Decision. Tier OFFICIAL/CDS_LLM_EXTRACT_2026_04
 *                          (stale — LLM erroneously assigned OFFICIAL despite
 *                          the C21 No checkbox) -> UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : 68.5   -> null   (CORRECTION. CDS C22: "Early
 *                          Action — Yes/No" — Y, closing 11/1, notification
 *                          1/20, NOT restrictive. HOWEVER, UNCW did NOT
 *                          publish EA application/admit counts in the CDS —
 *                          those rows are blank. Prior 68.5 came from
 *                          TAVILY_ENRICHMENT and is unverifiable against the
 *                          CDS — cleared to null. Tier VERIFIED_REAL/
 *                          TAVILY_ENRICHMENT -> UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION. Status: OFFERED-BUT-COUNTS-BLANK.)
 *
 * NOTE on hasEarlyDecision: current DB value is true, but CDS C21 is "No".
 *   Correcting to false to match CDS reality. UNCW has EA but not ED.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL = 'https://uncw.edu/media/pdf/irp/cds-2024-2025.pdf';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iwq0055z0tivbkk0qbk';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UNCW) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC North Carolina]`);

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-batch29-uncw',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 64.24,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 20,393 total applied / 13,101 admitted. AR = 13,101 / 20,393 = 64.2426%, rounds to 64.24%. CORRECTION DOWN -9.76 from prior LEGACY_DB_VALUE 74 (no source URL on record). Tier LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1230,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'CDS 2024-25 Section C9 SAT Composite 25th percentile = 1230. EXACT MATCH. Prior URL was prepscholar.com (not a CDS). Tier upgraded OFFICIAL/CDS_PDF_AUTO -> OFFICIAL/CDS_OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1340,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'CDS 2024-25 Section C9 SAT Composite 75th percentile = 1340. EXACT MATCH. Same source correction as sat25.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: UNCW LEFT the International and Unknown columns BLANK. Only Total / In-State (12,300/9,762) / OOS (8,093/3,339) columns are populated. Prior 70.3 came from tier INFERRED/PERMANENT_HEURISTIC and is not CDS-verifiable — cleared to null. Tier INFERRED/PERMANENT_HEURISTIC -> UNAVAILABLE/OFFICIAL_BLANK_SECTION.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 41.26,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency: OUT-OF-STATE 8,093 applied / 3,339 admitted. oosAR = 3,339 / 8,093 = 41.2579%, rounds to 41.26%. EXACT MATCH. Tier LEGACY_DB_VALUE -> OFFICIAL. CRITICAL OOS CLOSURE for ML scope.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21 "Early Decision — Yes/No" — checked NO. UNCW does NOT offer Early Decision (only EA per C22). All ED dates/counts are blank. Tier OFFICIAL/CDS_LLM_EXTRACT_2026_04 (stale — LLM erroneously assigned OFFICIAL despite the C21 "No" checkbox) -> UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 0.9,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22 Early Action = YES (closing 11/1, notification 1/20, NOT restrictive). HOWEVER, UNCW did NOT publish EA application or admit counts — those rows are blank. Cannot derive a CDS-official EA admit rate. Prior 68.5 came from TAVILY_ENRICHMENT and is unverifiable against the CDS — cleared to null. Tier VERIFIED_REAL/TAVILY_ENRICHMENT -> UNAVAILABLE/OFFICIAL_BLANK_SECTION. Status: OFFERED-BUT-COUNTS-BLANK (not NOT_OFFERED). Field stays open if UNCW publishes EA counts in a future CDS cycle.',
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
      acceptanceRate: new Prisma.Decimal('64.24'),
      sat25: 1230,
      sat75: 1340,
      intlAcceptanceRate: null,
      oosAcceptanceRate: new Prisma.Decimal('41.26'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 = "No"; UNCW does NOT offer ED. Correct stale DB true.
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  updated 7 fields (AR=64.24 corr -9.76, sat25=1230 same, sat75=1340 same, intlAR=BLANK, oosAR=41.26 same, edAR=NOT_OFFERED, eaAR=BLANK-OFFERED, hasED=false)',
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
