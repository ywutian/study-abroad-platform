#!/usr/bin/env tsx
/**
 * Phase 3 — University of Texas at Arlington (UTA) closure of the 7
 *   prediction-critical fields.
 *
 * Source situation:
 *   UTA does NOT publish a downloadable Common Data Set PDF. The
 *   University Analytics page (https://www.uta.edu/administration/analytics/reports)
 *   exposes internal dashboards and a "Statistical Handbook (CB Data)"
 *   PDF (last updated 2018) which uses Texas-specific THECB metrics
 *   rather than CDS sections. No public CDS file exists on uta.edu.
 *
 * Primary source used:
 *   NCES IPEDS / College Navigator — Fall 2024 admissions for unitid
 *   228769 (University of Texas at Arlington).
 *     https://nces.ed.gov/collegenavigator/?id=228769
 *   IPEDS is the federally-mandated official disclosure equivalent in
 *   authority to a CDS for the seven core admit-rate / score fields,
 *   and is the correct fallback when the institution itself does not
 *   publish a downloadable CDS.
 *
 * UTA is a PUBLIC research university (Arlington, TX; UT System).
 *
 * IPEDS Fall 2024 facts:
 *   - Total applicants: 24,623 (10,879 men + 13,744 women)
 *   - Total admitted:   19,698 (NCES 80% rate × 24,623; men 79% × 10,879
 *                      = 8,595, women 81% × 13,744 = 11,133, sum 19,728;
 *                      the precise overall rate is 19,728/24,623 = 80.12%.
 *                      We use 80.00% to match the NCES headline rate
 *                      since the gendered counts derive from rounded
 *                      percentages.)
 *   - SAT Composite 25/75 (enrolled, 70% submitted): 1010 / 1240
 *     (subscore sum 510+500 = 1010, 620+620 = 1240)
 *   - ACT Composite 25/75 (12% submitted): 19 / 27
 *   - Test optional admission.
 *
 * Computed actions:
 *   - acceptanceRate    : 82    -> 80     (CORRECTION DOWN -2; tier
 *                          LEGACY_DB_VALUE -> SCRAPED with IPEDS URL.
 *                          Not OFFICIAL because IPEDS-derived, not from
 *                          institution-published CDS.)
 *   - sat25             : 1000  -> 1010   (CORRECTION UP +10; IPEDS
 *                          subscore sum 510+500. Prior source was
 *                          testbook.com mis-labeled CDS_PDF_AUTO. Source
 *                          corrected to IPEDS_OFFICIAL.)
 *   - sat75             : 1250  -> 1240   (CORRECTION DOWN -10; IPEDS
 *                          subscore sum 620+620. Same rationale.)
 *   - intlAcceptanceRate: 77.9  -> null   (UNAVAILABLE; UTA does not
 *                          publish a CDS PDF, and IPEDS does not break
 *                          out admissions by residency. Heuristic 77.9
 *                          was tier=NULL/source=PERMANENT_HEURISTIC —
 *                          fabricated. Cleared.)
 *   - oosAcceptanceRate : 83.64 -> null   (UNAVAILABLE; same rationale.
 *                          UTA is PUBLIC and OOS distinction is policy-
 *                          meaningful, but no source publishes counts.)
 *   - edAcceptanceRate  : null  (already OFFICIAL NOT_OFFERED via prior
 *                          LLM extract) — LEFT UNCHANGED.
 *   - eaAcceptanceRate  : null  (already OFFICIAL NOT_OFFERED) — LEFT
 *                          UNCHANGED.
 *
 * NOTE on hasEarlyDecision: DB has true, but UTA's admissions policy
 *   page lists priority and regular deadlines only — no ED program.
 *   Correcting to false to match reality.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const IPEDS_URL = 'https://nces.ed.gov/collegenavigator/?id=228769';
const UTA_ANALYTICS_URL =
  'https://www.uta.edu/administration/analytics/reports';
const CYCLE_YEAR = 2024;
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8isu003dz0tijwn1m0s0';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UTA) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}  [PUBLIC TX/UT System]`);
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
    verifiedBy: 'closure-pipeline-phase3-batch27-claude',
    generatedBy: 'phase3-uta-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'SCRAPED',
      source: 'IPEDS_OFFICIAL',
      value: 80,
      policyLabel: 'Overall admit rate (IPEDS Fall 2024)',
      reason:
        'IPEDS College Navigator Fall 2024 admissions: 24,623 applicants (10,879 men + 13,744 women), 80% NCES headline admit rate. Gendered counts (men 79%, women 81%) derive to ~19,728 admits or 80.12% precise; we use 80 to match the institution-attested rounded headline. UTA does NOT publish a CDS PDF (only internal dashboards and a 2018 THECB-based statistical handbook) — IPEDS is the most authoritative fallback. CORRECTION DOWN -2 from prior 82 (LEGACY_DB_VALUE). Tier LEGACY_DB_VALUE -> SCRAPED.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'IPEDS_OFFICIAL',
      value: 1010,
      policyLabel: 'SAT composite 25th percentile (IPEDS subscore sum)',
      reason:
        'IPEDS Fall 2024: SAT EBRW 25th=510, SAT Math 25th=500 → composite 25th = 1010. CORRECTION UP +10 from prior 1000 (prior source was testbook.com mis-labeled as CDS_PDF_AUTO). Source corrected to IPEDS_OFFICIAL. UTA is test-optional; 70% of enrolled submitted SAT.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat75: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'IPEDS_OFFICIAL',
      value: 1240,
      policyLabel: 'SAT composite 75th percentile (IPEDS subscore sum)',
      reason:
        'IPEDS Fall 2024: SAT EBRW 75th=620, SAT Math 75th=620 → composite 75th = 1240. CORRECTION DOWN -10 from prior 1250 (prior source was testbook.com mis-labeled as CDS_PDF_AUTO). Source corrected to IPEDS_OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    intlAcceptanceRate: {
      ...baseProv,
      sourceUrl: UTA_ANALYTICS_URL,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      value: null,
      policyLabel: 'International admit rate',
      reason:
        'UTA does not publish a downloadable CDS PDF — University Analytics exposes only internal dashboards and a 2018 THECB-format handbook, neither of which surfaces a C1 residency breakdown publicly. IPEDS does not break out admissions by residency. International admit count is therefore UNAVAILABLE. Prior value 77.9 was tier=NULL/source=PERMANENT_HEURISTIC (heuristic fabrication). Tier upgraded PERMANENT_HEURISTIC -> UNAVAILABLE; value cleared to null.',
      realDataStatus: 'INSTITUTION_REDACTED',
    },
    oosAcceptanceRate: {
      ...baseProv,
      sourceUrl: UTA_ANALYTICS_URL,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      value: null,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'UTA does not publish a downloadable CDS PDF — University Analytics exposes only internal dashboards, and IPEDS does not break out admissions by residency. OOS admit count is therefore UNAVAILABLE for this public Texas university. Prior value 83.64 was tier=NULL/source=PERMANENT_HEURISTIC (heuristic fabrication). Tier upgraded PERMANENT_HEURISTIC -> UNAVAILABLE; value cleared to null.',
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
      acceptanceRate: new Prisma.Decimal('80'),
      sat25: 1010,
      sat75: 1240,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      // edAR / eaAR LEFT UNCHANGED (already OFFICIAL).
      hasEarlyDecision: false, // No ED program at UTA.
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  updated 5 fields (AR=80, sat25=1010, sat75=1240, intlAR=UNAVAILABLE, oosAR=UNAVAILABLE) + hasED=false',
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
