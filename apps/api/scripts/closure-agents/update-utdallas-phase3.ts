#!/usr/bin/env tsx
/**
 * Phase 3 — University of Texas at Dallas (UTD) end-to-end closure of the
 * 7 prediction-critical fields.
 *
 * Source: UT Dallas Common Data Set 2024-2025 (Fall 2024 entering class),
 *   published by the Office of Institutional Success and Decision Support
 *   (formerly Institutional Research).
 *   URL: https://dox.utdallas.edu/report44675
 *   Index: https://oisds.utdallas.edu/common-data-set
 *   (NOTE: ir.utdallas.edu host does not resolve; canonical CDS PDF is
 *   served via dox.utdallas.edu/report44675)
 *
 * UTD is a PUBLIC research university (Richardson, Texas) — part of UT System.
 *   - isPrivate=false  ->  oosAcceptanceRate is in eligible scope, carries a
 *     real OFFICIAL number extracted from CDS C1 residency table.
 *
 * Test policy (CDS C8A): UTD is TEST-OPTIONAL ("Not required for admission,
 *   but considered if submitted"). 78% (3,290) submitted SAT, 13% (566)
 *   submitted ACT. SAT band still recorded per closure-pipeline convention
 *   (descriptive applicant-profile use, not a gating threshold).
 *
 * ED/EA (CDS C21/C22):
 *   - C21 Early Decision: "No" — UTD does NOT offer ED.
 *     (Existing DB hasEarlyDecision=true is STALE — being corrected to false.)
 *   - C22 Early Action: "No" — UTD does NOT offer EA. Application cycle uses
 *     fall priority date 12/1 and closing 5/1 (rolling notification "by
 *     registration").
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 65.1   -> 65.13  (CDS 2024-25 C1: 20,704 admits /
 *                          31,789 applicants = 65.1294%. Tier upgraded
 *                          LEGACY_DB -> OFFICIAL. Minor precision adjustment.)
 *   - sat25             : 1170   -> 1170   (CDS 2024-25 C9: SAT Composite 25th
 *                          = 1170 reported directly. No value change.
 *                          Existing OFFICIAL provenance carried wrong
 *                          sourceUrl (prepscholar.com) — refreshed to UTD
 *                          institutional CDS PDF.)
 *   - sat75             : 1390   -> 1390   (CDS 2024-25 C9: SAT Composite 75th
 *                          = 1390 reported directly. No value change.
 *                          Existing OFFICIAL provenance carried wrong
 *                          sourceUrl (prepscholar.com) — refreshed to UTD
 *                          institutional CDS PDF.)
 *   - intlAcceptanceRate: 39.7   -> 39.68  (CDS 2024-25 C1 residency: 1,382
 *                          intl admits / 3,483 intl applicants = 39.6784%.
 *                          Matches existing DB (rounding only). Tier
 *                          upgraded LEGACY_DB -> OFFICIAL.)
 *   - oosAcceptanceRate : 62.8   -> 62.83  (CDS 2024-25 C1 residency: 2,415
 *                          OOS admits / 3,844 OOS applicants = 62.8252%.
 *                          Matches existing DB. Tier upgraded
 *                          LEGACY_DB -> OFFICIAL. Minor precision
 *                          adjustment.)
 *   - edAcceptanceRate  : null   -> null   (CDS C21: "No" — UTD does not
 *                          offer ED. Field stays cleared
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION. Provenance
 *                          corrected: prior URL pointed to UNT Dallas (a
 *                          different institution!) Academic Council minutes
 *                          — refreshed to UTD CDS PDF.)
 *   - eaAcceptanceRate  : null   -> null   (CDS C22: "No" — UTD does not
 *                          offer EA. Field stays cleared
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION. Provenance
 *                          corrected: prior URL pointed to UNT Dallas
 *                          (different institution) — refreshed to UTD CDS
 *                          PDF.)
 *
 * NOTE on hasEarlyDecision: current DB value is true, but CDS C21 is "No".
 *   Setting to false to match CDS reality.
 *
 * NOTE on existing provenance URLs: The prior ED/EA provenance pointed to
 *   `untdallas.edu/provost/minutes/academic_council_minutes_february_27_2024.pdf`
 *   — this is the University of NORTH Texas at Dallas (UNT Dallas), a
 *   completely separate institution from UT Dallas (UTD). Confirming as a
 *   misattribution requiring correction.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL = 'https://dox.utdallas.edu/report44675';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iwx0059z0tilcfiwj80';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UTD) not found`);
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
    generatedBy: 'phase3-utdallas-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 65.13,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 20,704 admits / 31,789 applicants = 65.1294% (rounded to 65.13%). Tier upgraded from VERIFIED_REAL/LEGACY_DB (value 65.1) to OFFICIAL with minor precision adjustment.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1170,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1170 (reported directly; EBRW 580 + Math 580 ~ 1160 with rounding). Matches existing OFFICIAL value with cycle=2024. Existing provenance had wrong sourceUrl (prepscholar.com aggregator) — refreshed to UTD institutional CDS PDF. NOTE: UTD is test-optional (CDS C8A "Not required for admission, but considered if submitted"); 78% (3,290) submitted SAT; SAT band recorded for descriptive applicant-profile use, not a gating threshold.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1390,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1390 (reported directly; EBRW 690 + Math 720 ~ 1410 with rounding). Matches existing OFFICIAL value with cycle=2024. Existing provenance had wrong sourceUrl (prepscholar.com aggregator) — refreshed to UTD institutional CDS PDF. UTD test-optional: SAT band descriptive only.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 39.68,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 1,382 international admits / 3,483 international applicants = 39.6784% (rounded to 39.68%). Matches existing DB value 39.7 (rounding only). Tier upgraded from VERIFIED_REAL/LEGACY_DB to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 62.83,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 2,415 out-of-state admits / 3,844 out-of-state applicants = 62.8252% (rounded to 62.83%). UTD is a PUBLIC research university in the UT System — in-state vs. out-of-state distinction carries real policy meaning (different tuition; heavy in-state applicant volume: 24,462 of 31,789 = 77% of applicants), so this field is in eligible scope and carries a real CDS number. Matches existing DB. Tier upgraded LEGACY_DB -> OFFICIAL with minor precision adjustment. (For reference: in-state admit rate is 16,907/24,462 = 69.12%.)',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. UTD does not offer Early Decision. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance corrected: prior URL pointed to untdallas.edu (University of NORTH Texas at Dallas — a completely different institution from UTD!) — refreshed to UTD CDS PDF. NOTE: existing DB hasEarlyDecision=true is STALE — being corrected to false in this update.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. UTD does not offer Early Action. Application cycle uses fall priority date 12/1 and closing 5/1 (rolling notification "by registration"). Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance corrected: prior URL pointed to untdallas.edu (UNT Dallas — different institution) — refreshed to UTD CDS PDF.',
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
      acceptanceRate: new Prisma.Decimal('65.13'),
      sat25: 1170,
      sat75: 1390,
      intlAcceptanceRate: new Prisma.Decimal('39.68'),
      oosAcceptanceRate: new Prisma.Decimal('62.83'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — UTD does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=65.13, sat25=1170, sat75=1390, intlAR=39.68, oosAR=62.83, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
