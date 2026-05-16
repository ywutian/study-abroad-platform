#!/usr/bin/env tsx
/**
 * Phase 3 — San Diego State University (SDSU) end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: SDSU CDS 2024-2025 (Fall 2024 entering class)
 *   URL: https://asir.sdsu.edu/Documents/CommonDataSets/CDS_2024-25.pdf
 *
 * SDSU is a PUBLIC CSU institution (California State University system).
 *   - oosAcceptanceRate is in eligible scope — MUST carry a real OFFICIAL
 *     number from CDS C1 residency table (NOT marked UNAVAILABLE/TERMINAL).
 *
 * SDSU is **test-blind**. C8A reports SAT or ACT "Not Considered, even if
 * submitted." C8F clarifies: "SDSU no longer uses ACT or SAT examinations in
 * determining admission eligibility. If accepted to SDSU, ACT or SAT test
 * scores can be used as one of the measures to place students in the proper
 * mathematics and written communication courses." Because of this policy,
 * SDSU's 2024-25 CDS publishes NO C9 test score table at all — pages jump
 * from C8G (placement test usage) straight to C10 (HS class rank). Per
 * closure-pipeline convention for blank CDS sections, sat25/sat75 are marked
 * UNAVAILABLE/OFFICIAL_BLANK_SECTION rather than carrying a prior SEED/
 * heuristic value.
 *
 * SDSU offers neither Early Decision nor Early Action (CDS C21 "No", C22 "No").
 * Both edAcceptanceRate and eaAcceptanceRate are UNAVAILABLE/OFFICIAL_BLANK_
 * SECTION (NOT_OFFERED).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 36     -> 35.97  (CDS 2024-25 C1: 32,556 admits /
 *                          90,504 applicants = 35.9697%. Rounded to 35.97%.
 *                          Tier upgraded LEGACY_DB (value 36, no precision) ->
 *                          OFFICIAL with minor precision correction.)
 *   - sat25             : 1250   -> null   (SDSU is test-blind; the 2024-25
 *                          CDS publishes NO C9 test score table. Per
 *                          convention for blank CDS sections, prior SEED/
 *                          PR-15 heuristic value (1250) cleared. Tier marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *   - sat75             : 1450   -> null   (Same as sat25: test-blind, no C9.
 *                          Prior SEED/PR-15 heuristic value (1450) cleared.)
 *   - intlAcceptanceRate: 56.9   -> 56.90  (CDS 2024-25 C1 residency table:
 *                          726 international admits / 1,276 international
 *                          applicants = 56.8966% (rounded to 56.90%). Value
 *                          matches prior DB exactly; tier upgraded LEGACY_DB
 *                          -> OFFICIAL with refreshed cycle metadata.)
 *   - oosAcceptanceRate : 87.1   -> 87.06  (CDS 2024-25 C1 residency table:
 *                          6,739 OOS admits / 7,741 OOS applicants = 87.0560%
 *                          (rounded to 87.06%). Tier upgraded LEGACY_DB ->
 *                          OFFICIAL. Minor precision correction -0.04pp.
 *                          SDSU is a PUBLIC CSU institution — in-state vs.
 *                          out-of-state distinction carries real policy
 *                          meaning (different tuition, residency-preference
 *                          admit pathways), so this field MUST carry a real
 *                          CDS number, never TERMINAL.)
 *   - edAcceptanceRate  : null   -> null   (CDS 2024-25 C21: "No" checked —
 *                          SDSU does not offer Early Decision. Field stays
 *                          null. Tier transitions OFFICIAL/CDS_LLM_EXTRACT_2026_04
 *                          (value=undefined) -> UNAVAILABLE/OFFICIAL_BLANK_
 *                          SECTION/NOT_OFFERED with refreshed provenance.)
 *   - eaAcceptanceRate  : null   -> null   (CDS 2024-25 C22: "No" checked —
 *                          SDSU does not offer Early Action. Same treatment
 *                          as edAcceptanceRate.)
 *
 * NOTE on hasEarlyDecision: current DB value is true, but CDS C21 is "No".
 *   Correcting to false to match CDS reality.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://asir.sdsu.edu/Documents/CommonDataSets/CDS_2024-25.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iou001jz0tig866z8pb';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (SDSU) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC CSU]`);
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
    generatedBy: 'phase3-sdsu-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 35.97,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 32,556 admits / 90,504 applicants = 35.9697% (rounded to 35.97%). Tier upgraded from LEGACY_DB (value 36, no precision) to OFFICIAL with minor precision correction.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'SDSU is test-blind (CDS C8A: SAT or ACT "Not Considered, even if submitted"; C8F: "SDSU no longer uses ACT or SAT examinations in determining admission eligibility"). The 2024-25 CDS publishes NO C9 test score table at all — pages jump from C8G (placement test usage) straight to C10 (HS class rank). Per closure-pipeline convention for blank CDS sections, prior SEED/PR-15 heuristic value (1250) is cleared and field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    sat75: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'Same as sat25: SDSU is test-blind and the 2024-25 CDS publishes no C9 table. Prior SEED/PR-15 heuristic value (1450) cleared. Field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 56.9,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 726 international admits / 1,276 international applicants = 56.8966% (rounded to 56.90%). Value matches prior LEGACY_DB exactly; tier upgraded LEGACY_DB -> OFFICIAL with refreshed cycle metadata.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 87.06,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 6,739 out-of-state admits / 7,741 out-of-state applicants = 87.0560% (rounded to 87.06%). SDSU is a PUBLIC CSU institution — in-state vs. out-of-state distinction carries real policy meaning (different tuition, residency-preference admit pathways), so this field is in eligible scope and MUST carry a real CDS number. Tier upgraded LEGACY_DB -> OFFICIAL. Minor precision correction -0.04pp from prior 87.1%.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. SDSU does not offer Early Decision. Field stays null. Tier transitions OFFICIAL/CDS_LLM_EXTRACT_2026_04 (value=undefined) -> UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED with refreshed provenance.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. SDSU does not offer Early Action. Field stays null. Tier transitions OFFICIAL/CDS_LLM_EXTRACT_2026_04 (value=undefined) -> UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
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
      acceptanceRate: new Prisma.Decimal('35.97'),
      sat25: null,
      sat75: null,
      intlAcceptanceRate: new Prisma.Decimal('56.90'),
      oosAcceptanceRate: new Prisma.Decimal('87.06'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — SDSU does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=35.97, sat25=BLANK, sat75=BLANK, intlAR=56.90, oosAR=87.06, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
