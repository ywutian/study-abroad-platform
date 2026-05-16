#!/usr/bin/env tsx
/**
 * Phase 3 — James Madison University (Harrisonburg, VA) end-to-end closure of
 * the 7 prediction-critical fields.
 *
 * Source: JMU CDS 2024-2025 (Fall 2024 entering class)
 *   URL: https://www.jmu.edu/pair/ir/common-data-set/cds-2024-2025.docx
 *   Format: .docx
 *
 * James Madison is a PUBLIC Virginia research university.
 * oosAcceptanceRate is in eligible scope.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 85     -> 71.51  (CORRECTION DOWN -13.49. CDS C1
 *                          total: 38,419 applied (men 15,832 + women 22,587
 *                          + another 4 + unknown 3 — but the residency table
 *                          uses 38,426 as the canonical total for in-state +
 *                          OOS reporting). Admitted (residency): 27,480.
 *                          AR = 27,480 / 38,426 = 71.5136%, rounds to 71.51%.
 *                          Prior 85 was LEGACY_DB_VALUE with no source URL —
 *                          way off. Tier LEGACY_DB_VALUE -> OFFICIAL.)
 *   - sat25             : 1140   -> 1190   (CDS C9 SAT Composite 25th = 1190.
 *                          CORRECTION +50. Prior URL was cogn-iq.org — not a
 *                          CDS source. Tier upgraded OFFICIAL/CDS_PDF_AUTO ->
 *                          OFFICIAL/CDS_OFFICIAL.)
 *   - sat75             : 1320   -> 1330   (CDS C9 SAT Composite 75th = 1330.
 *                          REFINEMENT +10. Same source correction.)
 *   - intlAcceptanceRate: 86.3   -> null   (CORRECTION. CDS C1 residency
 *                          table: JMU LEFT the International + Unknown
 *                          columns BLANK — they only published total + in-
 *                          state + OOS. The prior 86.3 came from
 *                          unischolars.com (a third-party blog) and is not
 *                          CDS-verifiable. Tier transitions OFFICIAL/CDS_PDF_AUTO
 *                          (stale — URL was unischolars.com, NOT a CDS) ->
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *   - oosAcceptanceRate : 77.69  -> 77.68  (CDS C1 residency: OUT-OF-STATE
 *                          18,120 applied / 14,075 admitted. oosAR = 14,075 /
 *                          18,120 = 77.6766%, rounds to 77.68%. MINIMAL
 *                          REFINEMENT -0.01. Already CDS_OFFICIAL.)
 *   - edAcceptanceRate  : null   -> null   (CDS C21: "Early Decision —
 *                          Yes/No" — x in NO column. JMU does NOT offer ED
 *                          (only restrictive EA in C22). Tier transitions
 *                          OFFICIAL/CDS_LLM_EXTRACT_2026_04 (stale — LLM
 *                          erroneously assigned OFFICIAL despite the C21
 *                          "No" checkbox) -> UNAVAILABLE/OFFICIAL_BLANK_SECTION/
 *                          NOT_OFFERED.)
 *   - eaAcceptanceRate  : null   -> null   (CDS C22: "Early action — Yes/No"
 *                          — Y, closing 11/1, notification mid-late Jan,
 *                          restrictive=No. HOWEVER, JMU did NOT publish the
 *                          EA application/admit counts in the CDS (those rows
 *                          are blank). Tier transitions OFFICIAL/CDS_LLM_EXTRACT_2026_04
 *                          (stale) -> UNAVAILABLE/OFFICIAL_BLANK_SECTION. EA
 *                          is OFFERED-BUT-COUNTS-BLANK, not NOT_OFFERED.)
 *
 * NOTE on hasEarlyDecision: current DB value is true, but CDS C21 is "No".
 *   Correcting to false to match CDS reality. JMU has EA but not ED.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.jmu.edu/pair/ir/common-data-set/cds-2024-2025.docx';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iwp0054z0tic1mh49ba';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (JMU) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC Virginia]`);
  console.log(
    `  current AR=${school.acceptanceRate?.toString()} sat25=${school.sat25} sat75=${school.sat75}`,
  );

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-batch29-jmu',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 71.51,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1 residency totals: 38,426 applied / 27,480 admitted. AR = 27,480 / 38,426 = 71.5136%, rounds to 71.51%. CORRECTION DOWN -13.49 from prior LEGACY_DB_VALUE 85 (no source URL on record). Tier LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1190,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'CDS 2024-25 Section C9 SAT Composite 25th percentile = 1190. CORRECTION +50 from prior 1140. Prior URL was cogn-iq.org (not a CDS). Tier upgraded OFFICIAL/CDS_PDF_AUTO -> OFFICIAL/CDS_OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1330,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'CDS 2024-25 Section C9 SAT Composite 75th percentile = 1330. REFINEMENT +10 from prior 1320. Same source correction as sat25.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: JMU LEFT the International and Unknown columns BLANK. Only Total/In-State/OOS columns are populated (38,426 / 20,306 / 18,120 applied; 27,480 / 13,405 / 14,075 admitted). The International column has no number. Prior DB value 86.3 came from unischolars.com (third-party blog, not a CDS) and is not CDS-verifiable — cleared to null. Tier OFFICIAL/CDS_PDF_AUTO (stale, wrong URL) -> UNAVAILABLE/OFFICIAL_BLANK_SECTION.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 77.68,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency: OUT-OF-STATE 18,120 applied / 14,075 admitted. oosAR = 14,075 / 18,120 = 77.6766%, rounds to 77.68%. MINIMAL REFINEMENT -0.01 from prior 77.69. Already CDS_OFFICIAL source.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21 "Early Decision — Yes/No" — x in NO column. JMU does NOT offer Early Decision (only EA per C22). All ED dates/counts are blank. Tier OFFICIAL/CDS_LLM_EXTRACT_2026_04 (stale — LLM erroneously assigned OFFICIAL despite the C21 "No" checkbox) -> UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 0.9,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22 Early Action = YES (closing Nov 1, notification mid-late Jan, NOT restrictive). HOWEVER, JMU did NOT publish EA application or admit counts in C21/C22 — those rows are blank. Cannot derive a CDS-official EA admit rate. Tier OFFICIAL/CDS_LLM_EXTRACT_2026_04 (stale) -> UNAVAILABLE/OFFICIAL_BLANK_SECTION. Status: OFFERED-BUT-COUNTS-BLANK (not NOT_OFFERED). Field stays open if JMU publishes EA counts in a future CDS cycle.',
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
      acceptanceRate: new Prisma.Decimal('71.51'),
      sat25: 1190,
      sat75: 1330,
      intlAcceptanceRate: null,
      oosAcceptanceRate: new Prisma.Decimal('77.68'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 = "No"; JMU does NOT offer ED. Correct stale DB true.
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  updated 7 fields (AR=71.51 corr -13.49, sat25=1190 corr +50, sat75=1330 refined +10, intlAR=BLANK, oosAR=77.68 refined, edAR=NOT_OFFERED, eaAR=BLANK-OFFERED, hasED=false)',
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
