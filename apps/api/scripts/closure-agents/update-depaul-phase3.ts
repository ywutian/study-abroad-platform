#!/usr/bin/env tsx
/**
 * Phase 3 — DePaul University end-to-end closure of the 7 prediction-critical
 * fields.
 *
 * Source: DePaul University CDS 2024-2025 (Fall 2024 entering class).
 *   Section A index: https://irma.depaul.edu/CallReport.asp?backguy=/cds/2024/2024CDS_A.pdf
 *   Section C (admission): https://irma.depaul.edu/cds/2024/2024CDS_C.pdf  (parsed by Claude from PDF)
 *
 * Institution facts:
 *   - PRIVATE research university (Vincentian/Catholic)
 *   - In-state/Out-of-state distinction carries no policy meaning → oosAR = UNAVAILABLE/TERMINAL
 *   - International rates only meaningful for residency-aware (public) schools.
 *     Since CDS C1 residency table is BLANK (all rows show TOTAL=0 with no
 *     in-state/OOS/intl breakdown), intlAR likewise has no published source.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 91.65    → 75.89   (CDS C1: men 12,658 + women 18,608 =
 *                          31,266 applicants; men 9,290 + women 14,439 = 23,729
 *                          admits; 23,729/31,266 = 75.8907% (rounded to 75.89%).
 *                          BIG DOWNWARD CORRECTION −15.76pp. Prior LEGACY_DB
 *                          value 91.65 pointed to the CDS A index URL but was
 *                          inconsistent with the actual CDS C numbers. Tier
 *                          upgraded LEGACY_DB → OFFICIAL.)
 *   - sat25             : 1140     → 1090    (CDS C9: SAT Composite 25th = 1090.
 *                          CORRECTION DOWN −50 from prior SEED/PR-15 heuristic
 *                          value 1140. NOTE: DePaul is test-optional (CDS C8A:
 *                          "Not required for admission, but considered if
 *                          submitted"); 41.70% of Fall 2024 enrolled (1,070
 *                          students) submitted SAT scores.)
 *   - sat75             : 1330     → 1300    (CDS C9: SAT Composite 75th = 1300.
 *                          CORRECTION DOWN −30 from prior SEED/PR-15 value 1330.)
 *   - intlAcceptanceRate: 66.5     → null    (CDS C1 residency table BLANK —
 *                          DePaul did not report in-state/OOS/international
 *                          applicant or admit counts. Prior HEURISTIC value
 *                          (66.5) cleared. Field marked UNAVAILABLE per
 *                          OFFICIAL_BLANK_SECTION convention. Closure policy:
 *                          private schools generally do not have meaningful
 *                          residency-aware admit rates anyway.)
 *   - oosAcceptanceRate : 71.4     → null    (DePaul is PRIVATE; in-state/OOS
 *                          distinction has no policy meaning. CDS C1 residency
 *                          BLANK as noted. Prior HEURISTIC value (71.4) cleared.
 *                          Field marked UNAVAILABLE/TERMINAL per closure-pipeline
 *                          convention for private institutions.)
 *   - edAcceptanceRate  : null     → null    (CDS C21: "No" — DePaul does NOT
 *                          offer Early Decision. Field stays cleared. Provenance
 *                          refreshed from CDS_LLM_EXTRACT_2026_04 to authoritative
 *                          CDS_OFFICIAL pull marked UNAVAILABLE/NOT_OFFERED.
 *                          NOTE: DB has hasEarlyDecision=true which contradicts
 *                          CDS — corrected to false.)
 *   - eaAcceptanceRate  : null     → null    (CDS C22: "Yes" — DePaul offers
 *                          Early Action (non-binding, closes 11/15, notification
 *                          12/15, not restrictive). However CDS C22 does NOT
 *                          report EA application/admit counts (the standard
 *                          form has no count fields for EA in this version).
 *                          Field stays cleared, marked UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION (offered-but-not-published).)
 *
 * hasEarlyDecision correction: DB shows true; CDS C21 = No → setting to false.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const DEPAUL_CDS_C_URL = 'https://irma.depaul.edu/cds/2024/2024CDS_C.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ioe001ez0tii04p5pvd';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (DePaul) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}`);
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
    sourceUrl: DEPAUL_CDS_C_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-depaul-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 75.89,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1 (Fall 2024 entering class): men applied 12,658 + women applied 18,608 = 31,266 total applicants. Men admitted 9,290 + women admitted 14,439 = 23,729 total admits. 23,729 / 31,266 = 75.8907% (rounded to 75.89%). BIG DOWNWARD CORRECTION −15.76pp from prior LEGACY_DB value 91.65 (the prior sourceUrl pointed to the CDS Section A index, not the actual admission numbers in Section C). Tier upgraded LEGACY_DB → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1090,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1090. CORRECTION DOWN −50 from prior 1140 (SEED/PR-15 heuristic). NOTE: DePaul is test-optional (CDS C8A: "Not required for admission, but considered if submitted"); 41.70% of Fall 2024 enrolled (1,070 students) submitted SAT scores.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1300,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1300. CORRECTION DOWN −30 from prior 1330 (SEED/PR-15 heuristic). NOTE: DePaul is test-optional.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table is BLANK — DePaul did not report in-state/out-of-state/international applicant or admit counts (all residency rows show TOTAL=0 with no breakdown). Prior HEURISTIC value 66.5 cleared. As a PRIVATE Vincentian/Catholic university, DePaul has no residency-policy reason to publish this rate. Field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'DePaul University is a PRIVATE Vincentian/Catholic research university; in-state/out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table BLANK. Prior HEURISTIC value 71.4 cleared. Field marked UNAVAILABLE/TERMINAL per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. DePaul does NOT offer Early Decision. DB value was already null/undefined; provenance refreshed from CDS_LLM_EXTRACT_2026_04 to authoritative CDS_OFFICIAL pull marked UNAVAILABLE/NOT_OFFERED. Stale hasEarlyDecision=true flag corrected to false to match CDS reality.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — YES checked. DePaul offers Early Action (closes 11/15, notification 12/15, not restrictive). However CDS Section C22 in this cycle does not include applicant/admit count fields for EA (only Yes/No + dates + restrictive flag), so no round-level admit rate is published. Field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION (offered-but-counts-not-published).',
      realDataStatus: 'OFFERED_NOT_REPORTED',
    },
  };

  const existingMeta = toRecord(school.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: DEPAUL_CDS_C_URL,
  };

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('75.89'),
      sat25: 1090,
      sat75: 1300,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — DePaul does NOT offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=75.89, sat25=1090, sat75=1300, intlAR=N/A, oosAR=N/A, edAR=NOT_OFFERED, eaAR=OFFERED_NOT_REPORTED, hasED=false)',
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
