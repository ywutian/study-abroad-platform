#!/usr/bin/env tsx
/**
 * Phase 3 — University of Georgia (UGA, public flagship) end-to-end closure
 * of the 7 prediction-critical fields.
 *
 * Source: UGA CDS 2024-2025 (Fall 2024 entering class)
 *   URL: http://oir.uga.edu/wp-content/uploads/UGA_CDS_2024-2025.pdf
 *
 * Public GA flagship — oosAcceptanceRate is in eligible scope, MUST carry a
 * real OFFICIAL number from CDS C1 residency table.
 *
 * UGA C8A: SAT/ACT "Required to be considered for admission" — actively used
 * for admission decisions. CDS C9 SAT Composite percentiles are OFFICIAL
 * gating-threshold proxies.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 37.9  -> 37.92  (CDS C1: 16,092 admits (men 6,271 +
 *                          women 9,821) / 42,436 applicants = 37.9211%. Minor
 *                          precision upgrade from prior 37.9. Tier
 *                          LEGACY_DB->OFFICIAL.)
 *   - sat25             : 1250  -> 1220   (CDS C9: SAT Composite 25th = 1220
 *                          reported directly. CORRECTION DOWN -30 from prior
 *                          1250 (LEGACY_DB heuristic).)
 *   - sat75             : 1380  -> 1400   (CDS C9: SAT Composite 75th = 1400
 *                          reported directly. CORRECTION UP +20 from prior
 *                          1380 (LEGACY_DB heuristic).)
 *   - intlAcceptanceRate: 20.9  -> 20.91  (CDS C1 residency: 268 intl admits /
 *                          1,282 intl applicants = 20.9048%. Value matches
 *                          prior DB; tier upgraded LEGACY_DB->OFFICIAL.)
 *   - oosAcceptanceRate : 31.1  -> 31.10  (CDS C1 residency: 6,878 OOS admits
 *                          / 22,113 OOS applicants = 31.1039%. Value matches
 *                          prior DB; tier upgraded LEGACY_DB->OFFICIAL. UGA is
 *                          GA flagship — in-state vs OOS distinction has real
 *                          policy meaning.)
 *   - edAcceptanceRate  : null  -> null   (CDS C21: "No" — UGA does not offer
 *                          Early Decision. Field stays cleared,
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : 31.2  -> null   (CDS C22: "Yes" — UGA offers
 *                          nonbinding Early Action with 10/15 closing and 12/1
 *                          notification dates, BUT CDS C22 applicant/admit
 *                          counts are BLANK (not published in CDS). Prior DB
 *                          value 31.2 came from TAVILY_ENRICHMENT (lower-tier
 *                          aggregator). Per closure-pipeline convention CDS is
 *                          the authoritative source — when CDS is silent on
 *                          counts, field must be cleared to
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/COUNTS_NOT_PUBLISHED
 *                          even if EA is offered.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL = 'http://oir.uga.edu/wp-content/uploads/UGA_CDS_2024-2025.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmn1htkqf001cvqf2vdqpa1he';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UGA) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC — GA flagship]`);
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
    generatedBy: 'phase3-uga-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 37.92,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 16,092 admits (men 6,271 + women 9,821) / 42,436 applicants (men 17,624 + women 24,806 + unknown 6) = 37.9211% (rounded to 37.92%). Minor precision upgrade from prior 37.9. Tier upgraded LEGACY_DB->OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1220,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1220 (reported directly; EBRW 620 + Math 600 = 1220 also coincides). CORRECTION DOWN -30 from prior 1250 (LEGACY_DB heuristic). 70.00% of Fall 2024 enrolled submitted SAT (UGA is test-required per CDS C8A).',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1400,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1400 (reported directly; EBRW 710 + Math 710 = 1420 differs because composite quantiles != section sums). CORRECTION UP +20 from prior 1380 (LEGACY_DB heuristic).',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 20.91,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 268 international admits / 1,282 international applicants = 20.9048% (rounded to 20.91%). Value essentially matches prior DB (20.9); tier upgraded LEGACY_DB->OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 31.1,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 6,878 out-of-state admits / 22,113 out-of-state applicants = 31.1039% (rounded to 31.10%). UGA is GA public flagship — in-state vs. out-of-state distinction carries real policy meaning (different tuition, in-state preference via HOPE scholarship pathway), so oosAR is in eligible scope and MUST carry a real CDS number. Value matches prior DB; tier upgraded LEGACY_DB->OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. UGA does not offer Early Decision (only nonbinding Early Action). Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance refreshed to 2024-25 cycle CDS authoritative pull.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — YES checked (EA closing 10/15, notification 12/1, non-restrictive). UGA offers nonbinding Early Action, BUT CDS C22 applicant/admit counts are BLANK (not published in CDS). Prior DB value 31.2 came from TAVILY_ENRICHMENT (lower-tier aggregator). Per closure-pipeline convention CDS is the authoritative source — when CDS is silent on counts, field is cleared to UNAVAILABLE/OFFICIAL_BLANK_SECTION/COUNTS_NOT_PUBLISHED even though EA is offered.',
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
      acceptanceRate: new Prisma.Decimal('37.92'),
      sat25: 1220,
      sat75: 1400,
      intlAcceptanceRate: new Prisma.Decimal('20.91'),
      oosAcceptanceRate: new Prisma.Decimal('31.10'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — UGA does not offer ED; existing DB already false
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  updated 7 fields (AR=37.92, sat25=1220, sat75=1400, intlAR=20.91, oosAR=31.10, edAR=NOT_OFFERED, eaAR=OFFICIAL_BLANK_SECTION, hasED=false)',
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
