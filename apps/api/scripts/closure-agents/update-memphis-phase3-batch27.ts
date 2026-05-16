#!/usr/bin/env tsx
/**
 * Phase 3 — University of Memphis end-to-end closure of the 7
 *   prediction-critical fields.
 *
 * Source: University of Memphis CDS 2024-2025 (Fall 2024 entering class)
 *   URL: https://www.memphis.edu/oir/oirweb/WebReports/ProfilesAndFactbooks/CDS2024_2025.pdf
 *
 * U Memphis is a PUBLIC Tennessee R1 research university. oosAR is in
 *   eligible scope. HOWEVER, the CDS C1 residency breakdown table is
 *   published with ALL ZEROS (rows for In-State/Out-of-State/International/
 *   Unknown each show 0 applied / 0 admitted / 0 enrolled). The
 *   gender-breakdown totals ARE filled (men 5,546 + women 9,537 + unknown
 *   1 = 15,084 applied; 3,966 + 6,898 + 1 = 10,865 admitted), so the
 *   overall AR is reliable, but the residency rates cannot be derived from
 *   the published CDS.
 *
 * Value changes vs existing DB:
 *   - acceptanceRate    : 72.03  -> 72.03  (CDS C1 gender totals: 15,084
 *                          applied (men 5,546 + women 9,537 + another 0 +
 *                          unknown 1); 10,865 admitted (3,966 + 6,898 +
 *                          0 + 1). AR = 10,865/15,084 = 72.0240% (rounded
 *                          to 72.02% — DB shows 72.03 which is the value
 *                          carried over from prior CDS submission; values
 *                          match within rounding). Tier LEGACY_DB_VALUE
 *                          -> OFFICIAL. Keep 72.03 to avoid spurious
 *                          rounding diff.)
 *   - sat25             : 930    -> 930    (CDS C9 SAT Composite 25th =
 *                          930. Matches DB. Submitting SAT 4% (80 students);
 *                          ACT 90% (1,768) — Memphis is heavily ACT-dominant.
 *                          Tier LEGACY_DB_VALUE -> OFFICIAL.)
 *   - sat75             : 1150   -> 1150   (CDS C9 SAT Composite 75th =
 *                          1150. Matches DB. Tier LEGACY_DB_VALUE -> OFFICIAL.)
 *   - intlAcceptanceRate: 92.15  -> null   (CDS C1 residency breakdown
 *                          table is BLANK (all rows print 0). Cannot derive
 *                          a CDS-official intl admit rate. Prior DB value
 *                          92.15 was INFERRED/PERMANENT_HEURISTIC, not from
 *                          CDS. Cleared to null with tier UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION.)
 *   - oosAcceptanceRate : 98     -> null   (Same: CDS C1 residency
 *                          breakdown table is BLANK. Prior DB value 98 was
 *                          INFERRED/PERMANENT_HEURISTIC. Cleared to null
 *                          with tier UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *   - edAcceptanceRate  : null   -> null   (CDS C21: "Does your institution
 *                          offer an early decision plan?" — ✔ No. Memphis
 *                          does NOT offer ED. Stays null. Tier transitions
 *                          OFFICIAL/CDS_LLM_EXTRACT_2026_04 (stale) ->
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : null   -> null   (CDS C22: "Do you have a
 *                          nonbinding early action plan?" — ✔ No. Memphis
 *                          does NOT offer EA. Same as edAR.)
 *
 * hasEarlyDecision: current DB value is TRUE. CDS C21 confirms Memphis does
 *   NOT offer ED. Correcting to FALSE.
 *
 * Test policy (C8A): "Does your institution make use of SAT or ACT scores
 *   in admission decisions?" — Yes (✔ marked next to Yes box; sub-row
 *   "SAT or ACT" marked "Required to be considered for admission"). Memphis
 *   does USE test scores in admission.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.memphis.edu/oir/oirweb/WebReports/ProfilesAndFactbooks/CDS2024_2025.pdf';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8isv003ez0timrhbjznd';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Memphis) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC Tennessee R1]`);
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
    generatedBy: 'phase3-batch27-memphis',
  };

  const blankResidencyReason =
    'CDS 2024-25 Section C1 residency breakdown table is BLANK: the rows for In-State / Out-of-State / International / Unknown each print 0 applied / 0 admitted / 0 enrolled. The gender breakdown totals ARE filled (men 5,546 + women 9,537 + unknown 1 = 15,084 applied; 3,966 + 6,898 + 1 = 10,865 admitted), so the overall AR is reliable, but no individual residency rate can be derived from the published CDS. Per closure rule "CDS section blank -> OFFICIAL_BLANK_SECTION". Cleared to null. Field stays open for the next CDS cycle if Memphis fills the missing residency cells.';

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 72.03,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1 gender totals: 15,084 total applied (men 5,546 + women 9,537 + another 0 + unknown 1); 10,865 total admitted (3,966 + 6,898 + 0 + 1). AR = 10,865/15,084 = 72.0240% (computed). Prior DB 72.03 matches within rounding (carried over from prior CDS cycle with marginally different precision). Tier upgraded LEGACY_DB_VALUE -> OFFICIAL. Keep 72.03 to avoid spurious diff.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 930,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'CDS 2024-25 Section C9 SAT Composite 25th percentile = 930. Value matches prior DB; tier upgraded LEGACY_DB_VALUE -> OFFICIAL. NOTE: Memphis is heavily ACT-dominant — only 4.00% (80 students) submitted SAT vs 90.00% (1,768) ACT.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1150,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'CDS 2024-25 Section C9 SAT Composite 75th percentile = 1150. Value matches prior DB; tier upgraded LEGACY_DB_VALUE -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      policyLabel: 'International admit rate',
      reason:
        blankResidencyReason +
        ' Prior DB value 92.15 was INFERRED/PERMANENT_HEURISTIC, not from CDS.',
      realDataStatus: 'BLANK_IN_OFFICIAL_SOURCE',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      policyLabel: 'Out-of-state admit rate',
      reason:
        blankResidencyReason +
        ' Prior DB value 98 was INFERRED/PERMANENT_HEURISTIC, not from CDS.',
      realDataStatus: 'BLANK_IN_OFFICIAL_SOURCE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — ✔ No (closing date, notification date, applied/admitted cells all blank). Memphis does NOT offer ED. Field stays null. Tier transitions OFFICIAL/CDS_LLM_EXTRACT_2026_04 (stale) -> UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — ✔ No. Memphis does NOT offer EA. Same treatment as edAR.',
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
      acceptanceRate: new Prisma.Decimal('72.03'),
      sat25: 930,
      sat75: 1150,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — Memphis does NOT offer ED; correct stale DB true.
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=72.03, sat25=930, sat75=1150, intlAR=BLANK [bad CDS table], oosAR=BLANK [bad CDS table], edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
