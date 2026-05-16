#!/usr/bin/env tsx
/**
 * Phase 3 batch 7 — University of California, Berkeley (UCB) end-to-end
 * closure of the 7 prediction-critical fields.
 *
 * Source: UC Berkeley Common Data Set 2024-2025 (Fall 2024 entering class),
 *   published by UCB Office of Planning and Analysis (OPA). The CDS is
 *   maintained as a Google Sheet at the index page:
 *     https://opa.berkeley.edu/campus-data/common-data-set
 *   2024-25 spreadsheet:
 *     https://docs.google.com/spreadsheets/d/11BnFbit7JcrmFMi9iV_TMkzhUyCQ_dQHS0V8weuOHPM
 *
 *   We use the OPA index URL as the canonical sourceUrl so it remains
 *   stable as the OPA team rotates underlying Google Sheets IDs.
 *
 * KEY UCB POLICIES (drive the closure decisions):
 *   - UCB is **test-free** (CDS C8A "Y" with note "We do take into account
 *     SAT II Subject Test scores, but we do not take into account regular
 *     SAT or ACT scores"; C8F "Berkeley is test-free, which means we will
 *     not use SAT/ACT test scores in any part of our application
 *     process"). Stronger than test-blind: SAT/ACT scores are not used
 *     for admission OR placement. UCB's CDS C9 SAT/ACT percentile boxes
 *     are entirely BLANK. -> sat25/sat75 set to UNAVAILABLE/
 *     OFFICIAL_BLANK_SECTION.
 *   - UCB is a **public** UC institution. CDS C1 residency table IS
 *     completed (unlike UCLA). OOS and international admit rates carry
 *     real policy meaning (different tuition + nonresident tuition surcharge).
 *     OOS AR must be OFFICIAL, not TERMINAL.
 *   - UC system does NOT offer Early Decision (C21 "No") or Early Action
 *     (C22 "No"). -> edAR/eaAR set to UNAVAILABLE/OFFICIAL_BLANK_SECTION.
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 11     -> 11.04  (CDS 2024-25 C1: 13,714 admits
 *                          (M 5,058 + W 7,788 + Another 252 + Unknown 616)
 *                          / 124,245 applicants (M 57,337 + W 60,324 +
 *                          Another 2,098 + Unknown 4,486) = 11.0382%
 *                          (rounds to 11.04%). Minor precision upgrade;
 *                          tier LEGACY_DB -> OFFICIAL. Prior sourceUrl was
 *                          UC system-wide nonresident report; corrected
 *                          to UCB OPA CDS.)
 *   - sat25             : 1370   -> null   (UCB is test-free. CDS C9 SAT
 *                          Composite 25th percentile box is BLANK because
 *                          scores are not collected/used. Prior LEGACY_DB
 *                          value 1370 (no source URL) is not from any
 *                          UCB-published CDS, since UCB has not reported
 *                          SAT percentiles since adopting test-blind/free
 *                          in 2021. Field cleared; UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION.)
 *   - sat75             : 1520   -> null   (Same rationale as sat25.
 *                          Prior LEGACY_DB 1520 cleared.)
 *   - intlAcceptanceRate: 3.4    -> 3.38   (CDS 2024-25 C1 residency:
 *                          754 intl admits / 22,301 intl applicants =
 *                          3.3810% (rounds to 3.38%). Minor precision
 *                          adjustment; tier LEGACY_DB -> OFFICIAL.
 *                          NOTE: prior DB sat at value 3.4 in provenance
 *                          but column intlAcceptanceRate showed 5 — that
 *                          drift is corrected here by setting both column
 *                          and provenance to 3.38.)
 *   - oosAcceptanceRate : 7.3    -> 7.34   (CDS 2024-25 C1 residency:
 *                          2,186 OOS admits / 29,788 OOS applicants =
 *                          7.3385% (rounds to 7.34%). Minor precision
 *                          adjustment; tier LEGACY_DB -> OFFICIAL.
 *                          UCB is public UC -> oosAR carries real
 *                          residency-pricing meaning, MUST stay populated.)
 *   - edAcceptanceRate  : null   -> null   (CDS 2024-25 C21: "No". UC
 *                          system does not offer Early Decision. Field
 *                          stays cleared. Provenance refreshed to 2024-25
 *                          cycle.)
 *   - eaAcceptanceRate  : null   -> null   (CDS 2024-25 C22: "No". UC
 *                          system does not offer Early Action. Field
 *                          stays cleared. Provenance refreshed to 2024-25
 *                          cycle.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL = 'https://opa.berkeley.edu/campus-data/common-data-set';
const CDS_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/11BnFbit7JcrmFMi9iV_TMkzhUyCQ_dQHS0V8weuOHPM';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmn1htknv000evqf29yjvrstt';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (UC Berkeley) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(
    `  isPrivate=${school.isPrivate}  [PUBLIC UC — oosAR must be OFFICIAL]`,
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
    generatedBy: 'phase3-batch7-ucb-validation',
    notes: `Underlying CDS sheet: ${CDS_SHEET_URL}`,
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 11.04,
      policyLabel: 'Overall admit rate',
      reason:
        'UCB CDS 2024-25 Section C1: 13,714 admits (Men 5,058 + Women 7,788 + Another 252 + Unknown 616) / 124,245 applicants (Men 57,337 + Women 60,324 + Another 2,098 + Unknown 4,486) = 11.0382% (rounds to 11.04%). Tier upgraded LEGACY_DB (value 11; prior sourceUrl was UC system-wide nonresident report) -> OFFICIAL, sourced from UCB OPA CDS.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'UCB is test-free (CDS 2024-25 C8A: "We do not take into account regular SAT or ACT scores"; C8F: "Berkeley is test-free, which means we will not use SAT/ACT test scores in any part of our application process"). UCB CDS C9 SAT Composite percentile boxes are entirely BLANK because scores are not collected/used. Prior LEGACY_DB value 1370 (no source URL) is not from any UCB-published CDS — UCB has not reported SAT percentiles since adopting test-blind/free in Fall 2021. Field cleared; marked UNAVAILABLE/OFFICIAL_BLANK_SECTION.',
      realDataStatus: 'OFFICIAL_BLANK',
    },
    sat75: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'UCB is test-free; CDS C9 SAT Composite percentile boxes blank. Same rationale as sat25. Prior LEGACY_DB 1520 cleared.',
      realDataStatus: 'OFFICIAL_BLANK',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 3.38,
      policyLabel: 'International admit rate',
      reason:
        'UCB CDS 2024-25 Section C1 residency table: 754 international admits / 22,301 international applicants = 3.3810% (rounds to 3.38%). Minor precision adjustment; tier LEGACY_DB -> OFFICIAL. NOTE: prior DB had drift between provenance.value (3.4) and column intlAcceptanceRate (5); corrected here by setting both column and provenance to 3.38 from UCB-published CDS.',
      realDataStatus: 'VERIFIED_REAL',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 7.34,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'UCB CDS 2024-25 Section C1 residency table: 2,186 out-of-state admits / 29,788 out-of-state applicants = 7.3385% (rounds to 7.34%). UCB is a public UC institution — in-state vs. out-of-state distinction carries real policy meaning (~$33K nonresident supplemental tuition surcharge), so this field MUST carry a real CDS number and is NOT marked TERMINAL. Minor precision adjustment from prior LEGACY_DB 7.3; tier upgraded LEGACY_DB -> OFFICIAL.',
      realDataStatus: 'VERIFIED_REAL',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'UCB CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO. The UC system uniformly does not offer Early Decision (all UC campuses share the system-wide UC Application with one November application window for fall enrollment). Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance refreshed to 2024-25 cycle.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'UCB CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO. The UC system uniformly does not offer Early Action. Field stays cleared (UNAVAILABLE/OFFICIAL_BLANK_SECTION). Provenance refreshed to 2024-25 cycle.',
      realDataStatus: 'NOT_OFFERED',
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
      acceptanceRate: new Prisma.Decimal('11.04'),
      sat25: null,
      sat75: null,
      intlAcceptanceRate: new Prisma.Decimal('3.38'),
      oosAcceptanceRate: new Prisma.Decimal('7.34'),
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=11.04, sat25=null[test-free], sat75=null[test-free], intlAR=3.38, oosAR=7.34, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
