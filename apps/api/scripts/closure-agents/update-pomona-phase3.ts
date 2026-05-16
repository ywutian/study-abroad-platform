#!/usr/bin/env tsx
/**
 * Phase 3 — Pomona College end-to-end closure of the 7 prediction-critical
 * fields.
 *
 * Source: Pomona College Common Data Set 2023-2024 (CDS form dated 2024-04-23,
 *         Fall 2023 entering class).
 *   Landing: https://www.pomona.edu/administration/institutional-research/information-center/common-data-set
 *   PDF:     https://pomona.app.box.com/s/yidnpqoeuamv5tr0jax3c84xefaa9w6u
 *            (Box-hosted; direct download via shared file_id f_1527095516974)
 *
 * Note on cycle: Pomona's most recent CDS available as PDF is 2023-2024 (Fall
 * 2023 cohort). The 2024-2025 cycle is only published as an interactive
 * Tableau dashboard (https://tableau.campus.pomona.edu/views/CDS2024-25),
 * which cannot be parsed deterministically by this pipeline. We therefore use
 * CDS 2023-24 (cycleYear=2023) as the authoritative source.
 *
 * Note on prior DB URL: legacy provenance pointed to cds-2014-2015.pdf (a
 * decade-stale snapshot). All 7 fields refreshed to the current cycle.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 12.19  → 6.76   (CDS C1: 819 admits / 12,121
 *                          applicants (Men 377+Women 440+Another 2 admits /
 *                          Men 4,985+Women 7,133+Another 3 apps) = 6.7569%.
 *                          MAJOR CORRECTION DOWN — prior 12.19 was from the
 *                          decade-old 2014-15 CDS when Pomona had a very
 *                          different admit rate. Tier LEGACY_DB→OFFICIAL.)
 *   - sat25             : 1460   → 1480   (CDS C9: SAT Composite 25th = 1480
 *                          reported directly (EBRW 730 + Math 750 sum = 1480
 *                          coincidentally matches in this case). CORRECTION UP
 *                          from prior 1460 (SEED/PR-15 heuristic).)
 *   - sat75             : 1570   → 1550   (CDS C9: SAT Composite 75th = 1550
 *                          reported directly (EBRW 770 + Math 790 sum = 1560
 *                          differs from composite 1550 because section
 *                          quantiles ≠ composite quantile; per convention
 *                          prefer reported Composite row). CORRECTION DOWN
 *                          from prior 1570 (SEED/PR-15 heuristic).)
 *   - intlAcceptanceRate: 2.8    → null   (CDS 2023-24 C1 residency breakdown
 *                          table is BLANK — Pomona did not publish In-State /
 *                          Out-of-State / International applicant counts for
 *                          this cycle. Prior 2.8 was a heuristic (INFERRED /
 *                          PERMANENT_HEURISTIC) and cannot be verified.
 *                          Cleared and marked UNAVAILABLE / OFFICIAL_BLANK_SECTION.)
 *   - oosAcceptanceRate : 31.25  → null   (Pomona is a private liberal arts
 *                          college; in-state / out-of-state distinction
 *                          carries no policy meaning (no in-state tuition
 *                          advantage). CDS C1 residency table is also blank.
 *                          Prior heuristic value cleared. Marked UNAVAILABLE/
 *                          TERMINAL per closure-pipeline convention for
 *                          private institutions.)
 *   - edAcceptanceRate  : 13.71  → 12.54  (CDS C21: Pomona offers Early
 *                          Decision (ED I 11/15→12/15 + ED II 1/8→2/15).
 *                          Fall 2023 combined ED: 212 admits / 1,691
 *                          applications = 12.5370% (rounded to 12.54%).
 *                          CORRECTION DOWN from prior 13.71 (sourced from
 *                          ivycoach.com — third-party blog, not CDS). Tier
 *                          upgraded LEGACY_DB→OFFICIAL.)
 *   - eaAcceptanceRate  : null   → null   (CDS C22: Pomona does NOT offer a
 *                          nonbinding Early Action plan ("No" checked). Prior
 *                          DB value was already null but provenance sourceUrl
 *                          pointed to ivycoach.com (cross-pollinated /
 *                          third-party). Provenance refreshed to CDS
 *                          UNAVAILABLE / OFFICIAL_BLANK_SECTION (NOT_OFFERED).)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const POMONA_CDS_URL =
  'https://pomona.app.box.com/s/yidnpqoeuamv5tr0jax3c84xefaa9w6u';
const POMONA_CDS_LANDING =
  'https://www.pomona.edu/administration/institutional-research/information-center/common-data-set';
const CYCLE_YEAR = 2023; // CDS 2023-2024 = Fall 2023 entering class
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const pomona = await prisma.school.findFirst({
    where: { name: 'Pomona College', country: 'US' },
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
  if (!pomona) throw new Error('Pomona College not found');
  console.log(`Updating ${pomona.name} (${pomona.id})`);
  console.log(
    `  current AR=${pomona.acceptanceRate?.toString()} sat25=${pomona.sat25} sat75=${pomona.sat75}`,
  );
  console.log(
    `  current intlAR=${pomona.intlAcceptanceRate?.toString()} oosAR=${pomona.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${pomona.edAcceptanceRate?.toString()} eaAR=${pomona.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: POMONA_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-pomona-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 6.76,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2023-24 Section C1: 819 admits (M 377 + W 440 + Another 2) / 12,121 applicants (M 4,985 + W 7,133 + Another 3) = 6.7569% (rounded to 6.76%). MAJOR CORRECTION DOWN from prior 12.19% which was sourced from the decade-stale 2014-15 CDS. Tier upgraded LEGACY_DB→OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1480,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2023-24 Section C9: SAT Composite 25th = 1480 (reported directly). EBRW 730 + Math 750 = 1480 coincidentally matches in this cycle. CORRECTION UP from prior 1460 (SEED/PR-15 heuristic). Tier upgraded SEED→OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1550,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2023-24 Section C9: SAT Composite 75th = 1550 (reported directly; LOWER than EBRW 770 + Math 790 = 1560 because composite quantiles ≠ section sums). Per closure-pipeline convention, prefer reported Composite row. CORRECTION DOWN from prior 1570 (SEED/PR-15 heuristic). Tier upgraded SEED→OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2023-24 Section C1 residency breakdown table (In-State / Out-of-State / International applied/admitted/enrolled) is BLANK — Pomona did not publish this disaggregation for the Fall 2023 cohort. Prior 2.8% was an INFERRED/PERMANENT_HEURISTIC value and cannot be verified against the official source. Field cleared and marked UNAVAILABLE / OFFICIAL_BLANK_SECTION.',
      realDataStatus: 'UNAVAILABLE',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'Pomona College is a private liberal arts college; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). Additionally, CDS 2023-24 C1 residency table is blank (Pomona did not publish OOS counts). Prior 31.25% was an INFERRED/PERMANENT_HEURISTIC value (not from CDS). Field cleared and marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 12.54,
      policyLabel: 'Early Decision admit rate (ED I + ED II combined)',
      reason:
        'CDS 2023-24 Section C21: Pomona offers Early Decision ("Yes" checked). Two deadlines published: ED I closing 11/15 / notification 12/15, ED II closing 1/8 / notification 2/15. Fall 2023 combined ED counts: 212 admits / 1,691 applications = 12.5370% (rounded to 12.54%). CORRECTION DOWN from prior 13.71% which was sourced from ivycoach.com (third-party blog, not CDS). Tier upgraded LEGACY_DB→OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2023-24 Section C22: Pomona College does NOT offer a nonbinding Early Action plan ("No" checked). All EA count fields are blank in the CDS form. Prior DB value was already null but provenance sourceUrl pointed to ivycoach.com (third-party blog, not Pomona-official). Provenance refreshed to CDS UNAVAILABLE / OFFICIAL_BLANK_SECTION (NOT_OFFERED).',
      realDataStatus: 'NOT_OFFERED',
    },
  };

  const existingMeta = toRecord(pomona.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: POMONA_CDS_LANDING,
  };

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: pomona.id },
    data: {
      acceptanceRate: new Prisma.Decimal('6.76'),
      sat25: 1480,
      sat75: 1550,
      intlAcceptanceRate: null, // CDS C1 residency blank — clear stale heuristic
      oosAcceptanceRate: null, // private LAC — N/A; CDS C1 residency blank
      edAcceptanceRate: new Prisma.Decimal('12.54'),
      eaAcceptanceRate: null, // CDS C22 "No" — re-confirm not offered
      hasEarlyDecision: true, // re-confirm from CDS C21 "Yes"
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=6.76, sat25=1480, sat75=1550, intlAR=N/A, oosAR=N/A, edAR=12.54, eaAR=NOT_OFFERED)',
  );

  // verify
  const after = await prisma.school.findUnique({
    where: { id: pomona.id },
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
