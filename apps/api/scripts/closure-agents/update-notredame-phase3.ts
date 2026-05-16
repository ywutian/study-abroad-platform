#!/usr/bin/env tsx
/**
 * Phase 3 — University of Notre Dame end-to-end closure of the 7 prediction-
 * critical fields.
 *
 * Source: University of Notre Dame CDS 2024-2025 (parsed by Claude from PDF)
 *   URL: https://www3.nd.edu/~instres/CDS/2024-2025/CDS_2024-2025.pdf
 *   (cached via Wayback Machine; canonical URL retained for citation.)
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 11.10 → 11.27 (CDS C1 Total: 3,374 admits / 29,942
 *                          applicants = 11.2685% (rounded to 11.27%).
 *                          CORRECTION UP +0.17pp from prior LEGACY_DB 11.10.)
 *   - sat25             : 1440  → 1470  (CDS C9 SAT Composite 25th = 1470
 *                          reported directly. CORRECTION UP +30 from prior
 *                          1440 LEGACY_DB. 684 enrolled submitted SAT.)
 *   - sat75             : 1540  → 1540  (CDS C9 SAT Composite 75th = 1540.
 *                          Value matches prior DB; tier upgraded LEGACY_DB →
 *                          OFFICIAL.)
 *   - intlAcceptanceRate: 6.00  → 6.68  (CDS C1 residency: 264 intl admits /
 *                          3,954 intl applicants = 6.6768% (rounded to
 *                          6.68%). CORRECTION UP +0.68pp from prior
 *                          LEGACY_DB rounded value 6.00. Tier upgraded
 *                          LEGACY_DB → OFFICIAL.)
 *   - oosAcceptanceRate : null  → null  (Notre Dame is a private Catholic
 *                          university; in-state / out-of-state distinction
 *                          carries no policy meaning. CDS C1 residency does
 *                          report OOS (2,884 admits / 24,144 applicants =
 *                          11.9450%) but value is not actionable. Field
 *                          stays UNAVAILABLE-terminal per closure-pipeline
 *                          convention for private institutions.)
 *   - edAcceptanceRate  : 26.00 → null  (CDS C21: Notre Dame does NOT offer
 *                          a binding Early Decision plan ("No" checked).
 *                          Notre Dame only offers Restrictive Early Action
 *                          (REA), which is non-binding and lives in C22.
 *                          Prior stale LEGACY_DB value 26.00 (which appears
 *                          to have been an REA carry-over mis-classified as
 *                          ED) cleared. Field marked UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION / NOT_OFFERED. hasEarlyDecision
 *                          already false.)
 *   - eaAcceptanceRate  : 12.92 → null  (CDS C22: Notre Dame offers a
 *                          nonbinding Restrictive Early Action plan ("Yes"
 *                          checked, restrictive = "Yes") with closing date
 *                          11/1 and notification 12/15. HOWEVER, the C22
 *                          numeric fields for REA applicants and admits are
 *                          BLANK in Notre Dame\'s 2024-25 CDS — Notre Dame
 *                          does not publish REA application/admit counts via
 *                          CDS (they release them only via press release for
 *                          the cycle, e.g., Class of 2028 REA: 11,498 apps /
 *                          1,724 admits = 15.00% per the 2023-12-15
 *                          Undergraduate Admissions press release at
 *                          admissions.nd.edu). Per closure-pipeline
 *                          convention (CDS C22 numeric blank → UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION; do not source from press
 *                          releases or aggregators for the CDS field), the
 *                          field is cleared. Prior LEGACY_DB value 12.92
 *                          (which appears sourced from an earlier press
 *                          release / aggregator for a different cycle) is
 *                          superseded.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const ND_CDS_URL =
  'https://www3.nd.edu/~instres/CDS/2024-2025/CDS_2024-2025.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class (Class of 2028)
const NOW = new Date().toISOString();

const prisma = new PrismaClient();

async function main() {
  const nd = await prisma.school.findFirst({
    where: {
      id: 'cmn1htko7000jvqf22r0n55p2',
      name: 'University of Notre Dame',
    },
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
  if (!nd) throw new Error('University of Notre Dame not found');
  console.log(`Updating ${nd.name} (${nd.id})`);
  console.log(
    `  current AR=${nd.acceptanceRate?.toString()} sat25=${nd.sat25} sat75=${nd.sat75}`,
  );
  console.log(
    `  current intlAR=${nd.intlAcceptanceRate?.toString() ?? 'null'} oosAR=${nd.oosAcceptanceRate?.toString() ?? 'null'}`,
  );
  console.log(
    `  current edAR=${nd.edAcceptanceRate?.toString() ?? 'null'} eaAR=${nd.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const baseProv = {
    sourceUrl: ND_CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-notredame-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 11.27,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1: 3,374 admits / 29,942 applicants = 11.2685% (rounded to 11.27%). CORRECTION UP +0.17pp from prior LEGACY_DB value 11.10. Tier upgraded LEGACY_DB → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1470,
      policyLabel: 'SAT composite 25th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 25th = 1470 reported directly. CORRECTION UP +30 from prior 1440 LEGACY_DB value. 684 of Fall 2024 enrolled submitted SAT.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 1540,
      policyLabel: 'SAT composite 75th percentile (reported composite row)',
      reason:
        'CDS 2024-25 Section C9: SAT Composite 75th = 1540 reported directly. Value matches prior DB; tier upgraded from LEGACY_DB to OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 6.68,
      policyLabel: 'International admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table: 264 international admits / 3,954 international applicants = 6.6768% (rounded to 6.68%). CORRECTION UP +0.68pp from prior LEGACY_DB rounded value 6.00. Tier upgraded LEGACY_DB → OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'University of Notre Dame is a private Catholic research university; in-state / out-of-state distinction carries no policy meaning (no in-state tuition advantage). CDS C1 residency table does report OOS (2,884 admits / 24,144 applicants = 11.9450%), but the value is not actionable for applicants. Field marked UNAVAILABLE-terminal per closure-pipeline convention for private institutions.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: Notre Dame does NOT offer a binding Early Decision plan ("No" checked). Notre Dame only offers Restrictive Early Action (REA), which is non-binding and reported in C22. Prior stale LEGACY_DB value 26.00 (mis-classified, appears to have been an REA carry-over) is cleared. Field marked UNAVAILABLE-terminal / NOT_OFFERED. hasEarlyDecision flag remains false.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate (Restrictive Early Action)',
      reason:
        'CDS 2024-25 Section C22: Notre Dame OFFERS a nonbinding Restrictive Early Action ("Yes" checked, restrictive flag "Yes"), closing 11/1, notification 12/15. HOWEVER, the C22 numeric fields (REA applicants received / REA admits) are BLANK in Notre Dame\'s 2024-25 CDS — Notre Dame does not publish REA application/admit counts via CDS. For reference only (NOT used as the CDS field source): Notre Dame Undergraduate Admissions press release for the same Fall 2024 entering class (Class of 2028, released 2023-12-15) reports 11,498 REA applications / 1,724 admits = 14.99% (~15.0%). Per closure-pipeline convention (CDS C22 numeric blank → UNAVAILABLE/OFFICIAL_BLANK_SECTION; do not substitute press-release / aggregator figures into the CDS-typed field), the DB value is cleared. Prior LEGACY_DB value 12.92 superseded.',
      realDataStatus: 'NOT_REPORTED',
    },
  };

  const existingMeta = toRecord(nd.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: ND_CDS_URL,
  };

  await prisma.school.update({
    where: { id: nd.id },
    data: {
      acceptanceRate: new Prisma.Decimal('11.27'),
      sat25: 1470,
      sat75: 1540,
      intlAcceptanceRate: new Prisma.Decimal('6.68'),
      oosAcceptanceRate: null,
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // hasEarlyDecision: false (re-confirm Notre Dame does NOT offer ED)
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  updated 7 fields (AR=11.27, sat25=1470, sat75=1540, intlAR=6.68, oosAR=N/A, edAR=NOT_OFFERED, eaAR=BLANK_SECTION/REA)',
  );

  const after = await prisma.school.findUnique({
    where: { id: nd.id },
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
