#!/usr/bin/env tsx
/**
 * Phase 3 — Georgetown University closure of 7 prediction-critical fields.
 *
 * Source: Georgetown University CDS 2024-2025 (Fall 2024 entering class),
 *   published by Georgetown Office of Assessment and Decision Support.
 *   Index page: https://oads.georgetown.edu/commondataset/
 *   Direct file (Box share): https://georgetown.app.box.com/s/rp4p2ly4ej2tsikv827pl48psmb68quv
 *
 * Georgetown is PRIVATE (research university). Per closure convention,
 * oosAcceptanceRate is marked UNAVAILABLE / TERMINAL (no in-state policy
 * advantage).
 *
 * Early plan profile: Georgetown does NOT offer Early Decision (C21 "No").
 * Georgetown offers a **restrictive Early Action** (REA) plan (C22 "Yes",
 * restrictive=Yes). The CDS does not publish EA application/admit counts,
 * so eaAcceptanceRate is marked UNAVAILABLE / OFFICIAL_BLANK_SECTION even
 * though the plan exists.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 12.3   -> 12.92 (CDS C1: 3,374 / 26,131 =
 *                          12.9156%. CORRECTION UP +0.62pp. Prior LEGACY_DB
 *                          12.3 came from collegekickstart.com aggregator.
 *                          Tier upgraded LEGACY_DB -> OFFICIAL.)
 *   - sat25             : 1420   -> 1400 (CDS C9 SAT Composite 25th = 1400
 *                          reported directly. CORRECTION DOWN -20.)
 *   - sat75             : 1540   -> 1540 (CDS C9 SAT Composite 75th = 1540
 *                          reported directly. Confirmed.)
 *   - intlAcceptanceRate: 7.75   -> 7.75  (CDS C1 residency Intl: 280 /
 *                          3,615 = 7.7455%. Value matches; tier upgraded
 *                          LEGACY_DB -> OFFICIAL.)
 *   - oosAcceptanceRate : 13.71  -> null  (Georgetown is private; in/out-of-
 *                          state distinction carries no policy meaning. CDS
 *                          does report OOS (3,053 / 22,272 = 13.7095%) but
 *                          value is not actionable. Cleared, marked
 *                          UNAVAILABLE / TERMINAL.)
 *   - edAcceptanceRate  : null   -> null  (CDS C21 "No" — Georgetown does
 *                          not offer ED. UNAVAILABLE / NOT_OFFERED.)
 *   - eaAcceptanceRate  : 11.11  -> null  (CDS C22 "Yes" restrictive=Yes —
 *                          Georgetown offers REA, but C22 application/admit
 *                          counts are BLANK. Cannot extract EA admit rate
 *                          from CDS. Prior LEGACY_DB value 11.11% cleared.
 *                          Marked UNAVAILABLE / OFFICIAL_BLANK_SECTION even
 *                          though the plan exists.)
 *
 * hasEarlyDecision: false (re-confirm CDS C21 "No").
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://georgetown.app.box.com/s/rp4p2ly4ej2tsikv827pl48psmb68quv';
const CDS_INDEX_URL = 'https://oads.georgetown.edu/commondataset/';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmn1htkoc000lvqf2s5pgbhxx';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Georgetown) not found`);
  console.log(
    `Updating ${school.name} (${school.id})  isPrivate=${school.isPrivate}`,
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
    generatedBy: 'phase3-georgetown-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 12.92,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 3,374 admits / 26,131 applicants = 12.9156% (rounded to 12.92%). CORRECTION UP +0.62pp from prior LEGACY_DB 12.3 (whose sourceUrl pointed to collegekickstart.com aggregator — not Georgetown). Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1400,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1400 (reported directly; EBRW 700 + Math 690 sum = 1390 differs because composite quantiles ≠ section sums). CORRECTION DOWN -20 from prior 1420 (LEGACY_DB). 78% of Fall 2024 enrolled (1,232 students) submitted SAT.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1540,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1540 (reported directly; EBRW 770 + Math 780 sum = 1550 differs because composite quantiles ≠ section sums). Value matches prior DB; tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 7.75,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 280 international admits / 3,615 international applicants = 7.7455% (rounded to 7.75%). Value matches prior DB; tier upgraded LEGACY_DB -> OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Georgetown University is a private research university; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage, no residency-preference admit pathway). CDS C1 residency table does report OOS (3,053 admits / 22,272 applicants = 13.7095%), but the value is not actionable for applicants. Prior LEGACY_DB value (13.71%) cleared. Marked UNAVAILABLE / TERMINAL per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. Georgetown does not offer Early Decision. Field stays UNAVAILABLE / OFFICIAL_BLANK_SECTION (NOT_OFFERED). Provenance refreshed to 2024-25 cycle.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate (Restrictive EA — REA)',
      reason:
        'CDS 2024-25 Section C22: Georgetown offers a "restrictive" Early Action plan (REA) ("Yes" checked, restrictive="Yes", closing 11/1, notification 12/15) under which students are limited from applying to other early plans. However the C22 application/admit/enrollment count fields are BLANK in the published CDS. Cannot extract an EA admit rate from the source. Prior LEGACY_DB value 11.11% cleared (no traceable provenance). Marked UNAVAILABLE / OFFICIAL_BLANK_SECTION even though the REA plan exists.',
      realDataStatus: 'OFFICIALLY_BLANK',
    },
  };

  const existingMeta = toRecord(school.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: CDS_INDEX_URL,
  };

  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('12.92'),
      sat25: 1400,
      sat75: 1540,
      intlAcceptanceRate: new Prisma.Decimal('7.75'),
      oosAcceptanceRate: null,
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      hasEarlyDecision: false, // CDS C21 "No"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=12.92, sat25=1400, sat75=1540, intlAR=7.75, oosAR=N/A-private, edAR=NOT_OFFERED, eaAR=BLANK-REA)',
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
