#!/usr/bin/env tsx
/**
 * Phase 3 (batch15) — Yeshiva University end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: Yeshiva University CDS 2023-2024 XLSX, published by
 *   YU Office of Institutional Research & Assessment (https://www.yu.edu/oir).
 *   URL: https://www.yu.edu/sites/default/files/inline-files/CDS_2023_2024.xlsx
 *   This is the LATEST CDS published by YU (verified via direct fetch of
 *   the /oir page in May 2026). YU has not yet released CDS 2024-25 publicly.
 *   The previously-recorded "Admissions Wilf-22-24.pdf" URL on existing
 *   provenance is an Undergraduate Catalog (admission process narrative),
 *   NOT a CDS — the prior TAVILY_ENRICHMENT ED/EA rates (52.17% / 47.62%)
 *   appear to have been mis-attributed from the catalog text rather than
 *   any official CDS section.
 *
 * NOTE: Yeshiva is a PRIVATE institution (Modern Orthodox Jewish, NYC).
 *   isPrivate=true → oosAcceptanceRate is NOT in eligible scope and is
 *   marked UNAVAILABLE/TERMINAL per closure policy for private schools.
 *
 * Test policy: Yeshiva is test-optional (C8 "Does institution make use of
 *   SAT/ACT scores in admissions decisions" — D115 = "No"); however
 *   students may submit scores (21.3% submitted SAT, 18.6% submitted ACT)
 *   and Honors program requires test scores. C9 reports SAT Composite
 *   25th/75th percentiles directly for the submitting subset.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 55    → 63.75  (CDS 2023-24 C1: (544+548)=1092
 *                          admits / (908+805)=1713 applicants = 63.7478%
 *                          (rounded to 63.75%). CORRECTION UP +8.75 from
 *                          prior 55 (LEGACY_DB, source unknown — likely
 *                          older cycle or different gender-aggregate
 *                          computation). Tier LEGACY_DB → OFFICIAL.)
 *   - sat25             : null  → 1330  (CDS 2023-24 C9 row B159: SAT
 *                          Composite 25th = 1330 (reported composite row,
 *                          preferred per closure policy "C9 优先 Composite").
 *                          For n=141 SAT submitters (21.3% of enrolled).
 *                          Tier HEURISTIC:PR-15 SEED → OFFICIAL.)
 *   - sat75             : null  → 1470  (CDS 2023-24 C9 row D159: SAT
 *                          Composite 75th = 1470 (reported composite row).
 *                          Tier HEURISTIC:PR-15 SEED → OFFICIAL.)
 *   - intlAcceptanceRate: null  → null  (CDS 2023-24 C1 residency table:
 *                          In-State / Out-of-State / International / Total
 *                          rows all BLANK (Total cells show "0" because the
 *                          residency breakdown was not filled by YU OIR).
 *                          Per closure policy "C1 residency 空 →
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION": cannot
 *                          compute intl AR from CDS. Tier
 *                          PERMANENT_HEURISTIC → UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION.)
 *   - oosAcceptanceRate : null  → null  (Yeshiva is PRIVATE — same OOS/in-state
 *                          tuition tier, no residency preference in admissions.
 *                          Per closure policy for private schools:
 *                          UNAVAILABLE/TERMINAL/PRIVATE_SCHOOL_NO_OOS_DISTINCTION.
 *                          Tier PERMANENT_HEURISTIC → UNAVAILABLE/TERMINAL.)
 *   - edAcceptanceRate  : 52.17 → 100.0  (CDS 2023-24 C21 row C324:
 *                          "Does institution offer early decision plan?"
 *                          YES; row B329 closing 11/01; B336 ED applications
 *                          received = 129; B337 ED admits = 129 → 100%.
 *                          NOTE: a 100% ED admit rate is unusual but is the
 *                          literal CDS value — Yeshiva's small religious-
 *                          observant applicant pool likely self-selects to
 *                          near-certain admits before ED commitment. Prior
 *                          DB value 52.17 (TAVILY_ENRICHMENT from Wilf
 *                          Catalog PDF) does NOT match official CDS and is
 *                          replaced. Tier TAVILY_ENRICHMENT → OFFICIAL.)
 *   - eaAcceptanceRate  : 47.62 → null   (CDS 2023-24 C22 rows A344-A358:
 *                          ALL EA fields BLANK — Yeshiva does NOT have an
 *                          Early Action plan per CDS. Prior DB value 47.62
 *                          (TAVILY_ENRICHMENT from Wilf Catalog PDF) is
 *                          NOT supported by the official CDS and is
 *                          removed. Tier TAVILY_ENRICHMENT → UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.yu.edu/sites/default/files/inline-files/CDS_2023_2024.xlsx';
const CYCLE_YEAR = 2023; // CDS 2023-2024 = Fall 2023 entering class (latest published)
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8itt003rz0tizqmu1u5h';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Yeshiva) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate} (private)`);
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
    verifiedBy: 'closure-pipeline-phase3-batch15-claude',
    generatedBy: 'phase3-batch15-yeshiva-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 63.75,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2023-24 Section C1 (Yeshiva University): men+women admits 544+548=1,092 / applicants 908+805=1,713 = 63.7478% (rounded to 63.75%). CORRECTION UP +8.75 from prior 55 (LEGACY_DB, source unknown — likely older cycle or different aggregate). Tier LEGACY_DB → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1330,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2023-24 Section C9 cell B159: SAT Composite 25th = 1330 (reported composite row, preferred per closure policy "C9 优先 Composite"). 141 SAT submitters (21.3% of enrolled; YU is test-optional but Honors program requires tests). Tier HEURISTIC:PR-15 SEED → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1470,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2023-24 Section C9 cell D159: SAT Composite 75th = 1470 (reported composite row). Tier HEURISTIC:PR-15 SEED → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2023-24 Section C1 residency table (rows A20-A22, columns In-State/Out-of-State/International/Total): ALL BLANK — Yeshiva did not fill out the residency breakdown in the published CDS (Total cells show literal "0" indicating no data was provided). Per closure policy "C1 residency 空 → UNAVAILABLE/OFFICIAL_BLANK_SECTION": cannot compute international admit rate from CDS. Tier PERMANENT_HEURISTIC → UNAVAILABLE/OFFICIAL_BLANK_SECTION.',
      realDataStatus: 'NOT_DISCLOSED',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Yeshiva is a PRIVATE institution (Modern Orthodox Jewish university, NYC) — same tuition tier for in-state vs. out-of-state, no residency preference in admissions. Per closure policy for private schools: oosAcceptanceRate is OUT-OF-SCOPE (UNAVAILABLE/TERMINAL/PRIVATE_SCHOOL_NO_OOS_DISTINCTION). Tier PERMANENT_HEURISTIC → UNAVAILABLE/TERMINAL.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 100.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2023-24 Section C21 cell C324: "Does institution offer early decision plan?" YES (closing date 11/01/2023, notification 12/15/2023). Cell B336: ED applications received = 129. Cell B337: ED admits = 129. → ED admit rate = 129/129 = 100.0%. NOTE: A 100% ED admit rate is unusual but is the literal CDS value — Yeshiva\'s small religious-observant applicant pool (Modern Orthodox Jewish day school graduates) is likely tightly self-selected and effectively pre-screened before ED commitment. Prior DB value 52.17 (TAVILY_ENRICHMENT extracted from Wilf Undergraduate Catalog PDF, NOT a CDS) does not match official CDS and is replaced. Tier TAVILY_ENRICHMENT → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2023-24 Section C22 (rows A344-A358: "Do you have a nonbinding early action plan?", EA closing date, EA notification date, EA applicants, EA admits): ALL BLANK — Yeshiva does NOT have an Early Action plan per the official CDS. Prior DB value 47.62 (TAVILY_ENRICHMENT extracted from Wilf Undergraduate Catalog PDF, NOT a CDS) is unsupported by official CDS and is removed. Tier TAVILY_ENRICHMENT → UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
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
  // Per task scope: don't overwrite hasEarlyDecision (true is correct, matches CDS C21=YES).
  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('63.75'),
      sat25: 1330,
      sat75: 1470,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: new Prisma.Decimal('100.0'),
      eaAcceptanceRate: null,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=63.75, sat25=1330, sat75=1470, intlAR=OFFICIAL_BLANK, oosAR=TERMINAL_PRIVATE, edAR=100.0, eaAR=NOT_OFFERED)',
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
