#!/usr/bin/env tsx
/**
 * Phase 3 — Marquette University (private, Jesuit, R1) end-to-end closure of
 * the 7 prediction-critical fields.
 *
 * Source: Marquette University CDS 2024-2025
 *   URL: https://www.marquette.edu/academic-effectiveness/institutional-research-analysis/documents/cds-2024-2025_final.pdf
 *
 * NOTE: Marquette is a PRIVATE university — per closure-pipeline convention,
 *   oosAcceptanceRate is marked UNAVAILABLE/TERMINAL (in-state vs OOS carries
 *   no policy meaning at a private institution).
 *
 * NOTE: Marquette is **test-optional** (CDS C8A: SAT/ACT row checked
 *   "Not considered for admission" in admission-policies sub-table; C8F notes
 *   test-optional posture). Per closure-pipeline convention, SAT C9 Composite
 *   percentiles are still recorded OFFICIAL for descriptive applicant-profile
 *   use (not as a gating threshold). Only 13.59% of enrolled submitted SAT
 *   and 25.55% submitted ACT in Fall 2024 (~39% total).
 *
 * NOTE on Early plans: prior DB had hasEarlyDecision=true with edAR=undefined.
 *   CDS C21 confirms ED is **NOT** offered (Yes box unchecked; all date and
 *   applicant-count fields blank). CDS C22 confirms EA IS offered (closing
 *   11/15, notification 12/20) but Marquette did not report EA applicant /
 *   admit counts in C22 (CDS template doesn't require them for EA, and the
 *   institution opted not to provide). Setting hasEarlyDecision=false to
 *   reflect CDS reality and marking eaAR UNAVAILABLE/OFFICIAL_BLANK_SECTION.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 81.34  → 81.34 (CDS C1 Total: 15,212 admits / 18,701
 *                          applicants = 81.3486%, rounds to 81.35. Existing
 *                          81.34 within rounding tolerance; refresh tier
 *                          LEGACY_DB_VALUE → OFFICIAL. Use 81.35 exact.)
 *   - sat25             : 1170   → 1220 (CDS C9 SAT Composite 25th = 1220.
 *                          CORRECTION UP +50 from prior 1170 (LEGACY_DB).)
 *   - sat75             : 1350   → 1350 (CDS C9 SAT Composite 75th = 1350.
 *                          Value matches; tier upgraded LEGACY_DB → OFFICIAL.)
 *   - intlAcceptanceRate: 71.34  → 71.34 (CDS C1 residency: 789 intl admits /
 *                          1,106 intl applicants = 71.3382%, rounds to 71.34.
 *                          Value matches; tier LEGACY_DB → OFFICIAL.)
 *   - oosAcceptanceRate : 83.16  → null  (Marquette is a private university.
 *                          CDS C1 residency does report OOS (10,947/13,163 =
 *                          83.16%) but per closure-pipeline convention,
 *                          private schools → UNAVAILABLE/TERMINAL. Prior
 *                          legacy value cleared.)
 *   - edAcceptanceRate  : null   → null  (CDS C21 "No" — Marquette does NOT
 *                          offer ED. Field stays null; tier
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.
 *                          Correct stale hasEarlyDecision=true → false.)
 *   - eaAcceptanceRate  : null   → null  (CDS C22 "Yes" — Marquette offers EA
 *                          with closing 11/15 and notification 12/20, but the
 *                          CDS template / Marquette's filing does not include
 *                          EA applicant or admit counts. No authoritative
 *                          number available; mark
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.marquette.edu/academic-effectiveness/institutional-research-analysis/documents/cds-2024-2025_final.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8inl000yz0ti6wsiqcrv';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Marquette) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(
    `  isPrivate=${school.isPrivate}  [PRIVATE — oosAR cleared per convention]`,
  );
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
    generatedBy: 'phase3-marquette-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 81.35,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 15,212 admits / 18,701 applicants = 81.3486% (rounded to 81.35%). Tier upgraded from LEGACY_DB_VALUE (81.34) to OFFICIAL with minor precision adjustment.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1220,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1220 (reported directly). CORRECTION UP +50 from prior 1170 (LEGACY_DB_VALUE). NOTE: Marquette is test-optional (CDS C8A admission-policies sub-table places SAT/ACT in "Not considered" column; only 13.59% of enrolled submitted SAT, 25.55% submitted ACT); SAT band is recorded for descriptive applicant-profile use only, not as a gating threshold.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1350,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1350 (reported directly). Value matches prior DB; tier upgraded from LEGACY_DB_VALUE to OFFICIAL. NOTE: Marquette is test-optional (see sat25 note); SAT band is descriptive only.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 71.34,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 789 international admits / 1,106 international applicants = 71.3382% (rounded to 71.34%). Value matches prior DB; tier upgraded LEGACY_DB_VALUE → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Marquette University is a private Jesuit institution; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage, no residency-preference admit pathway). CDS C1 residency table does report OOS (10,947 admits / 13,163 applicants = 83.1649%), but the value is not actionable for applicants. Prior legacy DB value (83.16) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked (all ED date and applicant-count fields blank). Marquette does not offer Early Decision. Stale DB hasEarlyDecision=true corrected to false. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance refreshed to 2024-25 cycle.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: Marquette offers a nonbinding Early Action plan ("Yes" checked) with closing 11/15 and notification 12/20 (non-restrictive). However, the CDS C22 template / Marquette\'s filing does not include EA applicant or admit counts (only the closing/notification dates are reported). No authoritative number available; mark UNAVAILABLE/OFFICIAL_BLANK_SECTION. Existing provenance refreshed to authoritative CDS pull.',
      realDataStatus: 'NOT_REPORTED_IN_CDS',
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
  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('81.35'),
      sat25: 1220,
      sat75: 1350,
      intlAcceptanceRate: new Prisma.Decimal('71.34'),
      oosAcceptanceRate: null,
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — Marquette does NOT offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=81.35, sat25=1220, sat75=1350, intlAR=71.34, oosAR=N/A, edAR=NOT_OFFERED, eaAR=NOT_REPORTED, hasED=false)',
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
