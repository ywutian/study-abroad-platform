#!/usr/bin/env tsx
/**
 * Phase 3 batch 10 — University of Illinois Urbana-Champaign (UIUC) end-to-end
 * closure of the 7 prediction-critical fields.
 *
 * Source: UIUC Common Data Set 2024-2025 (Fall 2024 entering class),
 *   published by UIUC Division of Management Information (DMI) / Office of
 *   Institutional Research. Distributed as an .xlsx workbook (not PDF) keyed
 *   by question codes (C101..C2204) instead of section labels.
 *   XLSX: https://www.dmi.illinois.edu/stuenr/misc/cds_2024_2025.xlsx
 *   Index: https://ir.illinois.edu/common-data-set.html
 *
 * KEY UIUC POLICIES (drive the closure decisions):
 *   - UIUC is **test-optional** (CDS 2024-25 C801: "Does your institution make
 *     use of SAT or ACT scores in admission decisions? — Y"; C802 SAT or ACT
 *     marked "Not required for admission, but considered if submitted"; C8F
 *     clarifies "test optional"). Reports SAT/ACT percentiles in C9 for
 *     submitting students (C901 41.28% submitted SAT, C902 14.33% submitted
 *     ACT). SAT Composite 25/75 are recorded as OFFICIAL per closure-pipeline
 *     convention (test-optional ≠ test-blind — UIUC actively collects and
 *     publishes scores).
 *   - UIUC is a **public** Big Ten institution. UIUC reports residency
 *     breakdown explicitly in C120-C128 (in-state / OOS / international). OOS
 *     / international admit rates carry real policy meaning (nonresident
 *     tuition surcharge), so per closure convention they MUST carry a real
 *     OFFICIAL CDS number, never TERMINAL.
 *   - UIUC does NOT offer Early Decision (CDS C2101 "N"). -> edAR cleared,
 *     UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.
 *   - UIUC DOES offer Early Action (CDS C2201 "Y"; closing 11/1, notification
 *     1/31, non-restrictive). HOWEVER C22 in this CDS does NOT publish EA
 *     applicant or admit counts — only dates and restrictive flag. Per
 *     closure-pipeline convention an offered-but-unpublished plan is recorded
 *     as eaAR=null tier=UNAVAILABLE source=OFFICIAL_BLANK_SECTION (the
 *     section is officially blank for the metric).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 42.4   -> 42.37  (UIUC CDS 2024-25 C117 / C118:
 *                          31,247 admits / 73,742 applicants = 42.3733%
 *                          (rounds to 42.37%). Cross-check: C101+C102+C103+
 *                          C104 = 41,597 M + 32,124 F + 0 + 21 = 73,742;
 *                          C105+C106+C107+C108 = 15,134 + 16,102 + 0 + 11 =
 *                          31,247. Matches. Minor precision adjustment
 *                          -0.03pp from prior LEGACY_DB 42.4. Tier upgraded
 *                          LEGACY_DB -> OFFICIAL, sourced from UIUC DMI CDS.)
 *   - sat25             : 1320   -> 1390   (UIUC CDS 2024-25 C905: SAT
 *                          Composite 25th = 1390 (reported directly).
 *                          CORRECTION UP +70 from prior LEGACY_DB 1320
 *                          (older cycle). UIUC is test-optional — scores
 *                          actively collected and published — so SAT
 *                          percentile IS recorded as OFFICIAL per closure-
 *                          pipeline convention.)
 *   - sat75             : 1470   -> 1520   (UIUC CDS 2024-25 C907: SAT
 *                          Composite 75th = 1520. CORRECTION UP +50 from
 *                          prior LEGACY_DB 1470.)
 *   - intlAcceptanceRate: 33.5   -> 33.53  (UIUC CDS 2024-25 C126 / C127:
 *                          6,181 international admits / 18,437 international
 *                          applicants = 33.5304% (rounds to 33.53%). Minor
 *                          precision adjustment +0.03pp from prior
 *                          LEGACY_DB 33.5. Tier upgraded LEGACY_DB ->
 *                          OFFICIAL.)
 *   - oosAcceptanceRate : 36.2   -> 36.20  (UIUC CDS 2024-25 C123 / C124:
 *                          9,983 out-of-state admits / 27,575 out-of-state
 *                          applicants = 36.2031% (rounds to 36.20%). UIUC
 *                          is a public Big Ten institution — in-state vs.
 *                          OOS distinction carries real policy meaning
 *                          (nonresident tuition surcharge), so this field
 *                          MUST carry a real CDS number and is NOT marked
 *                          TERMINAL. Effectively unchanged from prior
 *                          LEGACY_DB 36.2 (+0.00pp). Tier upgraded
 *                          LEGACY_DB -> OFFICIAL.)
 *   - edAcceptanceRate  : null   -> null   (UIUC CDS 2024-25 C2101: "N".
 *                          UIUC does not offer Early Decision. Field stays
 *                          cleared. Provenance anchored to UIUC DMI CDS as
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : null   -> null   (UIUC CDS 2024-25 C2201: "Y" —
 *                          EA offered (11/1 closing, 1/31 notification,
 *                          non-restrictive). HOWEVER C22 does NOT publish EA
 *                          applicant or admit counts (only ED has C2106/
 *                          C2107 numeric fields). Per closure-pipeline
 *                          convention an offered-but-unpublished plan is
 *                          recorded as eaAR=null tier=UNAVAILABLE source=
 *                          OFFICIAL_BLANK_SECTION (the section is officially
 *                          blank for the metric).)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL = 'https://www.dmi.illinois.edu/stuenr/misc/cds_2024_2025.xlsx';
const CDS_INDEX_URL = 'https://ir.illinois.edu/common-data-set.html';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmn1htkpe0010vqf2xzzjz779';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UIUC) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(
    `  isPrivate=${school.isPrivate}  [PUBLIC Big Ten — oosAR must be OFFICIAL]`,
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
    generatedBy: 'phase3-batch10-uiuc-validation',
    notes: `CDS index: ${CDS_INDEX_URL}`,
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 42.37,
      policyLabel: 'Overall admit rate',
      reason:
        'UIUC CDS 2024-25 C117 / C118: 31,247 admits / 73,742 applicants = 42.3733% (rounds to 42.37%). Cross-check: C101+C102+C103+C104 = 41,597 M + 32,124 F + 0 + 21 = 73,742; C105+C106+C107+C108 = 15,134 + 16,102 + 0 + 11 = 31,247. Gender totals match residency totals. Minor precision adjustment -0.03pp from prior LEGACY_DB 42.4. Tier upgraded LEGACY_DB -> OFFICIAL, sourced from UIUC DMI CDS xlsx.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1390,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'UIUC CDS 2024-25 C905: SAT Composite 25th Percentile = 1390 (reported directly). UIUC is test-optional (CDS C801=Y, C802 SAT/ACT marked "Not required for admission, but considered if submitted", C8F clarifies "test optional") — scores actively collected and published, so SAT percentile IS recorded as OFFICIAL per closure-pipeline convention. 41.28% of enrollees submitted SAT (C901), 14.33% ACT (C902). CORRECTION UP +70 from prior LEGACY_DB 1320 (older cycle). Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1520,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'UIUC CDS 2024-25 C907: SAT Composite 75th Percentile = 1520 (reported directly). UIUC is test-optional but reports scores. CORRECTION UP +50 from prior LEGACY_DB 1470. Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 33.53,
      policyLabel: 'International admit rate',
      reason:
        'UIUC CDS 2024-25 C126 / C127: 6,181 international admits / 18,437 international applicants = 33.5304% (rounds to 33.53%). Minor precision adjustment +0.03pp from prior LEGACY_DB 33.5. Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 36.2,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'UIUC CDS 2024-25 C123 / C124: 9,983 out-of-state admits / 27,575 out-of-state applicants = 36.2031% (rounds to 36.20%). UIUC is a public Big Ten institution — in-state vs. OOS distinction carries real policy meaning (nonresident tuition surcharge), so this field MUST carry a real CDS number and is NOT marked TERMINAL. Effectively unchanged from prior LEGACY_DB 36.2 (+0.00pp). Tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'UIUC CDS 2024-25 C2101: "Does your institution offer an early decision plan?" — N. UIUC does not offer Early Decision (only Regular Decision and non-restrictive Early Action). Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance anchored to UIUC DMI CDS.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'UIUC CDS 2024-25 C2201: "Do you have a nonbinding early action plan?" — Y. UIUC offers EA (C2202 closing 11/1, C2203 notification 1/31, C2204 restrictive=N — i.e. non-restrictive). HOWEVER C22 in this CDS does NOT publish EA applicant or admit counts (only ED has C2106/C2107 numeric fields). Per closure-pipeline convention an offered-but-unpublished plan is recorded as eaAR=null tier=UNAVAILABLE source=OFFICIAL_BLANK_SECTION (the section is officially blank for the metric).',
      realDataStatus: 'OFFERED_NOT_REPORTED',
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
      acceptanceRate: new Prisma.Decimal('42.37'),
      sat25: 1390,
      sat75: 1520,
      intlAcceptanceRate: new Prisma.Decimal('33.53'),
      oosAcceptanceRate: new Prisma.Decimal('36.20'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C2101 "N" — UIUC does not offer ED. hasEarlyDecision stays false.
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=42.37, sat25=1390, sat75=1520, intlAR=33.53, oosAR=36.20, edAR=NOT_OFFERED, eaAR=OFFERED_NOT_REPORTED, hasED=false)',
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
