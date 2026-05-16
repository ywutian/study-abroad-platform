#!/usr/bin/env tsx
/**
 * Phase 3 — Rutgers University-New Brunswick end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: Rutgers New Brunswick CDS 2023-2024 (Fall 2023 entering class).
 *   NOTE: A 2024-2025 CDS is NOT yet published by OIRAP (verified via OIRAP
 *   index page on 2026-05-16); the 2023-2024 CDS is the latest available.
 *   URL: https://oirap.rutgers.edu/CDS/2023/New%20Brunswick%20CDS_2023-2024_final_V1.pdf
 *   Index: https://oirap.rutgers.edu/ReportingCommonDataSet.html
 *
 * Rutgers is PUBLIC (NJ state research university) → oosAcceptanceRate is in
 * eligible scope and carries a real OFFICIAL number from CDS C1 residency
 * table (in-state vs. out-of-state distinction has real policy meaning — NJ
 * residents pay materially lower tuition).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 65.35  → 65.35  (CDS C1: 28,326 admits / 43,347
 *                          applicants = 65.3541%. Value matches prior DB;
 *                          tier upgraded LEGACY_DB → OFFICIAL.)
 *   - sat25             : 1230   → 1270   (CDS C9: SAT Composite row BLANK
 *                          (Rutgers does not report composite percentiles).
 *                          Per closure-pipeline rule, sum EBRW 25th (630) +
 *                          Math 25th (640) = 1270. CORRECTION UP +40 from
 *                          prior 1230 (LEGACY_DB heuristic).)
 *   - sat75             : 1390   → 1480   (CDS C9: SAT Composite row BLANK.
 *                          Sum EBRW 75th (720) + Math 75th (760) = 1480.
 *                          CORRECTION UP +90 from prior 1390 (LEGACY_DB
 *                          heuristic).)
 *   - intlAcceptanceRate: 70.72  → 70.72  (CDS C1 residency: 3,345 intl
 *                          admits / 4,730 intl applicants = 70.7188%
 *                          (rounded to 70.72%). Value matches prior DB;
 *                          tier upgraded LEGACY_DB → OFFICIAL.)
 *   - oosAcceptanceRate : 71.98  → 71.98  (CDS C1 residency: 6,928 OOS
 *                          admits / 9,625 OOS applicants = 71.9792%
 *                          (rounded to 71.98%). Value matches prior DB;
 *                          tier upgraded LEGACY_DB → OFFICIAL. Public-school
 *                          convention: oosAR carries the real number, never
 *                          marked TERMINAL.)
 *   - edAcceptanceRate  : null   → null   (CDS C21: "No" checked — Rutgers
 *                          does NOT offer Early Decision. Field stays
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION. Prior tier
 *                          was NOT_APPLICABLE/POLICY_DETERMINATION; refreshed
 *                          to authoritative CDS pull.)
 *   - eaAcceptanceRate  : null   → null   (CDS C22: "Yes" checked — Rutgers
 *                          offers nonbinding Early Action (EA closing 11/1,
 *                          notification 1/31). BUT the Fall 2023 entering-
 *                          class EA applicant/admit counts are NOT REPORTED
 *                          on this CDS (numeric fields blank). Per closure-
 *                          pipeline rule, field stays null, marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_REPORTED.
 *                          Provenance refreshed.)
 *
 * NOTE on hasEarlyDecision: DB value is false; matches CDS C21 "No". No change.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://oirap.rutgers.edu/CDS/2023/New%20Brunswick%20CDS_2023-2024_final_V1.pdf';
const CYCLE_YEAR = 2023; // CDS 2023-2024 = Fall 2023 entering class (latest available)
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmn1htkpo0013vqf2byqbw5mb';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Rutgers NB) not found`);
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
    generatedBy: 'phase3-rutgers-nb-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 65.35,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2023-24 Section C1: 28,326 admits / 43,347 applicants = 65.3541% (rounded to 65.35%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance. 2024-25 CDS not yet published by OIRAP (verified 2026-05-16).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1270,
      policyLabel: 'SAT 25th percentile (EBRW + Math sum; composite row blank)',
      reason:
        'CDS 2023-24 Section C9: SAT Composite percentile row is BLANK (Rutgers does not report composite percentiles). Per closure-pipeline rule, derived 25th = EBRW 630 + Math 640 = 1270. CORRECTION UP +40 from prior 1230 (LEGACY_DB heuristic). 50.9% of Fall 2023 enrolled (3,908 students) submitted SAT.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1480,
      policyLabel: 'SAT 75th percentile (EBRW + Math sum; composite row blank)',
      reason:
        'CDS 2023-24 Section C9: SAT Composite percentile row is BLANK. Per closure-pipeline rule, derived 75th = EBRW 720 + Math 760 = 1480. CORRECTION UP +90 from prior 1390 (LEGACY_DB heuristic).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 70.72,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2023-24 Section C1 residency table: 3,345 international admits / 4,730 international applicants = 70.7188% (rounded to 70.72%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 71.98,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2023-24 Section C1 residency table: 6,928 out-of-state admits / 9,625 out-of-state applicants = 71.9792% (rounded to 71.98%). Rutgers New Brunswick is a PUBLIC NJ state research university — in-state vs. out-of-state distinction carries real policy meaning (NJ residents pay materially lower tuition), so this field is in eligible scope and carries a real CDS number. Value matches prior DB; tier upgraded LEGACY_DB → OFFICIAL. (Public-school convention: oosAR is a real OFFICIAL number, never marked TERMINAL.)',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2023-24 Section C21: "Does your institution offer an early decision plan?" — NO checked. Rutgers New Brunswick does not offer Early Decision. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Prior tier was NOT_APPLICABLE/POLICY_DETERMINATION; refreshed to authoritative CDS-pull provenance.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2023-24 Section C22: "Do you have a nonbinding early action plan?" — YES checked (EA closing 11/1, notification 1/31, non-restrictive). HOWEVER, the Fall 2023 entering-class EA applicant/admit counts are NOT REPORTED on this CDS (numeric fields blank). Per closure-pipeline rule, field stays null, marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_REPORTED. Provenance refreshed to authoritative CDS pull.',
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
  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('65.35'),
      sat25: 1270,
      sat75: 1480,
      intlAcceptanceRate: new Prisma.Decimal('70.72'),
      oosAcceptanceRate: new Prisma.Decimal('71.98'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      hasEarlyDecision: false, // CDS C21 "No"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=65.35, sat25=1270, sat75=1480, intlAR=70.72, oosAR=71.98, edAR=NOT_OFFERED, eaAR=NOT_REPORTED, hasED=false)',
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
