#!/usr/bin/env tsx
/**
 * Phase 3 — University of Florida (UF Main Campus) end-to-end closure of the
 * 7 prediction-critical fields.
 *
 * Source: UF CDS 2024-2025 (Fall 2024 entering class).
 *   URL: https://data-apps.ir.aa.ufl.edu/public/cds/CDS_2024-2025_UFMAIN_Post_v4_ADA5.pdf
 *   Index: https://ir.aa.ufl.edu/dashboards-and-data/data/common-data-set/
 *
 * UFL is a PUBLIC state flagship (State University System of Florida).
 *   - isPrivate=false  ->  oosAcceptanceRate carries a real OFFICIAL number
 *     from CDS C1 residency table. NOT marked UNAVAILABLE/TERMINAL.
 *
 * NOTE on test policy (CDS C8): UFL is **NOT test-optional** for 2024-25.
 *   C8A explicitly checks "Required to be considered for admission" for
 *   SAT or ACT (one of SAT/ACT/CLT required). 80% of enrolled submitted
 *   SAT (5,908 students). SAT Composite percentiles reported directly.
 *
 * ED/EA (CDS C21/C22):
 *   - C21 Early Decision: "No" — UFL does NOT offer ED.
 *   - C22 Early Action: "Yes" — UFL offers nonbinding EA (closing 11/1,
 *     notification 1/23 — "Last Friday in January"). Non-restrictive.
 *     However, CDS C22 does NOT require institutions to break out EA
 *     applicant/admit/enroll counts the way C21 does for ED; UF provides
 *     none in this CDS. Existing eaAR=22.80 was sourced from the UF
 *     Office of Admissions Freshman Profile Infographic 2025-26
 *     (admissions.ufl.edu) — that remains the authoritative OFFICIAL_SCHOOL
 *     publication for EA rate; preserve it, refresh provenance, and note
 *     CDS C22 cross-confirms EA exists.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 24.03  -> 24.20  (CDS 2024-25 C1: 17,804 admits /
 *                          73,557 applicants = 24.2046%. Tier upgraded
 *                          LEGACY_DB (sourceUrl pointed to appybara.org
 *                          aggregator) -> OFFICIAL. CORRECTION UP +0.17pp.)
 *   - sat25             : 1310   -> 1330   (CDS 2024-25 C9: SAT Composite 25th
 *                          = 1330 reported directly. CORRECTION UP +20 from
 *                          prior 1310 (SEED/PR-15 heuristic). Note: SAT is
 *                          REQUIRED, not test-optional — 80% submitted.)
 *   - sat75             : 1460   -> 1470   (CDS 2024-25 C9: SAT Composite 75th
 *                          = 1470 reported directly. CORRECTION UP +10 from
 *                          prior 1460 (SEED/PR-15 heuristic).)
 *   - intlAcceptanceRate: 32.5   -> 32.49  (CDS 2024-25 C1 residency: 1,676
 *                          intl admits / 5,159 intl applicants = 32.4869%.
 *                          Tier upgraded LEGACY_DB -> OFFICIAL. Minor
 *                          precision shift.)
 *   - oosAcceptanceRate : 23.26  -> 23.27  (CDS 2024-25 C1 residency: 6,834
 *                          OOS admits / 29,376 OOS applicants = 23.2670%.
 *                          Tier upgraded LEGACY_DB -> OFFICIAL. UFL is a
 *                          PUBLIC state flagship — oosAR carries the real
 *                          OFFICIAL number, never TERMINAL.)
 *   - edAcceptanceRate  : null   -> null   (CDS 2024-25 C21: "No" — UFL does
 *                          not offer ED. Field stays cleared
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION. Provenance
 *                          refreshed.)
 *   - eaAcceptanceRate  : 22.8   -> 22.8   (preserved. CDS C22 "Yes" confirms
 *                          EA exists but CDS does not break out EA admit
 *                          counts; existing 22.80 from UF Office of
 *                          Admissions Freshman Profile Infographic 2025-26
 *                          remains the authoritative OFFICIAL_SCHOOL source.
 *                          Provenance refreshed; tier stays OFFICIAL/
 *                          OFFICIAL_SCHOOL with cross-confirmation note.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://data-apps.ir.aa.ufl.edu/public/cds/CDS_2024-2025_UFMAIN_Post_v4_ADA5.pdf';
const EA_PROFILE_URL =
  'https://admissions.ufl.edu/pdf/Freshman_Profile_Infographic_2025-26.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmn1htkow000tvqf2qc5n3qhd';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UFL) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(
    `  isPrivate=${school.isPrivate}  [PUBLIC — oosAR carries real number]`,
  );
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
    generatedBy: 'phase3-ufl-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 24.2,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 17,804 admits / 73,557 applicants = 24.2046% (rounded to 24.20%). Tier upgraded from LEGACY_DB (value 24.03, sourceUrl pointed to appybara.org aggregator — not UFL) to OFFICIAL. CORRECTION UP +0.17pp.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1330,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1330 (reported directly). CORRECTION UP from prior 1310 (SEED/PR-15 heuristic). NOTE: UFL is NOT test-optional in 2024-25 — CDS C8A checks "Required to be considered for admission" for SAT or ACT (one of SAT/ACT/CLT required). 80% of enrolled (5,908 students) submitted SAT.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1470,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1470 (reported directly). CORRECTION UP from prior 1460 (SEED/PR-15 heuristic). UFL test-required policy: 80% submitted SAT.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 32.49,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 1,676 international admits / 5,159 international applicants = 32.4869% (rounded to 32.49%). Tier upgraded from LEGACY_DB (value 32.5) to OFFICIAL with minor precision adjustment.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 23.27,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 6,834 out-of-state admits / 29,376 out-of-state applicants = 23.2670% (rounded to 23.27%). UFL is a PUBLIC state flagship (State University System of Florida) — in-state vs. out-of-state distinction carries real policy meaning (different tuition, residency-preference admit pathways), so this field is in eligible scope and MUST carry a real CDS number. Tier upgraded from LEGACY_DB (value 23.26) to OFFICIAL with minor precision adjustment. (Public-school convention: oosAR carries the real number, never marked TERMINAL.)',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. UFL does not offer Early Decision. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance refreshed to 2024-25 cycle.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      sourceUrl: EA_PROFILE_URL,
      tier: 'OFFICIAL',
      source: 'OFFICIAL_SCHOOL',
      value: 22.8,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — YES checked (closing 11/1, notification 1/23 — "Last Friday in January"). Non-restrictive EA. However, CDS C22 does not require institutions to break out EA applicant/admit/enroll counts; UFL provides none in this CDS. Existing eaAR=22.80 was sourced from the UF Office of Admissions Freshman Profile Infographic 2025-26 (admissions.ufl.edu) — that remains the authoritative OFFICIAL_SCHOOL publication for EA rate. Value preserved, provenance refreshed with cross-confirmation that CDS C22 confirms EA exists. Tier stays OFFICIAL/OFFICIAL_SCHOOL.',
      realDataStatus: 'VERIFIED_REAL',
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
      acceptanceRate: new Prisma.Decimal('24.20'),
      sat25: 1330,
      sat75: 1470,
      intlAcceptanceRate: new Prisma.Decimal('32.49'),
      oosAcceptanceRate: new Prisma.Decimal('23.27'),
      edAcceptanceRate: null,
      eaAcceptanceRate: new Prisma.Decimal('22.80'),
      // CDS C21 "No" — UFL does not offer ED; confirm hasEarlyDecision stays false
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=24.20, sat25=1330, sat75=1470, intlAR=32.49, oosAR=23.27, edAR=NOT_OFFERED, eaAR=22.80, hasED=false)',
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
