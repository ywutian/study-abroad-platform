#!/usr/bin/env tsx
/**
 * Phase 3 — California Institute of Technology (Caltech) end-to-end closure of
 * the 7 prediction-critical fields.
 *
 * Source: Caltech Common Data Set 2024-2025 (May 2025 release)
 *   URL: https://iro.caltech.edu/documents/31491/Caltech_CDS_2024-2025_May_2025.pdf
 *   (Published by Caltech Institutional Research at https://iro.caltech.edu/
 *    common-data-set)
 *
 * Caltech is a private research institute. For the Fall 2024 entering class it
 * was operating under its test-blind policy (in effect 2020-2025; SAT/ACT
 * scores were neither required nor considered). Caltech reinstated a
 * test-required policy for Fall 2026 entry (per C8A in the same CDS), but the
 * Fall 2024 cohort reported in this CDS was NOT scored on SAT/ACT — Section
 * C9 is entirely blank.
 *
 * Caltech also does NOT offer Early Decision. It DOES offer a Restrictive
 * (single-choice) Early Action plan (CDS C22 "Yes" + restrictive variant
 * "Yes"), but Caltech does not publish EA application/admit counts (no
 * numbers appear in C22 for Fall 2024).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 2.57     -> 2.57    (CDS C1: 356 admits / 13,856
 *                          applicants = 2.5693%. Value matches prior DB;
 *                          tier upgraded VERIFIED_REAL/LEGACY_DB_VALUE ->
 *                          OFFICIAL/CDS_OFFICIAL with refreshed provenance.)
 *   - sat25             : 1550     -> null    (CDS C9 entirely blank: Caltech
 *                          was test-blind for Fall 2024 entry — SAT/ACT not
 *                          collected or reported. Prior DB value 1550 was a
 *                          legacy heuristic, no longer authoritative. Cleared
 *                          to null and marked UNAVAILABLE/OFFICIAL_BLANK_
 *                          SECTION/NOT_COLLECTED.)
 *   - sat75             : 1580     -> null    (Same rationale as sat25.
 *                          Cleared to null and marked UNAVAILABLE/OFFICIAL_
 *                          BLANK_SECTION/NOT_COLLECTED.)
 *   - intlAcceptanceRate: 1.03     -> null    (CDS C1 residency table left
 *                          blank by Caltech — only Total row reported. Per
 *                          closure-pipeline convention for OFFICIAL_BLANK_
 *                          SECTION, value cleared. Prior 1.03% was
 *                          PERMANENT_HEURISTIC (no source URL). Marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *   - oosAcceptanceRate : 2.7      -> null    (Caltech is private — in-state
 *                          / out-of-state distinction carries no policy
 *                          meaning. CDS C1 residency table also blank.
 *                          Cleared to null and marked UNAVAILABLE/TERMINAL
 *                          per closure-pipeline private-institution
 *                          convention.)
 *   - edAcceptanceRate  : null     -> null    (CDS C21 "Does your institution
 *                          offer an early decision plan?" — NO checked.
 *                          Caltech does NOT offer ED. Field stays null and
 *                          upgraded to UNAVAILABLE/OFFICIAL_BLANK_SECTION
 *                          /NOT_OFFERED with refreshed provenance.)
 *   - eaAcceptanceRate  : null     -> null    (CDS C22 "Do you have a
 *                          nonbinding early action plan?" — YES checked,
 *                          restrictive variant also YES (Restrictive Early
 *                          Action). However, no counts are published — the
 *                          Fall 2024 application/admit count cells are blank.
 *                          Field stays null and marked UNAVAILABLE/OFFICIAL_
 *                          BLANK_SECTION/NOT_REPORTED. hasEarlyDecision
 *                          stays false; Caltech operates REA, not ED.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CALTECH_CDS_URL =
  'https://iro.caltech.edu/documents/31491/Caltech_CDS_2024-2025_May_2025.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const caltech = await prisma.school.findFirst({
    where: { name: 'California Institute of Technology' },
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
  if (!caltech) throw new Error('Caltech not found');
  console.log(`Updating ${caltech.name} (${caltech.id})`);
  console.log(
    `  current AR=${caltech.acceptanceRate?.toString()} sat25=${caltech.sat25} sat75=${caltech.sat75}`,
  );
  console.log(
    `  current intlAR=${caltech.intlAcceptanceRate?.toString()} oosAR=${caltech.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${caltech.edAcceptanceRate?.toString() ?? 'null'} eaAR=${caltech.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: CALTECH_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-caltech-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 2.57,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 356 admits (166 men + 190 women) / 13,856 applicants (9,401 men + 4,446 women + 9 another gender) = 2.5693% (rounded to 2.57%). Value matches prior DB; tier upgraded from VERIFIED_REAL/LEGACY_DB_VALUE to OFFICIAL/CDS_OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'CDS 2024-25 Section C9 is entirely blank — no SAT or ACT percentiles, score ranges, or submission counts reported. Caltech operated a test-blind admissions policy for the Fall 2024 entering class (in effect 2020-2025; SAT/ACT scores were neither required nor considered), so no test data was collected for this cohort. Caltech reinstated test-required policy for Fall 2026 entry (per CDS C8A box checked "Required to be considered for admission"), but that does not retroactively populate Fall 2024. Prior DB value 1550 was a legacy heuristic with no CDS sourceUrl; cleared to null and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION (NOT_COLLECTED).',
      realDataStatus: 'NOT_COLLECTED',
    },
    sat75: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'CDS 2024-25 Section C9 is entirely blank — no SAT or ACT percentiles, score ranges, or submission counts reported. Same rationale as sat25: Caltech test-blind for Fall 2024 entry. Prior DB value 1580 was a legacy heuristic with no CDS sourceUrl; cleared to null and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION (NOT_COLLECTED).',
      realDataStatus: 'NOT_COLLECTED',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency breakdown table is entirely blank — Caltech only reports total first-time, first-year applicants/admits/enrolled with no in-state / out-of-state / international / unknown disaggregation. Prior DB value 1.03% was INFERRED/PERMANENT_HEURISTIC with no source URL — not authoritative. Cleared to null and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION per closure-pipeline convention.',
      realDataStatus: 'NOT_REPORTED',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Caltech is a private research institute; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). Additionally, CDS C1 residency table is entirely blank — no OOS data even if it were policy-relevant. Prior DB value 2.7% was INFERRED/PERMANENT_HEURISTIC. Cleared to null and marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. Caltech does NOT offer Early Decision (it offers Restrictive Early Action instead; see eaAcceptanceRate). Field stays null and upgraded to UNAVAILABLE/OFFICIAL_BLANK_SECTION (NOT_OFFERED) with refreshed provenance. Prior provenance was NOT_APPLICABLE/POLICY_DETERMINATION — semantics preserved, source refreshed to authoritative CDS pull.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Restrictive Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — YES checked; "Is your early action plan a restrictive plan under which you limit students from applying to other early plans?" — YES checked. Caltech operates Restrictive (single-choice) Early Action with closing date 11/1 and notification 12/15. However, no Fall 2024 EA application/admit counts are published — the count cells in C22 are blank. Field stays null and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION (NOT_REPORTED). Note: hasEarlyDecision stays false — REA is not ED.',
      realDataStatus: 'NOT_REPORTED',
    },
  };

  const existingMeta = toRecord(caltech.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: CALTECH_CDS_URL,
  };

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: caltech.id },
    data: {
      acceptanceRate: new Prisma.Decimal('2.57'),
      sat25: null, // CDS C9 blank — test-blind for Fall 2024
      sat75: null, // CDS C9 blank — test-blind for Fall 2024
      intlAcceptanceRate: null, // CDS C1 residency blank
      oosAcceptanceRate: null, // private institution — N/A
      edAcceptanceRate: null, // CDS C21 "No" — ED not offered
      eaAcceptanceRate: null, // CDS C22 "Yes" REA but no counts reported
      hasEarlyDecision: false, // re-confirm from CDS C21 "No"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=2.57 OFFICIAL, sat25/sat75=NOT_COLLECTED test-blind, intlAR=NOT_REPORTED, oosAR=N/A private, edAR=NOT_OFFERED, eaAR=NOT_REPORTED REA-blank-counts)',
  );

  // verify
  const after = await prisma.school.findUnique({
    where: { id: caltech.id },
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
    `  AR=${after?.acceptanceRate?.toString()} sat25=${after?.sat25 ?? 'null'} sat75=${after?.sat75 ?? 'null'}`,
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
