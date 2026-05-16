#!/usr/bin/env tsx
/**
 * Phase 3 — University of Texas at San Antonio (UTSA) closure of the 7
 *   prediction-critical fields.
 *
 * Source: UTSA Common Data Set 2024-2025 (Fall 2024 entering class),
 *   published by Office of Institutional Research:
 *   https://www.utsa.edu/ir/docs/resources/commonDataSet/CDS_2024-2025.xlsx
 *
 * UTSA is a PUBLIC research university (San Antonio, TX; UT System).
 *
 * CDS 2024-25 facts (extracted from official XLSX):
 *   Section C1 (Fall 2024 first-time first-year):
 *     - Total applied: 25,422 (men 11,053 + women 14,369)
 *     - Total admitted: 22,063 (men 9,330 + women 12,733)
 *     - Total enrolled: 5,980
 *     - Overall AR = 22,063 / 25,422 = 86.79%
 *   Section C1 residency table (Fall 2024):
 *     - In-state:        applied 23,871 / admitted 20,828
 *     - Out-of-state:    applied  1,093 / admitted    793 → 72.55%
 *     - International:   applied    458 / admitted    442 → 96.51%
 *   Section C9 (enrolled first-time first-year SAT/ACT):
 *     - 61% submitted SAT, 7% submitted ACT
 *     - SAT Composite: 25th=1010, 50th=1110, 75th=1210
 *     - SAT EBRW: 510 / 560 / 620; SAT Math: 490 / 540 / 600
 *     - ACT Composite: 19 / 23 / 25
 *   Section C21 Early Decision: NO (box F327=X)
 *   Section C22 Early Action: NO (box F343=X)
 *
 * NOTE on DB starting state: the prior LEGACY_DB_VALUE rows on
 *   acceptanceRate, intlAcceptanceRate, and oosAcceptanceRate all had
 *   their sourceUrl POINTING AT TEXAS A&M's CDS PDF
 *   (https://abpa.tamu.edu/.../CDS-2024-2025_TexasA-M.pdf). That is a
 *   provenance bug — the prior numbers (57.32 / 56.53 / 48.71) were
 *   either Texas A&M's numbers misattributed to UTSA or some other
 *   fabrication. None of them match UTSA's actual CDS 2024-25.
 *   The corrections below re-anchor to UTSA's own CDS.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 57.32 -> 86.79  (LARGE CORRECTION +29.47; prior
 *                          value was wrong-school provenance. CDS 22,063 /
 *                          25,422 = 0.86793. Tier LEGACY_DB_VALUE/wrong-URL
 *                          -> OFFICIAL/CDS_OFFICIAL.)
 *   - sat25             : 1010  -> 1010   (CDS Composite 25th = 1010;
 *                          matches DB. Tier upgraded OFFICIAL/CDS_PDF_AUTO
 *                          (cogn-iq.org URL — not CDS) -> OFFICIAL/CDS_OFFICIAL
 *                          with proper UTSA CDS URL.)
 *   - sat75             : 1220  -> 1210   (CORRECTION DOWN -10; CDS
 *                          Composite 75th = 1210, not 1220. Tier upgraded
 *                          OFFICIAL/CDS_PDF_AUTO (cogn-iq.org URL) ->
 *                          OFFICIAL/CDS_OFFICIAL.)
 *   - intlAcceptanceRate: 56.53 -> 96.51  (LARGE CORRECTION +39.98; CDS
 *                          intl 442 / 458 = 0.96506. UTSA admits nearly
 *                          all int'l applicants — consistent with a
 *                          tuition-driven public R1 in Texas.)
 *   - oosAcceptanceRate : 48.71 -> 72.55  (LARGE CORRECTION +23.84; CDS
 *                          OOS 793 / 1,093 = 0.72553.)
 *   - edAcceptanceRate  : null  -> null   (CDS C21 "No". Already null;
 *                          re-anchored OFFICIAL/CDS_LLM_EXTRACT (stale
 *                          tea.texas.gov URL — not CDS) -> UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : null  -> null   (CDS C22 "No". Same treatment.)
 *
 * NOTE on hasEarlyDecision: DB has true, but CDS C21 "No". Correcting
 *   to false.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.utsa.edu/ir/docs/resources/commonDataSet/CDS_2024-2025.xlsx';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8isz003fz0tisq77swxo';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UTSA) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC TX/UT System]`);
  console.log(
    `  current AR=${school.acceptanceRate?.toString()} sat25=${school.sat25} sat75=${school.sat75}`,
  );
  console.log(
    `  current intlAR=${school.intlAcceptanceRate?.toString()} oosAR=${school.oosAcceptanceRate?.toString()}`,
  );

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-batch27-claude',
    generatedBy: 'phase3-utsa-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 86.79,
      policyLabel: 'Overall admit rate',
      reason:
        "CDS 2024-25 Section C1: 25,422 first-time first-year applicants (men 11,053 + women 14,369), 22,063 admits (men 9,330 + women 12,733). AR = 22,063 / 25,422 = 86.79%. LARGE CORRECTION +29.47 from prior 57.32 (LEGACY_DB_VALUE wrongly sourced from Texas A&M's CDS PDF). Tier LEGACY_DB_VALUE/wrong-URL -> OFFICIAL/CDS_OFFICIAL with UTSA's own CDS.",
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1010,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        "CDS 2024-25 Section C9 SAT Composite 25th = 1010. Matches DB exactly; tier upgraded OFFICIAL/CDS_PDF_AUTO (prior URL cogn-iq.org — third-party scrape, not CDS) -> OFFICIAL/CDS_OFFICIAL with UTSA's own CDS XLSX. NOTE: UTSA is test-optional for Fall 2025; 61% (3,648) of enrolled submitted SAT, 7% ACT.",
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1210,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        "CDS 2024-25 Section C9 SAT Composite 75th = 1210. CORRECTION DOWN -10 from prior 1220 (wrong-source cogn-iq.org). Tier upgraded OFFICIAL/CDS_PDF_AUTO -> OFFICIAL/CDS_OFFICIAL with UTSA's own CDS.",
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 96.51,
      policyLabel: 'International admit rate',
      reason:
        "CDS 2024-25 Section C1 residency breakdown: international applied 458, admitted 442. intlAR = 442/458 = 96.506%, rounds to 96.51%. LARGE CORRECTION +39.98 from prior 56.53 (LEGACY_DB_VALUE wrongly sourced from Texas A&M's CDS PDF). UTSA admits nearly all international applicants — consistent with a public R1 in Texas where international undergrad enrollment is small but unrestricted.",
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 72.55,
      policyLabel: 'Out-of-state admit rate',
      reason:
        "CDS 2024-25 Section C1 residency breakdown: out-of-state applied 1,093, admitted 793. oosAR = 793/1,093 = 72.553%, rounds to 72.55%. LARGE CORRECTION +23.84 from prior 48.71 (LEGACY_DB_VALUE wrongly sourced from Texas A&M's CDS PDF). UTSA is PUBLIC; OOS distinction is policy-meaningful.",
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      value: null,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked (F327=X). UTSA does not offer Early Decision. Field stays null. Tier transitions OFFICIAL/CDS_LLM_EXTRACT_2026_04 (stale tea.texas.gov URL — not a CDS source) -> UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED with refreshed provenance from UTSA\'s actual CDS.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      value: null,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked (F343=X). UTSA does not offer Early Action. Same treatment as edAcceptanceRate.',
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
      acceptanceRate: new Prisma.Decimal('86.79'),
      sat25: 1010,
      sat75: 1210,
      intlAcceptanceRate: new Prisma.Decimal('96.51'),
      oosAcceptanceRate: new Prisma.Decimal('72.55'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — UTSA does not offer ED; correct stale DB true.
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  updated 7 fields (AR=86.79, sat25=1010, sat75=1210, intlAR=96.51, oosAR=72.55, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
