#!/usr/bin/env tsx
/**
 * Phase 3 — Rowan University end-to-end closure of the 7 prediction-critical
 * fields.
 *
 * Source: Rowan University CDS 2024-2025 (Update 11/6/2025; Fall 2024 entering
 *   class), published by the Office of Institutional Research & Analytics.
 *   URL: https://sites.rowan.edu/academic-affairs/oira/_docs/rowan_university_cds.pdf
 *   Landing: https://sites.rowan.edu/academic-affairs/oira/
 *
 * Rowan is PUBLIC (CDS A2 "Public" checked) — oosAR is in eligible scope and
 *   carries the real CDS number, not TERMINAL.
 *
 * Rowan is TEST-OPTIONAL for Fall 2026 admission (CDS C8A: SAT/ACT "Not
 *   required for admission, but consider if submitted"). 27.3% of enrolled
 *   freshmen (957) submitted SAT, 1.6% submitted ACT. SAT band recorded as
 *   OFFICIAL for descriptive applicant-profile use.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 78.3  -> 78.30 (CDS 2024-25 C1: 14,696 admits /
 *                          18,768 first-time first-year applicants = 78.3027%
 *                          (rounded 78.30%). Tier upgraded LEGACY_DB_VALUE ->
 *                          OFFICIAL with minor precision adjustment 78.3 -> 78.30.)
 *   - sat25             : 1120  -> 1120  (CDS 2024-25 C9 SAT Composite 25th =
 *                          1120 (reported directly). NO CHANGE in value — tier
 *                          upgraded OFFICIAL CDS_PDF_AUTO (prepscholar 3rd-party
 *                          URL) -> OFFICIAL CDS_OFFICIAL (canonical CDS PDF).)
 *   - sat75             : 1310  -> 1310  (CDS 2024-25 C9 SAT Composite 75th =
 *                          1310 (reported directly). NO CHANGE in value — tier
 *                          upgraded.)
 *   - intlAcceptanceRate: 65.9  -> 65.90 (CDS 2024-25 C1 residency table: 827
 *                          intl admits / 1,255 intl applicants = 65.8964%
 *                          (rounded 65.90%). Tier upgraded LEGACY_DB_VALUE ->
 *                          OFFICIAL with minor precision adjustment 65.9 -> 65.90.)
 *   - oosAcceptanceRate : 71.91 -> 71.91 (CDS 2024-25 C1 residency table: 1,902
 *                          OOS admits / 2,645 OOS applicants = 71.9093%
 *                          (rounded 71.91%). PUBLIC SCHOOL — oosAR is real
 *                          OFFICIAL. NO CHANGE in value. Tier upgraded.)
 *   - edAcceptanceRate  : null  -> null  (CDS 2024-25 C21: "No" — Rowan does
 *                          NOT offer Early Decision. Replace prior provenance
 *                          (source=CDS_LLM_EXTRACT_2026_04 marked OFFICIAL
 *                          despite value=null) with explicit UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : null  -> null  (CDS 2024-25 C22: "No" — Rowan does
 *                          NOT offer Early Action. Same correction.)
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
  'https://sites.rowan.edu/academic-affairs/oira/_docs/rowan_university_cds.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iqr002az0ti1une85dx';

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
    throw new Error(`School ${SCHOOL_ID} (Rowan University) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC SCHOOL]`);
  console.log(
    `  current AR=${school.acceptanceRate?.toString()} sat25=${school.sat25} sat75=${school.sat75}`,
  );

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-batch23-claude',
    generatedBy: 'phase3-rowan-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 78.3,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 14,696 admits / 18,768 first-time, first-year applicants = 78.3027% (rounded 78.30%). Tier upgraded from LEGACY_DB_VALUE (78.3) to OFFICIAL with minor precision adjustment.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1120,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1120 (reported directly). NO CHANGE in value — tier upgraded; previous OFFICIAL claim used CDS_PDF_AUTO with prepscholar.com 3rd-party URL, now replaced with canonical Rowan-published CDS PDF. NOTE: Rowan is TEST-OPTIONAL (CDS C8A: SAT/ACT "Not required for admission, but consider if submitted"); 27.3% of enrolled freshmen (957) submitted SAT, 1.6% submitted ACT — SAT band recorded for descriptive applicant-profile use only, not as a gating threshold.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1310,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1310 (reported directly). NO CHANGE in value — tier upgraded; previous OFFICIAL claim used CDS_PDF_AUTO with prepscholar.com 3rd-party URL, now replaced with canonical Rowan CDS PDF. Same test-optional caveat as sat25.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 65.9,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 827 international admits / 1,255 international applicants = 65.8964% (rounded 65.90%). Tier upgraded from LEGACY_DB_VALUE (65.9) to OFFICIAL with minor precision adjustment.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 71.91,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 1,902 out-of-state admits / 2,645 out-of-state applicants = 71.9093% (rounded 71.91%). Rowan is a PUBLIC research university (Glassboro, NJ) — in-state vs. out-of-state distinction carries policy meaning (different NJ resident tuition vs. non-resident tuition). NO CHANGE in value — tier upgraded from LEGACY_DB_VALUE to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. Rowan does NOT offer Early Decision. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Replaces prior provenance (source=CDS_LLM_EXTRACT_2026_04 marked OFFICIAL despite value=null). Also corrects stale hasEarlyDecision=true.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. Rowan does NOT offer Early Action. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Replaces prior CDS_LLM_EXTRACT_2026_04 OFFICIAL-marked-null.',
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
      acceptanceRate: new Prisma.Decimal('78.30'),
      sat25: 1120,
      sat75: 1310,
      intlAcceptanceRate: new Prisma.Decimal('65.90'),
      oosAcceptanceRate: new Prisma.Decimal('71.91'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=78.30, sat25=1120, sat75=1310, intlAR=65.90, oosAR=71.91, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
