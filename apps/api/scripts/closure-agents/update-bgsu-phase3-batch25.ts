#!/usr/bin/env tsx
/**
 * Phase 3 — Bowling Green State University (BGSU) closure of the 7
 *   prediction-critical fields.
 *
 * Source situation:
 *   BGSU's CDS page (https://www.bgsu.edu/institutional-research/CDS.html)
 *   exposes data ONLY via a Tableau Public dashboard — NO downloadable
 *   Common Data Set PDF is published. The dashboard does not surface a
 *   C1 residency breakdown publicly.
 *
 * Primary source used:
 *   NCES IPEDS / College Navigator — Fall 2024 admissions data for
 *   institution unitid 201441 (Bowling Green State University-Main Campus).
 *     https://nces.ed.gov/collegenavigator/?id=201441
 *   IPEDS is a federally-mandated official disclosure equivalent in
 *   authority to the CDS for the seven core admit-rate / score fields,
 *   and is the correct fallback when the institution itself does not
 *   publish a CDS PDF.
 *
 * BGSU is a PUBLIC research university (Bowling Green, OH).
 *   NOTE: DB currently records isPrivate=true — that is INCORRECT. BGSU
 *   is part of the Ohio state university system. Setting isPrivate=false.
 *
 * IPEDS Fall 2024 facts:
 *   - Total Applicants:  21,153
 *   - Total Admitted:    17,115 (calculated from 81% acceptance rate;
 *     NCES rounds to whole %; cross-check with collegetuitioncompare.com
 *     shows 80.96% which rounds to 81%).
 *   - Acceptance Rate:   81% (NCES rounded; 80.96% precise)
 *   - SAT EBRW 25/75:    500 / 610
 *   - SAT Math 25/75:    500 / 600
 *   - SAT Composite (sum subscores): 25th = 1000, 75th = 1210
 *   - ACT Composite 25/75: 19 / 26
 *   - 21% of admits enrolled; 21% of enrolled submitted SAT, 61% ACT
 *     (test-optional admission policy).
 *
 * Computed actions:
 *   - acceptanceRate    : 82 -> 80.96 (CORRECTION DOWN -1.04; tier
 *                          LEGACY_DB_VALUE -> SCRAPED with IPEDS URL.
 *                          Not OFFICIAL because IPEDS-derived, not from
 *                          institution-published CDS.)
 *   - sat25             : 1020 -> 1000 (CORRECTION DOWN -20; from IPEDS
 *                          subscore sum 500+500=1000; tier remains
 *                          OFFICIAL but source -> IPEDS_OFFICIAL).
 *                          (Prior was CDS_PDF_AUTO with a prepscholar
 *                          URL — not actually a CDS source.)
 *   - sat75             : 1300 -> 1210 (CORRECTION DOWN -90; from IPEDS
 *                          subscore sum 610+600=1210; same rationale as
 *                          sat25.)
 *   - intlAcceptanceRate: 77.9 -> null (UNAVAILABLE; tier PERMANENT_
 *                          HEURISTIC -> UNAVAILABLE/INSTITUTION_REDACTED.
 *                          BGSU does not publish C1 residency breakdown
 *                          via any public channel — Tableau dashboard
 *                          and IPEDS both omit it. Heuristic 77.9 was
 *                          fabricated; clearing the value.)
 *   - oosAcceptanceRate : 83.64 -> null (UNAVAILABLE; same rationale.
 *                          BGSU is PUBLIC and OOS distinction is policy-
 *                          meaningful, but no source publishes counts.)
 *   - edAcceptanceRate  : null (already OFFICIAL NOT_OFFERED via prior
 *                          LLM extract pointing at the CDS landing page)
 *                          — LEFT UNCHANGED.
 *   - eaAcceptanceRate  : null (already OFFICIAL NOT_OFFERED) — LEFT
 *                          UNCHANGED.
 *
 * NOTE on isPrivate / hasEarlyDecision: DB has isPrivate=true (wrong —
 *   BGSU is public) and hasEarlyDecision=true (no published evidence
 *   of an ED program at BGSU). Correcting both to FALSE.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const IPEDS_URL = 'https://nces.ed.gov/collegenavigator/?id=201441';
const BGSU_CDS_PAGE = 'https://www.bgsu.edu/institutional-research/CDS.html';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8irv002uz0tic1bpn6g4';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (BGSU) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [CORRECTION NEEDED -> PUBLIC]`);
  console.log(
    `  current AR=${school.acceptanceRate?.toString()} sat25=${school.sat25} sat75=${school.sat75}`,
  );
  console.log(
    `  current intlAR=${school.intlAcceptanceRate?.toString()} oosAR=${school.oosAcceptanceRate?.toString()}`,
  );

  const baseProv = {
    sourceUrl: IPEDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-batch25-claude',
    generatedBy: 'phase3-bgsu-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'SCRAPED',
      source: 'IPEDS_OFFICIAL',
      value: 80.96,
      policyLabel: 'Overall admit rate (IPEDS Fall 2024)',
      reason:
        'IPEDS College Navigator Fall 2024 admissions: 21,153 applicants, 81% acceptance rate (NCES rounded); precise value 80.96% (collegetuitioncompare derivation matches). BGSU does NOT publish a CDS PDF (only a Tableau dashboard) — IPEDS is the most authoritative fallback. CORRECTION DOWN -1.04 from prior 82 (LEGACY_DB_VALUE). Tier LEGACY_DB_VALUE -> SCRAPED with IPEDS official URL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'IPEDS_OFFICIAL',
      value: 1000,
      policyLabel: 'SAT composite 25th percentile (IPEDS subscore sum)',
      reason:
        'IPEDS Fall 2024: SAT EBRW 25th=500, SAT Math 25th=500 → composite 25th = 1000. CORRECTION DOWN -20 from prior 1020 (prior source was prepscholar.com mis-labeled as CDS_PDF_AUTO). Source corrected to IPEDS_OFFICIAL. BGSU is test-optional; only 21% of enrolled submitted SAT.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'IPEDS_OFFICIAL',
      value: 1210,
      policyLabel: 'SAT composite 75th percentile (IPEDS subscore sum)',
      reason:
        'IPEDS Fall 2024: SAT EBRW 75th=610, SAT Math 75th=600 → composite 75th = 1210. CORRECTION DOWN -90 from prior 1300 (prior source was prepscholar.com mis-labeled as CDS_PDF_AUTO). Source corrected to IPEDS_OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      sourceUrl: BGSU_CDS_PAGE,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      value: null,
      policyLabel: 'International admit rate',
      reason:
        'BGSU does not publish a downloadable CDS PDF — the institutional CDS page exposes only a Tableau Public dashboard, and IPEDS does not break out admissions by residency. International admit count is therefore UNAVAILABLE. Prior value 77.9 was tier=NULL/source=PERMANENT_HEURISTIC (heuristic fabrication). Tier upgraded PERMANENT_HEURISTIC -> UNAVAILABLE; value cleared to null.',
      realDataStatus: 'INSTITUTION_REDACTED',
    },
    oosAcceptanceRate: {
      ...baseProv,
      sourceUrl: BGSU_CDS_PAGE,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      value: null,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'BGSU does not publish a downloadable CDS PDF — the institutional CDS page exposes only a Tableau Public dashboard, and IPEDS does not break out admissions by residency. OOS admit count is therefore UNAVAILABLE for this public university. Prior value 83.64 was tier=NULL/source=PERMANENT_HEURISTIC (heuristic fabrication). Tier upgraded PERMANENT_HEURISTIC -> UNAVAILABLE; value cleared to null.',
      realDataStatus: 'INSTITUTION_REDACTED',
    },
  };

  const existingMeta = toRecord(school.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: IPEDS_URL,
  };

  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('80.96'),
      sat25: 1000,
      sat75: 1210,
      intlAcceptanceRate: null, // INSTITUTION_REDACTED.
      oosAcceptanceRate: null, // INSTITUTION_REDACTED.
      // edAR / eaAR LEFT UNCHANGED (already OFFICIAL NOT_OFFERED).
      isPrivate: false, // CORRECTION: BGSU is PUBLIC (Ohio state system).
      hasEarlyDecision: false, // No published ED program at BGSU.
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 5 fields (AR=80.96, sat25=1000, sat75=1210, intlAR=UNAVAILABLE, oosAR=UNAVAILABLE) + isPrivate=false + hasED=false',
  );

  const after = await prisma.school.findUnique({
    where: { id: school.id },
    select: {
      isPrivate: true,
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
  console.log(`  isPrivate=${after?.isPrivate}`);
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
