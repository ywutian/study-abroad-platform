#!/usr/bin/env tsx
/**
 * Phase 3 — Louisiana State University (LSU, public flagship Louisiana)
 * End-to-end closure of the 7 prediction-critical fields.
 *
 * Source: LSU CDS 2024-2025, Section C (Admissions PDF, "3_2425_admissions.pdf").
 *   The user-supplied root URL https://www.lsu.edu/ir/cds/cds_2024_2025.pdf 404s.
 *   Authoritative split-section file: 3_2425_admissions.pdf (located via
 *   WebSearch site:lsu.edu, confirmed reachable; CDS index lives at
 *   https://www.lsu.edu/data/common-data-set/).
 *
 * LSU is public (isPrivate=false) — oosAcceptanceRate IS in eligible scope
 * and carries a real OFFICIAL number from CDS C1 residency table.
 *
 * Test policy: C8A SAT/ACT "Not required for admission, but considered if
 * submitted" — test-optional. C9 SAT Composite percentiles still recorded as
 * OFFICIAL for descriptive applicant-profile use (not a gating threshold).
 *
 * Value changes:
 *   - acceptanceRate    : 73.3   -> 73.33   (CDS C1: 34,513 admits / 47,065
 *                          applicants = 73.3290%, rounded 73.33%. Tier
 *                          LEGACY_DB -> OFFICIAL; trivial precision upgrade.)
 *   - sat25             : 1180   -> 1180    (CDS C9 SAT Composite 25th =
 *                          1180; no change in value, refresh provenance to
 *                          cycle-2024 OFFICIAL. Already closed at OFFICIAL.)
 *   - sat75             : 1320   -> 1320    (CDS C9 SAT Composite 75th =
 *                          1320; no change in value, refresh provenance.)
 *   - intlAcceptanceRate: 47.8   -> 47.81   (CDS C1 residency: 752 intl
 *                          admits / 1,573 intl applicants = 47.8067%,
 *                          rounded 47.81%. Tier LEGACY_DB -> OFFICIAL.)
 *   - oosAcceptanceRate : 72.3   -> 72.29   (CDS C1 residency: 24,838 OOS
 *                          admits / 34,357 OOS applicants = 72.2937%,
 *                          rounded 72.29%. Tier LEGACY_DB -> OFFICIAL.
 *                          PUBLIC FLAGSHIP — oosAR carries the real number,
 *                          never TERMINAL.)
 *   - edAcceptanceRate  : null   -> null    (CDS C21 = "No" — LSU does not
 *                          offer ED. Already UNAVAILABLE/OFFICIAL_BLANK_
 *                          SECTION; refresh reason to NOT_OFFERED + 2024-25
 *                          cycle.)
 *   - eaAcceptanceRate  : 75     -> null    (CDS C22 = "No" — LSU does not
 *                          offer EA. Prior value 75 was from TAVILY_
 *                          ENRICHMENT (likely Tavily mis-classified a regular
 *                          rolling-admit notification as EA). CORRECTION:
 *                          clear DB value to null, downgrade tier to
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *
 * Note on hasEarlyDecision: current DB value is true, but CDS C21 = "No".
 *   Setting to false to match CDS reality (same fix as Cal Poly SLO).
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.lsu.edu/data/common-data-set/2024/3_2425_admissions.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iq1001yz0ti1jb6g7hi';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (LSU) not found`);
  console.log(`Updating ${school.name} (${school.id}) [public]`);

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-lsu-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 73.33,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 34,513 admits / 47,065 applicants = 73.3290% (rounded to 73.33%). Tier upgraded from LEGACY_DB (value 73.3) to OFFICIAL with trivial precision refresh.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1180,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1180 (reported directly). Same value as prior cycle; provenance refreshed to 2024-25 OFFICIAL. NOTE: LSU is test-optional (CDS C8A SAT/ACT "Not required for admission, but considered if submitted"); SAT band is recorded for descriptive applicant-profile use, not as a gating threshold.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1320,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1320 (reported directly). Same value as prior cycle; provenance refreshed to 2024-25 OFFICIAL. NOTE: LSU is test-optional (CDS C8A "Not required for admission, but considered if submitted").',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 47.81,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 752 international admits / 1,573 international applicants = 47.8067% (rounded to 47.81%). Tier upgraded from LEGACY_DB (value 47.8) to OFFICIAL with trivial precision refresh.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 72.29,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 24,838 out-of-state admits / 34,357 out-of-state applicants = 72.2937% (rounded to 72.29%). LSU is a PUBLIC FLAGSHIP institution — in-state vs. out-of-state distinction carries real policy meaning (different tuition, residency-preference pathways), so this field is in eligible scope and MUST carry a real CDS number. Tier upgraded from LEGACY_DB (value 72.3) to OFFICIAL with trivial precision refresh.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. LSU does not offer Early Decision. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance refreshed to 2024-25 cycle, realDataStatus tightened to NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. LSU does not offer Early Action. CORRECTION: prior DB value 75 (sourced from TAVILY_ENRICHMENT 2026-05) was incorrect — Tavily likely mis-classified LSU\'s rolling-admit notification (C16 "On a rolling basis beginning 15-Oct" per CDS) as Early Action. Clearing DB value to null and downgrading tier to UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
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

  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('73.33'),
      sat25: 1180,
      sat75: 1320,
      intlAcceptanceRate: new Prisma.Decimal('47.81'),
      oosAcceptanceRate: new Prisma.Decimal('72.29'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated (AR=73.33, sat25=1180, sat75=1320, intlAR=47.81, oosAR=72.29, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
  console.log('=== After update ===');
  console.log(
    `  AR=${after?.acceptanceRate?.toString()} sat25=${after?.sat25} sat75=${after?.sat75} intlAR=${after?.intlAcceptanceRate?.toString()} oosAR=${after?.oosAcceptanceRate?.toString()} edAR=${after?.edAcceptanceRate?.toString() ?? 'null'} eaAR=${after?.eaAcceptanceRate?.toString() ?? 'null'} hasED=${after?.hasEarlyDecision}`,
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
