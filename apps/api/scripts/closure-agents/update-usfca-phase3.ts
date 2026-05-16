#!/usr/bin/env tsx
/**
 * Phase 3 — University of San Francisco (USF) end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: University of San Francisco CDS 2024-2025 (Fall 2024 entering class)
 *   URL: https://myusf.usfca.edu/sites/default/files/users/ncain/CDS%202024-2025.pdf
 *   Index: https://myusf.usfca.edu/cipe/cds
 *
 * USF is a PRIVATE (nonprofit) institution (CDS A2 checked).
 *   - oosAcceptanceRate -> UNAVAILABLE/TERMINAL per closure-pipeline convention
 *     (no in-state tuition policy meaning for private institutions).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 69.16  -> 61.71  (CDS C1: 15,358 admits / 24,888
 *                          applicants = 61.7084%. Rounded to 61.71%. Tier
 *                          upgraded LEGACY_DB (value 69.16, sourceUrl pointed
 *                          to USF CDS 2012-2013 — 12 years stale) -> OFFICIAL.
 *                          CORRECTION DOWN -7.45pp from the 2012-13 era value.)
 *   - sat25             : 1190   -> 1200   (CDS C9: SAT Composite 25th = 1200
 *                          reported. CORRECTION UP +10 from prior 1190
 *                          (SEED/PR-15 heuristic). 12.39% of Fall 2024 enrolled
 *                          (114 students) submitted SAT under test-optional
 *                          policy (C8A: SAT/ACT "Not required for admission,
 *                          but considered if submitted").)
 *   - sat75             : 1390   -> 1380   (CDS C9: SAT Composite 75th = 1380
 *                          reported. CORRECTION DOWN -10 from prior 1390
 *                          (SEED/PR-15 heuristic).)
 *   - intlAcceptanceRate: 61.75  -> null   (CDS C1 residency table reports
 *                          only In-State (CA) breakdown — does NOT split out
 *                          international applicants/admits. Per convention,
 *                          when CDS leaves the international cell blank we mark
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION. Prior LEGACY_DB
 *                          value (61.75% from HEURISTIC) cleared.)
 *   - oosAcceptanceRate : 66.3   -> null   (USF is a private institution; the
 *                          in-state/out-of-state distinction carries no tuition
 *                          policy meaning. CDS C1 residency table only reports
 *                          In-State (CA) — does not separate OOS. Per closure-
 *                          pipeline convention, private schools -> UNAVAILABLE/
 *                          TERMINAL. Prior LEGACY_DB value (66.3% from
 *                          HEURISTIC) cleared.)
 *   - edAcceptanceRate  : null   -> 49.41  (CDS C21: USF offers Early Decision
 *                          ("Yes" checked); single plan, 11/1 closing, 12/1
 *                          notification. Fall 2024 entering class: 42 admits /
 *                          85 ED applications = 49.4118% (rounded to 49.41%).
 *                          Tier upgraded NO_PUBLIC_ROUND_RATE/TERMINAL ->
 *                          OFFICIAL with real CDS volume.)
 *   - eaAcceptanceRate  : null   -> null   (CDS C22: USF offers nonbinding
 *                          Early Action ("Yes" checked); 11/1 closing, 12/14
 *                          notification; NOT restrictive. However, CDS C22
 *                          does NOT collect EA applications/admits counts —
 *                          only the policy box and dates. Field stays null;
 *                          tier transitions NO_PUBLIC_ROUND_RATE/TERMINAL ->
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION with hasEA=true.)
 *
 * NOTE on hasEarlyDecision: DB already true; CDS C21 "Yes" confirms.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://myusf.usfca.edu/sites/default/files/users/ncain/CDS%202024-2025.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iol001gz0ticdgvwjkf';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (USF) not found`);
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
    generatedBy: 'phase3-usfca-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 61.71,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 15,358 admits / 24,888 applicants = 61.7084% (rounded to 61.71%). Tier upgraded from LEGACY_DB (value 69.16, sourceUrl pointed to USF CDS 2012-2013 — 12 years stale) to OFFICIAL. CORRECTION DOWN -7.45pp.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1200,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1200 (reported directly). CORRECTION UP +10 from prior 1190 (SEED/PR-15 heuristic). 12.39% of Fall 2024 enrolled (114 students) submitted SAT under test-optional policy (CDS C8A: SAT/ACT "Not required for admission, but considered if submitted").',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1380,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1380 (reported directly). CORRECTION DOWN -10 from prior 1390 (SEED/PR-15 heuristic).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table reports only In-State (CA) breakdown (9,845 applicants / 7,094 admits = 72.06%); it does NOT separate international applicants/admits. Per closure-pipeline convention, when CDS leaves the international cell blank we mark UNAVAILABLE/OFFICIAL_BLANK_SECTION. Prior DB value 61.75% (HEURISTIC/PERMANENT_HEURISTIC) cleared.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'USF is a private (nonprofit) institution (CDS A2 "Private (nonprofit)" checked); in-state / out-of-state distinction carries no tuition policy meaning. CDS C1 residency table reports only In-State (CA) — does not separate OOS. Per closure-pipeline convention, private schools -> UNAVAILABLE/TERMINAL. Prior DB value 66.3% (HEURISTIC/PERMANENT_HEURISTIC) cleared.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 49.41,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: USF offers Early Decision ("Yes" checked); single plan, 11/1 closing, 12/1 notification. Fall 2024 entering class: 42 admits / 85 ED applications = 49.4118% (rounded to 49.41%). Tier upgraded from NO_PUBLIC_ROUND_RATE/TERMINAL (with stale sourceUrl pointing to ArtCenter CDS) to OFFICIAL with real CDS volume.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: USF offers nonbinding Early Action ("Yes" checked); 11/1 closing, 12/14 notification; NOT restrictive (C22 "Is your early action plan restrictive?" = No). However, CDS C22 does NOT collect EA application/admit counts — only the policy box and dates — so a numeric EA admit rate cannot be derived from the CDS. Field stays null. Tier transitions NO_PUBLIC_ROUND_RATE/TERMINAL (with stale ArtCenter sourceUrl) -> UNAVAILABLE/OFFICIAL_BLANK_SECTION. (hasEarlyAction is true at the policy level even though no rate is publishable.)',
      realDataStatus: 'NOT_APPLICABLE',
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
      acceptanceRate: new Prisma.Decimal('61.71'),
      sat25: 1200,
      sat75: 1380,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('49.41'),
      eaAcceptanceRate: null, // CDS C22 does not collect EA counts
      hasEarlyDecision: true, // re-confirm from CDS C21 "Yes"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=61.71, sat25=1200, sat75=1380, intlAR=N/A, oosAR=N/A, edAR=49.41, eaAR=BLANK_SECTION)',
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
