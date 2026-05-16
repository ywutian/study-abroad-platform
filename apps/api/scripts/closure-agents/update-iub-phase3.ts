#!/usr/bin/env tsx
/**
 * Phase 3 — Indiana University Bloomington (IUB) end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: IU Bloomington CDS 2024-2025 — published as a dynamic HTML viewer
 *   by University Institutional Research and Reporting (UIRR).
 *   URL: https://iuapps.iu.edu/cds/?p=index&i=home&section=C.%20First-Time,%20(Freshman)%20Admission&year=2024
 *   Section C extracted via WebFetch rendering.
 *
 * NOTE: IUB is a PUBLIC institution (state-supported flagship). isPrivate=false
 *   → oosAcceptanceRate is in eligible scope and MUST carry a real OFFICIAL
 *   number from CDS C1 residency table.
 *
 * Test policy: IUB is test-optional (C8A "Require for Some" — SAT/ACT
 *   recommended but not required for general admission).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 78.21 → 78.21  (CDS 2024-25 C1: 52,918 admits /
 *                          67,658 applicants = 78.2154% (rounded to 78.21%).
 *                          Value matches prior OFFICIAL exactly; provenance
 *                          refreshed to closure-pipeline-phase3 CDS_OFFICIAL
 *                          with explicit numeric value and source tier upgraded
 *                          from OFFICIAL_ADMISSIONS_PROFILE → CDS_OFFICIAL.)
 *   - sat25             : 1140  → 1180  (CDS 2024-25 C9: SAT Composite 25th =
 *                          1180 reported directly (EBRW 590 + Math 580 sum =
 *                          1170 differs because composite quantiles ≠ section
 *                          sums). CORRECTION UP +40 from prior 1140
 *                          (LEGACY_DB heuristic). Tier LEGACY_DB → OFFICIAL.)
 *   - sat75             : 1330  → 1390  (CDS 2024-25 C9: SAT Composite 75th =
 *                          1390 reported directly (EBRW 690 + Math 710 sum =
 *                          1400). CORRECTION UP +60 from prior 1330
 *                          (LEGACY_DB heuristic). Tier LEGACY_DB → OFFICIAL.)
 *   - intlAcceptanceRate: 66.82 → 66.82  (CDS 2024-25 C1 residency: 3,724
 *                          international admits / 5,573 international
 *                          applicants = 66.8222% (rounded to 66.82%). Value
 *                          matches prior OFFICIAL exactly; provenance
 *                          refreshed and source tier upgraded from
 *                          OFFICIAL_ADMISSIONS_PROFILE → CDS_OFFICIAL.)
 *   - oosAcceptanceRate : 80.76 → 80.76  (CDS 2024-25 C1 residency: 36,497
 *                          OOS admits / 45,191 OOS applicants = 80.7594%
 *                          (rounded to 80.76%). Public school → oosAR carries
 *                          the real OFFICIAL number. Value matches prior
 *                          OFFICIAL exactly; provenance refreshed and source
 *                          tier upgraded from OFFICIAL_ADMISSIONS_PROFILE →
 *                          CDS_OFFICIAL.)
 *   - edAcceptanceRate  : null  → null   (CDS 2024-25 C21: "No" — IUB does
 *                          NOT offer Early Decision. CORRECTION: hasEarlyDecision
 *                          was true in DB — set to false to match CDS reality.
 *                          Provenance refreshed from prior CDS_LLM_EXTRACT_2026_04
 *                          (value=undefined with tier=OFFICIAL, semantically
 *                          inconsistent) to authoritative UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : null  → null   (CDS 2024-25 C22: "Yes" — IUB
 *                          OFFERS Early Action (closes 11/1, notification 1/15,
 *                          non-restrictive). HOWEVER, IUB does NOT publish EA
 *                          applicants/admits counts in CDS C22 (numeric fields
 *                          blank). Plan exists but rate cannot be computed
 *                          from CDS. Field stays null. Marked UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION per closure-pipeline
 *                          convention for "plan exists but numbers blank"
 *                          (same pattern as Ohio State / Penn State EA).)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://iuapps.iu.edu/cds/?p=index&i=home&section=C.%20First-Time,%20(Freshman)%20Admission&year=2024';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iml000ez0ti01wzdugn';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (IUB) not found`);
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
    generatedBy: 'phase3-iub-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 78.21,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1 (IU Bloomington): 52,918 admits / 67,658 applicants = 78.2154% (rounded to 78.21%). Value matches prior OFFICIAL DB value exactly; provenance refreshed to closure-pipeline-phase3 CDS_OFFICIAL with explicit numeric value (prior had value=undefined and source=OFFICIAL_ADMISSIONS_PROFILE).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1180,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1180 (reported directly; EBRW 590 + Math 580 sum = 1170 differs because composite quantiles ≠ section sums). CORRECTION UP +40 from prior 1140 (LEGACY_DB / PR-15 heuristic). IUB is test-optional (C8A "Require for Some").',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1390,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1390 (reported directly; EBRW 690 + Math 710 sum = 1400 differs because composite quantiles ≠ section sums). CORRECTION UP +60 from prior 1330 (LEGACY_DB / PR-15 heuristic). Tier upgraded LEGACY_DB → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 66.82,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 3,724 international admits / 5,573 international applicants = 66.8222% (rounded to 66.82%). Value matches prior OFFICIAL DB value exactly; provenance refreshed and source upgraded OFFICIAL_ADMISSIONS_PROFILE → CDS_OFFICIAL with explicit numeric value.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 80.76,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 36,497 out-of-state admits / 45,191 out-of-state applicants = 80.7594% (rounded to 80.76%). IUB is a PUBLIC institution (Indiana state flagship) — in-state vs. out-of-state distinction carries real policy meaning (different tuition tiers, residency preference), so this field is in eligible scope and MUST carry a real CDS number. Value matches prior OFFICIAL DB value exactly; provenance refreshed and source upgraded OFFICIAL_ADMISSIONS_PROFILE → CDS_OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO. IUB does NOT offer Early Decision. CORRECTION: hasEarlyDecision was true in DB — set to false to match CDS reality. Provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 (value=undefined with tier=OFFICIAL, semantically inconsistent) to authoritative UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — YES (closes 11/1, notification 1/15, non-restrictive). IUB OFFERS Early Action. HOWEVER, IUB does NOT publish EA applicants/admits counts in CDS C22 (numeric fields blank). Plan exists but rate cannot be computed from CDS. Field stays null with tier=UNAVAILABLE source=OFFICIAL_BLANK_SECTION (same pattern as Ohio State / Penn State EA). Provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 (value=undefined with tier=OFFICIAL, semantically inconsistent) to authoritative current cycle.',
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
      acceptanceRate: new Prisma.Decimal('78.21'),
      sat25: 1180,
      sat75: 1390,
      intlAcceptanceRate: new Prisma.Decimal('66.82'),
      oosAcceptanceRate: new Prisma.Decimal('80.76'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — IUB does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=78.21, sat25=1180, sat75=1390, intlAR=66.82, oosAR=80.76, edAR=NOT_OFFERED, eaAR=PLAN_EXISTS_NUMBERS_BLANK, hasED=false)',
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
