#!/usr/bin/env tsx
/**
 * Phase 3 — Southern Methodist University (SMU) end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: SMU CDS 2024-2025 Part C — First-Time, First-Year Admission
 *   URL: https://www.smu.edu/-/media/site/ir/commondatasets/2024/cds-2024-25-part-c-first-time-freshman.pdf
 *
 * SMU is a PRIVATE university (United Methodist-affiliated, Dallas TX).
 *   - isPrivate=true  ->  oosAcceptanceRate marked UNAVAILABLE/TERMINAL per
 *     closure-pipeline convention (no in-state/OOS tuition policy distinction
 *     even though CDS C1 residency reports the breakdown).
 *
 * SMU is TEST-OPTIONAL (CDS C8A "Yes" overall, but specific box checked is
 *   "Not required for admission, but consider if submitted").
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 63.34   -> 63.35  (CDS C1: 9,657 admits / 15,245
 *                          applicants = 63.3486%, rounded to 63.35%. Trivial
 *                          precision shift +0.01pp. Tier already OFFICIAL with
 *                          cycleYear=2024, refreshed to confirm value field.)
 *   - sat25             : 1290    -> 1340   (CDS C9: SAT Composite 25th = 1340
 *                          reported directly. CORRECTION UP +50 from prior 1290
 *                          (LEGACY_DB). Tier upgraded LEGACY_DB -> OFFICIAL.)
 *   - sat75             : 1440    -> 1480   (CDS C9: SAT Composite 75th = 1480
 *                          reported directly. CORRECTION UP +40 from prior 1440
 *                          (LEGACY_DB). Tier upgraded LEGACY_DB -> OFFICIAL.)
 *   - intlAcceptanceRate: 40.21   -> 40.21  (CDS C1 residency: 386 intl admits
 *                          / 960 intl applicants = 40.2083%, rounded to 40.21%.
 *                          Value matches prior DB; tier already OFFICIAL with
 *                          cycleYear=2024, refreshed to populate value field.)
 *   - oosAcceptanceRate : 72.80   -> null   (SMU is a private university; in-
 *                          state / out-of-state distinction carries no policy
 *                          meaning. CDS C1 residency does report OOS (4,761
 *                          admits / 6,540 applicants = 72.80%) but per closure-
 *                          pipeline convention, private schools -> UNAVAILABLE/
 *                          TERMINAL. Prior legacy DB value cleared.)
 *   - edAcceptanceRate  : 87.38   -> 87.38  (CDS C21: ED offered ("Yes" checked);
 *                          two ED plans — ED I closes 11/1, notification 12/31;
 *                          ED II closes 1/15, notification 3/1. Fall 2024
 *                          entering class combined totals: 353 admits / 404 ED
 *                          applications = 87.3762%, rounded to 87.38%. Value
 *                          matches prior DB; tier upgraded LEGACY_DB -> OFFICIAL
 *                          with cycle metadata.)
 *   - eaAcceptanceRate  : 81.11   -> null   (CDS C22: EA offered ("Yes" checked,
 *                          nonbinding, non-restrictive) but SMU's CDS C22 does
 *                          NOT include the "For the Fall 2024 entering class"
 *                          applications/admits subform — only closing/
 *                          notification dates (11/1, 12/31) are filled. The
 *                          prior DB value 81.11 came from TAVILY_ENRICHMENT and
 *                          is NOT in the authoritative CDS. Per closure-pipeline
 *                          convention, value is cleared and marked UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION since CDS does not publish
 *                          this number despite EA being offered.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.smu.edu/-/media/site/ir/commondatasets/2024/cds-2024-25-part-c-first-time-freshman.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ims000iz0timfd6oan8';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (SMU) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(
    `  isPrivate=${school.isPrivate}  [PRIVATE — oosAR=UNAVAILABLE/TERMINAL]`,
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
    generatedBy: 'phase3-smu-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 63.35,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 9,657 admits / 15,245 applicants = 63.3486% (rounded to 63.35%). Trivial +0.01pp precision shift from prior 63.34%. Tier already OFFICIAL with cycleYear=2024 — refreshed to populate value field and reaffirm authoritative source URL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1340,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1340 (reported directly; EBRW 670 + Math 670 sum = 1340 also coincides). CORRECTION UP +50 from prior 1290 (LEGACY_DB heuristic). Tier upgraded LEGACY_DB -> OFFICIAL. NOTE: SMU is test-optional (CDS C8A "Not required for admission, but consider if submitted"); only 15.50% of Fall 2024 enrolled (266 students) submitted SAT.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1480,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1480 (reported directly; EBRW 740 + Math 750 sum = 1490 differs because composite quantiles ≠ section sums). CORRECTION UP +40 from prior 1440 (LEGACY_DB heuristic). Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 40.21,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 386 international admits / 960 international applicants = 40.2083% (rounded to 40.21%). Value matches prior DB exactly; tier already OFFICIAL with cycleYear=2024 — refreshed to populate value field.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'SMU is a private United Methodist-affiliated university in Dallas, TX; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage; same tuition for all US students). CDS C1 residency table does report OOS (4,761 admits / 6,540 applicants = 72.80%), but the value is not actionable for applicants. Prior legacy DB value (72.80%, derived from same CDS table) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 87.38,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2024-25 Section C21: SMU offers Early Decision ("Yes" checked) with two plans — ED I closes 11/1 (12/31 notification), ED II closes 1/15 (3/1 notification). Fall 2024 entering class combined totals: 353 admits / 404 ED applications = 87.3762% (rounded to 87.38%). Value matches prior DB; tier upgraded LEGACY_DB -> OFFICIAL with current cycle metadata.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: SMU offers nonbinding non-restrictive Early Action ("Yes" checked) — closing 11/1, notification 12/31. However, the C22 form does NOT include a "For the Fall 2024 entering class" applications/admits subform (only closing/notification dates are reported). Prior DB value 81.11 came from TAVILY_ENRICHMENT and is NOT sourced from authoritative CDS. Per closure-pipeline convention, value cleared and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION since CDS does not publish this number despite EA being offered.',
      realDataStatus: 'NOT_REPORTED',
    },
  };

  const existingMeta = toRecord(school.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: CDS_URL,
  };

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('63.35'),
      sat25: 1340,
      sat75: 1480,
      intlAcceptanceRate: new Prisma.Decimal('40.21'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('87.38'),
      eaAcceptanceRate: null, // CDS C22 does not publish EA admit numbers
      hasEarlyDecision: true, // re-confirm from CDS C21 "Yes"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  OK updated 7 fields (AR=63.35, sat25=1340, sat75=1480, intlAR=40.21, oosAR=N/A, edAR=87.38, eaAR=NOT_REPORTED)',
  );

  // verify
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
