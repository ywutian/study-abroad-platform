#!/usr/bin/env tsx
/**
 * Phase 3 — University of Oregon end-to-end closure of the 7 prediction-
 * critical fields.
 *
 * Source: University of Oregon CDS 2024-2025 (Fall 2024 entering class).
 *   IR index: https://ir.uoregon.edu/uo-overview/common-data-set
 *   PDF: hosted on UO SharePoint
 *   (https://uoregon.sharepoint.com/:b:/s/UOInstitutionalResearchPublicMaterials/EW5k4dUJKOROg-jLajeQUE4B9IdCoV7T8DoI8Fys7Eghkw?e=9y4y4S)
 *   parsed by Claude from the PDF.
 *
 * CRITICAL: The previous DB sourceUrl pointed to OREGON STATE UNIVERSITY's
 * CDS (institutionalresearch.oregonstate.edu). University of Oregon (UO) and
 * Oregon State University (OSU) are TWO DIFFERENT INSTITUTIONS. The prior
 * provenance was cross-contaminated and all values were wrong-school data.
 * This pull replaces it with authoritative University of Oregon CDS data.
 *
 * Institution facts:
 *   - PUBLIC research university (Oregon University System / Oregon University
 *     System successor), enrollment ~20,622 undergraduates
 *   - In-state vs. out-of-state distinction carries real policy meaning
 *     (different tuition; OUS residency-based admit pathways) → oosAR should
 *     be OFFICIAL whenever a real CDS number exists
 *   - HOWEVER: CDS 2024-2025 Section C1 residency table is BLANK — UO did
 *     NOT fill in the In-State / Out-of-State / International column breakdown
 *     for applicants/admits/enrolled (only the TOTAL column is populated:
 *     40,021 applicants / 35,337 admits / 5,087 enrolled). Therefore oosAR
 *     and intlAR are marked UNAVAILABLE/OFFICIAL_BLANK_SECTION (not TERMINAL)
 *     — distinct from private-school TERMINAL marking, this means the field
 *     IS in eligible scope but UO chose not to report.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 77.3     → 88.30   (CDS 2024-25 Section C1: 35,337
 *                          admits / 40,021 applicants = 88.2961% (rounded
 *                          88.30%). BIG UPWARD CORRECTION +11.0pp. Prior
 *                          LEGACY_DB value 77.3 had sourceUrl pointing to
 *                          Oregon STATE University (wrong institution).
 *                          Tier upgraded LEGACY_DB → OFFICIAL with corrected
 *                          source URL.)
 *   - sat25             : 1100     → 1130    (CDS 2024-25 Section C9: SAT
 *                          Composite 25th = 1130. CORRECTION UP +30 from
 *                          prior LEGACY_DB value 1100 (sourced from same
 *                          cross-contaminated Oregon State origin). 8% of
 *                          Fall 2024 enrolled (412 students) submitted SAT
 *                          under test-optional policy.)
 *   - sat75             : 1310     → 1360    (CDS 2024-25 Section C9: SAT
 *                          Composite 75th = 1360. CORRECTION UP +50 from
 *                          prior 1310.)
 *   - intlAcceptanceRate: 30.42    → null    (CDS 2024-25 Section C1
 *                          residency table is BLANK — UO populated only the
 *                          TOTAL column, leaving In-State/OOS/International
 *                          columns empty. Prior LEGACY_DB value 30.42 was
 *                          cross-contaminated from Oregon State data and
 *                          cannot be trusted. Field cleared and marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION (in scope,
 *                          but UO did not publish).)
 *   - oosAcceptanceRate : 77.37    → null    (As above — CDS C1 residency
 *                          table BLANK. NOTE: UO is a PUBLIC institution
 *                          (Oregon University System) so OOS distinction
 *                          DOES carry policy meaning (different tuition,
 *                          ~$15,309 in-state vs ~$45,408 OOS at UO 2024-25);
 *                          oosAR is in eligible scope. Field marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION (NOT TERMINAL —
 *                          this distinguishes public schools whose field is
 *                          legitimately blank from private schools whose
 *                          field is terminal-N/A). Prior 77.37 cleared.)
 *   - edAcceptanceRate  : null     → null    (CDS 2024-25 Section C21: "Does
 *                          your institution offer an early decision plan?" —
 *                          NO checked. UO does not offer Early Decision.
 *                          Field stays cleared. Provenance refreshed from
 *                          CDS_LLM_EXTRACT_2026_04 (with Oregon State
 *                          sourceUrl) to authoritative University of Oregon
 *                          CDS_OFFICIAL pull marked UNAVAILABLE/NOT_OFFERED.)
 *   - eaAcceptanceRate  : 88       → null    (CDS 2024-25 Section C22: "Do
 *                          you have a nonbinding early action plan?" — YES
 *                          checked. UO offers Early Action (closes 11/1,
 *                          notification 12/15, NOT restrictive). However
 *                          CDS C22 in this cycle does not include applicant/
 *                          admit count fields for EA (only Yes/No + dates +
 *                          restrictive flag), so UO does not publish a
 *                          round-level EA admit rate. Prior LEGACY_DB value
 *                          88 (sourced via TAVILY_ENRICHMENT from Oregon
 *                          State) cleared. Field marked UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION as OFFERED_NOT_REPORTED.)
 *
 * hasEarlyDecision correction: DB shows true; CDS C21 = No → setting to
 *   false. (The stale true was likely inherited from Oregon State data.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const UOREGON_CDS_INDEX_URL =
  'https://ir.uoregon.edu/uo-overview/common-data-set';
const UOREGON_CDS_PDF_URL =
  'https://uoregon.sharepoint.com/:b:/s/UOInstitutionalResearchPublicMaterials/EW5k4dUJKOROg-jLajeQUE4B9IdCoV7T8DoI8Fys7Eghkw?e=9y4y4S';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8int0013z0tiqysdv07w';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (U Oregon) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC institution]`);
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
    sourceUrl: UOREGON_CDS_INDEX_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-uoregon-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 88.3,
      policyLabel: 'Overall admit rate',
      reason:
        'University of Oregon CDS 2024-25 Section C1 (Fall 2024 entering class): TOTAL applicants 40,021; TOTAL admits 35,337; TOTAL enrolled 5,087. AR = 35,337 / 40,021 = 88.2961% (rounded to 88.30%). BIG UPWARD CORRECTION +11.0pp from prior LEGACY_DB value 77.3 — CRITICAL: prior provenance sourceUrl pointed to OREGON STATE UNIVERSITY (institutionalresearch.oregonstate.edu), a different institution. This pull replaces cross-contaminated Oregon State data with authoritative University of Oregon data. Tier upgraded LEGACY_DB → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1130,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'UO CDS 2024-25 Section C9: SAT Composite 25th = 1130. CORRECTION UP +30 from prior LEGACY_DB value 1100 (cross-contaminated from Oregon State). 8% of Fall 2024 enrolled (412 students) submitted SAT under UO test-optional policy.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1360,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'UO CDS 2024-25 Section C9: SAT Composite 75th = 1360. CORRECTION UP +50 from prior 1310 (cross-contaminated from Oregon State).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'UO CDS 2024-25 Section C1 residency table is BLANK — UO populated only the TOTAL column (40,021 / 35,337 / 5,087) leaving the In-State / Out-of-State / International / Unknown column breakdown empty. Prior LEGACY_DB value 30.42 was cross-contaminated from Oregon State data and cleared. Field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION (in eligible scope, but UO did not publish residency breakdown).',
      realDataStatus: 'NOT_REPORTED',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'University of Oregon is a PUBLIC research university (former Oregon University System member); in-state/out-of-state distinction carries real policy meaning (different tuition: ~$15,309 in-state vs. ~$45,408 OOS for 2024-25; residency-based admit pathways). oosAR is in eligible scope. HOWEVER, CDS 2024-25 Section C1 residency table is BLANK — UO did not publish residency breakdown of applicants/admits/enrolled. Field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION (NOT TERMINAL — distinguishes public-school legitimately-blank from private-school not-applicable). Prior LEGACY_DB value 77.37 cleared (cross-contaminated from Oregon State).',
      realDataStatus: 'NOT_REPORTED',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'UO CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. University of Oregon does NOT offer Early Decision. DB value already null; provenance refreshed from CDS_LLM_EXTRACT_2026_04 (Oregon State sourceUrl) to authoritative University of Oregon CDS_OFFICIAL pull marked UNAVAILABLE/NOT_OFFERED. Stale hasEarlyDecision=true flag corrected to false.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'UO CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — YES checked. UO offers Early Action (closes 11/1, notification 12/15, NOT restrictive). However CDS C22 in this cycle does not include EA applicant/admit count fields (only Yes/No + dates + restrictive flag); UO does not publish a round-level EA admit rate. Prior LEGACY_DB value 88 (via TAVILY_ENRICHMENT from Oregon State) cleared as cross-contaminated. Field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION as OFFERED_NOT_REPORTED.',
      realDataStatus: 'OFFERED_NOT_REPORTED',
    },
  };

  const existingMeta = toRecord(school.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: UOREGON_CDS_INDEX_URL,
    closureSourcePdf: UOREGON_CDS_PDF_URL,
  };

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('88.30'),
      sat25: 1130,
      sat75: 1360,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — UO does NOT offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=88.30, sat25=1130, sat75=1360, intlAR=BLANK, oosAR=BLANK, edAR=NOT_OFFERED, eaAR=OFFERED_NOT_REPORTED, hasED=false)',
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
