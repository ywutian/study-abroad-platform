#!/usr/bin/env tsx
/**
 * Phase 3 (batch15) — University of Iowa end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: University of Iowa CDS 2024-2025 PDF, published by Office of the Provost.
 *   URL: https://provost.uiowa.edu/sites/provost.uiowa.edu/files/2025-09/cds_2425_0.pdf
 *
 * NOTE: University of Iowa is a PUBLIC institution (Big Ten state flagship).
 *   isPrivate=false → oosAcceptanceRate is in eligible scope and carries a
 *   real OFFICIAL number from CDS C1 residency table.
 *
 * Test policy: Iowa is test-optional (C8 Yes — SAT/ACT scores used when
 *   submitted). 18.51% submitted SAT, 56.62% submitted ACT.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 83.62 → 83.62  (CDS 2024-25 C1: 23,222 admits /
 *                          27,770 applicants = 83.6226% (rounded to 83.62%).
 *                          Value matches prior LEGACY_DB exactly; provenance
 *                          refreshed from LEGACY_DB → CDS_OFFICIAL with
 *                          explicit numeric value.)
 *   - sat25             : 1120 → 1140  (CDS 2024-25 C9: SAT Composite 25th =
 *                          1140 reported directly (Composite preferred per
 *                          closure policy; EBRW 570 + Math 560 sum = 1130
 *                          differs because composite quantiles ≠ section
 *                          sums). CORRECTION UP +20 from prior 1120 LEGACY_DB.
 *                          Tier LEGACY_DB → OFFICIAL.)
 *   - sat75             : 1340 → 1313  (CDS 2024-25 C9: SAT Composite 75th =
 *                          1313 reported directly (EBRW 670 + Math 660 sum =
 *                          1330 differs because composite quantiles ≠ section
 *                          sums). CORRECTION DOWN -27 from prior 1340
 *                          LEGACY_DB heuristic. Tier LEGACY_DB → OFFICIAL.)
 *   - intlAcceptanceRate: 44.32 → 44.32  (CDS 2024-25 C1 residency: 617
 *                          international admits / 1,392 international
 *                          applicants = 44.3247% (rounded to 44.32%). Value
 *                          matches prior LEGACY_DB exactly; provenance
 *                          refreshed LEGACY_DB → CDS_OFFICIAL with explicit
 *                          numeric value.)
 *   - oosAcceptanceRate : 85.30 → 85.30  (CDS 2024-25 C1 residency: 17,627
 *                          OOS admits / 20,664 OOS applicants = 85.3018%
 *                          (rounded to 85.30%). Public school → oosAR carries
 *                          the real OFFICIAL number. Value matches prior
 *                          LEGACY_DB exactly; provenance refreshed
 *                          LEGACY_DB → CDS_OFFICIAL.)
 *   - edAcceptanceRate  : null  → null   (CDS 2024-25 C21: "Does your
 *                          institution offer an early decision plan?" — NO.
 *                          Iowa does NOT offer Early Decision (also no ED
 *                          dates filled, no ED applicant/admit numbers).
 *                          NOTE: DB has hasEarlyDecision=true which contradicts
 *                          CDS; field is OUTSIDE the 7 prediction-critical
 *                          scope so left untouched per task instructions.
 *                          Provenance refreshed from prior CDS_LLM_EXTRACT_2026_04
 *                          (value=undefined with tier=OFFICIAL, semantically
 *                          inconsistent) to authoritative
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : null  → null   (CDS 2024-25 C22: "Do you have a
 *                          nonbinding early action plan?" — NO. Iowa does
 *                          NOT offer Early Action. Per "可能 EA" caveat in
 *                          task prompt — checked CDS and confirmed: no EA.
 *                          Provenance refreshed from prior CDS_LLM_EXTRACT_2026_04
 *                          (value=undefined with tier=OFFICIAL, semantically
 *                          inconsistent) to authoritative
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://provost.uiowa.edu/sites/provost.uiowa.edu/files/2025-09/cds_2425_0.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8in0000mz0tiria7qm89';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Iowa) not found`);
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
    verifiedBy: 'closure-pipeline-phase3-batch15-claude',
    generatedBy: 'phase3-batch15-uiowa-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 83.62,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1 (University of Iowa): 23,222 admits / 27,770 applicants = 83.6226% (rounded to 83.62%). Value matches prior LEGACY_DB DB value exactly; provenance refreshed from LEGACY_DB → CDS_OFFICIAL with explicit numeric value tied to current CDS 2024-25 PDF.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1140,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1140 (reported directly per closure policy "C9 优先 Composite"; EBRW 570 + Math 560 sum = 1130 differs because composite quantiles ≠ section sums). CORRECTION UP +20 from prior 1120 (LEGACY_DB). Iowa is test-optional; 18.51% submitted SAT (n=964).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1313,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1313 (reported directly per closure policy "C9 优先 Composite"; EBRW 670 + Math 660 sum = 1330 differs because composite quantiles ≠ section sums). CORRECTION DOWN -27 from prior 1340 (LEGACY_DB heuristic). Tier upgraded LEGACY_DB → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 44.32,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 617 international admits / 1,392 international applicants = 44.3247% (rounded to 44.32%). Value matches prior LEGACY_DB exactly; provenance refreshed LEGACY_DB → CDS_OFFICIAL with explicit numeric value.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 85.3,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 17,627 out-of-state admits / 20,664 out-of-state applicants = 85.3018% (rounded to 85.30%). Iowa is a PUBLIC institution (Big Ten state flagship) — in-state vs. out-of-state distinction carries real policy meaning (different tuition tiers, residency preference), so this field is in eligible scope and MUST carry a real CDS number. Value matches prior LEGACY_DB exactly; provenance refreshed LEGACY_DB → CDS_OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO. Iowa does NOT offer Early Decision (ED plan dates blank, ED applicant/admit numbers blank). NOTE: DB has hasEarlyDecision=true which contradicts CDS; field is OUTSIDE the 7 prediction-critical scope so left untouched per task instructions. Provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 (value=undefined with tier=OFFICIAL, semantically inconsistent) to authoritative UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO. Iowa does NOT offer Early Action (EA dates blank, EA applicant/admit numbers blank). Provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 (value=undefined with tier=OFFICIAL, semantically inconsistent) to authoritative UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
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
      acceptanceRate: new Prisma.Decimal('83.62'),
      sat25: 1140,
      sat75: 1313,
      intlAcceptanceRate: new Prisma.Decimal('44.32'),
      oosAcceptanceRate: new Prisma.Decimal('85.30'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=83.62, sat25=1140, sat75=1313, intlAR=44.32, oosAR=85.30, edAR=NOT_OFFERED, eaAR=NOT_OFFERED)',
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
