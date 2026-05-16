#!/usr/bin/env tsx
/**
 * Phase 3 — Texas A&M University (public, College Station) end-to-end closure
 * of the 7 prediction-critical fields.
 *
 * Source: Texas A&M CDS 2024-2025 (Fall 2024 entering class)
 *   URL: https://abpa.tamu.edu/getattachment/439f54fe-1105-48af-955a-405775f80872/CDS-2024-2025_TexasA-M.pdf
 *
 * Public CSU-style institution — oosAcceptanceRate is in eligible scope, MUST
 * carry a real OFFICIAL number from CDS C1 residency table.
 *
 * TAMU is test-optional ("Not required for admission, but consider if
 * submitted" — CDS C8A). CDS C9 SAT Composite percentiles still recorded as
 * OFFICIAL for descriptive applicant-profile use.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 57.32 -> 57.32  (CDS C1: 31,472 admits / 54,905
 *                          applicants = 57.3208%. Value unchanged; tier
 *                          upgraded LEGACY_DB->OFFICIAL with refreshed
 *                          provenance.)
 *   - sat25             : 1190  -> 1160   (CDS C9: SAT Composite 25th = 1160
 *                          reported directly. CORRECTION DOWN -30 from prior
 *                          1190 (SEED/LEGACY_DB heuristic).)
 *   - sat75             : 1360  -> 1390   (CDS C9: SAT Composite 75th = 1390
 *                          reported directly. CORRECTION UP +30 from prior
 *                          1360 (SEED/LEGACY_DB heuristic).)
 *   - intlAcceptanceRate: 56.53 -> 56.53  (CDS C1 residency: 1,251 intl admits
 *                          / 2,213 intl applicants = 56.5296%. Value matches
 *                          prior DB; tier upgraded LEGACY_DB->OFFICIAL.)
 *   - oosAcceptanceRate : 49    -> 48.71  (CDS C1 residency: 4,142 OOS admits
 *                          / 8,504 OOS applicants = 48.7065%. Minor precision
 *                          upgrade from prior 49. Tier LEGACY_DB->OFFICIAL.
 *                          TAMU is a PUBLIC TX flagship — in-state vs OOS
 *                          distinction carries real policy meaning.)
 *   - edAcceptanceRate  : null  -> null   (CDS C21: "No" — TAMU does not offer
 *                          Early Decision. Field stays cleared,
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : null  -> null   (CDS C22: "Yes" — TAMU offers
 *                          nonbinding Early Action with 10/15 closing date,
 *                          BUT EA applicant/admit counts are BLANK in CDS.
 *                          Field stays cleared,
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/COUNTS_NOT_PUBLISHED.
 *                          Prior provenance source CDS_LLM_EXTRACT_2026_04 had
 *                          undefined value/blank section semantics — refreshed
 *                          to authoritative 2024-25 CDS pull.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://abpa.tamu.edu/getattachment/439f54fe-1105-48af-955a-405775f80872/CDS-2024-2025_TexasA-M.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmn1htkqc001bvqf22zfkx827';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Texas A&M) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC — TX flagship]`);
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
    generatedBy: 'phase3-tamu-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 57.32,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 31,472 admits (men 15,617 + women 15,855) / 54,905 applicants (men 27,374 + women 27,531) = 57.3208% (rounded to 57.32%). Value matches prior DB; tier upgraded LEGACY_DB->OFFICIAL with authoritative CDS source.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1160,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1160 (reported directly; EBRW 580 + Math 570 = 1150 differs because composite quantiles != section sums). CORRECTION DOWN -30 from prior 1190 (SEED/LEGACY_DB heuristic). NOTE: TAMU is test-optional (CDS C8A: "Not required for admission, but consider if submitted"); SAT band is recorded for descriptive applicant-profile use only.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1390,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1390 (reported directly; EBRW 690 + Math 710 = 1400 differs slightly because composite quantiles != section sums). CORRECTION UP +30 from prior 1360 (SEED/LEGACY_DB heuristic). NOTE: TAMU is test-optional; SAT band is descriptive only.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 56.53,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 1,251 international admits / 2,213 international applicants = 56.5296% (rounded to 56.53%). Value matches prior DB; tier upgraded LEGACY_DB->OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 48.71,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 4,142 out-of-state admits / 8,504 out-of-state applicants = 48.7065% (rounded to 48.71%). TAMU is a PUBLIC TX flagship — in-state vs. out-of-state distinction carries real policy meaning (different tuition tiers, residency-preference Texas Top 10% pathway), so oosAR is in eligible scope and MUST carry a real CDS number. Minor precision adjustment from prior LEGACY_DB value 49. Tier upgraded LEGACY_DB->OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. Texas A&M does not offer Early Decision. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance refreshed to 2024-25 cycle CDS authoritative pull.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — YES checked (EA closing date 10/15). Texas A&M offers nonbinding Early Action, BUT CDS C22 applicant/admit counts are BLANK (not published). Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Prior provenance source CDS_LLM_EXTRACT_2026_04 had undefined value/blank section semantics — refreshed to authoritative 2024-25 CDS pull with same UNAVAILABLE-terminal/COUNTS_NOT_PUBLISHED designation.',
      realDataStatus: 'OFFICIAL_BLANK_SECTION',
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
      acceptanceRate: new Prisma.Decimal('57.32'),
      sat25: 1160,
      sat75: 1390,
      intlAcceptanceRate: new Prisma.Decimal('56.53'),
      oosAcceptanceRate: new Prisma.Decimal('48.71'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — TAMU does not offer ED; existing DB already false
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  updated 7 fields (AR=57.32, sat25=1160, sat75=1390, intlAR=56.53, oosAR=48.71, edAR=NOT_OFFERED, eaAR=OFFICIAL_BLANK_SECTION, hasED=false)',
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
