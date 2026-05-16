#!/usr/bin/env tsx
/**
 * Phase 3 — University of Nevada, Reno end-to-end closure of the 7
 *   prediction-critical fields.
 *
 * Sources:
 *   Primary (preferred): UNR CDS 2024-2025 — PDF posted by UNR DataDen.
 *     https://dataden.unr.edu/Resources/CDS/CDS_2024-2025.pdf
 *   Reference (older):   UNR CDS 2023-2024 — DataDen.
 *     https://dataden.unr.edu/Resources/CDS/CDS_2023-2024.pdf
 *
 * UNR is a PUBLIC research university (Reno, NV) — oosAR carries the real
 *   CDS number, not TERMINAL — BUT both CDS cycles redact the C1 residency
 *   breakdown (in-state / out-of-state / international cells reported as
 *   confidential placeholders), so OOS rate is INSTITUTION_REDACTED.
 *
 * CDS 2024-2025 facts pulled directly from the PDF:
 *   - C1 totals (only the Total column is populated — residency cells blank):
 *       Applied:  17,679
 *       Admitted: 13,032
 *       Enrolled:  3,447
 *     -> residency breakdown UNAVAILABLE (institution-redacted in CDS).
 *   - C8A: SAT/ACT "NOT considered for admission, even if submitted" (test-blind
 *          for admission). SAT scores still reported in C9 for the enrolled
 *          cohort (used for placement/advising per C8D/C8G).
 *   - C9: SAT Composite 25th=1070, 50th=1165, 75th=1270 (composite row).
 *   - C21: Early Decision: No (not offered).
 *   - C22: Early Action: Yes (closing 11/15, notification upon application,
 *          non-restrictive). No EA applicant/admit counts reported in C22.
 *
 * Computed rates:
 *   - acceptanceRate    : 13,032 / 17,679 = 73.7146% ~= 73.71 (MAJOR
 *                          CORRECTION DOWN -13.29 from prior 87 — prior was
 *                          a stale heuristic with NULL sourceUrl. Tier
 *                          LEGACY_DB_VALUE -> OFFICIAL.)
 *   - oosAcceptanceRate : UNAVAILABLE — CDS C1 residency breakdown for the
 *                          out-of-state column is left blank (institutional
 *                          confidentiality redaction) in both CDS 2024-25
 *                          and CDS 2023-24. Tier upgraded
 *                          PERMANENT_HEURISTIC -> UNAVAILABLE/
 *                          INSTITUTION_REDACTED with proper CDS URL.
 *   - intlAcceptanceRate: ALREADY CLOSED (tier=OFFICIAL, but sourced from
 *                          a yocket.com snippet). Per closure pipeline rule
 *                          "do not overwrite already-closed fields", this
 *                          field is LEFT UNCHANGED. Note: the underlying
 *                          CDS does NOT actually disclose international
 *                          residency counts (same redaction as oosAR), so
 *                          the yocket value cannot be re-derived from CDS.
 *   - sat25             : 1070 (CORRECTION UP +10 from prior 1060 — prior
 *                          was LEGACY heuristic with NULL sourceUrl). Tier
 *                          LEGACY -> OFFICIAL. Note UNR is test-blind for
 *                          admission per C8A; C9 reports SAT for the
 *                          enrolled cohort.
 *   - sat75             : 1270 (NO CHANGE in value; tier LEGACY -> OFFICIAL
 *                          with direct CDS PDF as source.)
 *   - edAcceptanceRate  : null (CDS C21 = No; NOT_OFFERED). Already correctly
 *                          recorded as OFFICIAL/NOT_OFFERED (pointing at the
 *                          2023-24 CDS) — LEFT UNCHANGED.
 *   - eaAcceptanceRate  : null (CDS C22 = Yes but no applicant/admit counts
 *                          reported in C22). Already correctly recorded
 *                          (OFFICIAL_BLANK_SECTION notes the EA plan exists
 *                          but no counts) — LEFT UNCHANGED.
 *
 * NOTE on hasEarlyDecision: current DB value is TRUE, but CDS C21 = No.
 *   Setting to FALSE to match CDS reality.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL = 'https://dataden.unr.edu/Resources/CDS/CDS_2024-2025.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8irj002nz0tief4railh';

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
  if (!school)
    throw new Error(
      `School ${SCHOOL_ID} (University of Nevada, Reno) not found`,
    );
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC SCHOOL]`);
  console.log(
    `  current AR=${school.acceptanceRate?.toString()} sat25=${school.sat25} sat75=${school.sat75}`,
  );
  console.log(
    `  current intlAR=${school.intlAcceptanceRate?.toString()} oosAR=${school.oosAcceptanceRate?.toString()}`,
  );

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-batch24-claude',
    generatedBy: 'phase3-unr-validation',
  };

  // Rewrite 4 open fields: AR (major correction), sat25, sat75, oosAR
  // (UNAVAILABLE / INSTITUTION_REDACTED).
  // intlAR / edAR / eaAR already closed — preserve untouched.
  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 73.71,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1 total row: 13,032 admits / 17,679 first-time, first-year applicants = 73.7146% (rounded to 73.71%). MAJOR CORRECTION DOWN -13.29 from prior 87 (prior was a stale LEGACY_DB_VALUE with NULL sourceUrl). Tier upgraded LEGACY_DB_VALUE -> OFFICIAL with direct CDS PDF as source.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1070,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1070 (reported directly in composite row). CORRECTION UP +10 from prior 1060 (prior was LEGACY_DB_VALUE with NULL sourceUrl). Tier upgraded LEGACY -> OFFICIAL with direct CDS PDF. NOTE: UNR is test-blind for admission per C8A ("Not considered for admission, even if submitted"); C9 SAT distribution reflects the enrolled cohort and is used for placement/advising per C8D/C8G.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1270,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1270 (reported directly in composite row). NO change in numeric value; tier upgraded LEGACY -> OFFICIAL with direct CDS PDF.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency breakdown: in-state / out-of-state / international cells reported as confidentiality placeholders rather than counts (institution suppresses the residency breakdown). Same redaction in CDS 2023-24. UNR is a PUBLIC research university (Reno, NV) — OOS distinction is policy-meaningful — but the value is not derivable from any CDS cycle. Tier upgraded PERMANENT_HEURISTIC -> UNAVAILABLE / INSTITUTION_REDACTED with proper CDS URL.',
      realDataStatus: 'INSTITUTION_REDACTED',
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
      acceptanceRate: new Prisma.Decimal('73.71'),
      sat25: 1070,
      sat75: 1270,
      oosAcceptanceRate: null, // INSTITUTION_REDACTED — value is UNAVAILABLE.
      // intlAR LEFT untouched (already closed at tier=OFFICIAL).
      // edAR / eaAR LEFT untouched (already closed at OFFICIAL_BLANK_SECTION).
      hasEarlyDecision: false, // CDS C21 = No; correct stale DB true.
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 4 fields (AR=73.71 [MAJOR -13.29], sat25=1070, sat75=1270, oosAR=INSTITUTION_REDACTED) + hasED=false; intlAR/edAR/eaAR LEFT closed',
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
