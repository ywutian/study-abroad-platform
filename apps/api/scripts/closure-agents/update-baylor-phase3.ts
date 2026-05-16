#!/usr/bin/env tsx
/**
 * Phase 3 — Baylor University end-to-end closure of the 7 prediction-critical
 * fields.
 *
 * Source: Baylor University CDS 2024-2025 (Fall 2024 entering class).
 *   URL: https://ir.web.baylor.edu/sites/g/files/ecbvkj1621/files/2025-04/CDS-2024-2025-Baylor%20University.pdf
 *   Index: https://ir.web.baylor.edu/institutional-research
 *
 * NOTE: Baylor is a private (Baptist) research university.
 *   - isPrivate=true  ->  oosAcceptanceRate is OUT OF SCOPE per closure-pipeline
 *     convention; field marked UNAVAILABLE/TERMINAL even though CDS C1
 *     residency does report OOS numbers (Baylor reports a substantial
 *     in-state Texan applicant pool, but in-state/out-of-state distinction
 *     carries no policy meaning for a private institution).
 *
 * Baylor is **test-optional** (CDS C8A: SAT/ACT "Not required for admission,
 * but consider if submitted"). Per closure-pipeline convention, the reported
 * CDS C9 SAT Composite percentiles are still recorded as OFFICIAL for
 * descriptive applicant-profile use.
 *
 * IMPORTANT — CORRECTION TO USER ASSUMPTION: Baylor DOES offer Early Decision
 * (CDS C21 "Yes" checked, single ED plan, 11/1 close, 12/15 notification).
 * Baylor also offers Early Action (CDS C22 "Yes" nonbinding, non-restrictive,
 * 11/1 close, 2/1 notification). EA numbers are NOT reported in the CDS form
 * (only dates).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 51.28   -> 51.28  (CDS 2024-25 C1: 24,075 admits
 *                          (10124 men + 13950 women + 1 unknown) / 46,946
 *                          applicants (17823 men + 29114 women + 9 unknown) =
 *                          51.2843% (rounded to 51.28%). Value matches prior
 *                          DB; tier upgraded LEGACY_DB -> OFFICIAL.)
 *   - sat25             : 1200    -> 1160   (CDS 2024-25 C9: SAT Composite
 *                          25th = 1160 reported directly. CORRECTION DOWN -40
 *                          from prior 1200 (SEED/PR-15 heuristic). EBRW 580 +
 *                          Math 570 sum = 1150 differs because composite
 *                          quantiles ≠ section sums.)
 *   - sat75             : 1400    -> 1340   (CDS 2024-25 C9: SAT Composite
 *                          75th = 1340 reported directly. CORRECTION DOWN -60
 *                          from prior 1400 (SEED/PR-15 heuristic). EBRW 680 +
 *                          Math 680 sum = 1360 differs.)
 *   - intlAcceptanceRate: 52.4    -> 52.40  (CDS 2024-25 C1 residency: 1,749
 *                          intl admits / 3,338 intl applicants = 52.3966%
 *                          (rounded to 52.40%). Value matches prior DB; tier
 *                          upgraded LEGACY_DB -> OFFICIAL.)
 *   - oosAcceptanceRate : 53.21   -> null   (Baylor is a private institution;
 *                          in-state / out-of-state distinction carries no
 *                          policy meaning. CDS C1 residency does report OOS
 *                          (9,874 admits / 18,556 applicants = 53.2120%), but
 *                          the value is not actionable for applicants. Prior
 *                          legacy DB value (53.21%) cleared. Field marked
 *                          UNAVAILABLE-terminal per closure-pipeline convention
 *                          for private institutions.)
 *   - edAcceptanceRate  : 76.72   -> 76.72  (CDS 2024-25 C21: Baylor offers
 *                          Early Decision ("Yes" checked) — single binding ED
 *                          plan, closes 11/1, notification 12/15. Reported
 *                          Fall 2024 entering class: 491 admits / 640
 *                          applications = 76.7188% (rounded to 76.72%). Value
 *                          matches prior DB; tier upgraded LEGACY_DB ->
 *                          OFFICIAL with refreshed provenance.)
 *   - eaAcceptanceRate  : 76.7    -> null   (CDS 2024-25 C22: Baylor offers a
 *                          nonbinding (non-restrictive) Early Action plan
 *                          ("Yes" checked) — closes 11/1, notification 2/1.
 *                          However, Baylor does NOT report any EA applicants/
 *                          admits numbers in the visible C22 section (only the
 *                          dates). Prior legacy DB value 76.7 was a duplicate
 *                          of the edAR value (sourced via TAVILY_ENRICHMENT)
 *                          and has been cleared. Field marked UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION — EA is offered but numbers
 *                          not reported by the institution in the CDS form.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://ir.web.baylor.edu/sites/g/files/ecbvkj1621/files/2025-04/CDS-2024-2025-Baylor%20University.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8itw003sz0ti2fueoy2e';

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
    throw new Error(`School ${SCHOOL_ID} (Baylor University) not found`);
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
    generatedBy: 'phase3-baylor-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 51.28,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 24,075 admits (10124 men + 13950 women + 1 unknown) / 46,946 applicants (17823 men + 29114 women + 9 unknown) = 51.2843% (rounded to 51.28%). Value matches prior DB; tier upgraded LEGACY_DB -> OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1160,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1160 reported directly. EBRW 580 + Math 570 sum = 1150 differs because composite quantiles ≠ section sums. CORRECTION DOWN -40 from prior 1200 (SEED/PR-15 heuristic). NOTE: Baylor is test-optional (CDS C8A "Not required for admission, but consider if submitted"); SAT band recorded for descriptive applicant-profile use, not as a gating threshold. 43.95% (1506) of Fall 2024 enrolled submitted SAT.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1340,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1340 reported directly. EBRW 680 + Math 680 sum = 1360 differs because composite quantiles ≠ section sums. CORRECTION DOWN -60 from prior 1400 (SEED/PR-15 heuristic). NOTE: Baylor is test-optional; SAT band is descriptive only.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 52.4,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 1,749 international admits / 3,338 international applicants = 52.3966% (rounded to 52.40%). Value matches prior DB; tier upgraded LEGACY_DB -> OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Baylor University is a private (Baptist) research university; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage, no residency-based admit pathway). CDS C1 residency table does report OOS (9,874 admits / 18,556 applicants = 53.2120%), but the value is not actionable for applicants. Prior legacy DB value (53.21%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 76.72,
      policyLabel: 'Early Decision admit rate (single ED plan)',
      reason:
        'CDS 2024-25 Section C21: Baylor offers Early Decision ("Yes" checked) — single binding ED plan, closes 11/1, notification 12/15. Reported Fall 2024 entering class: 491 admits / 640 applications = 76.7188% (rounded to 76.72%). NOTE: Baylor confirms in the form ("Early Decision is a binding agreement for students who will commit to Baylor, if accepted"). Value matches prior DB; tier upgraded LEGACY_DB -> OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: Baylor offers a nonbinding (non-restrictive) Early Action plan ("Yes" checked) — closes 11/1, notification 2/1. However, Baylor does NOT report any EA applicants/admits numbers in the visible C22 section (only the dates). Prior legacy DB value 76.7 was a spurious duplicate of the edAR value (sourced via TAVILY_ENRICHMENT) and has been cleared. Field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION — EA is offered but numbers not reported by the institution in the CDS form.',
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
      acceptanceRate: new Prisma.Decimal('51.28'),
      sat25: 1160,
      sat75: 1340,
      intlAcceptanceRate: new Prisma.Decimal('52.40'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('76.72'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true, // CDS C21 "Yes" — re-confirm
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=51.28, sat25=1160, sat75=1340, intlAR=52.40, oosAR=N/A, edAR=76.72, eaAR=BLANK_SECTION)',
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
