#!/usr/bin/env tsx
/**
 * Phase 3 — Arizona State University (Campus Immersion) end-to-end closure of
 * the 7 prediction-critical fields.
 *
 * Source: ASU Common Data Set 2024-2025
 *   URL: https://uoia.asu.edu/sites/g/files/litvpz1436/files/2025-04/ASU%20Campus%20Immersion%20-%20Common%20Data%20Set%202024-25.pdf
 *
 * ASU is PUBLIC (Section A2 Public X). isPrivate=false.
 *   - oosAcceptanceRate IS in eligible scope: real OFFICIAL number from C1
 *     residency table. NOT marked TERMINAL.
 *
 * ASU is test-optional (C8A "Not required for admission, but considered if
 * submitted"). C9 SAT Composite percentile row is BLANK (no SAT scores
 * reported by ASU in this CDS).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 89.9   -> 89.89  (CDS 2024-25 C1: 63,756 admits /
 *                          70,928 applicants = 89.8915%. Minor precision
 *                          refresh, tier LEGACY_DB -> OFFICIAL.)
 *   - sat25             : 1120   -> null   (CDS 2024-25 C9 SAT Composite row
 *                          BLANK. ASU does not report SAT 25/75 in CDS. Prior
 *                          legacy DB value 1120 (LEGACY_DB) cleared per CDS-
 *                          authoritative convention. Mark UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION.)
 *   - sat75             : 1330   -> null   (CDS 2024-25 C9 BLANK. Same as
 *                          sat25.)
 *   - intlAcceptanceRate: 89.6   -> 89.63  (CDS 2024-25 C1 residency: 7,988
 *                          intl admits / 8,912 intl applicants = 89.6320%.
 *                          Tier LEGACY_DB -> OFFICIAL.)
 *   - oosAcceptanceRate : 89.2   -> 89.17  (CDS 2024-25 C1 residency: 38,249
 *                          OOS admits / 42,895 OOS applicants = 89.1714%.
 *                          PUBLIC school - real OFFICIAL number. Tier
 *                          LEGACY_DB -> OFFICIAL.)
 *   - edAcceptanceRate  : null   -> null   (CDS 2024-25 C21: "No" — ASU does
 *                          not offer ED. UNAVAILABLE/OFFICIAL_BLANK_SECTION.
 *                          Note: hasEarlyDecision was incorrectly true in DB;
 *                          corrected to false.)
 *   - eaAcceptanceRate  : null   -> null   (CDS 2024-25 C22: "No" — ASU does
 *                          not offer EA. UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
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
  'https://uoia.asu.edu/sites/g/files/litvpz1436/files/2025-04/ASU%20Campus%20Immersion%20-%20Common%20Data%20Set%202024-25.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8inx0015z0tix5dndhpi';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (ASU) not found`);
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
    generatedBy: 'phase3-asu-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 89.89,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 63,756 admits / 70,928 applicants = 89.8915% (rounded to 89.89%). Tier upgraded from LEGACY_DB (value 89.9, sourceUrl admission.asu.edu/freshman/facts) to OFFICIAL with precision refresh.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite percentile row is BLANK — ASU does not report SAT 25/50/75 in CDS. ASU is test-optional (C8A "Not required for admission, but considered if submitted"). Prior legacy DB value 1120 (LEGACY_DB, sourceUrl=null) cleared per CDS-authoritative convention. Field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION.',
      realDataStatus: 'NOT_REPORTED',
    },
    sat75: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite percentile row is BLANK — ASU does not report SAT 25/50/75 in CDS. Prior legacy DB value 1330 (LEGACY_DB) cleared. Field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION.',
      realDataStatus: 'NOT_REPORTED',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 89.63,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 7,988 international admits / 8,912 international applicants = 89.6320% (rounded to 89.63%). Tier upgraded from LEGACY_DB (value 89.6) to OFFICIAL with precision refresh.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 89.17,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 38,249 out-of-state admits / 42,895 out-of-state applicants = 89.1714% (rounded to 89.17%). ASU is a PUBLIC institution (CDS A2 Public X) — in-state vs. out-of-state distinction carries real policy meaning (different tuition, residency-preference pathways), so this field carries the real CDS number. Tier upgraded from LEGACY_DB (value 89.2) to OFFICIAL with precision refresh.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. ASU does not offer Early Decision. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). hasEarlyDecision corrected from stale DB true to false. Provenance refreshed from CDS_LLM_EXTRACT_2026_04 to CDS_OFFICIAL.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. ASU does not offer Early Action. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance refreshed from CDS_LLM_EXTRACT_2026_04 to CDS_OFFICIAL.',
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
      acceptanceRate: new Prisma.Decimal('89.89'),
      sat25: null,
      sat75: null,
      intlAcceptanceRate: new Prisma.Decimal('89.63'),
      oosAcceptanceRate: new Prisma.Decimal('89.17'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — ASU does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=89.89, sat25=BLANK, sat75=BLANK, intlAR=89.63, oosAR=89.17, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
