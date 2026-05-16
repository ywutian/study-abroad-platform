#!/usr/bin/env tsx
/**
 * Phase 3 — Western Michigan University (Kalamazoo, MI) end-to-end closure
 *   of the 7 prediction-critical fields.
 *
 * Source: Western Michigan University CDS 2024-2025 (Fall 2024 entering class)
 *   URL: https://files.wmich.edu/s3fs-public/2025-02/wmu_cds_2024-25_0.pdf
 *
 * WMU is a PUBLIC Michigan R1 research university. oosAR is in eligible scope.
 *
 * Value changes vs existing DB:
 *   - acceptanceRate    : 84.6   -> 84.6   (CDS C1: total applied 21,701
 *                          (men 9,768 + women 11,932 + another 0 + unknown 1);
 *                          total admitted 18,359 (men 8,121 + women 10,237 +
 *                          another 0 + unknown 1). AR = 18,359/21,701 =
 *                          84.6044% (CDS rounds to 84.6%). Value matches DB
 *                          exactly. Tier LEGACY_DB_VALUE -> OFFICIAL.)
 *   - sat25             : 980    -> 980    (CDS C9 SAT Composite 25th = 980.
 *                          Value matches DB. Source upgraded from PrepScholar
 *                          (third-party) -> CDS_OFFICIAL. SAT submission rate
 *                          54.0% (1,341 students); ACT 4.6% (114). SAT-dominant.)
 *   - sat75             : 1200   -> 1200   (CDS C9 SAT Composite 75th = 1200.
 *                          Value matches DB. Source upgraded from PrepScholar
 *                          -> CDS_OFFICIAL.)
 *   - intlAcceptanceRate: 32.2   -> 32.17  (CDS C1 residency table: Intl
 *                          830 applied / 267 admitted = 32.1687% (rounded to
 *                          32.17%). Value matches DB (32.2 was rounded to one
 *                          decimal). Tier LEGACY_DB_VALUE -> OFFICIAL.)
 *   - oosAcceptanceRate : 88.4   -> 88.40  (CDS C1 residency table: OOS 6,153
 *                          applied / 5,439 admitted = 88.3959% (rounded to
 *                          88.40%). Value matches DB. Tier LEGACY_DB_VALUE
 *                          -> OFFICIAL.)
 *   - edAcceptanceRate  : null   -> null   (CDS C21: "Does your institution
 *                          offer an early decision plan?" — NO (X in No
 *                          column; closing/notification date and applied/
 *                          admitted cells all blank). WMU does NOT offer ED.
 *                          Stays null. Tier OFFICIAL/CDS_LLM_EXTRACT_2026_04
 *                          -> UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : 88.48  -> 88.48  (CDS C22: "Do you have a nonbinding
 *                          early action plan?" — YES (X in Yes column).
 *                          Early action closing date 12/15. Fall 2024 EA:
 *                          18,502 applied / 16,370 admitted = 88.4769%
 *                          (rounded to 88.48%). Value matches DB. Tier
 *                          LEGACY_DB_VALUE -> OFFICIAL.)
 *
 * hasEarlyDecision: current DB value is TRUE. CDS C21 confirms WMU does NOT
 *   offer ED. Correcting to FALSE.
 *
 * Test policy (C8A): "Does your institution make use of SAT or ACT scores
 *   in admission decisions?" — NO (X in No column). WMU is test-optional/
 *   test-blind for admission ("ACT/SAT scores will only be used if they
 *   benefit a student in the admission process; students will not be
 *   penalized because of test scores"). C9 percentiles still reported on
 *   submitted scores for the enrolled cohort.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://files.wmich.edu/s3fs-public/2025-02/wmu_cds_2024-25_0.pdf';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8isr003bz0ti1h6j1c5s';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (WMU) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC Michigan R1]`);
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
    generatedBy: 'phase3-batch27-wmu',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 84.6,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 21,701 total applied (men 9,768 + women 11,932 + another 0 + unknown 1); 18,359 total admitted (men 8,121 + women 10,237 + another 0 + unknown 1). AR = 18,359/21,701 = 84.6044% (CDS prints 84.6%). Tier upgraded LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 980,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'CDS 2024-25 Section C9 SAT Composite 25th percentile = 980. Submitting SAT 54.0% (1,341 students); ACT 4.6% (114) — WMU is SAT-dominant among submitters. Value matches prior DB; source upgraded from PrepScholar (third-party aggregator) -> CDS_OFFICIAL. NOTE: WMU is test-optional/test-blind for admission per C8A (SAT/ACT NOT used in admission decisions), but the C9 percentiles still reflect the enrolled cohort that submitted scores.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1200,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'CDS 2024-25 Section C9 SAT Composite 75th percentile = 1200. Value matches prior DB; source upgraded from PrepScholar -> CDS_OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 32.17,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency breakdown: International 830 applied / 267 admitted. intlAR = 267/830 = 32.1687% (rounded to 32.17%). Value matches prior DB (32.2 to one decimal); tier upgraded LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 88.4,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency breakdown: Out-of-state 6,153 applied / 5,439 admitted. oosAR = 5,439/6,153 = 88.3959% (rounded to 88.40%, store 88.4 to match prior precision). Value matches prior DB; tier upgraded LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO (X in No column; closing date, notification date, and applied/admitted cells all blank). WMU does NOT offer ED. Field stays null. Tier transitions OFFICIAL/CDS_LLM_EXTRACT_2026_04 -> UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED with refreshed provenance.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 88.48,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — YES (X in Yes column). Early action closing date 12/15 (non-restrictive). Fall 2024 EA: 18,502 applied / 16,370 admitted / 1,958 enrolled. eaAR = 16,370/18,502 = 88.4769% (rounded to 88.48%). Value matches prior DB; tier LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
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
      acceptanceRate: new Prisma.Decimal('84.6'),
      sat25: 980,
      sat75: 1200,
      intlAcceptanceRate: new Prisma.Decimal('32.17'),
      oosAcceptanceRate: new Prisma.Decimal('88.4'),
      edAcceptanceRate: null,
      eaAcceptanceRate: new Prisma.Decimal('88.48'),
      // CDS C21 "No" — WMU does NOT offer ED; correct stale DB true.
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=84.6, sat25=980, sat75=1200, intlAR=32.17, oosAR=88.4, edAR=NOT_OFFERED, eaAR=88.48, hasED=false)',
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
