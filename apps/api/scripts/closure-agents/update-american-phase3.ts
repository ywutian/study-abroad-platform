#!/usr/bin/env tsx
/**
 * Phase 3 — American University end-to-end closure of the 7 prediction-critical
 * fields.
 *
 * Source: American University CDS 2025-2026 (Fall 2025 entering class) —
 *   most recent posted, dated 04-23-26 by AU Office of Institutional Research.
 *   URL: https://www.american.edu/provost/oira/upload/CDS-PDF-2025-2026_PDF_American-University_WEB_FINAL_04-23-26.pdf
 *   Index: https://www.american.edu/provost/oira/common-data-set.cfm
 *
 * NOTE: American University is a private research university (CDS A2 "Private
 * (nonprofit)").
 *   - isPrivate=true  ->  oosAcceptanceRate is OUT OF SCOPE per closure-pipeline
 *     convention; field marked UNAVAILABLE/TERMINAL even though CDS C1
 *     residency does report OOS numbers (the in-state/out-of-state distinction
 *     carries no policy meaning for a DC-based private institution).
 *
 * American University is **test-optional** (CDS C8A: SAT/ACT "Not required for
 * admission, but consider if submitted"). Per closure-pipeline convention, the
 * reported CDS C9 SAT Composite percentiles are still recorded as OFFICIAL for
 * descriptive applicant-profile use.
 *
 * American University offers BOTH Early Decision (ED I + ED II) and Early
 * Action (CDS C21 "Yes", C22 "Yes"). However, the CDS 2025-26 form reports only
 * combined ED applicants/admits for the Fall 2024 entering class (392 apps /
 * 316 admits = 80.61%) and does NOT report EA applicant/admit numbers in the
 * visible C22 section (only the EA dates: 11/1 close, 1/31 notification). EA is
 * marked UNAVAILABLE/OFFICIAL_BLANK_SECTION (offered but not reported).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 55      -> 65.56  (CDS 2025-26 C1: 13,741 admits /
 *                          20,960 applicants = 65.5630%. BIG UPWARD CORRECTION
 *                          +10.56pp from prior LEGACY_DB 55 (collegekickstart
 *                          aggregator value). Tier LEGACY_DB->OFFICIAL.)
 *   - sat25             : 1280    -> 1320   (CDS 2025-26 C9: SAT Composite
 *                          25th = 1320 reported. CORRECTION UP +40 from prior
 *                          1280 (SEED/PR-15 heuristic). EBRW 630 + Math 680 sum
 *                          = 1310 differs because composite quantiles ≠ section
 *                          sums.)
 *   - sat75             : 1460    -> 1440   (CDS 2025-26 C9: SAT Composite
 *                          75th = 1440 reported. CORRECTION DOWN -20 from
 *                          prior 1460 (SEED/PR-15 heuristic). EBRW 710 + Math
 *                          740 sum = 1450 differs.)
 *   - intlAcceptanceRate: 42.02   -> 50.50  (CDS 2025-26 C1 residency: 655
 *                          intl admits / 1,297 intl applicants = 50.5012%.
 *                          BIG UPWARD CORRECTION +8.48pp from prior LEGACY_DB
 *                          42.02. Tier LEGACY_DB->OFFICIAL.)
 *   - oosAcceptanceRate : 63.81   -> null   (American is a private university;
 *                          in-state/out-of-state distinction carries no policy
 *                          meaning. CDS C1 residency does report OOS (12,864
 *                          admits / 19,194 applicants = 67.02%), but per
 *                          closure-pipeline convention, private schools ->
 *                          UNAVAILABLE/TERMINAL. Prior legacy DB value 63.81
 *                          cleared.)
 *   - edAcceptanceRate  : 43.14   -> 80.61  (CDS 2025-26 C21: ED offered
 *                          ("Yes") with two plans — ED I 11/1 close, 12/31
 *                          notification; ED II 1/15 close, 2/15 notification.
 *                          Reported Fall 2024 entering class combined ED:
 *                          316 admits / 392 applications = 80.6122% (rounded
 *                          to 80.61%). BIG UPWARD CORRECTION +37.47pp from
 *                          prior LEGACY_DB 43.14. (Caveat: the AU CDS form
 *                          reports a single combined ED block for "Number of
 *                          early decision applications received" with no
 *                          per-plan split; treating as the canonical ED total
 *                          per CDS C21 instructions.) Tier LEGACY_DB->OFFICIAL.)
 *   - eaAcceptanceRate  : 63.81   -> null   (CDS 2025-26 C22: EA offered
 *                          ("Yes") — nonbinding, non-restrictive, 11/1 close,
 *                          1/31 notification. However, AU does NOT report any
 *                          EA applicants/admits numbers in the visible C22
 *                          section of the CDS form (only the dates). Field
 *                          cleared from prior legacy 63.81 (which was a
 *                          duplicate of the oosAR value via TAVILY_ENRICHMENT
 *                          and is clearly spurious). Marked UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION — EA is offered but numbers
 *                          not reported by the institution.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.american.edu/provost/oira/upload/CDS-PDF-2025-2026_PDF_American-University_WEB_FINAL_04-23-26.pdf';
const CYCLE_YEAR = 2025; // CDS 2025-2026 = Fall 2025 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ity003tz0tie2nazej1';

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
    throw new Error(`School ${SCHOOL_ID} (American University) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}`);
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
    generatedBy: 'phase3-american-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 65.56,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2025-26 Section C1: 13,741 admits (4605 men + 9129 women + 7 unknown) / 20,960 applicants (7241 men + 13697 women + 22 unknown) = 65.5630% (rounded to 65.56%). BIG UPWARD CORRECTION +10.56pp from prior LEGACY_DB 55 (collegekickstart aggregator). Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1320,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2025-26 Section C9: SAT Composite 25th = 1320 reported directly. EBRW 630 + Math 680 sum = 1310 differs because composite quantiles ≠ section sums. CORRECTION UP +40 from prior 1280 (SEED/PR-15 heuristic). NOTE: AU is test-optional (CDS C8A "Not required for admission, but consider if submitted"); SAT band recorded for descriptive applicant-profile use, not as a gating threshold. 15.92% (246) of Fall 2025 enrolled submitted SAT.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1440,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2025-26 Section C9: SAT Composite 75th = 1440 reported directly. EBRW 710 + Math 740 sum = 1450 differs because composite quantiles ≠ section sums. CORRECTION DOWN -20 from prior 1460 (SEED/PR-15 heuristic). NOTE: AU is test-optional; SAT band is descriptive only.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 50.5,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2025-26 Section C1 residency table: 655 international admits / 1,297 international applicants = 50.5012% (rounded to 50.50%). BIG UPWARD CORRECTION +8.48pp from prior LEGACY_DB 42.02. Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'American University is a private (nonprofit) research university (CDS A2 "Private (nonprofit)"); in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage, no residency-based admit pathway). CDS C1 residency table does report OOS (12,864 admits / 19,194 applicants = 67.0210%), but the value is not actionable for applicants. Prior legacy DB value (63.81%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 80.61,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2025-26 Section C21: American offers Early Decision ("Yes" checked) with two plans — ED I closes 11/1 (12/31 notification), ED II closes 1/15 (2/15 notification). Reported Fall 2024 entering class combined ED totals: 316 admits / 392 applications = 80.6122% (rounded to 80.61%). The AU CDS reports a single combined ED block without per-plan split; treating as the canonical ED admit rate per CDS C21 instructions. BIG UPWARD CORRECTION +37.47pp from prior LEGACY_DB 43.14. Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2025-26 Section C22: American offers a nonbinding (non-restrictive) Early Action plan ("Yes" checked) — closes 11/1, notification 1/31. However, AU does NOT report any EA applicants/admits numbers in the visible C22 section (only the dates). Prior legacy DB value 63.81 was a spurious duplicate of the oosAR value (sourced via TAVILY_ENRICHMENT) and has been cleared. Field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION — EA is offered but numbers not reported by the institution in the CDS form.',
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

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('65.56'),
      sat25: 1320,
      sat75: 1440,
      intlAcceptanceRate: new Prisma.Decimal('50.50'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('80.61'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true, // CDS C21 "Yes" — re-confirm
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=65.56, sat25=1320, sat75=1440, intlAR=50.50, oosAR=N/A, edAR=80.61, eaAR=BLANK_SECTION)',
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
