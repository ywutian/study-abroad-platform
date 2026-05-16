#!/usr/bin/env tsx
/**
 * Phase 3 — Auburn University end-to-end closure of the 7 prediction-critical
 * fields.
 *
 * Source: Auburn University CDS 2024-2025 (Fall 2024 entering class), Office
 *   of Institutional Research, published as HTML by section.
 *   URL: https://auburn.edu/administration/ir/common-data-set/2024/section-c.html
 *
 * Auburn is a PUBLIC land-grant research university (Auburn, Alabama).
 *   - isPrivate=false  ->  oosAcceptanceRate is in eligible scope and would
 *     normally carry a real OFFICIAL number. HOWEVER, Auburn's published CDS
 *     C1 does NOT include a residency breakdown sub-table (in-state vs
 *     out-of-state vs international). Per closure-pipeline convention, when
 *     C1 residency is blank, oosAR is marked UNAVAILABLE/OFFICIAL_BLANK_SECTION
 *     (institution-level data absence, not an inferred-heuristic placeholder).
 *
 * Test policy (CDS C8A): Auburn is TEST-OPTIONAL — SAT/ACT listed as
 *   "Consider if Submitted" (Fall 2026). Only 16% (954) submitted SAT,
 *   76% (4,629) submitted ACT. SAT band still recorded per closure-pipeline
 *   convention (descriptive applicant-profile use, not a gating threshold).
 *
 * ED/EA (CDS C21/C22):
 *   - C21 Early Decision: "No" — Auburn does NOT offer ED.
 *     (Existing DB hasEarlyDecision=true is STALE — being corrected to false.)
 *   - C22 Early Action: "Yes" — Auburn offers EA (closing 11/1, notification
 *     12/1). Non-restrictive. CDS C22 does NOT break out EA admit counts and
 *     Auburn provides none. Existing eaAR=39 was from TAVILY_ENRICHMENT but
 *     the same provenance note explicitly states "no EA counts in CDS" — the
 *     value is an erroneous extraction artifact and must be cleared.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 46     -> 45.93  (CDS 2024-25 C1: 25,284 admits /
 *                          55,056 applicants = 45.9281%. Tier upgraded
 *                          LEGACY_DB (collegekickstart.com aggregator) ->
 *                          OFFICIAL. Minor precision adjustment.)
 *   - sat25             : 1180   -> 1260   (CDS 2024-25 C9: SAT Composite 25th
 *                          = 1260 reported directly (EBRW 630 + Math 620).
 *                          CORRECTION UP +80 from prior 1180 (LEGACY_DB
 *                          heuristic). Auburn test-optional: 16% submitted.)
 *   - sat75             : 1340   -> 1380   (CDS 2024-25 C9: SAT Composite 75th
 *                          = 1380 reported directly (EBRW 690 + Math 700).
 *                          CORRECTION UP +40 from prior 1340.)
 *   - intlAcceptanceRate: 41.8   -> null   (CDS 2024-25 C1 residency breakdown
 *                          NOT REPORTED — Auburn only publishes total
 *                          applicants/admits/enrolled with gender split, no
 *                          in-state/OOS/international disaggregation. Prior
 *                          41.8% was HEURISTIC/PERMANENT_HEURISTIC with no
 *                          source URL — not authoritative. Cleared to null
 *                          and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *   - oosAcceptanceRate : 41.8   -> null   (CDS 2024-25 C1 residency NOT
 *                          REPORTED. Auburn is PUBLIC and oosAR would normally
 *                          carry a real OFFICIAL number, but the CDS section
 *                          is institutionally blank (not refused — simply not
 *                          published). Prior 41.8% was HEURISTIC. Cleared to
 *                          null with UNAVAILABLE/OFFICIAL_BLANK_SECTION per
 *                          closure-pipeline convention for public schools with
 *                          blank C1 residency sections.)
 *   - edAcceptanceRate  : null   -> null   (CDS C21: "No" — Auburn does not
 *                          offer ED. Field stays cleared
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION. Provenance
 *                          refreshed to verified 2024-25 cycle pull.)
 *   - eaAcceptanceRate  : 39     -> null   (CDS C22: "Yes" — Auburn offers EA
 *                          (closing 11/1) BUT CDS C22 does not require nor
 *                          publish EA applicant/admit counts and Auburn
 *                          provides none. Prior 39.0% was TAVILY_ENRICHMENT
 *                          whose own provenance note says "no EA counts in
 *                          CDS" — erroneous extraction. Cleared to null and
 *                          marked UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
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
  'https://auburn.edu/administration/ir/common-data-set/2024/section-c.html';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ini000wz0ti57rv9m9o';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Auburn) not found`);
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
    generatedBy: 'phase3-auburn-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 45.93,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 25,284 admits / 55,056 applicants = 45.9281% (rounded to 45.93%). Tier upgraded from LEGACY_DB (value 46, sourceUrl pointed to collegekickstart.com aggregator) to OFFICIAL with minor precision adjustment.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1260,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1260 (reported directly; EBRW 630 + Math 620). CORRECTION UP from prior 1180 (LEGACY_DB heuristic). NOTE: Auburn is test-optional (CDS C8A "Consider if Submitted") — only 16% (954) submitted SAT; SAT band recorded for descriptive applicant-profile use, not as a gating threshold.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1380,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1380 (reported directly; EBRW 690 + Math 700). CORRECTION UP from prior 1340 (LEGACY_DB heuristic). Auburn test-optional: 16% submitted SAT, 76% submitted ACT (ACT Composite 25/75 = 26/31). SAT band descriptive only.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency breakdown NOT REPORTED — Auburn publishes only total first-time first-year applicants/admits/enrolled with gender split (Men 22,199/10,586; Women 32,855/14,698) and no in-state / out-of-state / international / unknown disaggregation. Prior DB value 41.8% was HEURISTIC/PERMANENT_HEURISTIC with no source URL — not authoritative. Cleared to null and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION per closure-pipeline convention.',
      realDataStatus: 'NOT_REPORTED',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency breakdown NOT REPORTED by Auburn (no in-state vs OOS sub-table). Auburn IS a public land-grant institution where in-state/OOS distinction normally carries policy meaning (different tuition, residency-preference considerations), so this field is in eligible scope and would normally carry an OFFICIAL number — but the CDS section is institutionally blank (not refused — simply not published). Prior DB value 41.8% was HEURISTIC/PERMANENT_HEURISTIC. Cleared to null and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION per closure-pipeline convention for public schools with blank C1 residency sections.',
      realDataStatus: 'NOT_REPORTED',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. Auburn does not offer Early Decision. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance refreshed to verified 2024-25 cycle pull. NOTE: existing DB hasEarlyDecision=true is STALE — being corrected to false in this update.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — YES checked (closing 11/1; notification 12/1; non-restrictive). However, CDS C22 does NOT require institutions to publish EA applicant/admit counts and Auburn provides none. Prior DB value 39.0% was from TAVILY_ENRICHMENT whose own provenance note explicitly states "no EA counts in CDS" — the 39.0% is an erroneous extraction artifact (likely a confusion with another statistic). Cleared to null and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION (EA program confirmed exists; admit numbers not officially published).',
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
      acceptanceRate: new Prisma.Decimal('45.93'),
      sat25: 1260,
      sat75: 1380,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — Auburn does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=45.93, sat25=1260, sat75=1380, intlAR=NOT_REPORTED, oosAR=NOT_REPORTED, edAR=NOT_OFFERED, eaAR=NOT_REPORTED, hasED=false)',
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
