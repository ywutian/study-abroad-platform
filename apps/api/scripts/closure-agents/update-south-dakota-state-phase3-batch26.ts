#!/usr/bin/env tsx
/**
 * Phase 3 — South Dakota State University (SD, not San Diego) end-to-end closure
 * of the 7 prediction-critical fields.
 *
 * Source: SDSU CDS 2021-2022 (Fall 2021 entering class) — the MOST RECENT
 *   Common Data Set published by SDSU. The institutional research page
 *   (https://www.sdstate.edu/office-institutional-research-assessment/institutional-data)
 *   lists years 2020 | 2021 | 2022 | 2023 | 2024 but only the 2021-22 PDF
 *   has a working link. Verified absence of newer CDS PDFs via WebSearch
 *   (sdstate.edu domain) and direct URL probing of common SDSU file-archive
 *   path patterns (all 404). Per closure-pipeline convention, we use the
 *   most recent OFFICIAL CDS even if older than ideal cycle (cycle=2021).
 *   URL: https://www.sdstate.edu/sites/default/files/file-archive/2022-12/South%20Dakota%20State%20University%20-%20Common%20Data%20Set%20%282021-2022%29.pdf
 *
 * SDSU SD is a PUBLIC South Dakota Board of Regents institution.
 *   - oosAcceptanceRate is in eligible scope — MUST carry OFFICIAL number
 *     when available. However, the 2021-22 CDS C1 form does NOT include a
 *     residency breakdown table (the in-state/out-of-state/international
 *     columns were added in later CDS template versions). Therefore
 *     oosAcceptanceRate and intlAcceptanceRate are both marked
 *     UNAVAILABLE/OFFICIAL_BLANK_SECTION (cannot be derived from this CDS
 *     vintage), with prior HEURISTIC values cleared.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 87.43  -> 87.43  (CDS 2021-22 C1: 5,048 admits /
 *                          5,774 applicants = 87.4350%. Value matches DB
 *                          exactly. Tier upgraded VERIFIED_REAL/LEGACY_DB_VALUE
 *                          -> OFFICIAL with refreshed cycle metadata.)
 *   - sat25             : 1070   -> 993    (CDS 2021-22 C9 SAT Composite
 *                          25th = 993. Prior DB value 1070 came from prepscholar
 *                          heuristic (CDS_PDF_AUTO with prepscholar URL —
 *                          NOT actually a CDS extract). Replaced with real
 *                          CDS 2021-22 value. NOTE: SAT submission is only 3%
 *                          (68 of 2019 enrolled) — SDSU is ACT-dominant (86%
 *                          submitted ACT). Still, C9 publishes Composite, so
 *                          the value is OFFICIAL.)
 *   - sat75             : 1220   -> 1240   (CDS 2021-22 C9 SAT Composite
 *                          75th = 1240. Same correction as sat25.)
 *   - intlAcceptanceRate: 86.45  -> null   (CDS 2021-22 C1 has NO residency
 *                          breakdown table — the in-state/OOS/intl columns
 *                          were added in later CDS template versions. Prior
 *                          DB value 86.45 was HEURISTIC/PERMANENT_HEURISTIC
 *                          (not from CDS). Cleared to null with tier
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *   - oosAcceptanceRate : 92.82  -> null   (Same as intlAR: 2021-22 CDS C1
 *                          has no residency breakdown. Prior DB value 92.82
 *                          was HEURISTIC. Cleared to null with tier
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION. NOTE: SDSU is
 *                          a PUBLIC institution where oosAR is normally in
 *                          eligible scope, but no CDS data exists for this
 *                          vintage; the field stays open for the next CDS
 *                          publication cycle.)
 *   - edAcceptanceRate  : null   -> null   (CDS 2021-22 C21: "No" checked —
 *                          SDSU does not offer Early Decision. Field stays
 *                          null. Tier transitions OFFICIAL/CDS_LLM_EXTRACT_2026_04
 *                          (stale 2022 URL) -> UNAVAILABLE/OFFICIAL_BLANK_
 *                          SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : null   -> null   (CDS 2021-22 C22: "No" checked —
 *                          SDSU does not offer Early Action. Same as edAR.)
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
  'https://www.sdstate.edu/sites/default/files/file-archive/2022-12/South%20Dakota%20State%20University%20-%20Common%20Data%20Set%20%282021-2022%29.pdf';
const CYCLE_YEAR = 2021; // CDS 2021-2022 = Fall 2021 entering class (most recent SDSU CDS)
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8is4002zz0ti7l7rukwt';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (SDSU SD) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC SD Board of Regents]`);
  console.log(
    `  current AR=${school.acceptanceRate?.toString()} sat25=${school.sat25} sat75=${school.sat75}`,
  );
  console.log(
    `  current intlAR=${school.intlAcceptanceRate?.toString()} oosAR=${school.oosAcceptanceRate?.toString()}`,
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
    generatedBy: 'phase3-batch26-sdstate',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 87.43,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2021-22 Section C1: 5,048 admits / 5,774 applicants = 87.4350% (rounded to 87.43%). Value matches prior LEGACY_DB exactly; tier upgraded LEGACY_DB_VALUE -> OFFICIAL with refreshed cycle metadata. This is the MOST RECENT CDS published by SDSU SD (2022-2024 CDS PDFs not published as of 2026-05).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 993,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'CDS 2021-22 Section C9 SAT Composite 25th percentile = 993. Replaces prior DB value 1070 which originated from a prepscholar heuristic (CDS_PDF_AUTO source URL pointed to prepscholar.com — not an actual CDS extract). NOTE: SDSU is ACT-dominant (86% submitted ACT, only 3% submitted SAT = 68 students), but C9 publishes SAT Composite for that subset, so the value is OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1240,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'CDS 2021-22 Section C9 SAT Composite 75th percentile = 1240. Replaces prior DB value 1220 (prepscholar heuristic). Same caveat as sat25 re: SAT submission rate.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2021-22 Section C1 does NOT include a residency breakdown table (the in-state/out-of-state/international columns were added in later CDS template versions, e.g., 2024-25 template). The 2021-22 SDSU CDS only reports total applied/admitted/enrolled without residency split. Prior DB value 86.45 was HEURISTIC/PERMANENT_HEURISTIC, not from CDS. Cleared to null; field stays open for the next CDS publication cycle.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Same as intlAR: CDS 2021-22 Section C1 does NOT include the residency breakdown table. SDSU is a PUBLIC institution where oosAR is normally in eligible scope, but no CDS data exists for this vintage. Prior DB value 92.82 was HEURISTIC. Cleared to null; field stays open for the next CDS publication cycle.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2021-22 Section C21: "Does your institution offer an early decision plan?" — NO checked. SDSU does not offer Early Decision. Field stays null. Tier transitions OFFICIAL/CDS_LLM_EXTRACT_2026_04 (stale provenance with 2022-archive URL but cycle marked 2024) -> UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED with refreshed provenance.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2021-22 Section C22: "Do you have a nonbinding early action plan?" — NO checked. SDSU does not offer Early Action. Same treatment as edAcceptanceRate.',
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

  // Minimal Prisma update with explicit select.
  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('87.43'),
      sat25: 993,
      sat75: 1240,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — SDSU SD does not offer ED; correct stale DB true.
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=87.43, sat25=993, sat75=1240, intlAR=BLANK, oosAR=BLANK, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
