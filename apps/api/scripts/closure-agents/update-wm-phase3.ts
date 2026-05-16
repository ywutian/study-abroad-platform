#!/usr/bin/env tsx
/**
 * Phase 3 — William & Mary end-to-end closure of the 7 prediction-critical
 * fields.
 *
 * Source: William & Mary CDS 2024-2025 Section C (admissions; separated PDF)
 *   URL: https://www.wm.edu/offices/ir/university_data/cds/cds-2024-2025_c.pdf
 *
 * William & Mary is a PUBLIC research university (isPrivate=false).
 *   - Public-school convention: oosAR is in eligible scope and SHOULD carry a
 *     real OFFICIAL number when CDS C1 residency table is populated.
 *   - HOWEVER, W&M's CDS 2024-25 C1 residency table is BLANK (in-state /
 *     out-of-state / international columns all read 0). Per closure-pipeline
 *     convention, blank-section → UNAVAILABLE / OFFICIAL_BLANK_SECTION for the
 *     residency-derived fields (oosAR and intlAR).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 33     -> 34.07  (CDS C1: men 2519 + women 3544 +
 *                          other 0 + unknown 1 = 6,064 admits; men 6742 +
 *                          women 11047 + other 0 + unknown 9 = 17,798
 *                          applicants. 6064/17798 = 34.0712% (rounded 34.07%).
 *                          Tier upgraded LEGACY_DB -> OFFICIAL. CORRECTION UP
 *                          +1.07pp.)
 *   - sat25             : 1360   -> 1400   (CDS C9: SAT Composite 25th = 1400
 *                          reported directly. CORRECTION UP +40 from prior 1360
 *                          (SEED/LEGACY).)
 *   - sat75             : 1490   -> 1530   (CDS C9: SAT Composite 75th = 1530
 *                          reported directly. CORRECTION UP +40 from prior 1490
 *                          (SEED/LEGACY).)
 *   - intlAcceptanceRate: 23.1   -> null   (CDS C1 residency table for INTL is
 *                          BLANK (printed 0). Per convention, blank residency
 *                          section -> UNAVAILABLE/OFFICIAL_BLANK_SECTION. Prior
 *                          HEURISTIC value 23.1 cleared.)
 *   - oosAcceptanceRate : 24.75  -> null   (CDS C1 residency table for OOS is
 *                          BLANK (printed 0). Per convention, blank residency
 *                          section -> UNAVAILABLE/OFFICIAL_BLANK_SECTION. Prior
 *                          HEURISTIC value 24.75 cleared. Public school but
 *                          source doesn't publish — terminal for this cycle.)
 *   - edAcceptanceRate  : 47.03  -> 47.04  (CDS C21: ED offered ("Yes" checked)
 *                          — ED I 11/1 closing 12/15 notification; ED II 1/5
 *                          closing 2/1 notification. Fall 2024 entering class:
 *                          746 admits / 1,586 ED applications = 47.0366%
 *                          (rounded 47.04%). Minor precision adjustment;
 *                          tier upgraded LEGACY_DB -> OFFICIAL.)
 *   - eaAcceptanceRate  : null   -> null   (CDS C22: "No" — W&M does not offer
 *                          a nonbinding EA plan. Field stays cleared
 *                          (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED).
 *                          Provenance refreshed to authoritative phase3 pull.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.wm.edu/offices/ir/university_data/cds/cds-2024-2025_c.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ilx0001z0tilru6b1th';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (W&M) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC]`);
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
    generatedBy: 'phase3-wm-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 34.07,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: men 2,519 + women 3,544 + another gender 0 + unknown 1 = 6,064 admits; men 6,742 + women 11,047 + another gender 0 + unknown 9 = 17,798 applicants. 6,064 / 17,798 = 34.0712% (rounded 34.07%). Tier upgraded from LEGACY_DB (value 33) to OFFICIAL. CORRECTION UP +1.07pp.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1400,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1400 (reported directly; EBRW 710 + Math 690 = 1400 also coincides). 43.00% of Fall 2024 enrolled (696 students) submitted SAT under test-optional policy (C8A: SAT considered if submitted). CORRECTION UP +40 from prior 1360 (SEED/LEGACY).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1530,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1530 (reported directly; EBRW 760 + Math 770 = 1530 also coincides). CORRECTION UP +40 from prior 1490 (SEED/LEGACY).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table is BLANK for W&M — the IN-STATE / OUT-OF-STATE / INTERNATIONAL / UNKNOWN columns all print as 0 with TOTAL=0. The institution did not publish residency-broken-down applicants/admits in this cycle, so an authoritative international admit rate cannot be derived. Per closure-pipeline convention, blank residency section -> UNAVAILABLE / OFFICIAL_BLANK_SECTION. Prior HEURISTIC value (23.1) cleared.',
      realDataStatus: 'UNAVAILABLE',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'W&M is a PUBLIC institution (in-state/out-of-state distinction carries real policy meaning), so the field is in eligible scope. However, CDS 2024-25 Section C1 residency table is BLANK — IN-STATE / OUT-OF-STATE / INTERNATIONAL / UNKNOWN columns all print as 0 with TOTAL=0. The institution did not publish residency-broken-down applicants/admits in this cycle, so an authoritative OOS admit rate cannot be derived. Per closure-pipeline convention (C1 residency 空 -> UNAVAILABLE / OFFICIAL_BLANK_SECTION), prior HEURISTIC value (24.75) cleared.',
      realDataStatus: 'UNAVAILABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 47.04,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2024-25 Section C21: W&M offers Early Decision ("Yes" checked) with two plans — ED I closes 11/1 (12/15 notification), ED II closes 1/5 (2/1 notification). For the Fall 2024 entering class: 1,586 ED applications received, 746 admitted = 746/1,586 = 47.0366% (rounded 47.04%). Minor precision adjustment from prior 47.03; tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. W&M does not offer Early Action. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance refreshed to authoritative phase3 pull from prior CDS_LLM_EXTRACT_2026_04 with value=undefined.',
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
      acceptanceRate: new Prisma.Decimal('34.07'),
      sat25: 1400,
      sat75: 1530,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('47.04'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true, // re-confirm CDS C21 "Yes"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=34.07, sat25=1400, sat75=1530, intlAR=BLANK_SECTION, oosAR=BLANK_SECTION, edAR=47.04, eaAR=NOT_OFFERED, hasED=true)',
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
