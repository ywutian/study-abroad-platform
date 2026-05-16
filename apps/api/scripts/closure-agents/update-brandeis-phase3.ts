#!/usr/bin/env tsx
/**
 * Phase 3 — Brandeis University end-to-end closure of the 7 prediction-critical
 * fields.
 *
 * Source: Brandeis University CDS 2024-2025
 *   URL: https://www.brandeis.edu/institutional-research/docs/cds-2024-25.pdf
 *
 * Brandeis is a PRIVATE research university (isPrivate=true).
 *   - Private-school convention: oosAR carries no policy meaning -> UNAVAILABLE
 *     / TERMINAL (even though CDS C1 residency reports OOS, value not actionable).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 40.47  -> 40.51  (CDS C1: men 1643 + women 2591 +
 *                          another 0 + unknown 4 = 4,238 admits; men 4566 +
 *                          women 5888 + another 0 + unknown 8 = 10,462
 *                          applicants. 4238/10462 = 40.5085% (rounded 40.51%).
 *                          Minor precision adjustment; tier upgraded
 *                          LEGACY_DB -> OFFICIAL.)
 *   - sat25             : 1340   -> 1415   (CDS C9: SAT Composite 25th = 1415
 *                          reported directly; EBRW 690 + Math 700 = 1390
 *                          differs from composite (composite quantiles ≠
 *                          section sums). CORRECTION UP +75 from prior 1340
 *                          (SEED/LEGACY).)
 *   - sat75             : 1490   -> 1510   (CDS C9: SAT Composite 75th = 1510
 *                          reported directly; EBRW 750 + Math 770 = 1520
 *                          differs (composite quantiles ≠ section sums).
 *                          CORRECTION UP +20 from prior 1490 (SEED/LEGACY).)
 *   - intlAcceptanceRate: 20.06  -> 20.06  (CDS C1 residency: 767 intl admits /
 *                          3,824 intl applicants = 20.0575% (rounded 20.06%).
 *                          Value matches prior DB; tier upgraded LEGACY_DB ->
 *                          OFFICIAL with refreshed phase3 provenance.)
 *   - oosAcceptanceRate : 55.82  -> null   (Brandeis is a private research
 *                          university; in-state / OOS distinction carries no
 *                          policy meaning. CDS C1 residency does report OOS
 *                          (2585/4631 = 55.82%) but per closure-pipeline
 *                          convention, private schools -> UNAVAILABLE/TERMINAL.
 *                          Prior legacy DB value cleared.)
 *   - edAcceptanceRate  : 42.22  -> 42.22  (CDS C21: ED offered ("Yes" checked)
 *                          — ED I 11/1 closing 12/7 notification; ED II 1/2
 *                          closing 1/25 notification. Fall 2024 entering class
 *                          combined totals: 323 admits / 765 ED applications =
 *                          42.2222% (rounded 42.22%). Value matches prior DB;
 *                          tier upgraded LEGACY_DB -> OFFICIAL.)
 *   - eaAcceptanceRate  : null   -> null   (CDS C22: "No" — Brandeis does not
 *                          offer a nonbinding EA plan. Field stays cleared
 *                          (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED).
 *                          Provenance refreshed to authoritative phase3 pull
 *                          from prior CDS_LLM_EXTRACT_2026_04 with
 *                          value=undefined.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.brandeis.edu/institutional-research/docs/cds-2024-25.pdf';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8im10003z0ti20a5qdxq';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Brandeis) not found`);
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
    generatedBy: 'phase3-brandeis-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 40.51,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: men 1,643 + women 2,591 + another 0 + unknown 4 = 4,238 admits; men 4,566 + women 5,888 + another 0 + unknown 8 = 10,462 applicants. 4,238 / 10,462 = 40.5085% (rounded 40.51%). Minor precision adjustment from prior 40.47; tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1415,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1415 (reported directly; EBRW 690 + Math 700 = 1390 differs because composite quantiles ≠ section sums). 30.00% of Fall 2024 enrolled (217 students) submitted SAT under test-optional policy (C8A: SAT considered if submitted). CORRECTION UP +75 from prior 1340 (SEED/LEGACY).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1510,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1510 (reported directly; EBRW 750 + Math 770 = 1520 differs because composite quantiles ≠ section sums). CORRECTION UP +20 from prior 1490 (SEED/LEGACY).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 20.06,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 767 international admits / 3,824 international applicants = 20.0575% (rounded 20.06%). Value matches prior DB (20.06); tier upgraded from LEGACY_DB to OFFICIAL with refreshed phase3 provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Brandeis University is a private research university; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS 2024-25 C1 residency table does report OOS (2,585 admits / 4,631 applicants = 55.8195%), but the value is not actionable for applicants. Prior legacy DB value (55.82%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 42.22,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2024-25 Section C21: Brandeis offers Early Decision ("Yes" checked) with two plans — ED I closes 11/1 (12/7 notification), ED II closes 1/2 (1/25 notification). Fall 2024 entering class combined totals: 323 admits / 765 ED applications = 42.2222% (rounded 42.22%). Value matches prior DB; tier upgraded LEGACY_DB -> OFFICIAL with refreshed phase3 provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. Brandeis does not offer Early Action. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance refreshed to authoritative phase3 pull from prior CDS_LLM_EXTRACT_2026_04 with value=undefined.',
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
      acceptanceRate: new Prisma.Decimal('40.51'),
      sat25: 1415,
      sat75: 1510,
      intlAcceptanceRate: new Prisma.Decimal('20.06'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('42.22'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=40.51, sat25=1415, sat75=1510, intlAR=20.06, oosAR=N/A, edAR=42.22, eaAR=NOT_OFFERED, hasED=true)',
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
