#!/usr/bin/env tsx
/**
 * Phase 3 — University of Washington (Seattle) end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: UW Seattle CDS 2024-2025 (Fall 2024 entering class).
 *   URL: https://uw-s3-cdn.s3.us-west-2.amazonaws.com/wp-content/uploads/sites/162/2025/04/01121035/CDS_2024-2025_Seattle.pdf
 *
 * NOTE: UW is a PUBLIC institution (CDS A2 "Public" checked).
 *   - isPrivate=false  ->  oosAcceptanceRate MUST carry a real OFFICIAL number
 *     from CDS C1 residency table (PUBLIC-school convention).
 *
 * UW is **test-blind** (CDS C8A "No" — does not use SAT/ACT in admission
 * decisions). Per closure-pipeline convention, the reported C9 SAT Composite
 * percentiles are still recorded as OFFICIAL for descriptive applicant-profile
 * use (not as a gating threshold).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 43    -> 39.15  (CDS 2024-25 C1: 27,076 admits /
 *                          69,166 applicants = 39.1466%. CORRECTION DOWN ~3.85pp
 *                          from prior LEGACY_DB 43. Tier LEGACY_DB->OFFICIAL.)
 *   - sat25             : 1290  -> 1333   (CDS 2024-25 C9: SAT Composite 25th =
 *                          1333. CORRECTION UP from prior 1290 (SEED/PR-15
 *                          heuristic). NOTE: UW is test-blind; SAT band is
 *                          descriptive only.)
 *   - sat75             : 1460  -> 1500   (CDS 2024-25 C9: SAT Composite 75th =
 *                          1500. CORRECTION UP from prior 1460 (SEED/PR-15
 *                          heuristic). NOTE: UW is test-blind; descriptive only.)
 *   - intlAcceptanceRate: 38.3  -> 38.83  (CDS 2024-25 C1 residency: 4,385 intl
 *                          admits / 11,294 intl applicants = 38.8259%. Minor
 *                          precision upgrade. Tier LEGACY_DB->OFFICIAL.)
 *   - oosAcceptanceRate : 36    -> 36.20  (CDS 2024-25 C1 residency: 15,547 OOS
 *                          admits / 42,942 OOS applicants = 36.2046%. Minor
 *                          precision upgrade. Tier LEGACY_DB->OFFICIAL. PUBLIC
 *                          school -> oosAR carries the real OFFICIAL number.)
 *   - edAcceptanceRate  : 25.26 -> null   (CDS 2024-25 C21: "No" — UW does NOT
 *                          offer Early Decision. Prior DB value 25.26 with
 *                          POLICY_DETERMINATION provenance was incorrect — value
 *                          should never have been set since UW has no ED plan.
 *                          Clear value, mark UNAVAILABLE/OFFICIAL_BLANK_SECTION/
 *                          NOT_OFFERED.)
 *   - eaAcceptanceRate  : null  -> null   (CDS 2024-25 C22: "No" — UW does NOT
 *                          offer Early Action. Prior provenance was
 *                          CDS_LLM_EXTRACT_2026_04 (value=undefined) tier=OFFICIAL
 *                          which is semantically wrong (should be UNAVAILABLE,
 *                          not OFFICIAL with no value). Refresh to UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://uw-s3-cdn.s3.us-west-2.amazonaws.com/wp-content/uploads/sites/162/2025/04/01121035/CDS_2024-2025_Seattle.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmn1htkpu0015vqf2kumhyv3t';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UW) not found`);
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
    generatedBy: 'phase3-uw-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 39.15,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 27,076 admits / 69,166 applicants = 39.1466% (rounded to 39.15%). CORRECTION DOWN ~3.85pp from prior LEGACY_DB value 43. Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1333,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1333 (reported directly). CORRECTION UP from prior 1290 (SEED/PR-15 heuristic). NOTE: UW is test-blind (CDS C8A "No" — SAT/ACT scores not used in admission decisions); SAT band is recorded for descriptive applicant-profile use only, not as a gating threshold. Only 15% of Fall 2024 enrolled (1,069 students) submitted SAT.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1500,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1500 (reported directly). CORRECTION UP from prior 1460 (SEED/PR-15 heuristic). NOTE: UW is test-blind (CDS C8A "No"); SAT band is descriptive only.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 38.83,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 4,385 international admits / 11,294 international applicants = 38.8259% (rounded to 38.83%). Minor precision upgrade from prior LEGACY_DB value 38.3. Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 36.2,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 15,547 out-of-state admits / 42,942 out-of-state applicants = 36.2046% (rounded to 36.20%). UW is a PUBLIC institution (CDS A2 "Public") — in-state vs. out-of-state distinction carries real policy meaning (different tuition, residency considerations), so this field is in eligible scope and MUST carry a real CDS number. Minor precision upgrade from prior LEGACY_DB value 36. Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. UW does not offer Early Decision. Prior DB value 25.26 with POLICY_DETERMINATION provenance was incorrect — value should never have been set since UW has no ED plan. Cleared to null and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. UW does not offer Early Action. DB value already null; provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 (with value=undefined but tier=OFFICIAL, semantically inconsistent) to authoritative UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
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
      acceptanceRate: new Prisma.Decimal('39.15'),
      sat25: 1333,
      sat75: 1500,
      intlAcceptanceRate: new Prisma.Decimal('38.83'),
      oosAcceptanceRate: new Prisma.Decimal('36.20'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      hasEarlyDecision: false, // CDS C21 "No" — re-confirm
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=39.15, sat25=1333, sat75=1500, intlAR=38.83, oosAR=36.20, edAR=NOT_OFFERED, eaAR=NOT_OFFERED)',
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
