#!/usr/bin/env tsx
/**
 * Phase 3 — University of San Diego (USD) end-to-end closure of the 7
 * prediction-critical fields.
 *
 * Source: USD CDS 2024-2025 (parsed by Claude from PDF)
 *   URL: https://www.sandiego.edu/facts/documents/cds/cds_2024-25.pdf
 *
 * USD is test-blind/test-free (since 2022): CDS Section C9 SAT/ACT scores
 * are intentionally BLANK because USD does not collect them. Likewise, C21
 * (Early Decision) plan exists but USD left the applicant/admit count cells
 * BLANK. C22 (Early Action) plan exists but the CDS template does not
 * collect EA application/admit counts.
 *
 * All 7 fields upgraded to OFFICIAL (or UNAVAILABLE-terminal where USD
 * structurally cannot publish the value).
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 52.38 → 52.38 (CDS C1 totals: 8,909 admits /
 *                          17,010 applicants = 52.3751%. Value matches prior
 *                          DB; tier upgraded LEGACY_DB → OFFICIAL with
 *                          refreshed provenance.)
 *   - sat25             : 1080  → null  (CDS C9 SAT Composite 25th = BLANK.
 *                          USD is test-blind/test-free since 2022; institution
 *                          does not collect or report SAT scores in CDS.
 *                          Prior SEED/PR-15 heuristic value cleared. Marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *   - sat75             : 1320  → null  (CDS C9 SAT Composite 75th = BLANK,
 *                          same reason as sat25. Prior SEED/PR-15 cleared.)
 *   - intlAcceptanceRate: 49.12 → 49.12 (CDS C1 residency: 420 intl admits /
 *                          855 intl applicants = 49.1228%. Value matches
 *                          prior DB; tier upgraded LEGACY_DB → OFFICIAL.)
 *   - oosAcceptanceRate : 52.56 → null  (USD is a private Catholic
 *                          institution; in-state / out-of-state distinction
 *                          carries no policy meaning. CDS C1 residency does
 *                          report OOS (3,724 / 7,085 = 52.56%), but per
 *                          closure-pipeline convention, private schools →
 *                          UNAVAILABLE/TERMINAL. Prior LEGACY_DB cleared.)
 *   - edAcceptanceRate  : null  → null  (CDS C21: USD offers Early Decision
 *                          ("Yes" checked; ED I closes 11/1, notify 12/15).
 *                          However, USD left the Fall 2024 ED application
 *                          count and ED admit count cells BLANK in the CDS.
 *                          Field stays null. Provenance refreshed from prior
 *                          CDS_LLM_EXTRACT_2026_04 (value=undefined) to
 *                          authoritative CDS_OFFICIAL pull marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *   - eaAcceptanceRate  : null  → null  (CDS C22: USD offers nonbinding EA
 *                          ("Yes" checked; closes 11/1, notify 12/15;
 *                          non-restrictive). However, the CDS C22 template
 *                          does NOT collect EA application/admit counts —
 *                          only plan existence and dates. Provenance refreshed
 *                          to OFFICIAL/OFFICIAL_BLANK_SECTION.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const USD_CDS_URL =
  'https://www.sandiego.edu/facts/documents/cds/cds_2024-25.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8iuf003zz0ti12pe3iq1';

const prisma = new PrismaClient();

async function main() {
  const usd = await prisma.school.findFirst({
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
  if (!usd) throw new Error('University of San Diego not found');
  console.log(`Updating ${usd.name} (${usd.id})`);
  console.log(
    `  current AR=${usd.acceptanceRate?.toString()} sat25=${usd.sat25} sat75=${usd.sat75}`,
  );
  console.log(
    `  current intlAR=${usd.intlAcceptanceRate?.toString()} oosAR=${usd.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${usd.edAcceptanceRate?.toString() ?? 'null'} eaAR=${usd.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: USD_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-batch17-claude',
    generatedBy: 'phase3-usd-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 52.38,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 8,909 admits / 17,010 applicants = 52.3751% (rounded to 52.38%). Men 3,262/6,311; Women 5,646/10,697; Another Gender 1/2. Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL with refreshed provenance.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = BLANK. USD has been test-blind/test-free since 2022 (CDS C8A "SAT or ACT" = "Not used"). The institution does not collect or report SAT scores in CDS. Prior value 1080 was a SEED/PR-15 heuristic with no source attestation; cleared. Field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION (test-blind institution).',
      realDataStatus: 'NOT_COLLECTED',
    },
    sat75: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = BLANK. USD has been test-blind/test-free since 2022; institution does not collect or report SAT scores in CDS. Prior value 1320 was a SEED/PR-15 heuristic; cleared. Field marked UNAVAILABLE/OFFICIAL_BLANK_SECTION (test-blind institution).',
      realDataStatus: 'NOT_COLLECTED',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 49.12,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 420 international admits / 855 international applicants = 49.1228% (rounded to 49.12%). Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'University of San Diego is a private Catholic research university; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table does report OOS (3,724 admits / 7,085 applicants = 52.56%), but the value is not actionable for applicants. Prior LEGACY_DB value (52.56%) cleared. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: USD offers Early Decision ("Yes" checked; ED I closes 11/1, notification 12/15; no ED II row populated). However, USD left the Fall 2024 ED application count and ED admit count cells BLANK in the CDS. Prior provenance was CDS_LLM_EXTRACT_2026_04 (value=undefined). Field stays null and provenance refreshed to authoritative CDS_OFFICIAL pull marked UNAVAILABLE/OFFICIAL_BLANK_SECTION.',
      realDataStatus: 'NOT_PUBLISHED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: USD offers nonbinding Early Action ("Yes" checked; closes 11/1, notification 12/15; non-restrictive). However, the CDS C22 template does NOT collect EA application/admit counts — only plan existence and dates. Prior provenance was CDS_LLM_EXTRACT_2026_04 (value=undefined). Field stays null; provenance refreshed to CDS_OFFICIAL marked UNAVAILABLE/OFFICIAL_BLANK_SECTION.',
      realDataStatus: 'NOT_PUBLISHED',
    },
  };

  const existingMeta = toRecord(usd.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: USD_CDS_URL,
  };

  await prisma.school.update({
    where: { id: usd.id },
    data: {
      acceptanceRate: new Prisma.Decimal('52.38'),
      sat25: null,
      sat75: null,
      intlAcceptanceRate: new Prisma.Decimal('49.12'),
      oosAcceptanceRate: null,
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      hasEarlyDecision: true,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=52.38, sat25=BLANK_SECTION, sat75=BLANK_SECTION, intlAR=49.12, oosAR=N/A, edAR=BLANK_SECTION, eaAR=BLANK_SECTION)',
  );

  const after = await prisma.school.findUnique({
    where: { id: usd.id },
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
