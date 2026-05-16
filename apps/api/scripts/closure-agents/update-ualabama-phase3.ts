#!/usr/bin/env tsx
/**
 * Phase 3 — University of Alabama (Tuscaloosa) end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: The University of Alabama Common Data Set 2024-2025
 *   URL: https://oira.ua.edu/d/sites/all/files/reports25/CDS%202024-25%20FINAL.pdf
 *
 * University of Alabama is PUBLIC (flagship state university). isPrivate=false.
 *
 * UA is test-optional (C8A "Consider if Submitted"). C9 SAT Composite reported
 * directly (20% submitted SAT, 1,644 students; 54% submitted ACT).
 *
 * C1 residency: UA does NOT publish a residency breakdown for first-time
 * first-year applicants/admits in CDS 2024-25 — the C1 section reports only
 * total applicants/admits/enrolled by gender. Therefore oosAR and intlAR
 * cannot be sourced from this CDS and are marked UNAVAILABLE/
 * OFFICIAL_BLANK_SECTION (per "C1 residency 空 → UNAVAILABLE/OFFICIAL_BLANK
 * _SECTION" convention). Public-school convention still holds: when residency
 * IS reported the OOS field is OFFICIAL, not TERMINAL — here the section is
 * structurally absent, not policy-excluded.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 80     -> 76.65  (CDS 2024-25 C1: 43,531 admits /
 *                          56,795 applicants = 76.6529%. CORRECTION DOWN
 *                          -3.35pp from prior 80 (LEGACY_DB). Tier
 *                          LEGACY_DB -> OFFICIAL.)
 *   - sat25             : 1110   -> 1110   (CDS 2024-25 C9: SAT Composite 25th
 *                          = 1110 reported directly. Value matches prior DB
 *                          (CDS_PDF_AUTO). Tier refreshed to OFFICIAL via
 *                          manual CDS pull. Source corrected from
 *                          bigfuture.collegeboard.org to oira.ua.edu.)
 *   - sat75             : 1360   -> 1360   (CDS 2024-25 C9: SAT Composite 75th
 *                          = 1360 reported directly. Value matches prior DB.)
 *   - intlAcceptanceRate: 76     -> null   (CDS 2024-25 C1 does NOT publish
 *                          residency or international breakdown. Prior DB
 *                          value 76 (INFERRED/PERMANENT_HEURISTIC) cleared.
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *   - oosAcceptanceRate : 72     -> null   (CDS 2024-25 C1 does NOT publish
 *                          residency breakdown. Prior DB value 72 (INFERRED/
 *                          PERMANENT_HEURISTIC) cleared. UA is PUBLIC so this
 *                          field is in eligible scope in principle, but the
 *                          structural absence of the C1 residency table means
 *                          there is no authoritative number to fill it with.
 *                          Mark UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *   - edAcceptanceRate  : null   -> null   (CDS 2024-25 C21: "No" — UA does
 *                          not offer ED. UNAVAILABLE/OFFICIAL_BLANK_SECTION.
 *                          hasEarlyDecision corrected from stale DB true to
 *                          false.)
 *   - eaAcceptanceRate  : null   -> null   (CDS 2024-25 C22: "No" — UA does
 *                          not offer a nonbinding EA plan. UA operates on
 *                          rolling admission (C16 "Mid-July"). UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION.)
 *
 * NOTE on hasEarlyDecision: current DB value is true, but CDS C21 is "No".
 *   Setting to false to match CDS reality.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://oira.ua.edu/d/sites/all/files/reports25/CDS%202024-25%20FINAL.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ip1001lz0ti51lr5gad';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UAlabama) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC SCHOOL]`);
  console.log(
    `  current AR=${school.acceptanceRate?.toString()} sat25=${school.sat25} sat75=${school.sat75}`,
  );
  console.log(
    `  current intlAR=${school.intlAcceptanceRate?.toString()} oosAR=${school.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${school.edAcceptanceRate?.toString() ?? 'null'} eaAR=${school.eaAcceptanceRate?.toString() ?? 'null'} hasED=${school.hasEarlyDecision}`,
  );

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-ualabama-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 76.65,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 43,531 admits / 56,795 applicants = 76.6529% (rounded to 76.65%). CORRECTION DOWN from prior 80 (LEGACY_DB, sourceUrl=null) by -3.35pp. Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1110,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1110 (reported directly; EBRW 560 + Math 540 = 1100 differs by 10 because composite quantiles != section sums). Value matches prior DB (CDS_PDF_AUTO). Source corrected from bigfuture.collegeboard.org to authoritative oira.ua.edu. 20% of Fall 2024 enrolled (1,644 students) submitted SAT under test-optional policy.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1360,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1360 (reported directly; EBRW 670 + Math 680 = 1350 differs). Value matches prior DB (CDS_PDF_AUTO). Source corrected from bigfuture.collegeboard.org to authoritative oira.ua.edu.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 does NOT publish a residency or international breakdown for first-time first-year applicants/admits — the C1 table reports only totals by gender. Prior DB value 76 (INFERRED/PERMANENT_HEURISTIC) cleared. Field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION per "C1 residency blank" convention.',
      realDataStatus: 'NOT_REPORTED',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 does NOT publish a residency breakdown — the C1 table reports only totals by gender. University of Alabama is PUBLIC (flagship state university), so this field IS in eligible scope in principle, but the structural absence of the C1 residency table means there is no authoritative number to fill it with. Prior DB value 72 (INFERRED/PERMANENT_HEURISTIC) cleared. Field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION (NOT TERMINAL — public school).',
      realDataStatus: 'NOT_REPORTED',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. University of Alabama does not offer Early Decision (uses rolling admission per C16 "Mid-July"). Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). hasEarlyDecision corrected from stale DB true to false. Provenance refreshed from CDS_LLM_EXTRACT_2026_04 to CDS_OFFICIAL.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. University of Alabama does not offer a nonbinding EA plan; admission decisions are on a rolling basis (C16 "Mid-July"). Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance refreshed from CDS_LLM_EXTRACT_2026_04 to CDS_OFFICIAL.',
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
      acceptanceRate: new Prisma.Decimal('76.65'),
      sat25: 1110,
      sat75: 1360,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — UA does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=76.65, sat25=1110, sat75=1360, intlAR=BLANK, oosAR=BLANK, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
