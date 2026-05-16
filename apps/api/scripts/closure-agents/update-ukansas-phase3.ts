#!/usr/bin/env tsx
/**
 * Phase 3 — University of Kansas (KU) end-to-end closure of the 7 prediction-
 * critical fields.
 *
 * Source: KU CDS 2024-2025 (Fall 2024 entering class) — published Oct 2024 by
 *   the Analytics, Institutional Research, & Effectiveness (AIRE) office.
 *   URL: https://aire.ku.edu/sites/air/files/files/CDS/KUCDS_2024_2025.pdf
 *   Landing: https://irds.ku.edu/common-data-set (redirects to aire.ku.edu)
 *   Index: https://aire.ku.edu/common-data-set
 *
 * KU is a PUBLIC research university (CDS A2 "Public" checked) — oosAR is in
 * eligible scope and carries the real CDS number, not TERMINAL.
 *
 * KU is test-optional with assured-admission tiers (CDS C8A "Not required for
 * admission, but considered for some"). SAT/ACT scores reported in C9 are
 * recorded as OFFICIAL for descriptive applicant-profile use.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 93.5  -> 93.48 (CDS 2024-25 C1: 22,363 apps / 20,905
 *                          admits = 93.4842%. Rounded to 93.48. Minor precision
 *                          shift, tier LEGACY_DB_VALUE -> OFFICIAL.)
 *   - sat25             : 1100  -> 1090  (CDS 2024-25 C9: SAT Composite 25th
 *                          = 1090 reported. CORRECTION DOWN -10 from prior
 *                          1100. NOTE: only 8.6% (456) of enrolled freshmen
 *                          submitted SAT — ACT-dominant (55.2%, 2939).)
 *   - sat75             : 1310  -> 1280  (CDS 2024-25 C9: SAT Composite 75th
 *                          = 1280 reported. CORRECTION DOWN -30 from prior
 *                          1310.)
 *   - intlAcceptanceRate: 93.3  -> 93.35 (CDS 2024-25 C1 residency: 491 intl
 *                          admits / 526 intl applicants = 93.3460%. Minor
 *                          precision shift, tier LEGACY_DB -> OFFICIAL.)
 *   - oosAcceptanceRate : 93    -> 93.05 (CDS 2024-25 C1 residency: 13,495
 *                          OOS admits / 14,503 OOS applicants = 93.0497%.
 *                          Tier LEGACY_DB -> OFFICIAL. PUBLIC SCHOOL —
 *                          oosAR is a real OFFICIAL number.)
 *   - edAcceptanceRate  : null  -> null  (CDS 2024-25 C21: "No" — KU does
 *                          not offer Early Decision. UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION/NOT_OFFERED. Refresh
 *                          provenance.)
 *   - eaAcceptanceRate  : null  -> null  (CDS 2024-25 C22: "No" — KU does
 *                          not offer Early Action. UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION/NOT_OFFERED. Refresh
 *                          provenance.)
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
  'https://aire.ku.edu/sites/air/files/files/CDS/KUCDS_2024_2025.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8io8001cz0tivir7q6ki';

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
    throw new Error(`School ${SCHOOL_ID} (University of Kansas) not found`);
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
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-ukansas-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 93.48,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 22,363 total first-time freshman applications / 20,905 admits = 93.4842% (rounded to 93.48%). Tier upgraded from LEGACY_DB_VALUE (93.5) to OFFICIAL with minor precision adjustment.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1090,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1090 (reported directly; EBRW 540 + Math 530 = 1070 differs because composite quantiles do not equal section sums). CORRECTION DOWN from prior 1100. NOTE: only 8.6% (456 enrolled freshmen) submitted SAT — KU is ACT-dominant (55.2%, 2,939 submitting ACT; ACT Composite 25/50/75 = 21/25/28). KU CDS C8A: "Not required for admission, but considered for some" — assured-admission tiers based on GPA + ACT/SAT.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1280,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1280 (reported directly; EBRW 650 + Math 650 = 1300 differs because composite quantiles do not equal section sums). CORRECTION DOWN from prior 1310. Same submission-rate caveat as sat25.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 93.35,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 491 international admits / 526 international applicants = 93.3460% (rounded to 93.35%). Minor precision shift from prior LEGACY_DB_VALUE 93.3; tier upgraded to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 93.05,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 13,495 out-of-state admits / 14,503 out-of-state applicants = 93.0497% (rounded to 93.05%). KU is a PUBLIC research university (Kansas land-grant, Lawrence campus) — in-state vs. out-of-state distinction carries policy meaning (different tuition, residency-preference assured-admission thresholds). Tier upgraded from LEGACY_DB_VALUE (93) to OFFICIAL with minor precision shift.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. KU does not offer Early Decision (rolling admission with priority date Dec 1 for institutional scholarships). Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Provenance refreshed to authoritative CDS_OFFICIAL pull; corrects stale hasEarlyDecision=true.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. KU does not offer Early Action. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Provenance refreshed to authoritative CDS_OFFICIAL pull.',
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
      acceptanceRate: new Prisma.Decimal('93.48'),
      sat25: 1090,
      sat75: 1280,
      intlAcceptanceRate: new Prisma.Decimal('93.35'),
      oosAcceptanceRate: new Prisma.Decimal('93.05'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — KU does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=93.48, sat25=1090, sat75=1280, intlAR=93.35, oosAR=93.05, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
