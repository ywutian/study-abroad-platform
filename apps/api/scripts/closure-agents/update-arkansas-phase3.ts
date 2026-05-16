#!/usr/bin/env tsx
/**
 * Phase 3 — University of Arkansas (Fayetteville, public flagship Arkansas)
 * End-to-end closure of the 7 prediction-critical fields.
 *
 * Source: University of Arkansas CDS 2024-2025.
 *   The user-supplied URL was malformed; located via WebSearch with site
 *   restriction uark.edu:
 *     https://osai.uark.edu/datasets/cds/cds24-25v3.pdf
 *   Index: https://osai.uark.edu/datasets/cds/
 *
 * U. Arkansas is public (isPrivate=false) — oosAcceptanceRate IS in eligible
 * scope and carries a real OFFICIAL number from CDS C1 residency table.
 *
 * Test policy: C8A SAT/ACT "Required for some" — note that test scores are
 * Important (not Very Important) in C7. Recorded SAT band as OFFICIAL.
 *
 * NOTE on CDS C1 totals vs. residency table:
 *   Gender-aggregated C1 sums: 30,549 applied / 22,701 admitted (74.31%).
 *   Residency-aggregated table: 28,873 applied / 22,519 admitted (78.00%).
 *   The gap (≈1,676 applicants) is applicants for whom residency was not
 *   captured at application time. The CDS-canonical headline overall AR is
 *   the gender-total denominator (matches IPEDS conventions); residency
 *   ratios (in-state / OOS) are computed on the residency-table base.
 *
 * Value changes:
 *   - acceptanceRate    : 79     -> 74.31   (CDS C1 gender total: 22,701 /
 *                          30,549 = 74.3133%, rounded 74.31%. CORRECTION
 *                          DOWN from prior 79 (LEGACY_DB) — the prior was
 *                          a stale older-cycle estimate.)
 *   - sat25             : 1100   -> 1030    (CDS C9 SAT Composite 25th =
 *                          1030. CORRECTION DOWN from prior 1100 — prior
 *                          extraction may have inadvertently used ACT or an
 *                          older cycle. Tier remains OFFICIAL, source
 *                          refreshed to CDS_OFFICIAL 2024-25.)
 *   - sat75             : 1290   -> 1210    (CDS C9 SAT Composite 75th =
 *                          1210. CORRECTION DOWN from prior 1290 — same
 *                          rationale as sat25.)
 *   - intlAcceptanceRate: 75.05  -> null    (CDS C1 residency table:
 *                          International column shows "2" applicants only,
 *                          with admit/enroll cells blank. The international
 *                          residency category is effectively NOT
 *                          disaggregated in this institution's CDS report.
 *                          Prior 75.05 from PERMANENT_HEURISTIC has no
 *                          source backing. Clear value, mark UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION.)
 *   - oosAcceptanceRate : 76.46  -> 76.44   (CDS C1 residency: 15,953 OOS
 *                          admits / 20,869 OOS applicants = 76.4488%,
 *                          rounded 76.44%. Tier LEGACY_DB -> OFFICIAL with
 *                          trivial precision refresh. PUBLIC FLAGSHIP —
 *                          oosAR carries the real number, never TERMINAL.)
 *   - edAcceptanceRate  : null   -> null    (CDS C21 = "No" — U. Arkansas
 *                          does not offer ED. Already UNAVAILABLE/OFFICIAL_
 *                          BLANK_SECTION; refresh reason to NOT_OFFERED.)
 *   - eaAcceptanceRate  : 80.5   -> null    (CDS C22 = "Yes" — U. Arkansas
 *                          DOES offer EA (closing 11/1, notification 12/15,
 *                          non-restrictive), but the CDS does NOT report EA
 *                          applicant/admit counts. Prior DB value 80.5 from
 *                          TAVILY_ENRICHMENT 2026-05 has no official source
 *                          backing. CORRECTION: clear DB value to null,
 *                          mark UNAVAILABLE/OFFICIAL_BLANK_SECTION; EA is
 *                          offered but the CDS section is structurally
 *                          blank for the count breakdown.)
 *
 * NOTE on hasEarlyDecision: current DB value is true, but CDS C21 = "No".
 *   Setting to false to match CDS reality.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL = 'https://osai.uark.edu/datasets/cds/cds24-25v3.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iq40020z0tif8l8dxxu';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (U. Arkansas) not found`);
  console.log(`Updating ${school.name} (${school.id}) [public]`);

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-uark-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 74.31,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1 gender-aggregated totals: 22,701 admits / 30,549 applicants = 74.3133% (rounded to 74.31%). CORRECTION DOWN from prior LEGACY_DB value 79 (stale older-cycle estimate). Tier LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1030,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1030 (reported directly). CORRECTION DOWN from prior 1100 (cycle 2024 CDS_PDF_AUTO; the prior auto-extract appears to have used an inflated or non-composite value). Tier remains OFFICIAL, source refreshed to CDS_OFFICIAL 2024-25. NOTE: U. Arkansas is test-Required-for-some (CDS C8A); SAT band is descriptive applicant-profile data.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1210,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1210 (reported directly). CORRECTION DOWN from prior 1290 (same auto-extract rationale as sat25). Tier remains OFFICIAL, source refreshed to CDS_OFFICIAL 2024-25.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: the International column shows "2" in the applicants row with admit and enroll cells blank — international category is effectively NOT disaggregated in U. Arkansas CDS. Prior DB value 75.05 from PERMANENT_HEURISTIC (INFERRED tier) has no official source backing. CORRECTION: clear DB value to null, mark UNAVAILABLE/OFFICIAL_BLANK_SECTION. (U. Arkansas reports OOS vs. in-state breakdown only; international applicants appear pooled with OOS for residency purposes.)',
      realDataStatus: 'OFFICIAL_BLANK_SECTION',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 76.44,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 15,953 out-of-state admits / 20,869 out-of-state applicants = 76.4488% (rounded to 76.44%). U. Arkansas is a PUBLIC FLAGSHIP — in-state vs. out-of-state distinction carries real policy meaning, so this field MUST carry a real CDS number. Tier upgraded from LEGACY_DB (value 76.46) to OFFICIAL with trivial precision refresh.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. U. Arkansas does not offer Early Decision. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance refreshed to 2024-25 cycle, realDataStatus tightened to NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — YES checked (closing date 11/1, notification 12/15, non-restrictive). However, the CDS does NOT report EA applicant or admit counts (per-cycle EA breakdown is structurally blank in U. Arkansas CDS). Prior DB value 80.5 from TAVILY_ENRICHMENT 2026-05 has no official source backing. CORRECTION: clear DB value to null, mark UNAVAILABLE/OFFICIAL_BLANK_SECTION. EA is offered, but the CDS section for the count breakdown is blank.',
      realDataStatus: 'OFFICIAL_BLANK_SECTION',
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
      acceptanceRate: new Prisma.Decimal('74.31'),
      sat25: 1030,
      sat75: 1210,
      intlAcceptanceRate: null,
      oosAcceptanceRate: new Prisma.Decimal('76.44'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated (AR=74.31, sat25=1030, sat75=1210, intlAR=null/BLANK, oosAR=76.44, edAR=NOT_OFFERED, eaAR=BLANK_SECTION, hasED=false)',
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
    `  AR=${after?.acceptanceRate?.toString()} sat25=${after?.sat25} sat75=${after?.sat75} intlAR=${after?.intlAcceptanceRate?.toString() ?? 'null'} oosAR=${after?.oosAcceptanceRate?.toString()} edAR=${after?.edAcceptanceRate?.toString() ?? 'null'} eaAR=${after?.eaAcceptanceRate?.toString() ?? 'null'} hasED=${after?.hasEarlyDecision}`,
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
