#!/usr/bin/env tsx
/**
 * Phase 3 (batch20) — University of Tennessee, Knoxville (UTK) end-to-end
 * closure of the 7 prediction-critical fields.
 *
 * Source: UTK CDS 2025-2026 Full PDF, published by the Office of
 *   Institutional Research and Strategic Analysis (IRSA). UTK's current
 *   IRSA CDS index page lists 2025-26 as the most-recent fully-published
 *   cycle. (Note: user-provided URL pointed at a 2024-25 Full PDF that
 *   404s; IRSA in fact only published a 2024-25 Section-C-only PDF, then
 *   skipped to a complete 2025-26 release. Using authoritative 2025-26.)
 *   URL: http://irsa.utk.edu/wp-content/uploads/sites/107/2026/02/CDS_2025-26_All.pdf
 *   Index: https://irsa.utk.edu/reporting/common-data-set/
 *
 * NOTE: UTK is a PUBLIC institution (Tennessee state flagship, SEC).
 *   isPrivate=false → oosAcceptanceRate is in eligible scope and carries
 *   a real OFFICIAL number from CDS C1 residency table.
 *
 * Test policy: UTK changed to TEST-REQUIRED for Fall 2027 admission
 *   (CDS 2025-26 C8/C8A: SAT or ACT marked "Required to be considered
 *   for admission"). 25% submitted SAT (n=1,758), 80% submitted ACT
 *   (n=5,679). SAT/ACT scores fully gate-relevant for this institution.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 41.6  → 43.58  (CDS 2025-26 C1: 23,464 admits /
 *                          53,841 applicants = 43.5839% (rounded to
 *                          43.58%). MINOR UPWARD CORRECTION from prior
 *                          41.6 (LEGACY_DB). Tier LEGACY_DB → OFFICIAL.)
 *   - sat25             : 1210 → 1280   (CDS 2025-26 C9: SAT Composite
 *                          25th = 1280 (reported directly per closure
 *                          policy "C9 优先 Composite"; EBRW 640 + Math
 *                          630 sum = 1270 differs because composite
 *                          quantiles ≠ section sums). BIG UPWARD
 *                          CORRECTION +70 from prior 1210 (CDS_PDF_AUTO
 *                          collegetransitions URL — older cycle). Tier
 *                          retained OFFICIAL with refreshed source.)
 *   - sat75             : 1360 → 1380   (CDS 2025-26 C9: SAT Composite
 *                          75th = 1380 (reported directly; EBRW 700 +
 *                          Math 700 sum = 1400 differs because composite
 *                          quantiles ≠ section sums). UPWARD CORRECTION
 *                          +20 from prior 1360 (CDS_PDF_AUTO
 *                          collegetransitions URL). Tier retained
 *                          OFFICIAL with refreshed source.)
 *   - intlAcceptanceRate: 28.6  → 47.12  (CDS 2025-26 C1 residency table:
 *                          213 international admits / 452 international
 *                          applicants = 47.1239% (rounded to 47.12%).
 *                          BIG UPWARD CORRECTION +18.5pp from prior 28.6
 *                          (LEGACY_DB). Tier LEGACY_DB → OFFICIAL.)
 *   - oosAcceptanceRate : 33.4  → 35.08  (CDS 2025-26 C1 residency table:
 *                          14,526 out-of-state admits / 41,408 out-of-
 *                          state applicants = 35.0802% (rounded to
 *                          35.08%). UTK is a PUBLIC SEC state flagship —
 *                          OOS distinction carries real policy meaning
 *                          (different tuition tiers, residency-preference
 *                          admit pathways), so this field is in eligible
 *                          scope and MUST carry a real CDS number. MINOR
 *                          UPWARD CORRECTION from prior 33.4 (LEGACY_DB).
 *                          Tier LEGACY_DB → OFFICIAL.)
 *   - edAcceptanceRate  : null  → null   (CDS 2025-26 C21: "Does your
 *                          institution offer an early decision plan?" —
 *                          NO. UTK does NOT offer Early Decision (ED
 *                          dates blank, ED applicant/admit counts blank).
 *                          Provenance refreshed from prior
 *                          CDS_LLM_EXTRACT_2026_04 (Section-C-only PDF)
 *                          to authoritative
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED
 *                          tied to the current 2025-26 Full PDF.)
 *   - eaAcceptanceRate  : null  → null   (CDS 2025-26 C22: "Do you have
 *                          a nonbinding early action plan?" — YES (X in
 *                          Yes box; closing date 11/1, notification date
 *                          12/15; non-restrictive). HOWEVER, CDS Section
 *                          C22 form does NOT collect EA applicant/admit
 *                          counts (only ED C21 has those count rows), so
 *                          no EA admit-rate number is published by UTK
 *                          in CDS. Field is left null with tier
 *                          UNAVAILABLE / source OFFICIAL_BLANK_FIELD and
 *                          realDataStatus NOT_REPORTED — distinct from
 *                          NOT_OFFERED because UTK does offer EA but
 *                          counts aren't reportable via CDS.)
 *
 * NOTE on hasEarlyDecision: current DB value is true, but CDS C21 is NO.
 *   hasEarlyDecision is OUTSIDE the 7-field scope; leaving as-is per
 *   task convention.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'http://irsa.utk.edu/wp-content/uploads/sites/107/2026/02/CDS_2025-26_All.pdf';
const CYCLE_YEAR = 2025; // CDS 2025-2026 = Fall 2025 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ipf001qz0ti3d3001d9';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UTK) not found`);
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
    generatedBy: 'phase3-batch20-utk-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 43.58,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2025-26 Section C1 (UTK): 23,464 admits / 53,841 applicants = 43.5839% (rounded to 43.58%). MINOR UPWARD CORRECTION from prior 41.6 (LEGACY_DB). Tier upgraded LEGACY_DB → OFFICIAL with current 2025-26 Full PDF (prior CDS_LLM_EXTRACT pointed at a Section-C-only 2024-25 PDF; the 2024-25 Full PDF URL in legacy DB returns 404 — IRSA only published a partial 2024-25 then released a complete 2025-26).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1280,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2025-26 Section C9 (UTK): SAT Composite 25th = 1280 (reported directly per closure policy "C9 优先 Composite"; EBRW 640 + Math 630 sum = 1270 differs because composite quantiles ≠ section sums). BIG UPWARD CORRECTION +70 from prior 1210 (CDS_PDF_AUTO collegetransitions.com URL — older cycle). UTK is now TEST-REQUIRED for Fall 2027 (CDS C8A "Required to be considered for admission" for SAT or ACT); 25% of Fall 2025 enrollees submitted SAT (n=1,758). SAT band is fully gate-relevant.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1380,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2025-26 Section C9 (UTK): SAT Composite 75th = 1380 (reported directly; EBRW 700 + Math 700 sum = 1400 differs because composite quantiles ≠ section sums). UPWARD CORRECTION +20 from prior 1360 (CDS_PDF_AUTO collegetransitions URL). UTK is test-required for Fall 2027.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 47.12,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2025-26 Section C1 residency table (UTK): 213 international admits / 452 international applicants = 47.1239% (rounded to 47.12%). BIG UPWARD CORRECTION +18.5pp from prior 28.6 (LEGACY_DB). International applicant pool is small (n=452), so cycle-to-cycle variance can be large. Tier upgraded LEGACY_DB → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 35.08,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2025-26 Section C1 residency table (UTK): 14,526 out-of-state admits / 41,408 out-of-state applicants = 35.0802% (rounded to 35.08%). UTK is a PUBLIC SEC state flagship — in-state vs. OOS distinction carries real policy meaning (different tuition tiers, residency-preference admit pathways), so this field is in eligible scope and MUST carry a real CDS number. MINOR UPWARD CORRECTION from prior 33.4 (LEGACY_DB). Tier upgraded LEGACY_DB → OFFICIAL. Notable: OOS pool dominates UTK applicants (41,408 OOS vs. 11,980 in-state; OOS is 77% of total applicants).',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2025-26 Section C21 (UTK): "Does your institution offer an early decision plan?" — NO. UTK does NOT offer Early Decision (ED dates blank, ED applicant/admit counts blank). NOTE: DB has hasEarlyDecision=true which contradicts CDS; field is OUTSIDE the 7 prediction-critical scope so left untouched per task instructions. Provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 (2024-25 Section-C-only PDF) to authoritative UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED tied to current 2025-26 Full PDF.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_FIELD',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2025-26 Section C22 (UTK): "Do you have a nonbinding early action plan?" — YES (closing date 11/1, notification date 12/15; non-restrictive). HOWEVER, CDS Section C22 form does NOT collect EA applicant/admit counts (only Section C21 ED row asks for counts), so no EA admit-rate number is published by UTK in CDS. Field is left null; tier UNAVAILABLE / source OFFICIAL_BLANK_FIELD and realDataStatus NOT_REPORTED — distinct from NOT_OFFERED because UTK does offer EA but counts are not reportable via the CDS form. Provenance refreshed from prior CDS_LLM_EXTRACT_2026_04.',
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
  // Per task scope: don't overwrite already-closed/non-prediction fields like hasEarlyDecision.
  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('43.58'),
      sat25: 1280,
      sat75: 1380,
      intlAcceptanceRate: new Prisma.Decimal('47.12'),
      oosAcceptanceRate: new Prisma.Decimal('35.08'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=43.58, sat25=1280, sat75=1380, intlAR=47.12, oosAR=35.08, edAR=NOT_OFFERED, eaAR=NOT_REPORTED/EA_offered)',
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
