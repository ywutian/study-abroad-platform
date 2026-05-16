#!/usr/bin/env tsx
/**
 * Phase 3 batch 9 — University of California, San Diego (UCSD) end-to-end
 * closure of the 7 prediction-critical fields.
 *
 * Source: UC San Diego Common Data Set 2024-2025 (Fall 2024 entering class),
 *   published by UCSD Institutional Research.
 *   PDF: https://ir.ucsd.edu/stats/undergrad/CDS_UCSD_2024-20252.pdf
 *   Index: https://ir.ucsd.edu/
 *
 * KEY UCSD POLICIES (drive the closure decisions):
 *   - UCSD is **test-blind** (CDS C8: "Does your institution make use of
 *     SAT or ACT scores in admission decisions?" — No; C8A all admission
 *     boxes marked "Not considered for admission, even if submitted";
 *     C8G placement uses SAT/ACT/AP/Institutional Exam). UCSD's CDS C9
 *     SAT/ACT percentile boxes are entirely BLANK.
 *     -> sat25/sat75 set to UNAVAILABLE/OFFICIAL_BLANK_SECTION.
 *   - UCSD is a **public** UC institution. UCSD completes the CDS C1
 *     residency breakdown (unlike UCLA which leaves it blank). OOS /
 *     international admit rates carry real policy meaning (~$33K
 *     nonresident supplemental tuition). Must be OFFICIAL, not TERMINAL.
 *   - UC system does NOT offer Early Decision (CDS C21 "No") or Early
 *     Action (CDS C22 "No"). -> edAR/eaAR UNAVAILABLE/OFFICIAL_BLANK_SECTION.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 26.8   -> 26.77  (UCSD CDS 2024-25 C1 Total:
 *                          35,989 admits (M 13,964 + W 20,282 + Another
 *                          398 + Unknown 1,345) / 134,455 applicants
 *                          (M 60,225 + W 67,953 + Another 1,682 + Unknown
 *                          4,595) = 26.7693% (rounds to 26.77%). Note:
 *                          Gender table Total and residency table Total
 *                          MATCH for UCSD (both 134,455 / 35,989). Tier
 *                          upgraded LEGACY_DB (value 26.8; prior sourceUrl
 *                          was UCOP system-wide nonresident legreport) ->
 *                          OFFICIAL, sourced from UCSD IR CDS. Minor
 *                          precision adjustment -0.03pp.)
 *   - sat25             : 1310   -> null   (UCSD is test-blind. CDS C9
 *                          SAT Composite 25th percentile box is BLANK
 *                          because scores are not collected/used in
 *                          admissions. Prior LEGACY_DB value 1310 (no
 *                          source URL) is not from any UCSD-published CDS;
 *                          UCSD has not reported SAT percentiles since
 *                          adopting test-blind in Fall 2021. Field
 *                          cleared; UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *   - sat75             : 1490   -> null   (Same rationale as sat25.
 *                          Prior LEGACY_DB 1490 cleared.)
 *   - intlAcceptanceRate: 22.2   -> 22.44  (UCSD CDS 2024-25 C1 residency
 *                          table: 4,896 international admits / 21,821
 *                          international applicants = 22.4371% (rounds to
 *                          22.44%). CORRECTION UP +0.24pp from prior
 *                          LEGACY_DB column value 22.2. NOTE: prior
 *                          provenance.value was 22.4 (column 22.2) — drift
 *                          corrected here by setting both column and
 *                          provenance to 22.44 from UCSD-published CDS.
 *                          Tier upgraded LEGACY_DB -> OFFICIAL.)
 *   - oosAcceptanceRate : 33.6   -> 33.49  (UCSD CDS 2024-25 C1 residency
 *                          table: 8,109 out-of-state admits / 24,216
 *                          out-of-state applicants = 33.4861% (rounds to
 *                          33.49%). UCSD is public UC — in-state vs. OOS
 *                          distinction carries real policy meaning (~$33K
 *                          nonresident supplemental tuition surcharge),
 *                          so this field MUST carry a real CDS number and
 *                          is NOT marked TERMINAL. CORRECTION DOWN -0.11pp
 *                          from prior LEGACY_DB 33.6. Tier upgraded
 *                          LEGACY_DB -> OFFICIAL.)
 *   - edAcceptanceRate  : null   -> null   (UCSD CDS 2024-25 C21: "No".
 *                          UC system uniformly does not offer Early
 *                          Decision. Field stays cleared. Provenance
 *                          re-anchored from prior NOT_APPLICABLE/
 *                          POLICY_DETERMINATION (sourceUrl=UCOP legreport)
 *                          to authoritative UCSD IR CDS marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : null   -> null   (UCSD CDS 2024-25 C22: "No".
 *                          UC system uniformly does not offer Early
 *                          Action. Field stays cleared. Prior provenance
 *                          (CDS_LLM_EXTRACT_2026_04 with value=undefined,
 *                          sourceUrl pointing at UCOP legreport) refreshed
 *                          to authoritative UCSD IR CDS marked UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL = 'https://ir.ucsd.edu/stats/undergrad/CDS_UCSD_2024-20252.pdf';
const CDS_INDEX_URL = 'https://ir.ucsd.edu/';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmn1htkou000svqf2356l4yfj';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UCSD) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(
    `  isPrivate=${school.isPrivate}  [PUBLIC UC — oosAR must be OFFICIAL]`,
  );
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
    generatedBy: 'phase3-batch9-ucsd-validation',
    notes: `CDS index: ${CDS_INDEX_URL}`,
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 26.77,
      policyLabel: 'Overall admit rate',
      reason:
        'UCSD CDS 2024-25 Section C1 Total: 35,989 admits (Men 13,964 + Women 20,282 + Another 398 + Unknown 1,345) / 134,455 applicants (Men 60,225 + Women 67,953 + Another 1,682 + Unknown 4,595) = 26.7693% (rounds to 26.77%). Gender table Total and residency table Total MATCH for UCSD (both 134,455 apps / 35,989 admits). Tier upgraded LEGACY_DB (value 26.8; prior sourceUrl was UCOP system-wide nonresident legreport, not UCSD CDS) -> OFFICIAL, sourced from UCSD IR CDS. Minor precision adjustment -0.03pp.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'UCSD is test-blind (CDS 2024-25 C8: "Does your institution make use of SAT or ACT scores in admission decisions? — No"; C8A all admission boxes marked "Not considered for admission, even if submitted"; C8G placement only). UCSD CDS C9 SAT Composite percentile boxes are entirely BLANK. Prior LEGACY_DB value 1310 (no source URL) is not from any UCSD-published CDS — UCSD has not reported SAT percentiles since adopting test-blind in Fall 2021. Field cleared; UNAVAILABLE/OFFICIAL_BLANK_SECTION.',
      realDataStatus: 'OFFICIAL_BLANK',
    },
    sat75: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'UCSD is test-blind; CDS C9 SAT Composite percentile boxes blank. Same rationale as sat25. Prior LEGACY_DB 1490 cleared.',
      realDataStatus: 'OFFICIAL_BLANK',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 22.44,
      policyLabel: 'International admit rate',
      reason:
        'UCSD CDS 2024-25 Section C1 residency table: 4,896 international admits / 21,821 international applicants = 22.4371% (rounds to 22.44%). CORRECTION UP +0.24pp from prior LEGACY_DB column value 22.2. NOTE: prior provenance.value was 22.4 while column intlAcceptanceRate stored 22.2 — drift corrected here by setting both column and provenance to 22.44 from UCSD-published CDS. Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 33.49,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'UCSD CDS 2024-25 Section C1 residency table: 8,109 out-of-state admits / 24,216 out-of-state applicants = 33.4861% (rounds to 33.49%). UCSD is a public UC institution — in-state vs. out-of-state distinction carries real policy meaning (~$33K nonresident supplemental tuition surcharge), so this field MUST carry a real CDS number and is NOT marked TERMINAL. CORRECTION DOWN -0.11pp from prior LEGACY_DB 33.6. Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'UCSD CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO. The UC system uniformly does not offer Early Decision (all UC campuses share the system-wide UC Application with one November application window for fall enrollment). Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance re-anchored from prior NOT_APPLICABLE/POLICY_DETERMINATION (sourceUrl=UCOP legreport) to authoritative UCSD IR CDS.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'UCSD CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO. The UC system uniformly does not offer Early Action. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Prior provenance (CDS_LLM_EXTRACT_2026_04 with value=undefined, sourceUrl pointing at UCOP legreport) refreshed to authoritative UCSD IR CDS marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
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

  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('26.77'),
      sat25: null,
      sat75: null,
      intlAcceptanceRate: new Prisma.Decimal('22.44'),
      oosAcceptanceRate: new Prisma.Decimal('33.49'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=26.77, sat25=null[test-blind], sat75=null[test-blind], intlAR=22.44, oosAR=33.49, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
