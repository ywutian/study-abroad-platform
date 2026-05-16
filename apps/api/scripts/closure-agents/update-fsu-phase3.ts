#!/usr/bin/env tsx
/**
 * Phase 3 — Florida State University (Public, Tallahassee, FL)
 *
 * Source: Florida State University Common Data Set 2024-2025 (Fall 2024
 *   entering class), Section C — First-Time, First-Year (Freshman) Admission.
 *   Office of Institutional Research hosts the CDS as a server-rendered HTML
 *   report behind an ASP.NET dropdown selector (no static PDF). Canonical
 *   landing URL: https://ir.fsu.edu/commondataset.aspx (selection cdsYear=2024-25,
 *   cdsSection=C). For provenance we use the section-specific deep link.
 *
 *   URL (Section C): https://ir.fsu.edu/commondataset.aspx?cdsYear=2024-25&cdsSection=C
 *
 *   Pre-existing DB sourceUrls were INCORRECT — `floridagators.com/.../2024-25_UF_MBK_Quick_Facts.pdf`
 *   is a UNIVERSITY OF FLORIDA men's basketball quick-facts sheet, not a CDS,
 *   and `nextgenadmit.com/florida-state-admission-statistics/` is a third-party
 *   aggregator. Both must be replaced with the authoritative FSU IR CDS.
 *
 * NOTE: FSU is a PUBLIC institution (CDS A2 "Public" checked; isPrivate=false).
 *   - oosAR is in eligible scope; carries real OFFICIAL number from C1.
 *   - C1 residency table IS populated by FSU with full in-state / OOS /
 *     international / unknown disaggregation.
 *
 * FSU is NOT test-optional. Per CDS C8A "SAT or ACT Required to be considered
 * for admission" (FL Board of Governors Reg. 6.002). SAT 25/75 are gating-
 * relevant test bands and carry OFFICIAL tier as usual.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 24      -> 24.21  (CDS 2024-25 C1: 18,954 admits /
 *                          78,272 applicants = 24.2141%. Minor precision
 *                          upgrade. Tier LEGACY_DB (sourceUrl=nextgenadmit.com)
 *                          -> OFFICIAL. URL FIX: nextgenadmit aggregator ->
 *                          FSU IR CDS.)
 *   - sat25             : 1240   -> 1290   (CDS 2024-25 C9: SAT Composite 25th
 *                          = 1290 (reported directly; EBRW 640 + Math 630).
 *                          CORRECTION UP +50 from prior 1240 (LEGACY_DB). Tier
 *                          LEGACY_DB -> OFFICIAL. 63.9% (3,487) submitted SAT.)
 *   - sat75             : 1380   -> 1400   (CDS 2024-25 C9: SAT Composite 75th
 *                          = 1400 (reported directly; EBRW 710 + Math 700).
 *                          CORRECTION UP +20 from prior 1380. Tier LEGACY_DB
 *                          -> OFFICIAL.)
 *   - intlAcceptanceRate: 17.57  -> 10.55  (CDS 2024-25 C1 residency table:
 *                          538 international admits / 5,098 international
 *                          applicants = 10.5532%. SIGNIFICANT DOWNWARD
 *                          CORRECTION from prior 17.57% (HEURISTIC,
 *                          PERMANENT_HEURISTIC, no source URL). Tier
 *                          HEURISTIC -> OFFICIAL.)
 *   - oosAcceptanceRate : 13.36  -> 16.58  (CDS 2024-25 C1 residency table:
 *                          5,308 OOS admits / 32,018 OOS applicants =
 *                          16.5782%. UPWARD CORRECTION from prior 13.36%
 *                          (HEURISTIC). FSU is a PUBLIC SUS institution —
 *                          in-state (FL) vs OOS distinction carries real
 *                          policy meaning (different tuition, Bright Futures
 *                          eligibility) so this field MUST carry a real CDS
 *                          number. Tier HEURISTIC -> OFFICIAL.)
 *   - edAcceptanceRate  : null   -> null   (CDS 2024-25 C21: "No" — FSU does
 *                          not offer Early Decision. Field stays cleared
 *                          (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance
 *                          refreshed from a stale 2024 UF basketball-PDF URL
 *                          to the correct FSU IR CDS C section. NOTE: existing
 *                          DB hasEarlyDecision=true is STALE — corrected to
 *                          false.)
 *   - eaAcceptanceRate  : 38.3   -> null   (CDS 2024-25 C22: "Yes" — FSU
 *                          offers Early Action (closing 10/15; notification
 *                          12/11; non-restrictive). However, CDS C22 does NOT
 *                          require institutions to publish EA applicant/admit
 *                          counts and FSU provides none in C22. Prior DB value
 *                          38.3% was from TAVILY_ENRICHMENT pointing at a
 *                          UNIVERSITY OF FLORIDA men's basketball quick-facts
 *                          PDF — a clear cross-institution / cross-domain
 *                          extraction error. Cleared to null and marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION (EA program
 *                          confirmed exists; admit numbers not officially
 *                          published).)
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
  'https://ir.fsu.edu/commondataset.aspx?cdsYear=2024-25&cdsSection=C';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iny0016z0tiikip2622';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (FSU) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC]`);
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
    generatedBy: 'phase3-fsu-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 24.21,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 18,954 admits / 78,272 applicants = 24.2141% (rounded to 24.21%). Tier upgraded from LEGACY_DB (value 24, sourceUrl pointed to nextgenadmit.com aggregator) to OFFICIAL. Source URL corrected to FSU IR CDS.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1290,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1290 (reported directly; EBRW 640 + Math 630). CORRECTION UP +50 from prior 1240 (LEGACY_DB heuristic). 63.9% (3,487 of 5,455) of enrolled FTICs submitted SAT scores. FSU is NOT test-optional — per CDS C8A "SAT or ACT Required to be considered for admission" (FL Board of Governors Reg. 6.002); SAT band is a gating-relevant applicant profile metric.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1400,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1400 (reported directly; EBRW 710 + Math 700). CORRECTION UP +20 from prior 1380 (LEGACY_DB). FSU is NOT test-optional (CDS C8A "Required"); SAT band gating-relevant.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 10.55,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 538 international admits / 5,098 international applicants = 10.5532% (rounded to 10.55%). SIGNIFICANT DOWNWARD CORRECTION from prior 17.57% (HEURISTIC/PERMANENT_HEURISTIC, no source URL — not authoritative). Tier upgraded HEURISTIC -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 16.58,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 5,308 out-of-state admits / 32,018 OOS applicants = 16.5782% (rounded to 16.58%). UPWARD CORRECTION from prior 13.36% (HEURISTIC/PERMANENT_HEURISTIC, no source URL). FSU is a PUBLIC FL State University System institution — in-state (FL) vs out-of-state distinction carries real policy meaning (different tuition tiers; Bright Futures scholarship eligibility) so this field is in eligible scope and MUST carry a real CDS number. (In-state context: 13,108 admits / 41,156 applicants = 31.85% — sharply higher than OOS, consistent with public-school residency preference.) Tier HEURISTIC -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. FSU does not offer Early Decision. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance refreshed from a stale "2024-25_UF_MBK_Quick_Facts.pdf" URL (UNIVERSITY OF FLORIDA men\'s basketball — wrong institution) to the correct FSU IR CDS Section C link. NOTE: existing DB hasEarlyDecision=true is STALE — being corrected to false in this update.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — YES checked (closing 10/15; notification 12/11; non-restrictive). However, CDS C22 does NOT require institutions to publish EA applicant/admit counts (the section only asks for dates and the restrictive-plan flag) and FSU provides none. Prior DB value 38.3% was from TAVILY_ENRICHMENT whose sourceUrl pointed at a UNIVERSITY OF FLORIDA men\'s basketball quick-facts PDF — a clear cross-institution / cross-domain extraction error. Cleared to null and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION (EA program confirmed exists; admit numbers not officially published).',
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
      acceptanceRate: new Prisma.Decimal('24.21'),
      sat25: 1290,
      sat75: 1400,
      intlAcceptanceRate: new Prisma.Decimal('10.55'),
      oosAcceptanceRate: new Prisma.Decimal('16.58'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — FSU does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=24.21, sat25=1290, sat75=1400, intlAR=10.55, oosAR=16.58, edAR=NOT_OFFERED, eaAR=NOT_REPORTED, hasED=false)',
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
