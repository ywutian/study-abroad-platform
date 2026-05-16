#!/usr/bin/env tsx
/**
 * Phase 3 — University of California, Riverside (UCR) end-to-end closure of
 * the 7 prediction-critical fields.
 *
 * Source: UC Riverside CDS 2024-2025 (Fall 2024 entering class)
 *   URL: https://ir.ucr.edu/sites/default/files/2025-04/cds-2024-2025.pdf
 *   Index: https://ir.ucr.edu/cds
 *
 * UCR is a PUBLIC research university in the University of California system.
 *   - isPrivate=false  ->  oosAcceptanceRate IS in eligible scope and carries
 *     a real OFFICIAL CDS number.
 *   - UC SYSTEM-WIDE TEST-BLIND policy (C8A "No" — SAT/ACT NOT used in
 *     admission decisions, NOT collected). C9 SAT Composite/EBRW/Math rows
 *     are ALL BLANK in the CDS. Per closure-pipeline convention for test-blind
 *     schools: sat25/sat75 set to null with tier UNAVAILABLE/
 *     OFFICIAL_BLANK_SECTION (NOT_COLLECTED).
 *   - UC system does not offer Early Decision or Early Action (single
 *     application cycle).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 77.2    -> 76.85  (CDS C1: 44,356 admits / 57,714
 *                          applicants = 76.8497% (rounded to 76.85%). Minor
 *                          correction down -0.35pp from prior LEGACY_DB 77.2;
 *                          tier upgraded LEGACY_DB -> OFFICIAL.)
 *   - sat25             : 1120    -> null   (UC system is TEST-BLIND — C8A "No"
 *                          (SAT/ACT NOT used in admission decisions). CDS C9
 *                          SAT Composite/EBRW/Math 25/50/75 rows are ALL BLANK.
 *                          UC does not collect SAT data under test-blind policy.
 *                          Prior LEGACY_DB value 1120 cleared. Tier
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION (NOT_COLLECTED).)
 *   - sat75             : 1330    -> null   (Same as sat25 — UC test-blind,
 *                          CDS C9 BLANK. Prior LEGACY_DB value 1330 cleared.)
 *   - intlAcceptanceRate: 84.9    -> 84.99  (CDS C1 residency: 5,038 intl
 *                          admits / 5,928 intl applicants = 84.9865%
 *                          (rounded to 84.99%). Minor precision adjustment
 *                          from prior LEGACY_DB 84.9. Tier upgraded
 *                          LEGACY_DB -> OFFICIAL.)
 *   - oosAcceptanceRate : 95.3    -> 91.03  (CDS C1 residency: 2,607 OOS
 *                          admits / 2,864 OOS applicants = 91.0265%
 *                          (rounded to 91.03%). SIGNIFICANT DOWNWARD CORRECTION
 *                          -4.27pp from prior LEGACY_DB 95.3 (almost certainly
 *                          a stale prior-cycle figure). UCR is PUBLIC UC —
 *                          oosAR carries the real CDS number, never TERMINAL.
 *                          Tier upgraded LEGACY_DB -> OFFICIAL.)
 *   - edAcceptanceRate  : null    -> null   (CDS C21: "No" — UCR does NOT offer
 *                          Early Decision. UC system-wide single application
 *                          cycle, no ED. DB value was already null. Provenance
 *                          refreshed from CDS_LLM_EXTRACT_2026_04 (undefined)
 *                          to authoritative CDS_OFFICIAL pull marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : null    -> null   (CDS C22: "No" — UCR does NOT offer
 *                          Early Action. UC system-wide single application
 *                          cycle, no EA. DB value was already null. Provenance
 *                          refreshed from CDS_LLM_EXTRACT_2026_04 (undefined)
 *                          to authoritative CDS_OFFICIAL pull marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *
 * NOTE on hasEarlyDecision: current DB value is true but CDS C21 is "No".
 *   Setting to false to match CDS reality. (UC system never offered ED.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://ir.ucr.edu/sites/default/files/2025-04/cds-2024-2025.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8io40019z0ti0z11pe98';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UCR) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC UC — TEST-BLIND]`);
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
    generatedBy: 'phase3-ucr-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 76.85,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 44,356 admits / 57,714 applicants = 76.8497% (rounded to 76.85%). Minor correction down -0.35pp from prior LEGACY_DB value 77.2; tier upgraded from LEGACY_DB to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'UC system is TEST-BLIND — UCR CDS 2024-25 Section C8A "No" (SAT/ACT NOT used in admission decisions). CDS C9 SAT Composite / EBRW / Math 25/50/75 rows are ALL BLANK — UC does not collect SAT data under its test-blind policy. Prior LEGACY_DB value 1120 cleared. Field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION (NOT_COLLECTED).',
      realDataStatus: 'NOT_COLLECTED',
    },
    sat75: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'UC system is TEST-BLIND — UCR CDS 2024-25 Section C8A "No" (SAT/ACT NOT used in admission decisions). CDS C9 SAT Composite / EBRW / Math 25/50/75 rows are ALL BLANK — UC does not collect SAT data under its test-blind policy. Prior LEGACY_DB value 1330 cleared. Field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION (NOT_COLLECTED).',
      realDataStatus: 'NOT_COLLECTED',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 84.99,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 5,038 international admits / 5,928 international applicants = 84.9865% (rounded to 84.99%). Minor precision adjustment from prior LEGACY_DB 84.9 (+0.09pp); tier upgraded from LEGACY_DB to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 91.03,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 2,607 out-of-state admits / 2,864 out-of-state applicants = 91.0265% (rounded to 91.03%). SIGNIFICANT DOWNWARD CORRECTION -4.27pp from prior LEGACY_DB value 95.3 (likely stale prior-cycle figure or data-entry artifact). UCR is a PUBLIC UC research university — in-state vs. out-of-state distinction carries real policy meaning (different tuition, UC residency preference), so this field is in eligible scope and MUST carry a real CDS number. Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "No" — UCR does NOT offer Early Decision. UC system operates a single application cycle (no ED, no EA). DB value was already null; provenance refreshed from CDS_LLM_EXTRACT_2026_04 (undefined) to authoritative CDS_OFFICIAL pull marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED. Also corrected stale DB hasEarlyDecision=true to false.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "No" — UCR does NOT offer Early Action. UC system operates a single application cycle (no ED, no EA). DB value was already null; provenance refreshed from CDS_LLM_EXTRACT_2026_04 (undefined) to authoritative CDS_OFFICIAL pull marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
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

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('76.85'),
      sat25: null,
      sat75: null,
      intlAcceptanceRate: new Prisma.Decimal('84.99'),
      oosAcceptanceRate: new Prisma.Decimal('91.03'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — UC system does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=76.85, sat25=null[BLIND], sat75=null[BLIND], intlAR=84.99, oosAR=91.03, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
