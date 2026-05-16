#!/usr/bin/env tsx
/**
 * Phase 3 — The New School end-to-end closure of the 7 prediction-critical
 * fields.
 *
 * Closure context:
 *   The New School (RU in NYC; includes Parsons School of Design — portfolio-
 *   first — and Eugene Lang College — LAC; also School of Drama) does NOT
 *   publish a public Common Data Set. Verified via:
 *     - WebSearch site:newschool.edu "Common Data Set" filetype:pdf
 *       (only result is an archival 2008-2009 CDS in the New School Archives;
 *       no current/recent CDS PDF is published publicly)
 *     - newschool.edu/provost/institutional-research/ — explicitly says
 *       Almanac & Trends data is gated to "New School employees on campus or
 *       using the VPN" (i.e., not public)
 *     - newschool.edu/enrollment-data/ — no CDS link
 *   Prior DB sourceUrl for AR/intl/oos was
 *     https://www.buffalo.edu/.../CDS_2024-2025.pdf (UNIVERSITY AT BUFFALO!) —
 *   the legacy data was mistakenly imported from Buffalo's CDS and never
 *   corrected. All four values (AR=74.18, sat25=1080, sat75=1320, intlAR=60.43,
 *   oosAR=78.99) are Buffalo's, NOT The New School's.
 *
 *   Per user authorization (private school + no public CDS):
 *     1. AR — fall back to IPEDS (via DataUSA) Fall 2023 figure as SCRAPED
 *        (9,148 apps / 5,719 admits = 62.5%). Closest available authoritative
 *        public source. Tier SCRAPED with confidence 0.85.
 *     2. sat25/sat75 — The New School is TEST-BLIND for admission (no SAT/ACT
 *        considered). Per closure-pipeline convention: clear value, mark
 *        UNAVAILABLE/OFFICIAL_BLANK_SECTION (NOT_COLLECTED). External
 *        aggregators (acceptancerate.com etc.) report 1150-1380 — stale,
 *        derived from pre-test-blind cohorts; not authoritative.
 *     3. intlAR — UNAVAILABLE/TERMINAL: no public residency-segmented
 *        applicant/admit counts. IPEDS does not break out admit by residency.
 *     4. oosAR — UNAVAILABLE/TERMINAL per closure-pipeline private-institution
 *        convention (in-state/OOS distinction has no policy meaning for private
 *        NYC institution).
 *     5. edAR — The New School DOES offer Early Decision (binding, Nov 15
 *        deadline; verified via newschool.edu/admission/prospective-
 *        undergraduate-students/early-application-options/). However no public
 *        ED admit/applicant counts are published. Mark UNAVAILABLE/TERMINAL
 *        (no public round rate); preserve hasEarlyDecision=true.
 *     6. eaAR — The New School DOES offer Early Action (non-binding; Lang,
 *        Parsons Paris, Parsons, School of Drama). However no public EA
 *        admit/applicant counts are published. Mark UNAVAILABLE/TERMINAL
 *        (no public round rate).
 *
 * Source URLs:
 *   - DataUSA (IPEDS aggregator, fallback for AR):
 *       https://datausa.io/profile/university/the-new-school
 *   - The New School Institutional Research portal (gated):
 *       https://www.newschool.edu/provost/institutional-research/
 *   - The New School Early Application Options (verifies ED/EA offering):
 *       https://www.newschool.edu/admission/prospective-undergraduate-students/early-application-options/
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 74.18  -> 62.5  (DROP -11.68pp. Prior value was
 *                          Buffalo's CDS C1 mistakenly imported. IPEDS Fall
 *                          2023 (DataUSA): 9,148 apps / 5,719 admits = 62.5%.
 *                          Tier LEGACY_DB_VALUE(wrong) -> SCRAPED (IPEDS via
 *                          DataUSA).)
 *   - sat25             : 1080   -> null  (Buffalo's data. Cleared.
 *                          Test-blind policy means The New School does not
 *                          collect SAT for admission decisions; UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION/NOT_COLLECTED.)
 *   - sat75             : 1320   -> null  (same rationale as sat25.)
 *   - intlAcceptanceRate: 60.43  -> null  (Buffalo's data. Cleared.
 *                          UNAVAILABLE/TERMINAL — no public residency-
 *                          segmented data.)
 *   - oosAcceptanceRate : 78.99  -> null  (Buffalo's data. Cleared.
 *                          Private NYC institution — in-state/OOS distinction
 *                          carries no policy meaning. UNAVAILABLE/TERMINAL.)
 *   - edAcceptanceRate  : null   -> null  (The New School DOES offer ED
 *                          (Nov 15 binding) per official admission page, but
 *                          does NOT publish ED admit/applicant counts.
 *                          UNAVAILABLE/TERMINAL.)
 *   - eaAcceptanceRate  : null   -> null  (The New School DOES offer EA
 *                          (non-binding) per official admission page for Lang,
 *                          Parsons Paris, Parsons, School of Drama, but does
 *                          NOT publish EA admit/applicant counts. UNAVAILABLE/
 *                          TERMINAL.)
 *
 * Note: keep hasEarlyDecision=true (verified ED still offered).
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const IPEDS_DATAUSA_URL =
  'https://datausa.io/profile/university/the-new-school';
const TNS_IR_URL = 'https://www.newschool.edu/provost/institutional-research/';
const TNS_EARLY_URL =
  'https://www.newschool.edu/admission/prospective-undergraduate-students/early-application-options/';

const CYCLE_YEAR_IPEDS = 2023; // IPEDS Fall 2023 cohort (DataUSA latest)
const CYCLE_YEAR_NOW = 2024; // For ED/EA pages reflecting current admission cycle
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8ioy001kz0ti85qspr1l';

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
  if (!school)
    throw new Error(`School ${SCHOOL_ID} (The New School) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate}`);
  console.log(
    `  current AR=${school.acceptanceRate?.toString()} sat25=${school.sat25} sat75=${school.sat75}`,
  );
  console.log(
    `  current intlAR=${school.intlAcceptanceRate?.toString()} oosAR=${school.oosAcceptanceRate?.toString()}`,
  );
  console.log(
    `  current edAR=${school.edAcceptanceRate?.toString() ?? 'null'} eaAR=${school.eaAcceptanceRate?.toString() ?? 'null'}`,
  );

  const scrapedBase = {
    sourceUrl: IPEDS_DATAUSA_URL,
    cycleYear: CYCLE_YEAR_IPEDS,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 0.85,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-newschool-validation',
  };

  const terminalBase = {
    sourceUrl: TNS_IR_URL,
    cycleYear: CYCLE_YEAR_NOW,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 1.0,
    verifiedBy: 'closure-pipeline-phase3-claude',
    generatedBy: 'phase3-newschool-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...scrapedBase,
      tier: 'SCRAPED',
      source: 'IPEDS_DATAUSA',
      value: 62.5,
      policyLabel: 'Overall admit rate (institution-level)',
      reason:
        'The New School does NOT publish a public Common Data Set (IR portal is VPN-gated; only an archival 2008-2009 CDS exists publicly via the New School Archives). Prior DB value 74.18% with sourceUrl pointing to https://www.buffalo.edu/.../CDS_2024-2025.pdf was University at Buffalo data mistakenly imported. Fall-back source: IPEDS Fall 2023 first-time freshman cohort via DataUSA — 9,148 applications / 5,719 admits = 62.5%. Tier SCRAPED (confidence 0.85) reflects IPEDS-derived authoritative public number; would be OFFICIAL only if The New School published a CDS, which they do not. CORRECTION DOWN -11.68pp from the erroneous Buffalo-imported legacy value.',
      realDataStatus: 'SCRAPED_REAL',
    },
    sat25: {
      ...terminalBase,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'The New School operates a test-blind admission policy: SAT/ACT scores are not considered in first-time freshman admission decisions, so no testing data is collected for the entering class. Prior DB value 1080 was Buffalo CDS data mistakenly imported. External aggregators (acceptancerate.com, etc.) report 1150-1380 but this reflects pre-test-blind cohorts and is not authoritative. Cleared to null and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION (NOT_COLLECTED) per closure-pipeline convention for test-blind institutions without a published CDS.',
      realDataStatus: 'NOT_COLLECTED',
    },
    sat75: {
      ...terminalBase,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'Same rationale as sat25: The New School is test-blind for admission; no SAT data collected. Prior DB value 1320 was Buffalo CDS data mistakenly imported. Cleared to null and marked UNAVAILABLE/OFFICIAL_BLANK_SECTION (NOT_COLLECTED).',
      realDataStatus: 'NOT_COLLECTED',
    },
    intlAcceptanceRate: {
      ...terminalBase,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      policyLabel: 'International admit rate',
      reason:
        'The New School does not publish residency-segmented (international vs. domestic) applicant/admit counts. CDS is not publicly available. IPEDS reports total international enrollment but not admit rates by citizenship status. Prior DB value 60.43% was Buffalo CDS data mistakenly imported. Cleared to null and marked UNAVAILABLE/TERMINAL.',
      realDataStatus: 'UNAVAILABLE',
    },
    oosAcceptanceRate: {
      ...terminalBase,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      policyLabel: 'Out-of-state admit rate',
      reason:
        'The New School is a private NYC institution; in-state/out-of-state distinction carries no policy meaning (no in-state tuition advantage). No residency-segmented admit data published. Prior DB value 78.99% was Buffalo CDS data mistakenly imported. Cleared to null and marked UNAVAILABLE/TERMINAL per closure-pipeline private-institution convention.',
      realDataStatus: 'NOT_APPLICABLE',
    },
    edAcceptanceRate: {
      ...terminalBase,
      sourceUrl: TNS_EARLY_URL,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      policyLabel: 'Early Decision admit rate',
      reason:
        'The New School DOES offer Early Decision (binding, Nov 15 closing, mid- to late-December notification) — verified via newschool.edu/admission/prospective-undergraduate-students/early-application-options/. ED is available for Eugene Lang College, Parsons Paris, and Parsons School of Design. However, no ED applicant/admit counts are published publicly (CDS C21 numbers are VPN-gated). Marked UNAVAILABLE/TERMINAL (no public round rate). hasEarlyDecision retained as true.',
      realDataStatus: 'UNAVAILABLE',
    },
    eaAcceptanceRate: {
      ...terminalBase,
      sourceUrl: TNS_EARLY_URL,
      tier: 'UNAVAILABLE',
      source: 'TERMINAL',
      policyLabel: 'Early Action admit rate',
      reason:
        'The New School DOES offer Early Action (non-binding; mid-December to late-January notification) for Lang, Parsons Paris, Parsons, and School of Drama applicants — verified via newschool.edu/admission/prospective-undergraduate-students/early-application-options/. However no EA applicant/admit counts are published publicly. Marked UNAVAILABLE/TERMINAL (no public round rate).',
      realDataStatus: 'UNAVAILABLE',
    },
  };

  const existingMeta = toRecord(school.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: IPEDS_DATAUSA_URL,
  };

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('62.5'),
      sat25: null,
      sat75: null,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      hasEarlyDecision: true, // verified: The New School offers ED
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=62.5 SCRAPED IPEDS, sat25/75=NOT_COLLECTED test-blind, intlAR=N/A, oosAR=N/A private, edAR=UNAVAILABLE no public count, eaAR=UNAVAILABLE no public count)',
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
