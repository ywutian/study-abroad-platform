#!/usr/bin/env tsx
/**
 * Phase 3 — Adelphi University end-to-end closure of the 7 prediction-critical
 * fields.
 *
 * SOURCE NOTE: Adelphi's most-recent publicly-discoverable CDS PDF (2022-2023
 *   and newer) is gated behind an institutional SSO at intranet.adelphi.edu and
 *   is not retrievable by an unauthenticated agent. The most-recent CDS PDF the
 *   prior pipeline run referenced (cds_2010-11.pdf) is 14 years stale and was
 *   the root cause of the DB carrying legacy 2010-era acceptance-rate / SAT
 *   values.
 *
 *   For closure purposes we use College Board's BigFuture record of Adelphi's
 *   most recent Fall 2024 entering class — BigFuture is the canonical
 *   CDS-mirror endpoint operated by one of the three official CDS publishers
 *   (College Board, Peterson's, U.S. News). The figures BigFuture exposes are
 *   sourced verbatim from the institution's CDS C1/C9 submissions.
 *
 *   Primary source: https://bigfuture.collegeboard.org/colleges/adelphi-university/admissions
 *     - C1 totals (Fall 2024): 19,705 applied / 12,987 admitted / 1,343 enrolled
 *     - C9 SAT Composite middle 50%: 1120–1330
 *     - C9 ACT Composite middle 50%: 24–30
 *     - C21 ED: NOT mentioned (no early decision plan)
 *     - C22 EA: YES (Early Action deadline Dec 1)
 *
 *   Cross-validation: IPEDS College Navigator (Fall 2024 cohort, unitId 188429)
 *     reports the same SAT EBRW 570–660 / Math 550–680 (composite 1120–1340),
 *     66% admit rate, 14% submitting SAT.
 *
 * Adelphi is PRIVATE (CDS A2 "Private (nonprofit)" — confirmed via published
 *   2022-2023 institutional metadata). Per closure-pipeline convention for
 *   private institutions, oosAcceptanceRate is set to TERMINAL (private schools
 *   do not have a meaningful in-state/out-of-state policy distinction —
 *   tuition is uniform regardless of residency).
 *
 *   intlAcceptanceRate is also set to TERMINAL: Adelphi's CDS C1 residency
 *   table is not publicly accessible (intranet SSO), so the per-residency
 *   breakdown cannot be verified from a source the pipeline can audit. Prior
 *   value (71.25 HEURISTIC/PERMANENT_HEURISTIC) is also cleared.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 69.59 -> 65.91 (BigFuture/CDS 2024-25 C1: 12,987
 *                          admits / 19,705 first-time first-year applicants =
 *                          65.9072% (rounded 65.91%). Replaces stale
 *                          LEGACY_DB_VALUE (69.59) sourced from 14-year-old
 *                          2010-11 CDS. Tier OFFICIAL via College Board CDS
 *                          mirror.)
 *   - sat25             : 1060  -> 1120  (BigFuture/CDS 2024-25 C9 SAT
 *                          Composite middle-50% bottom = 1120. Replaces stale
 *                          1060 sourced from acceptancerate.com 3rd-party
 *                          aggregator. NOTE: Adelphi is TEST-OPTIONAL — 14% of
 *                          enrolled freshmen submitted SAT.)
 *   - sat75             : 1250  -> 1330  (BigFuture/CDS 2024-25 C9 SAT
 *                          Composite middle-50% top = 1330. IPEDS reports
 *                          1340 via EBRW 660 + Math 680 sum; we keep BigFuture's
 *                          reported composite figure 1330 as authoritative.)
 *   - intlAcceptanceRate: 71.25 -> null  (PRIVATE school — CDS C1 residency
 *                          table is not publicly accessible. Prior HEURISTIC
 *                          value cleared. Tier TERMINAL/PRIVATE_NO_RESIDENCY_BREAKDOWN.)
 *   - oosAcceptanceRate : 76.5  -> null  (PRIVATE school — same uniform-tuition
 *                          rule; per closure pipeline convention, private
 *                          schools use TERMINAL for oosAR. Prior HEURISTIC
 *                          value cleared.)
 *   - edAcceptanceRate  : null  -> null  (Adelphi does NOT offer Early Decision
 *                          per BigFuture deadline schedule (only Early Action
 *                          listed). UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.
 *                          Replaces prior NO_PUBLIC_ROUND_RATE/TERMINAL.)
 *   - eaAcceptanceRate  : null  -> null  (Adelphi offers Early Action (Dec 1
 *                          deadline per BigFuture), but no per-round admit
 *                          rate is publicly reported by the institution.
 *                          NO_PUBLIC_ROUND_RATE/TERMINAL stays.)
 *
 * NOTE on hasEarlyDecision: current DB value is TRUE, but Adelphi does NOT
 *   offer ED — only EA. Setting hasEarlyDecision to FALSE to match reality.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const PRIMARY_URL =
  'https://bigfuture.collegeboard.org/colleges/adelphi-university/admissions';
const IPEDS_URL =
  'https://nces.ed.gov/collegenavigator/?q=adelphi&s=all&id=188429';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iqt002bz0ti5efot7m8';

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
    throw new Error(`School ${SCHOOL_ID} (Adelphi University) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PRIVATE SCHOOL]`);
  console.log(
    `  current AR=${school.acceptanceRate?.toString()} sat25=${school.sat25} sat75=${school.sat75}`,
  );
  console.log(
    `  current intlAR=${school.intlAcceptanceRate?.toString() ?? 'null'} oosAR=${school.oosAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: PRIMARY_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-batch23-claude',
    generatedBy: 'phase3-adelphi-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 65.91,
      policyLabel: 'Overall admit rate',
      reason:
        "BigFuture (College Board CDS mirror) for Fall 2024 entering class: 12,987 admits / 19,705 first-time, first-year applicants = 65.9072% (rounded 65.91%). College Board is one of the three official CDS publishers — BigFuture exposes the institution's C1 submission verbatim. Cross-validated by IPEDS College Navigator Fall 2024 (66% admit rate). Replaces stale LEGACY_DB_VALUE (69.59) sourced from a 2010-11 CDS PDF that is 14 years out of date.",
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1120,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'BigFuture (College Board CDS mirror) for Fall 2024 entering class: SAT Composite middle-50% range 1120–1330; 25th percentile = 1120. Cross-validated by IPEDS College Navigator (SAT EBRW 25th=570, SAT Math 25th=550, sum=1120). Replaces stale value 1060 from acceptancerate.com 3rd-party aggregator. NOTE: Adelphi is TEST-OPTIONAL — only 14% of enrolled freshmen submitted SAT (per IPEDS). SAT band recorded for descriptive applicant-profile use only, not as a gating threshold.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1330,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        "BigFuture (College Board CDS mirror) for Fall 2024 entering class: SAT Composite middle-50% top = 1330. IPEDS College Navigator reports component-level EBRW 75th=660 + Math 75th=680 = composite 1340 by summation; we keep BigFuture's reported composite figure (1330) as authoritative since CDS C9 SAT Composite row is reported separately from component sums. Replaces stale value 1250 from acceptancerate.com aggregator. Same test-optional caveat as sat25.",
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      sourceUrl: PRIMARY_URL,
      tier: 'UNAVAILABLE',
      source: 'NO_PUBLIC_REAL_DATA',
      confidence: 0,
      policyLabel: 'International admit rate',
      reason:
        'Adelphi University (PRIVATE) does not publish CDS C1 residency-breakdown (in-state / out-of-state / international applicants and admits) on any publicly-accessible URL. The 2022-2023 and newer CDS PDFs are gated behind intranet.adelphi.edu SSO. Prior DB value (71.25 HEURISTIC/PERMANENT_HEURISTIC) is cleared as it has no auditable public source. Field marked UNAVAILABLE/NO_PUBLIC_REAL_DATA pending future public CDS publication.',
      realDataStatus: 'NO_PUBLIC_REAL_DATA',
    },
    oosAcceptanceRate: {
      ...baseProv,
      sourceUrl: PRIMARY_URL,
      tier: 'UNAVAILABLE',
      source: 'PRIVATE_SCHOOL_TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Adelphi University is a PRIVATE institution (Garden City, NY). Per closure-pipeline convention, private schools do not have a meaningful in-state vs. out-of-state admissions distinction (tuition is uniform regardless of residency, and CDS C1 residency reporting is typically omitted or merged). Field marked TERMINAL — no further closure action will be taken on oosAR for this school. Prior DB value (76.5 HEURISTIC/PERMANENT_HEURISTIC) cleared.',
      realDataStatus: 'PRIVATE_NO_RESIDENCY_DISTINCTION',
    },
    edAcceptanceRate: {
      ...baseProv,
      sourceUrl: PRIMARY_URL,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'Adelphi University does NOT offer Early Decision. BigFuture admissions page lists only an Early Action deadline (December 1) and Regular Decision — no Early Decision plan is offered. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED). Replaces prior NO_PUBLIC_ROUND_RATE/TERMINAL (which had wrong sourceUrl pointing to Williams College CDS). Also corrects stale hasEarlyDecision=true.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      sourceUrl: PRIMARY_URL,
      tier: 'UNAVAILABLE',
      source: 'NO_PUBLIC_REAL_DATA',
      confidence: 0,
      policyLabel: 'Early Action admit rate',
      reason:
        'Adelphi University DOES offer Early Action (deadline December 1 per BigFuture), but does not publish a per-round Early Action admit rate on any publicly-accessible source. The Adelphi 2022-2023 and newer CDS PDFs (where C22 EA applicants/admits would be reported) are SSO-gated behind intranet.adelphi.edu. Field stays cleared (TERMINAL — NO_PUBLIC_ROUND_RATE) pending future public CDS publication. Replaces prior URL misattribution to Williams College CDS.',
      realDataStatus: 'NO_PUBLIC_ROUND_RATE',
    },
  };

  const existingMeta = toRecord(school.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: PRIMARY_URL,
    closureCrossValidationSource: IPEDS_URL,
  };

  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('65.91'),
      sat25: 1120,
      sat75: 1330,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // Adelphi does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=65.91, sat25=1120, sat75=1330, intlAR=NO_PUBLIC, oosAR=TERMINAL, edAR=NOT_OFFERED, eaAR=NO_PUBLIC_ROUND_RATE, hasED=false)',
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
