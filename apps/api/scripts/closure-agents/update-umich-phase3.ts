#!/usr/bin/env tsx
/**
 * Phase 3 — University of Michigan, Ann Arbor (UMich) closure of 7
 * prediction-critical fields.
 *
 * Source: UMich CDS 2024-2025 (Fall 2024 entering class), published by Office
 *   of Budget & Planning.
 *   URL: https://obp.umich.edu/wp-content/uploads/pubdata/cds/CDS_2024-25_UMAA.pdf
 *
 * UMich is PUBLIC. Per closure convention, oosAR must carry the real CDS
 * residency number when available. **However**, the UMich CDS 2024-25 C1
 * residency table is structurally BLANK — UMich publishes only the gender
 * totals (98,310 / 15,373 / 7,278) and leaves the In-State / Out-of-State /
 * International cells empty. There is no way to extract a real OOS or
 * international admit rate from this CDS. Therefore intlAR and oosAR are
 * marked UNAVAILABLE / OFFICIAL_BLANK_SECTION (the institution officially
 * declined to publish per-residency admit counts in this cycle), not
 * TERMINAL (the institution is public and the values would be meaningful if
 * published).
 *
 * UMich is **test-optional / SAT-recommended** (C8A "SAT or ACT
 * Recommended"); SAT bands are recorded for descriptive applicant-profile
 * use, not as a gating threshold.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 15.64  -> 15.64  (CDS C1: 15,373 / 98,310 =
 *                          15.6377%. Value confirmed; tier upgraded
 *                          LEGACY_DB -> OFFICIAL.)
 *   - sat25             : 1400   -> 1360  (CDS C9 SAT Composite 25th = 1360
 *                          reported directly. CORRECTION DOWN -40 from prior
 *                          LEGACY_DB 1400.)
 *   - sat75             : 1540   -> 1530  (CDS C9 SAT Composite 75th = 1530
 *                          reported directly. CORRECTION DOWN -10 from prior
 *                          LEGACY_DB 1540.)
 *   - intlAcceptanceRate: 7.08   -> null  (CDS C1 residency International
 *                          admits cell is BLANK in UMich's published CDS.
 *                          Prior LEGACY_DB / heuristic 7.08% cleared. Field
 *                          marked UNAVAILABLE / OFFICIAL_BLANK_SECTION.)
 *   - oosAcceptanceRate : 10.62  -> null  (CDS C1 residency Out-of-State
 *                          cell is BLANK in UMich's published CDS. Prior
 *                          LEGACY_DB / heuristic 10.62% cleared. UMich is
 *                          public — value would be meaningful if published
 *                          — but the institution officially declined to
 *                          report per-residency counts; cannot fabricate.
 *                          Marked UNAVAILABLE / OFFICIAL_BLANK_SECTION, NOT
 *                          TERMINAL.)
 *   - edAcceptanceRate  : null   -> null  (CDS C21 "No" — UMich does not
 *                          offer ED. Stays UNAVAILABLE / NOT_OFFERED.)
 *   - eaAcceptanceRate  : null   -> null  (CDS C22 "Yes" — UMich offers
 *                          non-restrictive EA (closing 11/1, notification
 *                          1/31). But CDS C22 application/admit/enrollment
 *                          counts are BLANK. Stays UNAVAILABLE /
 *                          OFFICIAL_BLANK_SECTION.)
 *
 * hasEarlyDecision: false (CDS C21 "No") — confirmed, no change.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://obp.umich.edu/wp-content/uploads/pubdata/cds/CDS_2024-25_UMAA.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmn1htkoa000kvqf2oqm36hw5';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UMich) not found`);
  console.log(
    `Updating ${school.name} (${school.id})  isPrivate=${school.isPrivate}`,
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
    generatedBy: 'phase3-umich-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 15.64,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 15,373 admits / 98,310 applicants = 15.6377% (rounded to 15.64%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with authoritative UMich Office of Budget & Planning source.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1360,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1360 (reported directly; EBRW 680 + Math 680 sum = 1360 also coincides). CORRECTION DOWN -40 from prior 1400 (LEGACY_DB). 51% of Fall 2024 enrolled (3,697 students) submitted SAT under SAT-recommended (test-optional) policy.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1530,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1530 (reported directly; EBRW 750 + Math 780 sum = 1530 also coincides). CORRECTION DOWN -10 from prior 1540 (LEGACY_DB).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: International cell is BLANK — UMich published only the gender totals (98,310 applicants / 15,373 admits / 7,278 enrolled) and left In-State / Out-of-State / International per-residency cells empty in the published CDS. Prior LEGACY_DB / heuristic value 7.08% cleared. Field marked UNAVAILABLE / OFFICIAL_BLANK_SECTION (institution officially declined to publish).',
      realDataStatus: 'OFFICIALLY_BLANK',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: Out-of-State cell is BLANK — UMich published only the gender totals and left per-residency cells empty in the published CDS. UMich is a PUBLIC institution where the in-state / out-of-state distinction carries real policy meaning (in-state tuition advantage, residency-preference admit pathways), so this field is in eligible scope; however the source itself does not provide the value. Prior LEGACY_DB / heuristic value 10.62% cleared. Field marked UNAVAILABLE / OFFICIAL_BLANK_SECTION (NOT TERMINAL — the institution is public, the value would be meaningful if published, but UMich officially declined to report per-residency counts in this cycle).',
      realDataStatus: 'OFFICIALLY_BLANK',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. UMich does not offer Early Decision. Field stays UNAVAILABLE / OFFICIAL_BLANK_SECTION (NOT_OFFERED). Provenance refreshed to 2024-25 cycle.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: UMich offers nonbinding non-restrictive Early Action (closing 11/1, notification 1/31, restrictive=No). However the C22 application/admit/enrollment count fields are BLANK in the published CDS. Cannot extract an EA admit rate. Prior provenance had tier=OFFICIAL source=CDS_LLM_EXTRACT_2026_04 with no value — semantics preserved but source refreshed to authoritative CDS pull marked UNAVAILABLE / OFFICIAL_BLANK_SECTION.',
      realDataStatus: 'OFFICIALLY_BLANK',
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
      acceptanceRate: new Prisma.Decimal('15.64'),
      sat25: 1360,
      sat75: 1530,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      hasEarlyDecision: false, // re-confirm CDS C21 "No"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=15.64, sat25=1360, sat75=1530, intlAR=BLANK, oosAR=BLANK, edAR=NOT_OFFERED, eaAR=BLANK)',
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
