#!/usr/bin/env tsx
/**
 * Phase 3 — Lehigh University end-to-end closure of the 7 prediction-critical
 * fields.
 *
 * Source: Lehigh CDS 2024-2025 (Fall 2024 entering class).
 *   URL: https://data.lehigh.edu/sites/data.lehigh.edu/files/4.18.2025_CDS-2024-2025_FINAL.pdf
 *
 * NOTE: Lehigh is a PRIVATE institution.
 *   - isPrivate=true  ->  oosAcceptanceRate marked UNAVAILABLE-terminal per
 *     closure-pipeline convention (in-state/OOS distinction carries no policy
 *     meaning at private institutions). CDS C1 residency table does report
 *     OOS (3,991/12,442 = 32.08%) but the value is not actionable for
 *     applicants.
 *
 * Test policy: test-optional (C8A "Yes" but C8F note: "Adopted a test-optional
 *   policy in 2024 with plans to remain test-optional for the foreseeable
 *   future.") Only 29.65% of Fall 2024 enrollees submitted SAT. C9 SAT
 *   Composite reported for the submitting cohort.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 25.4  -> 25.93 (CDS 2024-25 C1: 5,289 admits /
 *                          20,396 applicants = 25.9365% (rounded to 25.93%).
 *                          Tier upgraded LEGACY_DB (sourceUrl pointed to
 *                          collegekickstart.com aggregator) -> OFFICIAL.
 *                          CORRECTION UP +0.53pp.)
 *   - sat25             : 1320  -> 1380 (CDS 2024-25 C9: SAT Composite 25th =
 *                          1380 reported directly. CORRECTION UP +60 from
 *                          prior 1320 (SEED/PR-15 heuristic). Test-optional
 *                          self-selection: only ~30% submitted, and that
 *                          submitting cohort sits higher than the heuristic
 *                          assumed.)
 *   - sat75             : 1440  -> 1490 (CDS 2024-25 C9: SAT Composite 75th =
 *                          1490 reported directly. CORRECTION UP +50 from
 *                          prior 1440 (SEED/PR-15 heuristic).)
 *   - intlAcceptanceRate: 4.73  -> 4.73 (CDS 2024-25 C1 residency: 217 intl
 *                          admits / 4,583 intl applicants = 4.7349% (rounded
 *                          to 4.73%). Value identical to prior DB; tier
 *                          upgraded LEGACY_DB -> OFFICIAL.)
 *   - oosAcceptanceRate : 32.08 -> null  (Lehigh is a PRIVATE university;
 *                          in-state / out-of-state distinction carries no
 *                          policy meaning. CDS C1 residency does report OOS
 *                          (3,991 admits / 12,442 applicants = 32.0768%), but
 *                          per closure-pipeline convention for private
 *                          institutions -> UNAVAILABLE/TERMINAL. Prior
 *                          LEGACY_DB value cleared.)
 *   - edAcceptanceRate  : 44.93 -> 44.93 (CDS 2024-25 C21: ED offered ("Yes"
 *                          checked); two plans — ED I closes 11/1, notifies
 *                          12/15; ED II closes 1/1, notifies 2/15. Fall 2024
 *                          entering class combined totals: 996 admits / 2,217
 *                          ED applications = 44.9256% (rounded to 44.93%).
 *                          Value identical to prior DB; tier upgraded
 *                          LEGACY_DB -> OFFICIAL with refreshed provenance
 *                          for the closure-pipeline phase3 cycle.)
 *   - eaAcceptanceRate  : null  -> null  (CDS 2024-25 C22: "No" — Lehigh does
 *                          NOT offer a nonbinding Early Action plan. Field
 *                          stays null. Existing provenance had
 *                          tier=OFFICIAL source=CDS_LLM_EXTRACT_2026_04 with
 *                          value=undefined — semantics preserved, source
 *                          refreshed to authoritative CDS pull marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *
 * NOTE on hasEarlyDecision: current DB value is true; CDS C21 confirms "Yes".
 * No change required (re-confirmed by phase3 closure).
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://data.lehigh.edu/sites/data.lehigh.edu/files/4.18.2025_CDS-2024-2025_FINAL.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmn1htkq9001avqf25ziy94gn';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Lehigh) not found`);
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
    generatedBy: 'phase3-lehigh-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 25.93,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 5,289 admits / 20,396 applicants = 25.9365% (rounded to 25.93%). Tier upgraded from LEGACY_DB (value 25.4, sourceUrl pointed to collegekickstart.com aggregator — not Lehigh) to OFFICIAL. CORRECTION UP +0.53pp.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1380,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1380 (reported directly). CORRECTION UP +60 from prior 1320 (SEED/PR-15 heuristic). Test-optional self-selection — only 29.65% of Fall 2024 enrollees submitted SAT, and that submitting cohort sits higher than the prior heuristic assumed.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1490,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1490 (reported directly). CORRECTION UP +50 from prior 1440 (SEED/PR-15 heuristic).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 4.73,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 217 international admits / 4,583 international applicants = 4.7349% (rounded to 4.73%). Value identical to prior DB; tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Lehigh University is a private institution; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage, no residency-preference admit pathways). CDS C1 residency table does report OOS (3,991 admits / 12,442 applicants = 32.0768%), but the value is not actionable for applicants. Prior LEGACY_DB value (32.08%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 44.93,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2024-25 Section C21: Lehigh offers Early Decision ("Yes" checked) with two plans — ED I closes 11/1 (12/15 notification), ED II closes 1/1 (2/15 notification). Fall 2024 entering class combined totals: 996 admits / 2,217 ED applications = 44.9256% (rounded to 44.93%). Value identical to prior DB; tier upgraded LEGACY_DB -> OFFICIAL with refreshed provenance for closure-pipeline phase3 cycle.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. Lehigh University does NOT offer a nonbinding Early Action plan. DB value was already null; provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 (with value=undefined) to authoritative CDS_OFFICIAL pull marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
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

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('25.93'),
      sat25: 1380,
      sat75: 1490,
      intlAcceptanceRate: new Prisma.Decimal('4.73'),
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('44.93'),
      eaAcceptanceRate: null,
      hasEarlyDecision: true, // re-confirm from CDS C21 "Yes"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=25.93, sat25=1380, sat75=1490, intlAR=4.73, oosAR=N/A, edAR=44.93, eaAR=NOT_OFFERED)',
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
