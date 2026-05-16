#!/usr/bin/env tsx
/**
 * Phase 3 — Bowdoin College end-to-end closure of the 7 prediction-critical
 * fields.
 *
 * Source: Bowdoin College CDS 2024-2025 (parsed by Claude from PDF)
 *   URL: https://www.bowdoin.edu/ir/pdf/bowdoin-cds_2024-2025.pdf
 *
 * All 7 fields upgraded to OFFICIAL (or UNAVAILABLE-terminal where Bowdoin
 * structurally cannot publish the value).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 6.97     → 7.13   (CDS C1 Total: 946 admits / 13,265
 *                          applicants = 7.1316%. Rounded to 7.13.
 *                          Tier upgraded LEGACY_DB (sourceUrl pointed to
 *                          collegekickstart.com aggregator) → OFFICIAL.
 *                          CORRECTION UP +0.16pp.)
 *   - sat25             : 1460     → 1470  (CDS C9: SAT Composite 25th = 1470
 *                          reported directly; EBRW 730 + Math 740 sum = 1470.
 *                          CORRECTION UP +10 from prior 1460
 *                          (SEED/PR-15 heuristic).)
 *   - sat75             : 1570     → 1540  (CDS C9: SAT Composite 75th = 1540
 *                          reported directly; EBRW 770 + Math 780 sum = 1550
 *                          differs because composite quantiles ≠ section sums.
 *                          CORRECTION DOWN -30 from prior 1570
 *                          (SEED/PR-15 heuristic).)
 *   - intlAcceptanceRate: 1.44     → 1.44   (CDS C1 residency: 77 intl admits /
 *                          5,347 intl applicants = 1.4400%. Value matches
 *                          prior DB; tier upgraded LEGACY_DB → OFFICIAL.)
 *   - oosAcceptanceRate : 10.8     → null   (Bowdoin is a private LAC; in-
 *                          state / out-of-state distinction carries no policy
 *                          meaning. CDS C1 residency does report OOS (804/7443
 *                          = 10.80%) but per closure-pipeline convention,
 *                          private schools → UNAVAILABLE/TERMINAL. Prior legacy
 *                          DB value cleared.)
 *   - edAcceptanceRate  : 13.47    → 13.47  (CDS C21: ED offered ("Yes"
 *                          checked); two plans — ED I 11/15 closing, 12/15
 *                          notification; ED II 1/5 closing, 2/15
 *                          notification. Fall 2024 entering class combined
 *                          totals: 270 admits / 2,005 ED applications =
 *                          13.4664% (rounded to 13.47%). Value matches prior
 *                          DB; provenance refreshed to closure-pipeline-phase3
 *                          CDS_OFFICIAL with current cycle metadata.)
 *   - eaAcceptanceRate  : null     → null   (CDS C22: Bowdoin does NOT offer a
 *                          nonbinding Early Action plan ("No" checked).
 *                          Field stays null. Existing provenance had
 *                          tier=OFFICIAL source=CDS_LLM_EXTRACT_2026_04 with
 *                          value=undefined — semantics preserved, source
 *                          refreshed to authoritative CDS pull marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const BOWDOIN_CDS_URL =
  'https://www.bowdoin.edu/ir/pdf/bowdoin-cds_2024-2025.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const bowdoin = await prisma.school.findFirst({
    where: { id: 'cmnwr8iuy0047z0tijtdlowua' },
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
  if (!bowdoin) throw new Error('Bowdoin College not found');
  console.log(`Updating ${bowdoin.name} (${bowdoin.id})`);
  console.log(
    `  current AR=${bowdoin.acceptanceRate?.toString()} sat25=${bowdoin.sat25} sat75=${bowdoin.sat75}`,
  );
  console.log(
    `  current intlAR=${bowdoin.intlAcceptanceRate?.toString()} oosAR=${bowdoin.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${bowdoin.edAcceptanceRate?.toString()} eaAR=${bowdoin.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: BOWDOIN_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-bowdoin-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 7.13,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 946 admits / 13,265 applicants = 7.1316% (rounded to 7.13%). Tier upgraded from LEGACY_DB (value 6.97, sourceUrl pointed to collegekickstart.com aggregator — not Bowdoin) to OFFICIAL. CORRECTION UP +0.16pp.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1470,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1470 (reported directly; EBRW 730 + Math 740 sum = 1470 also coincides). CORRECTION UP from prior 1460 (SEED/PR-15 heuristic). 31.16% of Fall 2024 enrolled (158 students) submitted SAT under test-optional policy.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1540,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1540 (reported directly; EBRW 770 + Math 780 sum = 1550 differs because composite quantiles ≠ section sums). CORRECTION DOWN from prior 1570 (SEED/PR-15 heuristic).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1.44,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 77 international admits / 5,347 international applicants = 1.4400% (rounded to 1.44%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Bowdoin College is a private liberal arts college; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table does report OOS (804 admits / 7,443 applicants = 10.8021%), but the value is not actionable for applicants. Prior legacy DB value (10.8%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 13.47,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2024-25 Section C21: Bowdoin offers Early Decision ("Yes" checked) with two plans — ED I closes 11/15 (12/15 notification), ED II closes 1/5 (2/15 notification). Fall 2024 entering class combined totals: 270 admits / 2,005 ED applications = 13.4664% (rounded to 13.47%). Value matches prior DB; provenance refreshed to closure-pipeline-phase3 CDS_OFFICIAL with current cycle metadata.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: Bowdoin College does NOT offer a nonbinding Early Action plan ("No" checked for EA plan). DB value was already null; provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 (with value=undefined) to authoritative CDS_OFFICIAL pull marked UNAVAILABLE-terminal/NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(bowdoin.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: BOWDOIN_CDS_URL,
  };

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: bowdoin.id },
    data: {
      acceptanceRate: new Prisma.Decimal('7.13'),
      sat25: 1470,
      sat75: 1540,
      intlAcceptanceRate: new Prisma.Decimal('1.44'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('13.47'),
      eaAcceptanceRate: null, // CDS C22 "No" — Bowdoin does not offer EA
      hasEarlyDecision: true, // re-confirm from CDS C21 "Yes"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=7.13, sat25=1470, sat75=1540, intlAR=1.44, oosAR=N/A, edAR=13.47, eaAR=NOT_OFFERED)',
  );

  // verify
  const after = await prisma.school.findUnique({
    where: { id: bowdoin.id },
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
