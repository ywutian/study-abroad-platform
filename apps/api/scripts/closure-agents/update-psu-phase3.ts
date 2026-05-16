#!/usr/bin/env tsx
/**
 * Phase 3 — Pennsylvania State University (University Park) end-to-end closure
 * of the 7 prediction-critical fields.
 *
 * Source: Penn State University Park CDS 2024-2025 (FINAL_HNP).
 *   URL: https://opair.psu.edu/files/2025/06/CDS_2024_2025_UniversityPark_v2.pdf
 *   Office of Planning, Assessment, and Institutional Research (OPAIR).
 *
 * NOTE: Penn State is a PUBLIC (state-related) institution. isPrivate=false →
 *   oosAcceptanceRate is in eligible scope and MUST carry a real OFFICIAL
 *   number from CDS C1 residency table.
 *
 * Test policy: Penn State is test-optional (C8A "Considered if Submitted" for
 *   SAT and/or ACT). 31.06% of Fall 2024 enrolled (2,848 students) submitted
 *   SAT, 5.39% submitted ACT.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 60.56 → 60.56  (CDS 2024-25 C1: 53,579 admits /
 *                          88,478 applicants = 60.5564% (rounded to 60.56%).
 *                          Value matches prior OFFICIAL value exactly;
 *                          provenance refreshed to closure-pipeline-phase3 with
 *                          explicit numeric value (prior provenance had
 *                          value=undefined).)
 *   - sat25             : 1210  → 1250  (CDS 2024-25 C9: SAT Composite 25th =
 *                          1250 reported directly (EBRW 620 + Math 620 sum =
 *                          1240 differs because composite quantiles ≠ section
 *                          sums). CORRECTION UP +40 from prior 1210
 *                          (LEGACY_DB heuristic). Tier LEGACY_DB → OFFICIAL.)
 *   - sat75             : 1380  → 1410  (CDS 2024-25 C9: SAT Composite 75th =
 *                          1410 reported directly (EBRW 700 + Math 720 sum =
 *                          1420). CORRECTION UP +30 from prior 1380
 *                          (LEGACY_DB heuristic). Tier LEGACY_DB → OFFICIAL.)
 *   - intlAcceptanceRate: 64.37 → 64.37  (CDS 2024-25 C1 residency: 6,639
 *                          international admits / 10,314 international
 *                          applicants = 64.3688% (rounded to 64.37%). Value
 *                          matches prior OFFICIAL exactly; provenance
 *                          refreshed with explicit numeric value.)
 *   - oosAcceptanceRate : 59.24 → 59.24  (CDS 2024-25 C1 residency: 34,761
 *                          OOS admits / 58,681 OOS applicants = 59.2407%
 *                          (rounded to 59.24%). Public school → oosAR carries
 *                          the real OFFICIAL number. Value matches prior
 *                          OFFICIAL exactly; provenance refreshed.)
 *   - edAcceptanceRate  : 14.22 → null   (CDS 2024-25 C21: "Does your
 *                          institution offer an early decision plan?" — NO
 *                          checked. Penn State does NOT offer Early Decision.
 *                          CORRECTION DOWN — prior DB value 14.22 (TAVILY_
 *                          ENRICHMENT, presumably mis-attributed: Penn State
 *                          has no ED plan, that 14.22% likely came from a
 *                          different Penn State program or an aggregator
 *                          error) cleared. hasEarlyDecision corrected
 *                          true → false to match CDS C21 "No". Marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : 70.3  → null   (CDS 2024-25 C22: "Yes" — Penn
 *                          State OFFERS Early Action (closes 11/01, notification
 *                          12/24, non-restrictive). HOWEVER, Penn State does
 *                          NOT publish EA applicants/admits counts in CDS C22
 *                          (the numeric fields are blank). Plan exists but
 *                          rate cannot be computed from CDS. Prior DB value
 *                          70.3 (TAVILY_ENRICHMENT, unverifiable from CDS)
 *                          cleared. Marked UNAVAILABLE/OFFICIAL_BLANK_SECTION
 *                          per closure-pipeline convention for "plan exists
 *                          but numbers blank".)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://opair.psu.edu/files/2025/06/CDS_2024_2025_UniversityPark_v2.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8imx000lz0tiez2ik9eg';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Penn State) not found`);
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
    generatedBy: 'phase3-psu-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 60.56,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1 (Penn State University Park): 53,579 admits / 88,478 applicants = 60.5564% (rounded to 60.56%). Value matches prior OFFICIAL DB value exactly; provenance refreshed to closure-pipeline-phase3 with explicit numeric value (prior provenance had value=undefined).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1250,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1250 (reported directly; EBRW 620 + Math 620 sum = 1240 differs because composite quantiles ≠ section sums). CORRECTION UP +40 from prior 1210 (LEGACY_DB / PR-15 heuristic). Penn State is test-optional; 31.06% of Fall 2024 enrolled (2,848 students) submitted SAT, 5.39% (494 students) submitted ACT.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1410,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1410 (reported directly; EBRW 700 + Math 720 sum = 1420 differs because composite quantiles ≠ section sums). CORRECTION UP +30 from prior 1380 (LEGACY_DB / PR-15 heuristic). Tier upgraded LEGACY_DB → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 64.37,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 6,639 international admits / 10,314 international applicants = 64.3688% (rounded to 64.37%). Value matches prior OFFICIAL DB value exactly; provenance refreshed with explicit numeric value (prior had value=undefined).',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 59.24,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 34,761 out-of-state admits / 58,681 out-of-state applicants = 59.2407% (rounded to 59.24%). Penn State is a PUBLIC (state-related) institution — in-state vs. out-of-state distinction carries real policy meaning (different tuition tiers, residency preference at flagship campus), so this field is in eligible scope and MUST carry a real CDS number. Value matches prior OFFICIAL DB value exactly; provenance refreshed.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. Penn State does NOT offer Early Decision. CORRECTION: prior DB value 14.22 (TAVILY_ENRICHMENT, source unverifiable from CDS) cleared — that value appears mis-attributed (perhaps from a different Penn State program or an aggregator error since CDS explicitly states no ED plan exists). hasEarlyDecision corrected true → false to match CDS C21 "No". Marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — YES checked (closes 11/01, notification 12/24, non-restrictive). Penn State OFFERS Early Action. HOWEVER, Penn State does NOT publish EA applicants/admits counts in CDS C22 (the numeric fields are blank in the published CDS). Plan exists but rate cannot be computed from CDS. Prior DB value 70.3 (TAVILY_ENRICHMENT, unverifiable from CDS) cleared. Marked UNAVAILABLE/OFFICIAL_BLANK_SECTION per closure-pipeline convention for "plan exists but numbers blank" (same pattern as Ohio State EA).',
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
      acceptanceRate: new Prisma.Decimal('60.56'),
      sat25: 1250,
      sat75: 1410,
      intlAcceptanceRate: new Prisma.Decimal('64.37'),
      oosAcceptanceRate: new Prisma.Decimal('59.24'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — Penn State does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=60.56, sat25=1250, sat75=1410, intlAR=64.37, oosAR=59.24, edAR=NOT_OFFERED, eaAR=PLAN_EXISTS_NUMBERS_BLANK, hasED=false)',
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
