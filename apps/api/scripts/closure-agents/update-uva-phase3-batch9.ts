#!/usr/bin/env tsx
/**
 * Phase 3 — University of Virginia end-to-end closure of the 7
 * prediction-critical fields. PUBLIC university.
 *
 * Source: UVA CDS 2024-2025
 *   URL: http://ira.virginia.edu/sites/ira/files/2025-03/CDS_2024-2025_508.pdf
 *
 * NOTE: UVA is a PUBLIC university (Commonwealth of Virginia). oosAR is in
 * eligible scope and MUST carry a real OFFICIAL number from CDS C1 residency.
 * UVA reintroduced Early Decision in 2019 (CDS C21 "Yes").
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 16.49    -> 16.81  (CDS C1: 9,909 admits / 58,951
 *                          applicants = 16.8089%. CORRECTION UP +0.32pp from
 *                          prior 16.49 (LEGACY_DB). Tier LEGACY_DB_VALUE ->
 *                          OFFICIAL.)
 *   - sat25             : 1370     -> 1410  (CDS C9: SAT Composite 25th =
 *                          1410. CORRECTION UP +40 from prior 1370.)
 *   - sat75             : 1500     -> 1520  (CDS C9: SAT Composite 75th =
 *                          1520. CORRECTION UP +20 from prior 1500.)
 *   - intlAcceptanceRate: 10.46    -> 10.46  (CDS C1 residency: 728 intl
 *                          admits / 6,961 intl applicants = 10.4583%. Matches
 *                          prior DB; tier LEGACY_DB_VALUE -> OFFICIAL.)
 *   - oosAcceptanceRate : 13       -> 13.83  (CDS C1 residency: 4,912 OOS
 *                          admits / 35,526 OOS applicants = 13.8265%
 *                          (rounded 13.83%). CORRECTION UP +0.83pp from prior
 *                          13 (LEGACY_DB). PUBLIC university — oosAR carries
 *                          real OFFICIAL number. Tier LEGACY_DB_VALUE ->
 *                          OFFICIAL.)
 *   - edAcceptanceRate  : 27.91    -> 27.91  (CDS C21: UVA offers ED ("Yes")
 *                          since 2019, single plan, closing 11/1, notification
 *                          12/15. Fall 2024 entering class: 1,245 admits /
 *                          4,461 ED applications = 27.9131% (rounded 27.91%).
 *                          Matches prior DB; provenance changed from
 *                          NOT_APPLICABLE/POLICY_DETERMINATION (stale — UVA
 *                          had no ED before 2019) -> OFFICIAL with refreshed
 *                          cycle metadata. ALSO sets hasEarlyDecision=true
 *                          (was false in DB, contradicting CDS reality).)
 *   - eaAcceptanceRate  : 17       -> null   (CDS C22: UVA offers a
 *                          nonbinding Early Action plan ("Yes" checked,
 *                          restrictive, closing 11/1, notification 2/15) but
 *                          the CDS C22 form does NOT collect EA applicant /
 *                          admit counts (only ED counts are collected in C21).
 *                          eaAR cannot be computed from CDS authoritative
 *                          source. Prior DB value 17 (TAVILY_ENRICHMENT, not
 *                          authoritative) cleared. Field marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION (EA exists but
 *                          counts not published in CDS).)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'http://ira.virginia.edu/sites/ira/files/2025-03/CDS_2024-2025_508.pdf';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmn1htkom000pvqf2se90bue1';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UVA) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC SCHOOL]`);
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
    generatedBy: 'phase3-uva-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 16.81,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 9,909 admits / 58,951 applicants = 16.8089% (rounded 16.81%). CORRECTION UP +0.32pp from prior 16.49 (LEGACY_DB). Tier upgraded LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1410,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1410 (reported directly). CORRECTION UP +40 from prior 1370 (LEGACY_DB).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1520,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1520 (reported directly). CORRECTION UP +20 from prior 1500 (LEGACY_DB).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 10.46,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 728 international admits / 6,961 international applicants = 10.4583% (rounded 10.46%). Matches prior DB; tier upgraded LEGACY_DB_VALUE -> OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 13.83,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 4,912 OOS admits / 35,526 OOS applicants = 13.8265% (rounded 13.83%). UVA is a PUBLIC university (Commonwealth of Virginia) — in-state vs. out-of-state distinction carries real policy meaning (different tuition, residency-preference admit pathways), so this field is in eligible scope and MUST carry a real CDS number. CORRECTION UP +0.83pp from prior 13 (LEGACY_DB). Tier upgraded LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 27.91,
      policyLabel: 'Early Decision admit rate (single plan)',
      reason:
        'CDS 2024-25 Section C21: UVA offers Early Decision ("Yes" checked), single plan, closing 11/1, notification 12/15. Note: UVA reintroduced ED in 2019; prior DB provenance tier=NOT_APPLICABLE/POLICY_DETERMINATION was stale (reflected pre-2019 policy). Fall 2024 entering class: 1,245 admits / 4,461 ED applications = 27.9131% (rounded 27.91%). Value matches prior DB; tier upgraded NOT_APPLICABLE -> OFFICIAL with refreshed cycle metadata. ALSO sets hasEarlyDecision=true (was false in DB, contradicting CDS C21 "Yes").',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: UVA OFFERS a nonbinding Early Action plan ("Yes" checked, restrictive, closing 11/1, notification 2/15). However the CDS C22 form does NOT collect EA applicant/admit counts (only ED counts are collected in C21). Therefore eaAR cannot be computed from CDS authoritative source. Prior DB value 17 (TAVILY_ENRICHMENT, not authoritative) cleared. Field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION — EA plan exists but counts are not published in CDS.',
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

  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('16.81'),
      sat25: 1410,
      sat75: 1520,
      intlAcceptanceRate: new Prisma.Decimal('10.46'),
      oosAcceptanceRate: new Prisma.Decimal('13.83'),
      edAcceptanceRate: new Prisma.Decimal('27.91'),
      eaAcceptanceRate: null,
      // UVA reintroduced ED in 2019; CDS C21 "Yes" — correct stale DB false.
      hasEarlyDecision: true,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=16.81, sat25=1410, sat75=1520, intlAR=10.46, oosAR=13.83 OFFICIAL public, edAR=27.91, eaAR=N/R hasED=true)',
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
