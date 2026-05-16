#!/usr/bin/env tsx
/**
 * Phase 3 — Clemson University end-to-end closure of the 7 prediction-critical
 * fields.
 *
 * Source: Clemson University CDS 2024-2025 (Fall 2024 entering class).
 *   URL: https://open.clemson.edu/cgi/viewcontent.cgi?article=1016&context=cds
 *   Index: https://open.clemson.edu/cds/  (Clemson OPEN repository)
 *   Posted: 1-1-2025 by Office for Institutional Research (Nancy James,
 *   Institutional Data Coordinator).
 *
 * NOTE: Clemson is a PUBLIC research university (CDS A2 "Public").
 *   - isPrivate=false  ->  oosAcceptanceRate IS in eligible scope and MUST
 *     carry a real OFFICIAL number from CDS C1 residency table.
 *   - oosAR is NOT marked UNAVAILABLE/TERMINAL.
 *
 * Clemson is **test-optional** (CDS C8A "Not required for admission, but
 * consider if submitted"; C8F: "Clemson is test optional for fall of 2025. No
 * decision has been made for fall of 2026."). Per closure-pipeline convention,
 * the reported CDS C9 SAT Composite percentiles are still recorded as OFFICIAL
 * for descriptive applicant-profile use.
 *
 * IMPORTANT — CORRECTION TO USER ASSUMPTION (and to DB): Clemson does NOT
 * offer Early Decision (CDS C21 "No" checked, all date/number fields blank).
 * However, the existing DB had hasEarlyDecision=true — corrected to false.
 *
 * Clemson DOES offer Early Action (CDS C22 "Yes" nonbinding, non-restrictive,
 * 10/15 close, 12/15 notification). However, Clemson does NOT report any EA
 * applicants/admits numbers in the visible C22 section of the CDS form (only
 * the dates).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 38      -> 38.34  (CDS 2024-25 C1: 23,586 admits
 *                          (8572 men + 14573 women + 83 another + 358 unknown)
 *                          / 61,517 applicants (23737 men + 36761 women + 237
 *                          another + 782 unknown) = 38.3414% (rounded to
 *                          38.34%). Minor precision upgrade +0.34pp from
 *                          prior LEGACY_DB 38. Tier LEGACY_DB->OFFICIAL.
 *                          Prior sourceUrl pointed to admissionsight.com
 *                          aggregator — replaced with authoritative CDS.)
 *   - sat25             : 1250    -> 1250   (CDS 2024-25 C9: SAT Composite
 *                          25th = 1250 reported directly. Value matches prior
 *                          DB; tier upgraded LEGACY_DB->OFFICIAL. EBRW 620 +
 *                          Math 620 sum = 1240 differs because composite
 *                          quantiles ≠ section sums.)
 *   - sat75             : 1390    -> 1400   (CDS 2024-25 C9: SAT Composite
 *                          75th = 1400 reported directly. CORRECTION UP +10
 *                          from prior 1390. EBRW 700 + Math 710 sum = 1410
 *                          differs.)
 *   - intlAcceptanceRate: 35      -> 35.77  (CDS 2024-25 C1 residency table:
 *                          480 intl admits / 1,342 intl applicants = 35.7675%
 *                          (rounded to 35.77%). Minor precision upgrade
 *                          +0.77pp from prior LEGACY_DB 35. Tier upgraded
 *                          LEGACY_DB->OFFICIAL.)
 *   - oosAcceptanceRate : 35      -> 34.94  (CDS 2024-25 C1 residency table:
 *                          17,566 OOS admits / 50,273 OOS applicants =
 *                          34.9412% (rounded to 34.94%). NOTE: Clemson is
 *                          PUBLIC — OOS distinction is real (different
 *                          tuition, residency-preference admit pathway).
 *                          Existing DB had both intlAR and oosAR == 35 from
 *                          the same admissionsight.com aggregator —
 *                          coincidence; the real OOS rate is 34.94%.
 *                          Minor correction -0.06pp. Tier
 *                          LEGACY_DB->OFFICIAL. State residency is also CDS
 *                          C7 "Very Important" for Clemson admission.)
 *   - edAcceptanceRate  : undefined -> null  (CDS 2024-25 C21: "Does your
 *                          institution offer an early decision plan?" — NO
 *                          checked, all date/number fields blank. Clemson does
 *                          NOT offer ED. Existing DB provenance was
 *                          tier=OFFICIAL source=CDS_LLM_EXTRACT_2026_04 with
 *                          value=undefined — semantics preserved, source
 *                          refreshed to authoritative CDS pull marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.
 *                          hasEarlyDecision corrected from stale true to
 *                          false.)
 *   - eaAcceptanceRate  : 38.3    -> null   (CDS 2024-25 C22: Clemson offers
 *                          a nonbinding (non-restrictive) Early Action plan
 *                          ("Yes" checked) — closes 10/15, notification
 *                          12/15. However, Clemson does NOT report any EA
 *                          applicants/admits numbers in the visible C22
 *                          section (only the dates). Prior legacy DB value
 *                          38.3 (TAVILY_ENRICHMENT — approximates overall AR
 *                          and is not the actual EA rate) cleared. Field
 *                          marked UNAVAILABLE/OFFICIAL_BLANK_SECTION — EA is
 *                          offered but numbers not reported by the institution
 *                          in the CDS form.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://open.clemson.edu/cgi/viewcontent.cgi?article=1016&context=cds';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8in3000oz0tih36u19xf';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Clemson) not found`);
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
    generatedBy: 'phase3-clemson-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 38.34,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 23,586 admits (8572 men + 14573 women + 83 another + 358 unknown) / 61,517 applicants (23737 men + 36761 women + 237 another + 782 unknown) = 38.3414% (rounded to 38.34%). Minor precision upgrade +0.34pp from prior LEGACY_DB 38 (admissionsight.com aggregator). Tier upgraded LEGACY_DB -> OFFICIAL with authoritative source.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1250,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1250 reported directly. EBRW 620 + Math 620 sum = 1240 differs because composite quantiles ≠ section sums. Value matches prior DB; tier upgraded LEGACY_DB -> OFFICIAL. NOTE: Clemson is test-optional (CDS C8A "Not required for admission, but consider if submitted"; C8F: "Clemson is test optional for fall of 2025"); SAT band recorded for descriptive applicant-profile use, not as a gating threshold. 35% (1698) of Fall 2024 enrolled submitted SAT.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1400,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1400 reported directly. EBRW 700 + Math 710 sum = 1410 differs because composite quantiles ≠ section sums. CORRECTION UP +10 from prior 1390 (LEGACY_DB). Tier upgraded LEGACY_DB -> OFFICIAL. NOTE: Clemson is test-optional; SAT band is descriptive only.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 35.77,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 480 international admits / 1,342 international applicants = 35.7675% (rounded to 35.77%). Minor precision upgrade +0.77pp from prior LEGACY_DB 35 (admissionsight.com aggregator). Tier upgraded LEGACY_DB -> OFFICIAL with authoritative source.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 34.94,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 17,566 out-of-state admits / 50,273 out-of-state applicants = 34.9412% (rounded to 34.94%). Clemson is a PUBLIC institution (CDS A2 "Public") — in-state vs. out-of-state distinction carries real policy meaning (different tuition, residency-preference admit pathway; CDS C7 lists State Residency as "Very Important" for Clemson admission). NOTE: Prior DB had intlAR=35 and oosAR=35 (identical) from the same admissionsight.com aggregator — coincidence; the real OOS rate per CDS is 34.94%. Minor correction -0.06pp. Tier upgraded LEGACY_DB -> OFFICIAL. (Confirms public-school convention: oosAR carries the real number, never marked TERMINAL.)',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked, all date/number fields blank. Clemson does NOT offer Early Decision. DB value was already null/undefined; provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 (with value=undefined) to authoritative CDS_OFFICIAL pull marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED. hasEarlyDecision flag corrected from stale true to false to match CDS reality.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: Clemson offers a nonbinding (non-restrictive) Early Action plan ("Yes" checked) — closes 10/15, notification 12/15. However, Clemson does NOT report any EA applicants/admits numbers in the visible C22 section (only the dates). Prior legacy DB value 38.3 (TAVILY_ENRICHMENT — approximates the overall AR and is not the actual EA rate) cleared. Field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION — EA is offered but numbers not reported by the institution in the CDS form.',
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
      acceptanceRate: new Prisma.Decimal('38.34'),
      sat25: 1250,
      sat75: 1400,
      intlAcceptanceRate: new Prisma.Decimal('35.77'),
      oosAcceptanceRate: new Prisma.Decimal('34.94'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — Clemson does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=38.34, sat25=1250, sat75=1400, intlAR=35.77, oosAR=34.94, edAR=NOT_OFFERED, eaAR=BLANK_SECTION, hasED=false)',
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
