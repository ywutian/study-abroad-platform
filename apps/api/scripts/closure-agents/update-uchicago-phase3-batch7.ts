#!/usr/bin/env tsx
/**
 * Phase 3 — University of Chicago end-to-end closure of the 7 prediction-
 * critical fields (batch 7).
 *
 * Source: University of Chicago 2023-2024 CDS (this is the most recent CDS
 *   UChicago publishes; UChicago has historically published the CDS with a
 *   ~one-year lag and has not yet released a 2024-2025 edition as of this
 *   review).
 *   URL: https://bpb-us-w2.wpmucdn.com/voices.uchicago.edu/dist/8/2077/
 *        files/2024/06/UChicago_CDS_2023-24.pdf
 *   Cycle: Fall 2023 entering class.
 *
 *   NOTE ON CDS COMPLETENESS: UChicago's published CDS has unusually sparse
 *   reporting compared to peer institutions. The 2023-24 PDF leaves the
 *   following sections entirely BLANK:
 *     - C1 residency table (in-state / out-of-state / international rows
 *       all empty)
 *     - C21 Early Decision: closing dates BLANK, ED applications BLANK,
 *       ED admits BLANK (only the "offered Yes" checkbox is marked)
 *     - C22 Early Action: closing date BLANK, EA applications BLANK, EA
 *       admits BLANK (only the "offered Yes / nonrestrictive" checkboxes
 *       are marked)
 *   Per closure-pipeline convention (matches Phase 3 batch 6 handling of
 *   other "C1 residency blank" cases), these fields → UNAVAILABLE /
 *   OFFICIAL_BLANK_SECTION. We do NOT fabricate values from third-party
 *   aggregators when the institution itself declines to publish them.
 *
 *   Publicly UChicago is known to offer ED I + ED II + EA (rare triple) — but
 *   because numeric admit counts are not in the official CDS, the ED/EA admit
 *   rates remain UNAVAILABLE.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 4.79    → 4.79  (CDS C1: total first-time first-
 *                          year applicants 38,631 (17,373 men + 21,249 women
 *                          + 9 another) → 1,849 admits (994 + 855 + 0) =
 *                          4.7864% (rounds to 4.79%). Value matches prior
 *                          DB; tier upgraded LEGACY_DB → OFFICIAL.)
 *   - sat25             : 1510    → 1510  (CDS C9: SAT Composite 25th = 1510
 *                          (EBRW 740 + Math 770 = 1510). Value matches prior
 *                          DB; tier upgraded LEGACY_DB → OFFICIAL.)
 *   - sat75             : 1570    → 1560  (CDS C9: SAT Composite 75th = 1560
 *                          reported directly (EBRW 770 + Math 800 = 1570
 *                          differs; composite quantiles ≠ section sums; per
 *                          convention prefer reported Composite row).
 *                          CORRECTION DOWN -10 from prior 1570 (LEGACY_DB
 *                          heuristic).)
 *   - intlAcceptanceRate: 1.92    → 1.92  (CDS C1 residency: International
 *                          row BLANK in the 2023-24 publication. Prior DB
 *                          value 1.92 (tier=INFERRED, source=
 *                          PERMANENT_HEURISTIC) is retained but tier
 *                          re-classified UNAVAILABLE / OFFICIAL_BLANK_SECTION
 *                          to signal that the institution does not publish
 *                          this value. Value field preserved for backward
 *                          compatibility with downstream consumers; new
 *                          consumers should treat as N/A.)
 *   - oosAcceptanceRate : 5.4     → null  (UChicago is a private research
 *                          university; in-state / out-of-state distinction
 *                          has no policy meaning. CDS C1 OOS row is also
 *                          BLANK in the 2023-24 publication. Per closure-
 *                          pipeline convention, private schools →
 *                          UNAVAILABLE/TERMINAL. Prior INFERRED value
 *                          cleared.)
 *   - edAcceptanceRate  : null    → null  (CDS C21: UChicago offers ED ("Yes"
 *                          checked) — publicly known to operate ED I + ED II
 *                          with separate closing dates. However the CDS
 *                          numeric fields (ED applications, ED admits,
 *                          closing/notification dates) are ALL BLANK for the
 *                          Fall 2023 entering class. Field stays null;
 *                          provenance refreshed to UNAVAILABLE /
 *                          OFFICIAL_BLANK_SECTION with a note explaining
 *                          UChicago does offer ED but does not publish admit
 *                          counts in its CDS.)
 *   - eaAcceptanceRate  : null    → null  (CDS C22: UChicago offers a
 *                          nonbinding, nonrestrictive EA plan ("Yes" checked,
 *                          restrictive "No"). However the CDS numeric fields
 *                          (EA closing date, EA applications, EA admits) are
 *                          ALL BLANK for the Fall 2023 entering class. Field
 *                          stays null; provenance refreshed to UNAVAILABLE /
 *                          OFFICIAL_BLANK_SECTION with a note explaining
 *                          UChicago does offer EA but does not publish admit
 *                          counts.)
 *
 *   NOTE: This is the ONE school in batch 7 where ED/EA admit-rate values
 *   cannot be filled — not because the school doesn't offer them (it offers
 *   the rare ED I + ED II + EA triple), but because UChicago's CDS reporting
 *   leaves the numeric counts blank. ED/EA hasEarlyDecision stays true.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const UCHICAGO_CDS_URL =
  'https://bpb-us-w2.wpmucdn.com/voices.uchicago.edu/dist/8/2077/files/2024/06/UChicago_CDS_2023-24.pdf';
const CYCLE_YEAR = 2023; // CDS 2023-2024 = Fall 2023 entering class (most recent CDS UChicago publishes)
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const uchicago = await prisma.school.findFirst({
    where: { id: 'cmn1htkns000dvqf2a150rn2s' },
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
  if (!uchicago) throw new Error('University of Chicago not found');
  if (uchicago.name !== 'University of Chicago')
    throw new Error(`Unexpected school name: ${uchicago.name}`);
  console.log(`Updating ${uchicago.name} (${uchicago.id})`);
  console.log(
    `  current AR=${uchicago.acceptanceRate?.toString()} sat25=${uchicago.sat25} sat75=${uchicago.sat75}`,
  );
  console.log(
    `  current intlAR=${uchicago.intlAcceptanceRate?.toString()} oosAR=${uchicago.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${uchicago.edAcceptanceRate?.toString()} eaAR=${uchicago.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: UCHICAGO_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-uchicago-validation-batch7',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 4.79,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2023-24 Section C1: total first-time first-year applicants 38,631 (17,373 men + 21,249 women + 9 another gender) → 1,849 admits (994 men + 855 women + 0 another) = 4.7864% (rounded to 4.79%). Value matches prior DB; tier upgraded LEGACY_DB → OFFICIAL with primary UChicago CDS source. Note: UChicago publishes CDS with ~1-year lag; this is the latest cycle available.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1510,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2023-24 Section C9: SAT Composite 25th = 1510 reported directly (EBRW 740 + Math 770 = 1510 also coincides). 46% (755) of Fall 2023 enrolled submitted SAT under test-optional policy (Fall 2025 admission policy: not required for admission, considered if submitted). Value matches prior DB; tier upgraded LEGACY_DB → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1560,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2023-24 Section C9: SAT Composite 75th = 1560 reported directly (EBRW 770 + Math 800 = 1570 differs; composite quantiles ≠ section sums; per convention prefer reported Composite row). CORRECTION DOWN -10 from prior 1570 (LEGACY_DB heuristic).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      value: 1.92,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2023-24 Section C1 residency table: International row BLANK in the official UChicago publication (UChicago declines to fill the residency breakdown rows). Prior DB value 1.92 (tier=INFERRED, source=PERMANENT_HEURISTIC, derived from a third-party aggregator) is preserved for downstream-consumer compatibility, but tier re-classified to UNAVAILABLE / OFFICIAL_BLANK_SECTION to signal the institution itself does not publish this value. Recommended treatment by new consumers: N/A.',
      realDataStatus: 'NOT_AVAILABLE',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'University of Chicago is a private research university; in-state / out-of-state distinction carries no policy meaning. CDS C1 residency OOS row is also BLANK in the official UChicago publication. Prior INFERRED legacy DB value (5.4%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2023-24 Section C21: UChicago offers Early Decision ("Yes" checked). UChicago is publicly known to operate the rare ED I + ED II + EA triple of early-application options. However the CDS numeric fields — first/only ED plan closing date, first/only ED plan notification date, other ED plan closing date, other ED plan notification date, number of ED applications received, number of applicants admitted under ED plan — are ALL BLANK in the official UChicago 2023-24 publication. Per closure-pipeline convention, when the institution declines to publish, the field is marked UNAVAILABLE / OFFICIAL_BLANK_SECTION rather than fabricated from third-party aggregators. hasEarlyDecision retained = true (the policy exists; only the admit-rate numbers are missing).',
      realDataStatus: 'NOT_AVAILABLE',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate (nonbinding, nonrestrictive)',
      reason:
        'CDS 2023-24 Section C22: UChicago offers a nonbinding, nonrestrictive Early Action plan ("Yes" checked, restrictive plan "No"). UChicago is one of the few selective universities to offer the ED I + ED II + EA triple. However the CDS numeric fields — EA closing date, EA notification date, EA applications received, EA admits — are ALL BLANK in the official UChicago 2023-24 publication. Per closure-pipeline convention, when the institution declines to publish, the field is marked UNAVAILABLE / OFFICIAL_BLANK_SECTION rather than fabricated from third-party aggregators.',
      realDataStatus: 'NOT_AVAILABLE',
    },
  };

  const existingMeta = toRecord(uchicago.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: UCHICAGO_CDS_URL,
  };

  await prisma.school.update({
    where: { id: uchicago.id },
    data: {
      acceptanceRate: new Prisma.Decimal('4.79'),
      sat25: 1510,
      sat75: 1560,
      // intlAcceptanceRate: value preserved at 1.92 for backward-compatibility,
      // but tier downgraded to UNAVAILABLE/OFFICIAL_BLANK_SECTION in provenance.
      intlAcceptanceRate: new Prisma.Decimal('1.92'),
      oosAcceptanceRate: null, // private R1 — N/A per convention + CDS blank
      edAcceptanceRate: null, // CDS C21 numeric fields blank — UNAVAILABLE
      eaAcceptanceRate: null, // CDS C22 numeric fields blank — UNAVAILABLE
      hasEarlyDecision: true, // re-confirm from CDS C21 "Yes" (UChicago does offer ED I + ED II)
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=4.79, sat25=1510, sat75=1560, intlAR=1.92 [tier=UNAVAILABLE], oosAR=N/A, edAR=BLANK, eaAR=BLANK)',
  );

  const after = await prisma.school.findUnique({
    where: { id: uchicago.id },
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
