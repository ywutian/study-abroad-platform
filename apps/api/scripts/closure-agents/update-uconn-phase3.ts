#!/usr/bin/env tsx
/**
 * Phase 3 (batch13) — University of Connecticut end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: UConn CDS 2024-2025 (Fall 2024 entering class)
 *   URL: https://bpir.media.uconn.edu/wp-content/uploads/sites/3452/2025/07/UConn_CDS_2024_2025.pdf
 *   Index: https://bpir.uconn.edu/home/institutional-research/data-resources/common-data-set/
 *
 * NOTE: UConn is PUBLIC (A2: Public, state flagship of Connecticut).
 *   - isPrivate=false  ->  oosAcceptanceRate is in eligible scope.
 *   - HOWEVER, the UConn CDS C1 table does NOT publish an applicant/admit
 *     residency breakdown (no in-state vs out-of-state vs international
 *     applicant/admit table). Only B2 enrollment lists Nonresidents counts
 *     (351 first-time, post-enrollment). Therefore oosAR and intlAR are
 *     marked UNAVAILABLE/OFFICIAL_BLANK_SECTION (the CDS section exists but
 *     is intentionally blank — UConn elects not to report this breakdown).
 *
 * Test policy: C8A — SAT or ACT "Not required for admission, but considered
 *   if submitted" (test-optional). C8F: UConn became test-optional starting
 *   Fall 2021 through next five admission cycles. C9 SAT Composite quantiles
 *   recorded as OFFICIAL for descriptive applicant-profile use.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 52.4    -> 52.39   (CDS 2024-25 Section C1: 29,065
 *                          admits (11,403 men + 17,652 women + 10 another gender
 *                          + 0 unknown) / 55,479 applicants (23,683 + 31,770 + 24
 *                          + 2) = 52.3892%. Minor precision shift, tier
 *                          LEGACY_DB->OFFICIAL.)
 *   - sat25             : 1250    -> 1220    (CDS C9 SAT Composite 25th = 1220
 *                          reported directly. CORRECTION DOWN -30 from prior
 *                          1250 (LEGACY_DB). 1,614 students (36% enrolled)
 *                          submitted SAT scores. Tier LEGACY_DB->OFFICIAL.)
 *   - sat75             : 1400    -> 1420    (CDS C9 SAT Composite 75th = 1420
 *                          reported directly. CORRECTION UP +20 from prior 1400
 *                          (LEGACY_DB). Tier LEGACY_DB->OFFICIAL.)
 *   - intlAcceptanceRate: 69.1    -> null    (CDS C1 does NOT publish an
 *                          applicant residency table. Field cleared;
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION. Prior 69.1
 *                          (LEGACY_DB) appears to be Class of 2025 era and is
 *                          not from the current CDS.)
 *   - oosAcceptanceRate : 56.2    -> null    (Same — CDS C1 does NOT publish
 *                          applicant residency table. Field cleared;
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION. Prior 56.2
 *                          (LEGACY_DB) is stale Class of 2025 figure.)
 *   - edAcceptanceRate  : 60      -> null    (CDS C21: "Does your institution
 *                          offer an early decision plan?" — NO checked. UConn
 *                          does NOT offer Early Decision (the prior value 60
 *                          from TAVILY_ENRICHMENT 2024 was incorrect / stale).
 *                          Field cleared; UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *   - eaAcceptanceRate  : null    -> null    (CDS C22: "Do you have a
 *                          nonbinding early action plan?" — NO checked. UConn
 *                          does NOT offer Early Action. Field stays cleared;
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION. Prior provenance
 *                          had source=CDS_LLM_EXTRACT_2026_04 with value=undefined
 *                          — refreshed to authoritative CDS pull marked
 *                          NOT_OFFERED.)
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
  'https://bpir.media.uconn.edu/wp-content/uploads/sites/3452/2025/07/UConn_CDS_2024_2025.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8imj000dz0tif3r9fq0l';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UConn) not found`);
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
    verifiedBy: 'closure-pipeline-phase3-batch13-claude',
    generatedBy: 'phase3-batch13-uconn-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 52.39,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 29,065 admits (11,403 men + 17,652 women + 10 another gender + 0 unknown) / 55,479 applicants (23,683 men + 31,770 women + 24 another gender + 2 unknown) = 52.3892% (rounded to 52.39%). Tier upgraded from LEGACY_DB (value 52.4) to OFFICIAL with minor precision adjustment.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1220,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1220 (reported directly). CORRECTION DOWN from prior 1250 (LEGACY_DB). NOTE: UConn is test-optional (C8A "Not required for admission, but considered if submitted"; test-optional since Fall 2021); 36% of Fall 2024 enrolled (1,614 students) submitted SAT.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1420,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1420 (reported directly). CORRECTION UP from prior 1400 (LEGACY_DB). NOTE: UConn is test-optional; SAT band recorded for descriptive applicant-profile use only, not as a gating threshold.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 does NOT publish an applicant residency breakdown (no in-state vs out-of-state vs international applicant/admit table) — only B2 enrollment lists 351 first-time Nonresidents (post-enrollment, not applicants/admits). Therefore intl admit rate cannot be computed from CDS. Field cleared; UNAVAILABLE/OFFICIAL_BLANK_SECTION. Prior LEGACY_DB value 69.1 appears to be Class of 2025 era figure not from the current CDS.',
      realDataStatus: 'NOT_PUBLISHED',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'UConn is a PUBLIC institution (A2: Public, Connecticut state flagship) — in-state vs. out-of-state distinction carries real policy meaning (different tuition tier). However, CDS 2024-25 Section C1 does NOT publish an applicant residency breakdown (no in-state vs out-of-state applicant/admit table). Therefore OOS admit rate cannot be computed from CDS. Field cleared; UNAVAILABLE/OFFICIAL_BLANK_SECTION. Prior LEGACY_DB value 56.2 is stale Class of 2025 era figure. Per closure-pipeline convention, when an institution does not publish a residency breakdown in CDS C1, the field is OFFICIAL_BLANK_SECTION (not TERMINAL — public schools never go TERMINAL on OOS).',
      realDataStatus: 'NOT_PUBLISHED',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. UConn does NOT offer Early Decision. Field cleared; UNAVAILABLE/OFFICIAL_BLANK_SECTION. Prior DB value 60 (TAVILY_ENRICHMENT 2024) was incorrect / stale and is replaced. (Note: C2107 lists ED closing date "November 1st" / notification "Mid December" but the C21 Yes/No question itself is checked NO, and the counts table is blank, indicating UConn does not actually run an ED program for the Fall 2024 cycle.)',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. UConn does NOT offer Early Action. Field stays cleared; UNAVAILABLE/OFFICIAL_BLANK_SECTION. Provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 (with value=undefined) to authoritative CDS pull marked NOT_OFFERED.',
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
      acceptanceRate: new Prisma.Decimal('52.39'),
      sat25: 1220,
      sat75: 1420,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — UConn does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=52.39, sat25=1220, sat75=1420, intlAR=NOT_PUBLISHED, oosAR=NOT_PUBLISHED, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
