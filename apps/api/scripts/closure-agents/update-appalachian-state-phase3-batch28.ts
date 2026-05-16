#!/usr/bin/env tsx
/**
 * Phase 3 — Appalachian State University (Boone, NC) end-to-end closure of
 * the 7 prediction-critical fields.
 *
 * Source: Appalachian State CDS 2024-2025 (Fall 2024 entering class)
 *   URL: https://drive.usercontent.google.com/download?id=1PUkZvkKHC3TpwIknzecYO6HGAm6kQFCO&export=download
 *   Hosted via Google Drive and linked from the App State Institutional
 *   Research, Assessment and Planning page:
 *     https://analytics.appstate.edu/info_inst_res
 *
 * Appalachian State is a PUBLIC North Carolina research university.
 * oosAcceptanceRate is in eligible scope.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 84     -> 90.14  (CORRECTION UP +6.14. CDS C1
 *                          total: 24,614 applied (men 10,340 + women
 *                          14,274), 22,188 admitted (9,155 + 13,033).
 *                          AR = 22,188 / 24,614 = 90.1438%, rounds to
 *                          90.14%. Prior 84 was LEGACY_DB_VALUE with no
 *                          source URL. Tier LEGACY_DB_VALUE -> OFFICIAL.)
 *   - sat25             : 1140   -> 1140   (CDS C9 SAT Composite 25th =
 *                          1140. Value matches DB exactly. Tier upgraded
 *                          OFFICIAL/CDS_PDF_AUTO (prepscholar URL — not
 *                          a CDS) -> OFFICIAL/CDS_OFFICIAL with corrected
 *                          source URL.)
 *   - sat75             : 1270   -> 1270   (CDS C9 SAT Composite 75th =
 *                          1270. Same as sat25 — value confirmed, source
 *                          corrected.)
 *   - intlAcceptanceRate: 85.8   -> 85.81  (CDS C1 residency: INTERNATIONAL
 *                          606 applied / 520 admitted. intlAR = 520/606 =
 *                          85.8086%, rounds to 85.81%. MINIMAL REFINEMENT
 *                          +0.01. Prior URL was clastify.com — replaced
 *                          with official App State CDS. Tier upgraded
 *                          OFFICIAL/CDS_PDF_AUTO -> OFFICIAL/CDS_OFFICIAL.)
 *   - oosAcceptanceRate : null   -> 93.95  (NEW VALUE FROM CDS. C1
 *                          residency: OUT-OF-STATE 7,185 applied / 6,750
 *                          admitted. oosAR = 6,750 / 7,185 = 93.9457%,
 *                          rounds to 93.95%. Prior null with tier
 *                          PERMANENT_HEURISTIC — superseded by CDS-official
 *                          value. Tier NULL/PERMANENT_HEURISTIC -> OFFICIAL.)
 *   - edAcceptanceRate  : null   -> null   (CDS C21: "Early decision —
 *                          Yes/No" — NO checked. App State does NOT offer
 *                          ED. Tier transitions OFFICIAL/CDS_LLM_EXTRACT_2026_04
 *                          (stale — LLM extraction had assigned OFFICIAL
 *                          erroneously since C21 is blank for App State) ->
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : 89     -> null   (CORRECTION. CDS C22: "Early
 *                          action — Yes/No" — YES checked, AND C22 is a
 *                          RESTRICTIVE EA plan. HOWEVER: App State did NOT
 *                          publish the EA application/admit counts in C21
 *                          (those rows are blank — the published numbers
 *                          are under C21 not C22, and they're blank).
 *                          Prior value 89 came from TAVILY_ENRICHMENT and
 *                          is unverifiable against the CDS. With CDS the
 *                          authoritative source and EA counts not published,
 *                          eaAR transitions to UNAVAILABLE/OFFICIAL_BLANK_SECTION
 *                          and the value is cleared to null. Note: EA is
 *                          OFFERED (Yes in C22) — this is "offered but
 *                          counts blank", not "not offered".)
 *
 * NOTE on hasEarlyDecision: current DB value is true, but CDS C21 is "No".
 *   Correcting to false to match CDS reality. App State has EA but not ED.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://drive.usercontent.google.com/download?id=1PUkZvkKHC3TpwIknzecYO6HGAm6kQFCO&export=download';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iwn0053z0tiokrlwt8f';

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
    throw new Error(`School ${SCHOOL_ID} (Appalachian State) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC North Carolina]`);
  console.log(
    `  current AR=${school.acceptanceRate?.toString()} sat25=${school.sat25} sat75=${school.sat75}`,
  );
  console.log(
    `  current intlAR=${school.intlAcceptanceRate?.toString()} oosAR=${school.oosAcceptanceRate?.toString() ?? 'null'}`,
  );
  console.log(
    `  current edAR=${school.edAcceptanceRate?.toString() ?? 'null'} eaAR=${school.eaAcceptanceRate?.toString() ?? 'null'} hasED=${school.hasEarlyDecision}`,
  );

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-batch28-appalachian-state',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 90.14,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 24,614 total applied (men 10,340 + women 14,274), 22,188 total admitted (9,155 + 13,033). AR = 22,188 / 24,614 = 90.1438%, rounds to 90.14%. CORRECTION UP +6.14 from prior LEGACY_DB_VALUE 84 (no source URL on record). Tier upgraded LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1140,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'CDS 2024-25 Section C9 SAT Composite 25th percentile = 1140. Value matches DB exactly. Tier upgraded OFFICIAL/CDS_PDF_AUTO (prior URL was prepscholar.com — not a CDS) -> OFFICIAL/CDS_OFFICIAL with corrected source URL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1270,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'CDS 2024-25 Section C9 SAT Composite 75th percentile = 1270. Value matches DB exactly. Same source correction as sat25.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 85.81,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency breakdown: INTERNATIONAL 606 applied / 520 admitted. intlAR = 520 / 606 = 85.8086%, rounds to 85.81%. MINIMAL REFINEMENT +0.01 from prior 85.8. Source corrected from clastify.com (prior URL) to the official App State CDS PDF.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 93.95,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency breakdown: OUT-OF-STATE 7,185 applied / 6,750 admitted. oosAR = 6,750 / 7,185 = 93.9457%, rounds to 93.95%. NEW VALUE FROM CDS (prior null with tier PERMANENT_HEURISTIC). Tier NULL/PERMANENT_HEURISTIC -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Early decision — Yes/No" — NO checked. Appalachian State does not offer Early Decision (they have a restrictive Early Action plan in C22, but no ED). Tier transitions OFFICIAL/CDS_LLM_EXTRACT_2026_04 (stale — LLM extraction had erroneously assigned OFFICIAL despite C21 being blank for App State) -> UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 0.9,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: Early Action plan = YES (restrictive plan, closing date 11/1, notification 1/25). HOWEVER App State did NOT publish EA application or admit counts in the CDS — only the dates and "Yes/restrictive" boxes are filled. Cannot derive a CDS-official EA admit rate. Prior DB value 89 came from TAVILY_ENRICHMENT and is unverifiable against the CDS — cleared to null. Tier transitions VERIFIED_REAL/TAVILY_ENRICHMENT -> UNAVAILABLE/OFFICIAL_BLANK_SECTION. NOTE: status is OFFERED-BUT-COUNTS-BLANK (not NOT_OFFERED). Field stays open if App State publishes EA counts in a future CDS cycle.',
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

  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('90.14'),
      sat25: 1140,
      sat75: 1270,
      intlAcceptanceRate: new Prisma.Decimal('85.81'),
      oosAcceptanceRate: new Prisma.Decimal('93.95'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — App State does not offer ED (only restrictive EA);
      // correct stale DB true.
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  updated 7 fields (AR=90.14 up +6.14, sat25=1140 same, sat75=1270 same, intlAR=85.81 refined, oosAR=93.95 NEW, edAR=NOT_OFFERED, eaAR=BLANK-OFFERED, hasED=false)',
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
