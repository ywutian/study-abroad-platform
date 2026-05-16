#!/usr/bin/env tsx
/**
 * Phase 3 — George Washington University end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: GWU CDS 2024-2025
 *   URL: https://irp.gwu.edu/sites/g/files/zaxdzs6056/files/2025-05/CDS_2024-2025_FINAL.pdf
 *
 * GWU is a PRIVATE research university (isPrivate=true).
 *   - Private-school convention: oosAR carries no policy meaning -> UNAVAILABLE
 *     / TERMINAL (even though CDS C1 residency reports OOS, value not actionable).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 47.1   -> 47.09  (CDS C1: men 4432 + women 8286 + 0 +
 *                          0 = 12,718 admits; men 9735 + women 17271 + 0 + 0 =
 *                          27,006 applicants. 12,718 / 27,006 = 47.0932%
 *                          (rounded 47.09%). Minor precision adjustment; tier
 *                          upgraded LEGACY_DB (sourceUrl was
 *                          nextgenadmit.com aggregator — not GWU) -> OFFICIAL.)
 *   - sat25             : 1300   -> 1360   (CDS C9: SAT Composite 25th = 1360
 *                          reported directly. CORRECTION UP +60 from prior 1300
 *                          (SEED/LEGACY).)
 *   - sat75             : 1440   -> 1470   (CDS C9: SAT Composite 75th = 1470
 *                          reported directly. CORRECTION UP +30 from prior 1440
 *                          (SEED/LEGACY).)
 *   - intlAcceptanceRate: 35.7   -> 35.75  (CDS C1 residency: 1,279 intl admits
 *                          / 3,578 intl applicants = 35.7462% (rounded 35.75%).
 *                          Minor precision adjustment; tier upgraded LEGACY_DB
 *                          (sourceUrl was nextgenadmit.com aggregator —
 *                          not GWU) -> OFFICIAL.)
 *   - oosAcceptanceRate : 49.2   -> null   (GWU is a private research
 *                          university; in-state / OOS distinction carries no
 *                          policy meaning. CDS C1 residency does report OOS
 *                          (11260/22893 = 49.18%) but per closure-pipeline
 *                          convention, private schools -> UNAVAILABLE/TERMINAL.
 *                          Prior legacy DB value cleared.)
 *   - edAcceptanceRate  : 66.29  -> 66.29  (CDS C21: ED offered ("Yes" checked)
 *                          — ED I 11/1 closing 12/15 notification; ED II 1/5
 *                          closing 2/1 notification. Fall 2024 entering class
 *                          combined totals: 755 admits / 1,139 ED applications =
 *                          66.2862% (rounded 66.29%). Value matches prior DB;
 *                          tier upgraded LEGACY_DB -> OFFICIAL.)
 *   - eaAcceptanceRate  : null   -> null   (CDS C22: "No" — GWU does not offer
 *                          a nonbinding EA plan. Field stays cleared
 *                          (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED).
 *                          Provenance refreshed from prior CDS_LLM_EXTRACT_2026_04.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://irp.gwu.edu/sites/g/files/zaxdzs6056/files/2025-05/CDS_2024-2025_FINAL.pdf';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8img000bz0tiktbc3agu';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (GWU) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PRIVATE]`);
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
    generatedBy: 'phase3-gwu-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 47.09,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: men 4,432 + women 8,286 + another 0 + unknown 0 = 12,718 admits; men 9,735 + women 17,271 + another 0 + unknown 0 = 27,006 applicants. 12,718 / 27,006 = 47.0932% (rounded 47.09%). Minor precision adjustment from prior 47.1; tier upgraded from LEGACY_DB (sourceUrl was nextgenadmit.com aggregator — not GWU) to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1360,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1360 (reported directly; EBRW 680 + Math 670 = 1350 differs because composite quantiles ≠ section sums). 27% of Fall 2024 enrolled (673 students) submitted SAT under test-optional policy (C8A: SAT/ACT required for some, considered if submitted otherwise). CORRECTION UP +60 from prior 1300 (SEED/LEGACY).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1470,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1470 (reported directly; EBRW 750 + Math 750 = 1500 differs because composite quantiles ≠ section sums). CORRECTION UP +30 from prior 1440 (SEED/LEGACY).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 35.75,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 1,279 international admits / 3,578 international applicants = 35.7462% (rounded 35.75%). Minor precision adjustment from prior 35.7; tier upgraded from LEGACY_DB (sourceUrl was nextgenadmit.com aggregator — not GWU) to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'George Washington University is a private research university; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS 2024-25 C1 residency table does report OOS (11,260 admits / 22,893 applicants = 49.1853%), but the value is not actionable for applicants. Prior legacy DB value (49.2%, sourceUrl was nextgenadmit.com aggregator) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 66.29,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2024-25 Section C21: GWU offers Early Decision ("Yes" checked) with two plans — ED I closes 11/1 (12/15 notification), ED II closes 1/5 (2/1 notification). Fall 2024 entering class combined totals: 755 admits / 1,139 ED applications = 66.2862% (rounded 66.29%). Value matches prior DB; tier upgraded LEGACY_DB -> OFFICIAL with refreshed phase3 provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. GWU does not offer Early Action. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance refreshed to authoritative phase3 pull from prior CDS_LLM_EXTRACT_2026_04 with value=undefined.',
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
      acceptanceRate: new Prisma.Decimal('47.09'),
      sat25: 1360,
      sat75: 1470,
      intlAcceptanceRate: new Prisma.Decimal('35.75'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('66.29'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=47.09, sat25=1360, sat75=1470, intlAR=35.75, oosAR=N/A, edAR=66.29, eaAR=NOT_OFFERED, hasED=true)',
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
