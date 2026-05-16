#!/usr/bin/env tsx
/**
 * Phase 3 — University at Buffalo (SUNY) end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: University at Buffalo CDS 2024-2025 (Fall 2024 entering class).
 *   URL: https://www.buffalo.edu/content/dam/www/oia/Common-Data-Sets/CDS_2024-2025.pdf
 *
 * UBuffalo is a PUBLIC SUNY research institution:
 *   - isPrivate=false  ->  oosAcceptanceRate is in eligible scope, MUST carry
 *     a real OFFICIAL number from CDS C1 residency table.
 *   - oosAR is NOT marked UNAVAILABLE/TERMINAL.
 *
 * UBuffalo is test-optional per CDS C8A ("Not required for admission but
 * consider if submitted"). SAT band is still recorded as OFFICIAL for
 * descriptive applicant-profile use.
 *
 * NOTE on hasEarlyDecision: current DB value is true, but CDS C21 is "No".
 *   Setting to false to match CDS reality. UBuffalo has EA only (C22 = Yes,
 *   nonbinding, EA closing Nov 1) — but CDS does NOT publish separate EA
 *   admit numbers, so eaAR stays UNAVAILABLE/OFFICIAL_BLANK_SECTION while
 *   hasEarlyAction remains true.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 74.18  -> 74.18  (CDS C1 residency: 30,307 admits /
 *                          40,855 applicants = 74.1772%. No value change;
 *                          tier upgrade LEGACY_DB->OFFICIAL.)
 *   - sat25             : 1170   -> 1210   (CDS C9: SAT EBRW 25th=600 + SAT
 *                          Math 25th=610 = 1210. CORRECTION UP from prior 1170
 *                          (SEED/PR-15 heuristic). UBuffalo's CDS C9 does not
 *                          publish a separate SAT Composite line, so sub-
 *                          section sum is the canonical CDS composite.)
 *   - sat75             : 1350   -> 1380   (CDS C9: SAT EBRW 75th=680 + SAT
 *                          Math 75th=700 = 1380. CORRECTION UP from prior 1350.)
 *   - intlAcceptanceRate: 60.43  -> 60.43  (CDS C1 residency: 3,471 admits /
 *                          5,744 applicants = 60.4283%. No value change; tier
 *                          upgrade LEGACY_DB->OFFICIAL.)
 *   - oosAcceptanceRate : 78.99  -> 78.99  (CDS C1 residency: 2,666 OOS admits
 *                          / 3,375 OOS applicants = 78.9926%. No value change;
 *                          tier upgrade LEGACY_DB->OFFICIAL. Note: residency
 *                          row "OUT-OF-STATE" is U.S. domestic out-of-state
 *                          only, not international.)
 *   - edAcceptanceRate  : null   -> null   (CDS C21: "No" — UBuffalo does NOT
 *                          offer Early Decision. Field cleared. Provenance
 *                          refreshed to 2024-25 cycle. CORRECTION: existing
 *                          provenance had tier=OFFICIAL with source
 *                          CDS_LLM_EXTRACT_2026_04 but is being re-affirmed
 *                          here with manual CDS verification.)
 *   - eaAcceptanceRate  : null   -> null   (CDS C22: "Yes" — EA offered
 *                          (nonbinding, closing Nov 1, notification Nov 19),
 *                          but no separate EA admit numbers published in CDS.
 *                          Field stays cleared. Provenance refreshed.)
 *
 * NOTE on hasEarlyDecision: existing DB has true; correct to false to match
 *   CDS C21 = No.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.buffalo.edu/content/dam/www/oia/Common-Data-Sets/CDS_2024-2025.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8io00017z0ti5bju2vo7';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UBuffalo) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC SUNY]`);
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
    generatedBy: 'phase3-ubuffalo-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 74.18,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 30,307 admits / 40,855 applicants = 74.1772% (rounded to 74.18%). Tier upgraded from LEGACY_DB (value 74.18) to OFFICIAL with manual CDS verification.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1210,
      policyLabel: 'SAT composite 25th percentile (EBRW+Math subsection sum)',
      reason:
        'CDS 2024-25 Section C9: SAT EBRW 25th=600 + SAT Math 25th=610 = 1210. UBuffalo CDS C9 does not publish a separate SAT Composite line, so the subsection sum is the canonical CDS composite. CORRECTION UP from prior 1170 (SEED/PR-15 heuristic). NOTE: UBuffalo is test-optional (CDS C8A "Not required for admission but consider if submitted"); SAT band is descriptive only.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1380,
      policyLabel: 'SAT composite 75th percentile (EBRW+Math subsection sum)',
      reason:
        'CDS 2024-25 Section C9: SAT EBRW 75th=680 + SAT Math 75th=700 = 1380. CORRECTION UP from prior 1350 (SEED/PR-15 heuristic).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 60.43,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 3,471 international admits / 5,744 international applicants = 60.4283% (rounded to 60.43%). Tier upgraded from LEGACY_DB to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 78.99,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 2,666 out-of-state admits / 3,375 out-of-state applicants = 78.9926% (rounded to 78.99%). UBuffalo is a PUBLIC SUNY institution — in-state vs. out-of-state residency carries real policy meaning (different tuition, residency-preference pathways), so this field is in eligible scope and MUST carry a real CDS number. Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO. UBuffalo does not offer Early Decision. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). DB hasEarlyDecision corrected from true to false to match CDS. Provenance refreshed.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Yes" — UBuffalo offers a nonbinding Early Action plan (closing Nov 1, notification Nov 19, non-restrictive). However, CDS does NOT publish separate EA applicants/admits numbers, so the rate cannot be derived from the official document. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION).',
      realDataStatus: 'NOT_PUBLISHED',
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
      acceptanceRate: new Prisma.Decimal('74.18'),
      sat25: 1210,
      sat75: 1380,
      intlAcceptanceRate: new Prisma.Decimal('60.43'),
      oosAcceptanceRate: new Prisma.Decimal('78.99'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — UBuffalo does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=74.18, sat25=1210, sat75=1380, intlAR=60.43, oosAR=78.99, edAR=NOT_OFFERED, eaAR=NOT_PUBLISHED, hasED=false)',
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
