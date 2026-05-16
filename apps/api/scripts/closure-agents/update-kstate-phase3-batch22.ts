#!/usr/bin/env tsx
/**
 * Phase 3 — Kansas State University (K-State) end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: K-State CDS 2024-2025 (Fall 2024 entering class) published by Data,
 *   Assessment and Institutional Research office.
 *   URL: https://www.k-state.edu/data/institutional-research/resources/common-data-set/CDS_2024_2025.pdf
 *   Landing: https://www.k-state.edu/data/institutional-research/resources/
 *
 * K-State is a PUBLIC land-grant research university (CDS A2 "Public" checked) —
 *   oosAR is in eligible scope and carries the real CDS number, not TERMINAL.
 *
 * K-State is TEST-BLIND for Fall 2026 admission (CDS C8A: SAT or ACT marked
 *   "Not considered for admission, even if submitted"; C8 "No" for SAT/ACT use
 *   in admission decisions). Per closure-pipeline convention, the reported CDS
 *   C9 SAT Composite percentiles are still recorded as OFFICIAL for descriptive
 *   applicant-profile use (not as a gating threshold).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 82    -> 81.99 (CDS 2024-25 C1: 12,653 admits /
 *                          15,432 applicants = 81.9919%. Tier LEGACY_DB_VALUE
 *                          -> OFFICIAL with minor precision adjustment.)
 *   - sat25             : 1060  -> 1060  (CDS 2024-25 C9 SAT Composite 25th =
 *                          1060. NO CHANGE — value already matches CDS. Tier
 *                          upgraded LEGACY_DB_VALUE -> OFFICIAL.)
 *   - sat75             : 1255  -> 1255  (CDS 2024-25 C9 SAT Composite 75th =
 *                          1255. NO CHANGE. Tier LEGACY_DB_VALUE -> OFFICIAL.
 *                          NOTE: only 6% (220 enrolled freshmen) submitted
 *                          SAT — ACT-dominant (81%, 2,812 submitting ACT;
 *                          ACT Composite 25/50/75 = 20/23/27).)
 *   - intlAcceptanceRate: 30.2  -> 30.24 (CDS 2024-25 C1 residency: 453 intl
 *                          admits / 1,498 intl applicants = 30.2403%. Tier
 *                          LEGACY_DB_VALUE -> OFFICIAL with minor precision
 *                          adjustment.)
 *   - oosAcceptanceRate : 84.3  -> 84.27 (CDS 2024-25 C1 residency: 6,365 OOS
 *                          admits / 7,553 OOS applicants = 84.2711%. Tier
 *                          LEGACY_DB_VALUE -> OFFICIAL with minor precision
 *                          adjustment. PUBLIC SCHOOL — oosAR is real OFFICIAL.)
 *   - edAcceptanceRate  : null  -> null  (CDS 2024-25 C21: "No" — K-State does
 *                          NOT offer Early Decision. Replace prior provenance
 *                          (source=CDS_LLM_EXTRACT_2026_04 tier OFFICIAL but
 *                          value=null) with explicit UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : null  -> null  (CDS 2024-25 C22: "No" — K-State does
 *                          NOT offer Early Action. Same correction as ED.)
 *
 * NOTE on hasEarlyDecision: current DB value is TRUE, but CDS C21 is "No".
 *   Setting to FALSE to match CDS reality.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.k-state.edu/data/institutional-research/resources/common-data-set/CDS_2024_2025.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iqc0023z0ti60klqjhy';

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
    throw new Error(`School ${SCHOOL_ID} (Kansas State University) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC SCHOOL]`);
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
    verifiedBy: 'closure-pipeline-phase3-batch22-claude',
    generatedBy: 'phase3-kstate-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 81.99,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 12,653 admits / 15,432 first-time, first-year applicants = 81.9919% (rounded to 81.99%). Tier upgraded from LEGACY_DB_VALUE (82) to OFFICIAL with minor precision adjustment.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1060,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1060 (reported directly). No change in value — tier upgraded from LEGACY_DB_VALUE to OFFICIAL. NOTE: K-State is TEST-BLIND (CDS C8A: SAT/ACT "Not considered for admission, even if submitted"); only 6% (220 enrolled freshmen) submitted SAT — ACT-dominant (81%, 2,812 ACT submitters; ACT Composite 25/50/75 = 20/23/27). SAT band is recorded for descriptive applicant-profile use only, not as a gating threshold.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1255,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1255 (reported directly). No change in value — tier upgraded from LEGACY_DB_VALUE to OFFICIAL. Same test-blind + low-SAT-submission caveat as sat25.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 30.24,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 453 international admits / 1,498 international applicants = 30.2403% (rounded to 30.24%). Tier upgraded from LEGACY_DB_VALUE (30.2) to OFFICIAL with minor precision adjustment.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 84.27,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 6,365 out-of-state admits / 7,553 out-of-state applicants = 84.2711% (rounded to 84.27%). K-State is a PUBLIC land-grant research university (Manhattan, KS) — in-state vs. out-of-state distinction carries policy meaning (different tuition, residency-preference scholarships). Tier upgraded from LEGACY_DB_VALUE (84.3) to OFFICIAL with minor precision shift.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. K-State does NOT offer Early Decision. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Replaces prior provenance (source=CDS_LLM_EXTRACT_2026_04 marked OFFICIAL despite value=null) with explicit blank-section marker. Also corrects stale hasEarlyDecision=true.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. K-State does NOT offer Early Action. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED).',
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
      acceptanceRate: new Prisma.Decimal('81.99'),
      sat25: 1060,
      sat75: 1255,
      intlAcceptanceRate: new Prisma.Decimal('30.24'),
      oosAcceptanceRate: new Prisma.Decimal('84.27'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — K-State does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=81.99, sat25=1060, sat75=1255, intlAR=30.24, oosAR=84.27, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
