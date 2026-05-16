#!/usr/bin/env tsx
/**
 * Phase 3 (batch20) — University of Nebraska–Lincoln (UNL) end-to-end
 * closure of the 7 prediction-critical fields.
 *
 * Source: UNL CDS 2024-2025, published by the Office of Institutional
 *   Effectiveness and Analytics (IEA). UNL publishes the 2024-25 cycle
 *   as section-by-section HTML pages rather than a single Full PDF; the
 *   primary canonical index URL is recorded as sourceUrl. Section pages
 *   used to extract individual fields are referenced in the per-field
 *   `reason` text.
 *   URL: https://iea.unl.edu/common-data-set-2024-2025/
 *   Section pages:
 *     - C1 (applications):   .../c-first-time-first-year-admission/applications/
 *     - C8 (SAT/ACT policy): .../c-first-time-first-year-admission/sat-and-act-policies/
 *     - C9 (FT/FY profile):  .../c-first-time-first-year-admission/first-time-first-year-profile/
 *     - C21/C22 (ED/EA):     .../c-first-time-first-year-admission/admission-policies/
 *
 * NOTE: UNL is a PUBLIC institution (Big Ten state flagship).
 *   isPrivate=false → oosAcceptanceRate is in eligible scope and carries
 *   a real OFFICIAL number from CDS C1 residency table.
 *
 * IMPORTANT: Prior DB provenance pointed sourceUrl at the U of Nebraska
 *   Kearney (UNK) CDS PDF and at an unrelated UN system operating-budget
 *   PDF, neither of which are the UNL CDS. This is a corrective rewrite
 *   with the authoritative UNL IEA CDS 2024-25 source.
 *
 * Test policy: UNL is test-optional (CDS C8A: "Not required for
 *   admission, but consider if submitted" for SAT or ACT, ACT Only, SAT
 *   Only). 7% submitted SAT (n=323), 82% submitted ACT (n=3,830). Per
 *   closure-pipeline convention, reported CDS C9 SAT Composite
 *   percentiles are still recorded as OFFICIAL for descriptive
 *   applicant-profile use.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 89.49 → 87.49  (CDS 2024-25 C1: 15,609 admits /
 *                          17,841 applicants = 87.4895% (rounded to
 *                          87.49%). MINOR DOWNWARD CORRECTION from prior
 *                          89.49 (LEGACY_DB heuristic). Tier
 *                          LEGACY_DB → OFFICIAL.)
 *   - sat25             : 1100 → 1100   (CDS 2024-25 C9: SAT Composite
 *                          25th = 1100 (reported directly per closure
 *                          policy "C9 优先 Composite"; EBRW 560 + Math
 *                          538 sum = 1098 differs because composite
 *                          quantiles ≠ section sums). Value matches prior
 *                          DB exactly; provenance refreshed CDS_PDF_AUTO
 *                          (wrong prepscholar URL) → CDS_OFFICIAL.)
 *   - sat75             : 1310 → 1310   (CDS 2024-25 C9: SAT Composite
 *                          75th = 1310 (reported directly; EBRW 670 +
 *                          Math 660 sum = 1330 differs because composite
 *                          quantiles ≠ section sums). Value matches prior
 *                          DB exactly; provenance refreshed CDS_PDF_AUTO →
 *                          CDS_OFFICIAL.)
 *   - intlAcceptanceRate: 45.74 → 42.54  (CDS 2024-25 C1 residency table:
 *                          428 international admits / 1,006 international
 *                          applicants = 42.5447% (rounded to 42.54%).
 *                          MODEST DOWNWARD CORRECTION from prior 45.74
 *                          (LEGACY_DB heuristic). Tier LEGACY_DB →
 *                          OFFICIAL.)
 *   - oosAcceptanceRate : 92.83 → 91.10  (CDS 2024-25 C1 residency table:
 *                          6,895 out-of-state admits / 7,569 out-of-state
 *                          applicants = 91.0952% (rounded to 91.10%). UNL
 *                          is a PUBLIC Big Ten state flagship — OOS
 *                          distinction carries real policy meaning, so
 *                          this field is in eligible scope and MUST carry
 *                          a real CDS number. MINOR DOWNWARD CORRECTION
 *                          from prior 92.83 (LEGACY_DB heuristic). Tier
 *                          LEGACY_DB → OFFICIAL.)
 *   - edAcceptanceRate  : null  → null   (CDS 2024-25 C21: "Does your
 *                          institution offer an early decision plan?" —
 *                          NO. UNL does NOT offer Early Decision. Field
 *                          stays cleared; provenance refreshed from prior
 *                          CDS_LLM_EXTRACT_2026_04 (wrong-URL operating-
 *                          budget PDF) to authoritative
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED
 *                          with correct UNL IEA CDS URL.)
 *   - eaAcceptanceRate  : null  → null   (CDS 2024-25 C22: "Do you have
 *                          a nonbinding early action plan?" — NO. UNL
 *                          does NOT offer Early Action. Refreshed from
 *                          prior CDS_LLM_EXTRACT_2026_04 (wrong-URL) to
 *                          authoritative UNAVAILABLE/OFFICIAL_BLANK_SECTION/
 *                          NOT_OFFERED.)
 *
 * NOTE on hasEarlyDecision: current DB value is true, but CDS C21 is NO.
 *   hasEarlyDecision is OUTSIDE the 7-field scope; leaving as-is per task
 *   convention.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL = 'https://iea.unl.edu/common-data-set-2024-2025/';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ipj001rz0tipapk15or';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UNL) not found`);
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
    verifiedBy: 'closure-pipeline-phase3-batch20-claude',
    generatedBy: 'phase3-batch20-unl-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 87.49,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1 (UNL): 15,609 admits / 17,841 applicants = 87.4895% (rounded to 87.49%). MINOR DOWNWARD CORRECTION from prior 89.49 (LEGACY_DB heuristic). Source: https://iea.unl.edu/common-data-set-2024-2025/c-first-time-first-year-admission/applications/ — IMPORTANT: prior LEGACY_DB sourceUrl pointed at U of Nebraska KEARNEY (UNK) CDS, a DIFFERENT institution. Tier upgraded LEGACY_DB → OFFICIAL with correct UNL IEA CDS URL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1100,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9 (UNL): SAT Composite 25th = 1100 (reported directly per closure policy "C9 优先 Composite"; EBRW 560 + Math 538 sum = 1098 differs because composite quantiles ≠ section sums). Value matches prior DB exactly; provenance refreshed from CDS_PDF_AUTO (wrong-source prepscholar URL) → CDS_OFFICIAL with UNL IEA CDS source. UNL is test-optional (CDS C8A "Not required for admission, but consider if submitted"); 7% submitted SAT (n=323); SAT band is descriptive applicant-profile use only.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1310,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9 (UNL): SAT Composite 75th = 1310 (reported directly; EBRW 670 + Math 660 sum = 1330 differs because composite quantiles ≠ section sums). Value matches prior DB exactly; provenance refreshed CDS_PDF_AUTO → CDS_OFFICIAL with UNL IEA CDS source. UNL is test-optional.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 42.54,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table (UNL): 428 international admits / 1,006 international applicants = 42.5447% (rounded to 42.54%). MODEST DOWNWARD CORRECTION from prior 45.74 (LEGACY_DB). Prior sourceUrl pointed at an unrelated UN system operating-budget PDF; refreshed to UNL IEA CDS. Tier LEGACY_DB → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 91.1,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table (UNL): 6,895 out-of-state admits / 7,569 out-of-state applicants = 91.0952% (rounded to 91.10%). UNL is a PUBLIC Big Ten state flagship — in-state vs. OOS distinction carries real policy meaning (different tuition tiers), so this field is in eligible scope and MUST carry a real CDS number. MINOR DOWNWARD CORRECTION from prior 92.83 (LEGACY_DB). Prior sourceUrl was an unrelated operating-budget PDF; refreshed to UNL IEA CDS. Tier LEGACY_DB → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21 (UNL admission-policies page): "Does your institution offer an early decision plan?" — NO. UNL does NOT offer Early Decision. NOTE: DB has hasEarlyDecision=true which contradicts CDS; field is OUTSIDE the 7 prediction-critical scope so left untouched per task instructions. Provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 (wrong-URL UN system operating-budget PDF) to authoritative UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED with correct UNL IEA CDS URL.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22 (UNL admission-policies page): "Do you have a nonbinding early action plan?" — NO. UNL does NOT offer Early Action. Provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 (wrong-URL UN system operating-budget PDF) to authoritative UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
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
  // Per task scope: don't overwrite already-closed/non-prediction fields like hasEarlyDecision.
  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('87.49'),
      sat25: 1100,
      sat75: 1310,
      intlAcceptanceRate: new Prisma.Decimal('42.54'),
      oosAcceptanceRate: new Prisma.Decimal('91.10'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=87.49, sat25=1100, sat75=1310, intlAR=42.54, oosAR=91.10, edAR=NOT_OFFERED, eaAR=NOT_OFFERED)',
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
