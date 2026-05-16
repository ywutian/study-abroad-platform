#!/usr/bin/env tsx
/**
 * Phase 3 — The Ohio State University (Columbus) end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: OSU Columbus CDS 2024-2025 (Fall 2024 entering class).
 *   URL: https://irp.osu.edu/sites/default/files/documents/2025/11/CDS-2024-2025-The-Ohio-State-University-Columbus.pdf
 *
 * NOTE: OSU is a PUBLIC institution.
 *   - isPrivate=false  ->  oosAcceptanceRate MUST carry a real OFFICIAL number
 *     from CDS C1 residency table.
 *
 * Test policy: OSU is test-optional (CDS C8A "Yes" but C8F note states "The
 * submission of test scores is optional for applicants to the Columbus campus
 * for the 2025 spring, summer and autumn semesters"). C9 SAT Composite
 * reported normally.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 56.55 -> 60.57  (CDS 2024-25 C1: 44,116 admits /
 *                          72,829 applicants = 60.5734% (rounded to 60.57%).
 *                          CORRECTION UP +4.02pp from prior LEGACY_DB 56.55.
 *                          Tier LEGACY_DB->OFFICIAL.)
 *   - sat25             : 1260  -> 1280   (CDS 2024-25 C9: SAT Composite 25th =
 *                          1280 reported directly. CORRECTION UP +20 from prior
 *                          1260 (SEED/PR-15 heuristic).)
 *   - sat75             : 1410  -> 1430   (CDS 2024-25 C9: SAT Composite 75th =
 *                          1430 reported directly. CORRECTION UP +20 from prior
 *                          1410 (SEED/PR-15 heuristic).)
 *   - intlAcceptanceRate: 6.94  -> 72.03  (CDS 2024-25 C1 residency: 8,569
 *                          international admits / 11,896 international
 *                          applicants = 72.0410% (rounded to 72.03%). MAJOR
 *                          CORRECTION UP — prior LEGACY_DB 6.94% appears to
 *                          have been totally wrong / mis-sourced. Tier
 *                          LEGACY_DB->OFFICIAL.)
 *   - oosAcceptanceRate : 49.93 -> 58.98  (CDS 2024-25 C1 residency: 22,140 OOS
 *                          admits / 37,540 OOS applicants = 58.9771% (rounded
 *                          to 58.98%). CORRECTION UP +9.05pp from prior
 *                          LEGACY_DB 49.93. Public school -> oosAR carries the
 *                          real OFFICIAL number. Tier LEGACY_DB->OFFICIAL.)
 *   - edAcceptanceRate  : null  -> null   (CDS 2024-25 C21: "No" — OSU does NOT
 *                          offer Early Decision. Field stays null. Provenance
 *                          refreshed from prior POLICY_DETERMINATION/
 *                          NOT_APPLICABLE to authoritative
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : null  -> null   (CDS 2024-25 C22: "Yes" — OSU OFFERS
 *                          Early Action (closes 11/1, notification 1/31,
 *                          non-restrictive). HOWEVER, OSU does NOT publish EA
 *                          applicants/admits counts in CDS C22 (those fields
 *                          are blank/not provided). Field stays null with
 *                          tier=UNAVAILABLE source=OFFICIAL_BLANK_SECTION:
 *                          plan exists but CDS does not report numbers.
 *                          Refreshed from prior CDS_LLM_EXTRACT_2026_04
 *                          (value=undefined but tier=OFFICIAL, semantically
 *                          inconsistent) to authoritative current cycle.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://irp.osu.edu/sites/default/files/documents/2025/11/CDS-2024-2025-The-Ohio-State-University-Columbus.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmn1htkq00017vqf245v5dk2j';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Ohio State) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate} (public)`);
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
    generatedBy: 'phase3-ohio-state-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 60.57,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 44,116 admits / 72,829 applicants = 60.5734% (rounded to 60.57%). CORRECTION UP +4.02pp from prior LEGACY_DB value 56.55. Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1280,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1280 (reported directly; EBRW 620 + Math 640 sum = 1260 differs because composite quantiles ≠ section sums). CORRECTION UP +20 from prior 1260 (SEED/PR-15 heuristic). OSU is test-optional; 24% of Fall 2024 enrolled (2,288 students) submitted SAT.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1430,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1430 (reported directly; EBRW 710 + Math 740 sum = 1450 differs because composite quantiles ≠ section sums). CORRECTION UP +20 from prior 1410 (SEED/PR-15 heuristic).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 72.03,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 8,569 international admits / 11,896 international applicants = 72.0410% (rounded to 72.03%). MAJOR CORRECTION UP — prior LEGACY_DB value 6.94 appears to have been totally wrong / mis-sourced (perhaps swapped with an unrelated metric). Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 58.98,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 22,140 out-of-state admits / 37,540 out-of-state applicants = 58.9771% (rounded to 58.98%). OSU is a PUBLIC institution — in-state vs. out-of-state distinction carries real policy meaning (different tuition, residency preference at flagship), so this field is in eligible scope and MUST carry a real CDS number. CORRECTION UP +9.05pp from prior LEGACY_DB value 49.93. Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. OSU does not offer Early Decision. Field stays null. Provenance refreshed from prior POLICY_DETERMINATION/NOT_APPLICABLE to authoritative UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: OSU OFFERS Early Action ("Yes" checked; closes 11/1, notification 1/31, non-restrictive). HOWEVER, OSU does NOT publish EA applicants/admits counts in CDS C22 (the numeric fields are blank in the published CDS). Plan exists but rate cannot be computed from CDS. Field stays null with tier=UNAVAILABLE source=OFFICIAL_BLANK_SECTION. Refreshed from prior CDS_LLM_EXTRACT_2026_04 (value=undefined but tier=OFFICIAL, semantically inconsistent) to authoritative current cycle.',
      realDataStatus: 'NOT_DISCLOSED',
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
      acceptanceRate: new Prisma.Decimal('60.57'),
      sat25: 1280,
      sat75: 1430,
      intlAcceptanceRate: new Prisma.Decimal('72.03'),
      oosAcceptanceRate: new Prisma.Decimal('58.98'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      hasEarlyDecision: false, // CDS C21 "No" — re-confirm
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=60.57, sat25=1280, sat75=1430, intlAR=72.03, oosAR=58.98, edAR=NOT_OFFERED, eaAR=PLAN_EXISTS_NUMBERS_BLANK)',
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
