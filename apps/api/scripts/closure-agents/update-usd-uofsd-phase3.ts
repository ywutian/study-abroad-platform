#!/usr/bin/env tsx
/**
 * Phase 3 — University of South Dakota (UofSD, Vermillion, SD) end-to-end
 * closure of the 7 prediction-critical fields. PUBLIC flagship research
 * university (South Dakota Board of Regents system).
 *
 * (NOTE: Distinct from the unrelated private "University of San Diego" (USD)
 * which is school id cmnwr8iuf003zz0ti12pe3iq1 and was closed separately.)
 *
 * Source: USD CDS 2024-2025 (Fall 2024 entering class) from USD Institutional
 *   Research, Planning and Assessment.
 *   PDF: https://www.usd.edu/-/media/Project/USD/DotEdu/About/Departments-Offices-and-Resources/Institutional-Research-Planning-and-Assessment/USD-Common-Data-Set.pdf?rev=1ddcb14196e140a9bec776ebd5bc7b88&hash=F12AD65AC125F221B48CB947AD4702C0
 *
 * Institution facts:
 *   - PUBLIC flagship; in-state/out-of-state distinction carries real policy
 *     meaning (different tuition; residency pathways) → oosAR in eligible scope
 *   - CDS C8A "Yes" — USD DOES use SAT/ACT in admission decisions (NOT test-
 *     blind). C9 reports SAT Composite 25/75 = 1145/1260 (60 students
 *     submitting SAT = 4.23%; 877 ACT = 61.85% — primarily ACT-driven region).
 *   - C21 "No" — USD does NOT offer Early Decision (hasEarlyDecision DB true
 *     is STALE — correcting to false).
 *   - C22 "Yes" — USD offers nonbinding Early Action, but CDS C22 template in
 *     this cycle does not include EA applicant/admit counts; closing/notification
 *     dates also left blank.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 98.80 → 98.78 (CDS C1: 5,892 admits / 5,965 applicants
 *                          = 98.7762% (rounded to 98.78%). Composition: Men
 *                          2,383/2,424 = 98.31%; Women 3,509/3,541 = 99.10%.
 *                          Minor −0.02pp precision adjustment. Tier upgraded
 *                          LEGACY_DB_VALUE → OFFICIAL.)
 *   - sat25             : 1145 → 1145 (CDS C9 SAT Composite 25th = 1145.
 *                          Value matches prior DB; source upgraded from
 *                          prepscholar.com (third-party) to CDS_OFFICIAL.)
 *   - sat75             : 1260 → 1260 (CDS C9 SAT Composite 75th = 1260.
 *                          Same as sat25 — provenance correction only.)
 *   - intlAcceptanceRate: 97.50 → 97.52 (CDS C1 residency: 1,806 intl admits
 *                          / 1,852 intl applicants = 97.5162% (rounded to
 *                          97.52%). Minor +0.02pp precision adjustment.
 *                          Tier upgraded LEGACY_DB → OFFICIAL.)
 *   - oosAcceptanceRate : 99.40 → 99.38 (CDS C1 residency: 2,075 OOS admits /
 *                          2,088 OOS applicants = 99.3774% (rounded to
 *                          99.38%). Minor −0.02pp precision adjustment.
 *                          Tier upgraded LEGACY_DB → OFFICIAL. USD is PUBLIC
 *                          flagship — oosAR in eligible scope.)
 *   - edAcceptanceRate  : null → null (CDS C21 "No" — USD does not offer Early
 *                          Decision. Provenance refreshed from CDS_LLM_EXTRACT
 *                          to authoritative CDS_OFFICIAL marked
 *                          UNAVAILABLE/NOT_OFFERED.)
 *   - eaAcceptanceRate  : null → null (CDS C22 "Yes" — USD offers nonbinding
 *                          Early Action. However CDS C22 template does NOT
 *                          collect EA applicant/admit counts (only Yes/No +
 *                          dates + restrictive flag); USD does not publish a
 *                          round-level EA admit rate. Field marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION as
 *                          OFFERED_NOT_REPORTED.)
 *
 * hasEarlyDecision correction: DB true → false (CDS C21 "No" — USD does NOT
 *   offer ED). Stale flag corrected.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const UOFSD_CDS_URL =
  'https://www.usd.edu/-/media/Project/USD/DotEdu/About/Departments-Offices-and-Resources/Institutional-Research-Planning-and-Assessment/USD-Common-Data-Set.pdf?rev=1ddcb14196e140a9bec776ebd5bc7b88&hash=F12AD65AC125F221B48CB947AD4702C0';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8irf002lz0titpd5mufz';

const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findUnique({
    where: { id: SCHOOL_ID },
    select: {
      id: true,
      name: true,
      isPrivate: true,
      hasEarlyDecision: true,
      dataReviewStatus: true,
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
    throw new Error(
      `School ${SCHOOL_ID} (University of South Dakota) not found`,
    );
  if (school.dataReviewStatus === 'REJECTED') {
    console.log(
      `Skipping closed/rejected school ${school.name} (status=${school.dataReviewStatus})`,
    );
    return;
  }
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC flagship]`);
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
    sourceUrl: UOFSD_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-batch24-claude',
    generatedBy: 'phase3-usd-uofsd-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 98.78,
      policyLabel: 'Overall admit rate',
      reason:
        'University of South Dakota CDS 2024-2025 Section C1: TOTAL applicants 5,965 (Men 2,424 + Women 3,541); TOTAL admits 5,892 (Men 2,383 + Women 3,509). AR = 5,892 / 5,965 = 98.7762% (rounded to 98.78%). Minor −0.02pp precision adjustment vs prior 98.80. Tier upgraded LEGACY_DB_VALUE → OFFICIAL with authoritative usd.edu CDS sourceUrl.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1145,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'USD CDS 2024-2025 Section C9: SAT Composite 25th percentile = 1145 (60 students submitting SAT = 4.23% of enrolled; 877 students submitted ACT = 61.85%, ACT Composite 25th = 19, 75th = 25 — primarily ACT-driven region). USD CDS C8A "Yes" — USD DOES use SAT/ACT in admission decisions (NOT test-blind). Value matches prior DB; source upgraded from prepscholar.com (third-party) to authoritative CDS_OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1260,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'USD CDS 2024-2025 Section C9: SAT Composite 75th percentile = 1260. Value matches prior DB; source upgraded from prepscholar.com (third-party) to CDS_OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 97.52,
      policyLabel: 'International admit rate',
      reason:
        'USD CDS 2024-2025 Section C1 residency breakdown: 1,852 international applicants; 1,806 international admits. intlAR = 1,806 / 1,852 = 97.5162% (rounded to 97.52%). Minor +0.02pp precision adjustment vs prior 97.50. Tier upgraded LEGACY_DB_VALUE → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 99.38,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'USD CDS 2024-2025 Section C1 residency breakdown: 2,088 out-of-state applicants; 2,075 out-of-state admits. oosAR = 2,075 / 2,088 = 99.3774% (rounded to 99.38%). Minor −0.02pp precision adjustment vs prior 99.40. USD is PUBLIC flagship (South Dakota Board of Regents) — in-state/out-of-state distinction carries real policy meaning (different tuition, residency pathways); oosAR in eligible scope. Tier upgraded LEGACY_DB_VALUE → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'USD CDS 2024-2025 Section C21: "Does your institution offer an early decision plan?" — NO checked. University of South Dakota does NOT offer Early Decision. Prior provenance was CDS_LLM_EXTRACT_2026_04 (value=undefined). Provenance refreshed to authoritative CDS_OFFICIAL marked UNAVAILABLE/NOT_OFFERED. Stale DB hasEarlyDecision=true flag corrected to false.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'USD CDS 2024-2025 Section C22: "Do you have a nonbinding early action plan?" — YES checked (USD offers nonbinding EA; closing/notification dates left blank in CDS; restrictive flag left blank). However CDS C22 template does NOT collect EA applicant/admit counts (only Yes/No + dates + restrictive flag); USD does not publish a round-level EA admit rate. Prior provenance was CDS_LLM_EXTRACT_2026_04 (value=undefined). Field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION as OFFERED_NOT_REPORTED.',
      realDataStatus: 'OFFERED_NOT_REPORTED',
    },
  };

  const existingMeta = toRecord(school.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: UOFSD_CDS_URL,
  };

  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('98.78'),
      sat25: 1145,
      sat75: 1260,
      intlAcceptanceRate: new Prisma.Decimal('97.52'),
      oosAcceptanceRate: new Prisma.Decimal('99.38'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — USD does NOT offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=98.78, sat25=1145, sat75=1260, intlAR=97.52, oosAR=99.38, edAR=NOT_OFFERED, eaAR=OFFERED_NOT_REPORTED, hasED=false)',
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
