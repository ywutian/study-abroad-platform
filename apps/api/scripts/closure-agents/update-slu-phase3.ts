#!/usr/bin/env tsx
/**
 * Phase 3 — Saint Louis University (SLU) end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: Saint Louis University CDS 2021-2022 (Fall 2021 entering class)
 *   — the MOST RECENT CDS publicly available from SLU's Office of
 *   Institutional Research as of 2026-05-16.
 *   URL: https://www.slu.edu/provost/office-of-institutional-research/institutional-data/2122cds.php
 *   Index: https://www.slu.edu/provost/office-of-institutional-research/institutional-data/index.php
 *
 * IMPORTANT: SLU has NOT publicly released a CDS for cycles 2022-23, 2023-24,
 *   or 2024-25 (verified 2026-05-16 via WebSearch limited to slu.edu domain
 *   and inspection of the OIR Institutional Data index page — the index lists
 *   only "2021-2022 Common Data Set"). The 2021-22 CDS is therefore the only
 *   primary source available for closure-pipeline OFFICIAL extraction, and
 *   even within that document several critical sections are BLANK:
 *     - C9 SAT/ACT percentile tables: ENTIRELY BLANK
 *     - C1 residency table (in-state / OOS / international): NOT REPORTED
 *       at the residency-breakdown level in 2021-22 (only F1 reports "61%
 *       from out of state" at a coarse profile level)
 *     - C21 ED counts: ED program "begins with the Fall 2022 entering class"
 *       (so no Fall 2021 ED applicants/admits exist by definition)
 *     - C22 EA counts: EA exists (Dec 1 close, Feb 1 notif, non-restrictive)
 *       but the CDS C22 template does NOT collect EA application/admit counts
 *
 * SLU is a private Jesuit research university (isPrivate=true). Per
 * closure-pipeline convention, oosAcceptanceRate is marked UNAVAILABLE/
 * TERMINAL — in-state vs. out-of-state distinction carries no policy meaning
 * for private institutions (no in-state tuition advantage).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 55       -> 70.05  (CDS 2021-22 C1: 10,540 admits /
 *                          15,047 applicants = 70.0472% (rounded to 70.05%).
 *                          Tier upgraded from LEGACY_DB (value 55, sourceUrl
 *                          NULL — no source attestation) to OFFICIAL with
 *                          cycleYear=2021 explicit. CORRECTION UP +15.05pp,
 *                          but flagged with OFFICIAL_STALE_CYCLE note: this
 *                          is the most recent CDS-attested figure available;
 *                          SLU has not published a 2022-23 or newer CDS.)
 *   - sat25             : 1200     -> null   (CDS 2021-22 C9: entire SAT/ACT
 *                          percentile table is BLANK. SLU is test-optional
 *                          (C8A "Consider if Submitted"). Prior DB value 1200
 *                          was SEED/PR-15 heuristic. Cleared to null and
 *                          marked UNAVAILABLE/OFFICIAL_BLANK_SECTION:
 *                          most recent SLU CDS has C9 blank.)
 *   - sat75             : 1410     -> null   (Same rationale as sat25.
 *                          Cleared to null and marked UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION.)
 *   - intlAcceptanceRate: 44       -> null   (CDS 2021-22 C1 does NOT report
 *                          a residency-level applications/admits breakdown
 *                          (only F1 profile-level "61% from out of state").
 *                          Prior DB value 44 was HEURISTIC. Cleared to null
 *                          and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION:
 *                          most recent SLU CDS lacks C1 residency breakdown.)
 *   - oosAcceptanceRate : 56.1     -> null   (SLU is private; in-state/OOS
 *                          distinction carries no policy meaning. Prior DB
 *                          value 56.1 was HEURISTIC. Cleared to null and
 *                          marked UNAVAILABLE/TERMINAL per closure-pipeline
 *                          convention for private institutions.)
 *   - edAcceptanceRate  : null     -> null   (CDS 2021-22 C21: ED program
 *                          "begins with the Fall 2022 entering class" — so
 *                          no Fall 2021 ED applicants/admits exist. SLU does
 *                          now offer ED (per C21 "Yes"), but the most recent
 *                          CDS-attested counts are absent. Field stays null,
 *                          marked UNAVAILABLE/OFFICIAL_BLANK_SECTION:
 *                          plan exists but no published count yet in
 *                          available CDS.)
 *   - eaAcceptanceRate  : null     -> null   (CDS 2021-22 C22: SLU offers
 *                          nonbinding EA ("Yes" checked; closing 12/1,
 *                          notification 2/1; not restrictive). However, the
 *                          CDS C22 template does NOT collect EA application/
 *                          admit counts — only plan existence and dates.
 *                          Field stays null. Provenance refreshed from prior
 *                          CDS_LLM_EXTRACT_2026_04 with explicit
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION rationale.)
 *
 * NOTE on hasEarlyDecision: current DB value is true. SLU's 2021-22 CDS C21
 *   reports "Yes" with the note "Early decision will begin with the Fall
 *   2022 entering class." Keeping hasEarlyDecision=true.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.slu.edu/provost/office-of-institutional-research/institutional-data/2122cds.php';
const CYCLE_YEAR = 2021; // CDS 2021-2022 = Fall 2021 entering class (most recent SLU CDS available)
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iua003xz0tio2zj4a4z';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (SLU) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PRIVATE]`);
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
    generatedBy: 'phase3-slu-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 70.05,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2021-22 Section C1: 10,540 admits / 15,047 applicants = 70.0472% (rounded to 70.05%). Tier upgraded from LEGACY_DB (value 55, sourceUrl NULL — no source attestation) to OFFICIAL with explicit cycleYear=2021. CORRECTION UP +15.05pp. NOTE: This is the most recent CDS-attested overall admit rate available — SLU has NOT publicly released CDS for cycles 2022-23, 2023-24, or 2024-25 (verified via WebSearch site:slu.edu and OIR index page inspection). Value flagged as OFFICIAL_STALE_CYCLE: best available CDS truth pending a newer SLU CDS publication.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'CDS 2021-22 Section C9 (SAT/ACT percentile table) is ENTIRELY BLANK — no SAT or ACT percentiles, score ranges, or submission counts reported. SLU is test-optional (CDS C8A "Consider if Submitted"; per C8F: "SLU is recently test-optional and test scores are considered if submitted"). Prior DB value 1200 was SEED/PR-15 heuristic with no CDS sourceUrl; cleared to null and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION. SLU has NOT publicly released a newer CDS (verified 2026-05-16 via WebSearch site:slu.edu — only 2021-22 CDS available); no OFFICIAL SAT percentile source can currently be attested.',
      realDataStatus: 'OFFICIAL_BLANK_SECTION',
    },
    sat75: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'CDS 2021-22 Section C9 is ENTIRELY BLANK — same rationale as sat25. Prior DB value 1410 was SEED/PR-15 heuristic; cleared to null and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION. SLU has not publicly released a newer CDS as of 2026-05-16.',
      realDataStatus: 'OFFICIAL_BLANK_SECTION',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2021-22 Section C1 does NOT report a residency-level applications/admits/enrolled breakdown by in-state/OOS/international (the 2021-22 CDS template predates the residency-breakdown subtable now standard in 2024-25 CDS). Section F1 reports a profile-level "61% from out of state" but does not give an international admit rate. Prior DB value 44 was PERMANENT_HEURISTIC with no CDS source. Cleared to null and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION: most recent SLU CDS lacks C1 residency breakdown; no OFFICIAL international admit rate can currently be attested.',
      realDataStatus: 'OFFICIAL_BLANK_SECTION',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Saint Louis University is a private Jesuit research university; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). Prior DB value 56.1 was PERMANENT_HEURISTIC with no CDS source. Cleared to null and marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2021-22 Section C21: SLU offers Early Decision ("Yes" checked) BUT the CDS explicitly notes "Early decision will begin with the Fall 2022 entering class" — so no Fall 2021 ED applicants/admits exist by definition (plan not yet active in cycle reported). SLU has NOT published a newer CDS (2022-23, 2023-24, 2024-25 all unavailable as of 2026-05-16), so post-launch ED counts are not CDS-attested. Field stays null. Provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 (value=undefined) to authoritative 2021-22 CDS pull marked UNAVAILABLE/OFFICIAL_BLANK_SECTION: plan exists but no published count in available CDS.',
      realDataStatus: 'NOT_PUBLISHED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2021-22 Section C22: SLU offers nonbinding Early Action ("Yes" checked; closing 12/1, notification 2/1; not restrictive). However, the CDS C22 template does NOT collect EA application/admit counts — only plan existence and dates. Field stays null. Provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 (value=undefined) to authoritative 2021-22 CDS pull marked UNAVAILABLE/OFFICIAL_BLANK_SECTION: plan exists but CDS does not publish admit numbers.',
      realDataStatus: 'NOT_PUBLISHED',
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
      acceptanceRate: new Prisma.Decimal('70.05'),
      sat25: null, // CDS 2021-22 C9 blank — test-optional, no scores reported
      sat75: null, // same
      intlAcceptanceRate: null, // 2021-22 CDS C1 lacks residency breakdown
      oosAcceptanceRate: null, // private — N/A
      edAcceptanceRate: null, // ED program begins F22 in 2021-22 CDS; no counts
      eaAcceptanceRate: null, // EA exists per C22 Yes but CDS doesn't publish counts
      hasEarlyDecision: true, // per CDS C21 Yes (plan exists)
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=70.05 OFFICIAL_STALE_CYCLE 2021-22, sat25/sat75=BLANK_SECTION, intlAR=BLANK_SECTION, oosAR=N/A private, edAR=BLANK_SECTION, eaAR=BLANK_SECTION, hasED=true)',
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
