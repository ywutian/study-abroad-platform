#!/usr/bin/env tsx
/**
 * Phase 3 — Rutgers University-Newark end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: Rutgers University-Newark CDS 2023-2024 (Fall 2023 entering class).
 *   NOTE: A 2024-2025 CDS for Newark is NOT yet posted by OIRAP (verified
 *   2026-05-16 via OIRAP CDS index); the 2023-2024 CDS is the latest available.
 *   URL: https://oirap.rutgers.edu/CDS/2023/Newark%20CDS_2023-2024_final_V1.pdf
 *   Index: https://oirap.rutgers.edu/ReportingCommonDataSet.html
 *
 * Rutgers-Newark is PUBLIC (NJ state research university) → oosAcceptanceRate
 * is in eligible scope and carries a real OFFICIAL number from CDS C1 residency
 * table (in-state vs. out-of-state distinction has real policy meaning — NJ
 * residents pay materially lower tuition).
 *
 * Rutgers-Newark is TEST-BLIND (CDS C8A "No" — SAT/ACT NOT used in admission
 * decisions for first-time, first-year, degree-seeking applicants). CDS C9 SAT
 * Composite/EBRW/Math 25/50/75 rows ALL BLANK. Per closure-pipeline convention:
 *   sat25/sat75 = null, tier UNAVAILABLE/OFFICIAL_BLANK_SECTION (NOT_COLLECTED).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 78.73  → 78.73  (CDS C1: 13,997 admits / 17,779
 *                          applicants = 78.7333%. Value matches prior DB
 *                          exactly; tier upgraded LEGACY_DB → OFFICIAL.)
 *   - sat25             : 1090   → null   (Rutgers-Newark is TEST-BLIND — CDS
 *                          C8A "No". C9 SAT Composite/EBRW/Math rows ALL BLANK.
 *                          Prior LEGACY_DB 1090 cleared. UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION (NOT_COLLECTED).)
 *   - sat75             : 1280   → null   (Same — test-blind. Prior LEGACY_DB
 *                          1280 cleared.)
 *   - intlAcceptanceRate: 70.1   → 70.10  (CDS C1 residency: 1,550 intl admits /
 *                          2,211 intl applicants = 70.1040% (rounded 70.10%).
 *                          Value matches prior DB (precision); tier upgraded
 *                          LEGACY_DB → OFFICIAL.)
 *   - oosAcceptanceRate : 77.56  → 77.56  (CDS C1 residency: 2,835 OOS admits /
 *                          3,655 OOS applicants = 77.5650% (rounded 77.56%).
 *                          Value matches prior DB; tier upgraded LEGACY_DB →
 *                          OFFICIAL. PUBLIC NJ school — oosAR carries real
 *                          number, never marked TERMINAL.)
 *   - edAcceptanceRate  : null   → null   (CDS C21: "No" — Rutgers-Newark does
 *                          NOT offer Early Decision. Provenance refreshed from
 *                          CDS_LLM_EXTRACT_2026_04 to CDS_OFFICIAL marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : null   → null   (CDS C22: "Yes" — Rutgers-Newark
 *                          offers nonbinding Early Action (closing 11/1,
 *                          notification 1/31, non-restrictive). HOWEVER the
 *                          Fall 2023 EA applicant/admit numeric counts are NOT
 *                          REPORTED on this CDS (blank). Per closure-pipeline
 *                          rule, field stays null marked UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION/NOT_REPORTED.)
 *
 * NOTE on hasEarlyDecision: current DB value is true but CDS C21 is "No".
 *   Setting to false to match CDS reality.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://oirap.rutgers.edu/CDS/2023/Newark%20CDS_2023-2024_final_V1.pdf';
const CYCLE_YEAR = 2023; // CDS 2023-2024 = Fall 2023 entering class (latest available)
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8io7001bz0tihu5wo9mh';

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
    throw new Error(`School ${SCHOOL_ID} (Rutgers-Newark) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC — TEST-BLIND]`);
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
    generatedBy: 'phase3-rutgers-newark-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 78.73,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2023-24 Section C1: 13,997 admits / 17,779 applicants = 78.7333% (rounded to 78.73%). Value matches prior DB; tier upgraded LEGACY_DB → OFFICIAL with refreshed provenance. 2024-25 CDS not yet published by OIRAP (verified 2026-05-16).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'Rutgers-Newark is TEST-BLIND — CDS 2023-24 Section C8A "No" (SAT/ACT NOT used in admission decisions for first-time, first-year, degree-seeking applicants). CDS C9 SAT Composite / EBRW / Math 25/50/75 rows ALL BLANK. Per C8F: "Reviews of applicants for regular admissions are test blind." Prior LEGACY_DB value 1090 cleared. Marked UNAVAILABLE/OFFICIAL_BLANK_SECTION (NOT_COLLECTED).',
      realDataStatus: 'NOT_COLLECTED',
    },
    sat75: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'Rutgers-Newark is TEST-BLIND — CDS 2023-24 Section C8A "No". CDS C9 SAT rows ALL BLANK. Prior LEGACY_DB value 1280 cleared. Marked UNAVAILABLE/OFFICIAL_BLANK_SECTION (NOT_COLLECTED).',
      realDataStatus: 'NOT_COLLECTED',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 70.1,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2023-24 Section C1 residency table: 1,550 international admits / 2,211 international applicants = 70.1040% (rounded to 70.10%). Value matches prior DB (precision); tier upgraded LEGACY_DB → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 77.56,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2023-24 Section C1 residency table: 2,835 out-of-state admits / 3,655 out-of-state applicants = 77.5650% (rounded to 77.56%). Rutgers-Newark is a PUBLIC NJ state research university — in-state vs. out-of-state distinction carries real policy meaning (NJ residents pay materially lower tuition), so this field is in eligible scope and carries a real CDS number. Value matches prior DB; tier upgraded LEGACY_DB → OFFICIAL. (Public-school convention: oosAR is a real OFFICIAL number, never marked TERMINAL.)',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2023-24 Section C21: "Does your institution offer an early decision plan?" — NO checked. Rutgers-Newark does not offer Early Decision. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Prior provenance was CDS_LLM_EXTRACT_2026_04; refreshed to authoritative CDS_OFFICIAL. Also corrected stale DB hasEarlyDecision=true to false.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2023-24 Section C22: "Do you have a nonbinding early action plan?" — YES checked (EA closing 11/1, notification 1/31, non-restrictive). HOWEVER, the Fall 2023 entering-class EA applicant/admit numeric counts are NOT REPORTED on this CDS (numeric fields blank). Per closure-pipeline rule, field stays null, marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_REPORTED. Provenance refreshed from CDS_LLM_EXTRACT_2026_04 to authoritative CDS_OFFICIAL pull.',
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

  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('78.73'),
      sat25: null,
      sat75: null,
      intlAcceptanceRate: new Prisma.Decimal('70.10'),
      oosAcceptanceRate: new Prisma.Decimal('77.56'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      hasEarlyDecision: false, // CDS C21 "No"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=78.73, sat25=null[BLIND], sat75=null[BLIND], intlAR=70.10, oosAR=77.56, edAR=NOT_OFFERED, eaAR=NOT_REPORTED, hasED=false)',
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
