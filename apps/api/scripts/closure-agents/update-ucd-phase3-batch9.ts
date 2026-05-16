#!/usr/bin/env tsx
/**
 * Phase 3 batch 9 — University of California, Davis (UC Davis) end-to-end
 * closure of the 7 prediction-critical fields.
 *
 * Source: UC Davis Common Data Set 2024-2025 (Fall 2024 entering class),
 *   published by UC Davis Office of Institutional Analysis (AggieData).
 *   PDF: https://aggiedata.ucdavis.edu/sites/g/files/dgvnsk1841/files/media/documents/CDS_UCD.pdf
 *   Index: https://aggiedata.ucdavis.edu/
 *
 * KEY UC DAVIS POLICIES (drive the closure decisions):
 *   - UCD is **test-blind** (CDS C8: "Does your institution make use of
 *     SAT or ACT scores in admission decisions?" — No; C8A all boxes blank;
 *     C8G placement only uses SAT/ACT/AP). UCD's CDS C9 SAT/ACT percentile
 *     boxes are entirely BLANK. -> sat25/sat75 set to UNAVAILABLE/
 *     OFFICIAL_BLANK_SECTION.
 *   - UCD is a **public** UC institution. Unlike UCLA (which leaves the
 *     CDS C1 residency table BLANK), UC Davis DOES complete the residency
 *     breakdown. OOS / international admit rates carry real policy meaning
 *     (~$33K nonresident supplemental tuition). Must be OFFICIAL, not
 *     TERMINAL.
 *   - UC system does NOT offer Early Decision (CDS C21 "No") or Early
 *     Action (CDS C22 "No"). -> edAR/eaAR UNAVAILABLE/OFFICIAL_BLANK_SECTION.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 42.1   -> 41.83  (UC Davis CDS 2024-25 C1
 *                          residency Total row: 41,353 admits / 98,869
 *                          applicants = 41.8267% (rounds to 41.83%).
 *                          Tier upgraded LEGACY_DB (value 42.1; prior
 *                          sourceUrl was UC system-wide nonresident
 *                          legreport, not UCD CDS) -> OFFICIAL, sourced
 *                          from UCD AggieData CDS. NOTE: CDS C1 gender
 *                          table totals 96,769 applicants (M 40,931 +
 *                          W 50,944 + Another 1,411 + Unknown 3,483) —
 *                          which yields 42.73% — but the residency Total
 *                          (98,869) is more complete because the gender
 *                          table omits applicants with no reported gender.
 *                          Using residency Total for AR.)
 *   - sat25             : 1210   -> null   (UCD is test-blind. CDS C9
 *                          SAT Composite 25th percentile box is BLANK
 *                          because scores are not collected/used in
 *                          admissions. Prior LEGACY_DB value 1210 (no
 *                          source URL) is not from any UCD-published CDS;
 *                          UCD has not reported SAT percentiles since
 *                          adopting test-blind in Fall 2021. Field
 *                          cleared; UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *   - sat75             : 1420   -> null   (Same rationale as sat25.
 *                          Prior LEGACY_DB 1420 cleared.)
 *   - intlAcceptanceRate: 51.5   -> 50.68  (UC Davis CDS 2024-25 C1
 *                          residency table: 9,569 international admits /
 *                          18,880 international applicants = 50.6833%
 *                          (rounds to 50.68%). CORRECTION DOWN -0.82pp
 *                          from prior LEGACY_DB 51.5 (sourced from UC
 *                          system-wide nonresident legreport, not the
 *                          per-campus CDS). Tier upgraded LEGACY_DB ->
 *                          OFFICIAL, sourced from UCD AggieData CDS.)
 *   - oosAcceptanceRate : 57.7   -> 57.32  (UC Davis CDS 2024-25 C1
 *                          residency table: 7,038 out-of-state admits /
 *                          12,279 out-of-state applicants = 57.3174%
 *                          (rounds to 57.32%). UCD is public UC — in-state
 *                          vs. OOS distinction carries real policy meaning
 *                          (~$33K nonresident supplemental tuition), so
 *                          this field MUST carry a real CDS number and is
 *                          NOT marked TERMINAL. CORRECTION DOWN -0.38pp
 *                          from prior LEGACY_DB 57.7. Tier upgraded
 *                          LEGACY_DB -> OFFICIAL.)
 *   - edAcceptanceRate  : null   -> null   (UCD CDS 2024-25 C21: "No".
 *                          UC system uniformly does not offer Early
 *                          Decision (all UC campuses share the system-wide
 *                          UC Application with one November application
 *                          window for fall enrollment). Field stays
 *                          cleared. Provenance refreshed and re-anchored
 *                          to UNAVAILABLE/OFFICIAL_BLANK_SECTION /
 *                          NOT_OFFERED with authoritative CDS sourceUrl.)
 *   - eaAcceptanceRate  : null   -> null   (UCD CDS 2024-25 C22: "No".
 *                          UC system uniformly does not offer Early
 *                          Action. Field stays cleared. Prior provenance
 *                          (CDS_LLM_EXTRACT_2026_04 with value=undefined,
 *                          sourceUrl pointing at UCOP legreport) refreshed
 *                          to authoritative CDS pull marked UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://aggiedata.ucdavis.edu/sites/g/files/dgvnsk1841/files/media/documents/CDS_UCD.pdf';
const CDS_INDEX_URL = 'https://aggiedata.ucdavis.edu/';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmn1htkor000rvqf282ibd6kz';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UC Davis) not found`);
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
    generatedBy: 'phase3-batch9-ucd-validation',
    notes: `CDS index: ${CDS_INDEX_URL}`,
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 41.83,
      policyLabel: 'Overall admit rate',
      reason:
        'UC Davis CDS 2024-25 Section C1 residency Total: 41,353 admits / 98,869 applicants = 41.8267% (rounds to 41.83%). Tier upgraded LEGACY_DB (value 42.1; prior sourceUrl was UCOP system-wide nonresident legreport, not UCD CDS) -> OFFICIAL, sourced from UCD AggieData CDS. NOTE: CDS C1 gender table totals 96,769 applicants (M 40,931 + W 50,944 + Another 1,411 + Unknown 3,483) which yields 42.73% — but the residency Total (98,869) is more complete because the gender table omits applicants with no reported gender. Using residency Total for AR.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'UC Davis is test-blind (CDS 2024-25 C8: "Does your institution make use of SAT or ACT scores in admission decisions? — No"; C8A all admission boxes blank; C8G placement only). UCD CDS C9 SAT Composite percentile boxes are entirely BLANK because scores are not collected/used for admission. Prior LEGACY_DB value 1210 (no source URL) is not from any UCD-published CDS — UCD has not reported SAT percentiles since adopting test-blind in Fall 2021. Field cleared; UNAVAILABLE/OFFICIAL_BLANK_SECTION.',
      realDataStatus: 'OFFICIAL_BLANK',
    },
    sat75: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'UC Davis is test-blind; CDS C9 SAT Composite percentile boxes blank. Same rationale as sat25. Prior LEGACY_DB 1420 cleared.',
      realDataStatus: 'OFFICIAL_BLANK',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 50.68,
      policyLabel: 'International admit rate',
      reason:
        'UC Davis CDS 2024-25 Section C1 residency table: 9,569 international admits / 18,880 international applicants = 50.6833% (rounds to 50.68%). CORRECTION DOWN -0.82pp from prior LEGACY_DB 51.5 (sourced from UCOP system-wide nonresident legreport, not the per-campus CDS). Tier upgraded LEGACY_DB -> OFFICIAL, sourced from UCD AggieData CDS.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 57.32,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'UC Davis CDS 2024-25 Section C1 residency table: 7,038 out-of-state admits / 12,279 out-of-state applicants = 57.3174% (rounds to 57.32%). UCD is a public UC institution — in-state vs. out-of-state distinction carries real policy meaning (~$33K nonresident supplemental tuition surcharge), so this field MUST carry a real CDS number and is NOT marked TERMINAL. CORRECTION DOWN -0.38pp from prior LEGACY_DB 57.7. Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'UC Davis CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO. The UC system uniformly does not offer Early Decision (all UC campuses share the system-wide UC Application with one November application window for fall enrollment). Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance re-anchored from prior NOT_APPLICABLE/POLICY_DETERMINATION (sourceUrl=UCOP legreport) to authoritative UCD AggieData CDS.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'UC Davis CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO. The UC system uniformly does not offer Early Action. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Prior provenance (CDS_LLM_EXTRACT_2026_04 with value=undefined, sourceUrl pointing at UCOP legreport) refreshed to authoritative UCD AggieData CDS marked UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
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
      acceptanceRate: new Prisma.Decimal('41.83'),
      sat25: null,
      sat75: null,
      intlAcceptanceRate: new Prisma.Decimal('50.68'),
      oosAcceptanceRate: new Prisma.Decimal('57.32'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=41.83, sat25=null[test-blind], sat75=null[test-blind], intlAR=50.68, oosAR=57.32, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
