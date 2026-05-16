#!/usr/bin/env tsx
/**
 * Phase 3 — Old Dominion University (ODU) closure of the 7
 *   prediction-critical fields.
 *
 * Source: Old Dominion University Common Data Set 2024-2025
 *   (Fall 2024 entering class), published by Office of
 *   Institutional Effectiveness:
 *   https://www.odu.edu/sites/default/files/2025/documents/common-data-set-2024-2025.pdf
 *
 * ODU is a PUBLIC research university (Norfolk, VA). CDS A2 = Public.
 *
 * CDS 2024-25 facts (extracted directly from ODU's CDS PDF):
 *   Section C1 (Fall 2024 first-time first-year):
 *     - Applied:  men 6,593 + women 8,489 + another 18 = 15,100 (also
 *                 confirmed by "Applied" total field = 15,100)
 *     - Admitted: men 5,862 + women 7,767 + another 16 = 13,645
 *     - Enrolled: total 2,721 (men 1,232 + women 1,481 + another 8)
 *     - Overall AR = 13,645 / 15,100 = 90.36%
 *   Section C1 residency table (Fall 2024) — fully populated:
 *     - In-state:        applied 11,074 / admitted 10,345 / enrolled 2,487
 *                        in-state AR = 10,345 / 11,074 = 93.42%
 *     - Out-of-state:    applied  3,765 / admitted  3,055 / enrolled   193
 *                        oos AR = 3,055 / 3,765 = 81.14%
 *     - International:   applied    261 / admitted    245 / enrolled    41
 *                        intl AR = 245 / 261 = 93.87%
 *     (15,100 applied total matches 11,074 + 3,765 + 261 = 15,100. ✓)
 *   Section C9 (enrolled first-time first-year SAT/ACT, Fall 2024):
 *     - 13% submitted SAT (n=365); 2% submitted ACT (n=47)
 *     - SAT Composite: 25th=1120, 50th=1200, 75th=1270
 *     - SAT EBRW: 570 / - / 650; SAT Math: 530 / - / 630
 *     - ACT Composite: 24 / - / 29
 *   Section C8: SAT/ACT "Required for some" — selective test policy.
 *   Section C21 Early Decision: data fields BLANK in ODU's CDS C21
 *     ("Number of early decision applications received" — empty;
 *      "Number of applicants admitted under early decision plan" — empty).
 *     ODU does NOT offer Early Decision; admissions are rolling
 *     (CDS shows priority date but no binding ED round).
 *   Section C22 Early Action: ODU does not have an EA section
 *     reporting EA applied/admitted numbers in its CDS. ODU operates
 *     on rolling priority deadlines, not a binding EA round.
 *
 * NOTE on prior DB state — every value below the official AR was either
 * mis-sourced or a stale legacy figure:
 *   - acceptanceRate=90.4   tier=VERIFIED_REAL src=LEGACY_DB_VALUE
 *     (with correct ODU CDS URL). Updates to CDS 90.36 (tiny delta -0.04).
 *   - sat25=1120, sat75=1280 — sat25 correct, but sat75 1280 is OFF
 *     (CDS says 1270). Provenance URL pointed at clastify.com
 *     (third-party scrape, not CDS).
 *   - intlAR=93.9       tier=VERIFIED_REAL src=LEGACY_DB_VALUE.
 *     Matches CDS 93.87 (rounding 93.87 ~ 93.9). Re-anchor to OFFICIAL.
 *   - oosAR=81.1        tier=VERIFIED_REAL src=LEGACY_DB_VALUE.
 *     Matches CDS 81.14. Re-anchor to OFFICIAL.
 *   - edAR=100          tier=VERIFIED_REAL src=TAVILY_ENRICHMENT —
 *     suspicious 100% value. CDS C21 fields are BLANK; ODU does not
 *     offer ED. Convert to NOT_OFFERED, null out.
 *   - eaAR=88.83        tier=VERIFIED_REAL src=LEGACY_DB_VALUE — ODU's
 *     CDS does not report an EA round. Setting to NOT_OFFERED.
 *   - hasEarlyDecision=true — wrong per CDS (no ED). Correct to false.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.odu.edu/sites/default/files/2025/documents/common-data-set-2024-2025.pdf';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8itg003kz0tikwvhzllw';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (ODU) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC VA]`);
  console.log(
    `  current AR=${school.acceptanceRate?.toString()} sat25=${school.sat25} sat75=${school.sat75}`,
  );
  console.log(
    `  current intlAR=${school.intlAcceptanceRate?.toString()} oosAR=${school.oosAcceptanceRate?.toString()} edAR=${school.edAcceptanceRate?.toString() ?? 'null'} eaAR=${school.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-batch28-claude',
    generatedBy: 'phase3-odu-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 90.36,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 15,100 first-time first-year applicants (men 6,593 + women 8,489 + another 18 — also confirmed by "Applied" total = 15,100), 13,645 admits (men 5,862 + women 7,767 + another 16). AR = 13,645 / 15,100 = 90.36%. Minor delta -0.04 from prior 90.4. Tier LEGACY_DB_VALUE -> OFFICIAL/CDS_OFFICIAL with ODU\'s own CDS (URL was already correct).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1120,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'CDS 2024-25 Section C9 SAT Composite 25th = 1120. Matches DB value exactly; tier re-anchored OFFICIAL/CDS_PDF_AUTO (prior URL clastify.com — third-party scrape, not CDS) -> OFFICIAL/CDS_OFFICIAL with ODU\'s own CDS. NOTE: ODU is "Required for some" per C8; only 13% (n=365) of enrolled FTFY submitted SAT.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1270,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        "CDS 2024-25 Section C9 SAT Composite 75th = 1270. CORRECTION DOWN -10 from prior 1280 (wrong-source clastify.com). Tier OFFICIAL/CDS_PDF_AUTO -> OFFICIAL/CDS_OFFICIAL with ODU's own CDS.",
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 93.87,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency breakdown: international applied 261, admitted 245. intlAR = 245/261 = 93.870%, rounds to 93.87%. Prior DB 93.9 was a rounded version of the same number tagged LEGACY_DB_VALUE; re-anchor to OFFICIAL with full precision.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 81.14,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency breakdown: out-of-state applied 3,765, admitted 3,055. oosAR = 3,055/3,765 = 81.143%, rounds to 81.14%. Prior DB 81.1 was a rounded version of the same number tagged LEGACY_DB_VALUE; re-anchor to OFFICIAL. ODU is PUBLIC VA; OOS distinction is policy-meaningful (in-state admit rate is much higher: 10,345/11,074 = 93.42%).',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      value: null,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Number of early decision applications received" — BLANK; "Number of applicants admitted under early decision plan" — BLANK. ODU does NOT offer Early Decision; admissions are rolling with priority deadlines (no binding ED round). Prior DB value 100 (TAVILY_ENRICHMENT) is a fabrication — no ED round means no ED admit rate can exist. Nulling the value; setting to NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      value: null,
      policyLabel: 'Early Action admit rate',
      reason:
        "CDS 2024-25: ODU's CDS does not include EA applied/admitted statistics. ODU operates on rolling priority deadlines, not a binding/non-binding EA round. Prior DB value 88.83 (LEGACY_DB_VALUE) has no official basis as an EA admit rate. Nulling the value; setting to NOT_OFFERED.",
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
      acceptanceRate: new Prisma.Decimal('90.36'),
      sat25: 1120,
      sat75: 1270,
      intlAcceptanceRate: new Prisma.Decimal('93.87'),
      oosAcceptanceRate: new Prisma.Decimal('81.14'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS shows no ED — correct stale DB true.
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  updated 7 fields (AR=90.36, sat25=1120, sat75=1270, intlAR=93.87, oosAR=81.14, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
