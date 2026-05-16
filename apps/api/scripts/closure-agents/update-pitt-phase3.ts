#!/usr/bin/env tsx
/**
 * Phase 3 — University of Pittsburgh end-to-end closure of the 7 prediction-
 * critical fields.
 *
 * Source: Pitt CDS 2024-2025 (Pittsburgh Campus). Office of Institutional
 *   Research, retrieved from index https://ir.pitt.edu/cds.
 *   URL: https://ir.pitt.edu/sites/default/files/assets/2024-2025%20CDS%20Pittsburgh_2.pdf
 *
 * NOTE: Pitt is a PUBLIC institution (Commonwealth-related university of the
 *   Commonwealth of Pennsylvania). isPrivate=false → oosAcceptanceRate is in
 *   eligible scope and MUST carry a real OFFICIAL number from C1 residency
 *   when available.
 *
 * IMPORTANT — partial CDS: Pitt's 2024-25 CDS reports the C1 GRAND TOTAL
 *   (applicants/admits/enrolled) but leaves C1 residency breakdown (C120-C131
 *   in-state/OOS/international) BLANK, and leaves C9 SAT/ACT score
 *   distributions BLANK ("Data is posted as it becomes available"). C21 ED
 *   and C22 EA explicitly answered "No".
 *
 * Value changes (vs. existing DB):
 *   - acceptanceRate    : 58.08 → 58.08  (CDS 2024-25 C1: 35,372 admits /
 *                          60,898 applicants = 58.0840% (rounded to 58.08%).
 *                          Value matches prior LEGACY_DB exactly; tier upgraded
 *                          LEGACY_DB → OFFICIAL with refreshed provenance.)
 *   - sat25             : 1290  → null   (CDS 2024-25 C9 SAT Composite 25th =
 *                          BLANK — Pitt's CDS C9-C12 section is explicitly
 *                          marked "Data is posted as it becomes available"
 *                          and SAT/ACT score cells are empty. Prior 1290
 *                          (LEGACY_DB heuristic) cleared. Marked UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION until Pitt publishes the
 *                          score profile.)
 *   - sat75             : 1450  → null   (CDS 2024-25 C9 SAT Composite 75th =
 *                          BLANK — same blank-section reason as sat25. Prior
 *                          1450 (LEGACY_DB heuristic) cleared. Marked
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *   - intlAcceptanceRate: 40.18 → null   (CDS 2024-25 C1 residency:
 *                          International row BLANK — Pitt's CDS does not
 *                          publish residency breakdown for Fall 2024. Prior
 *                          40.18 (INFERRED/PERMANENT_HEURISTIC — note same
 *                          value as oosAR in DB, indicating a duplicated
 *                          heuristic placeholder, not real data) cleared.
 *                          Marked UNAVAILABLE/OFFICIAL_BLANK_SECTION.)
 *   - oosAcceptanceRate : 40.18 → null   (CDS 2024-25 C1 residency: Out-of-
 *                          State row BLANK. Same blank-section reason as
 *                          intlAR. Pitt is a public institution so oosAR is in
 *                          eligible scope and should carry a real CDS number
 *                          when available — but the CDS section is structurally
 *                          empty. Prior 40.18 (INFERRED/PERMANENT_HEURISTIC,
 *                          duplicated with intlAR) cleared. Marked UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION until Pitt publishes
 *                          residency breakdown.)
 *   - edAcceptanceRate  : null  → null   (CDS 2024-25 C21: "Does your
 *                          institution offer an early decision plan?" — NO
 *                          checked. Pitt does NOT offer Early Decision. Field
 *                          stays null. CORRECTION: hasEarlyDecision was true in
 *                          DB — set to false to match CDS reality. Provenance
 *                          refreshed from prior CDS_LLM_EXTRACT_2026_04
 *                          (value=undefined but tier=OFFICIAL, semantically
 *                          inconsistent) to authoritative UNAVAILABLE/
 *                          OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 *   - eaAcceptanceRate  : null  → null   (CDS 2024-25 C22: "Do you have a
 *                          nonbinding early action plan?" — NO checked. Pitt
 *                          does NOT offer Early Action either. (Pitt is
 *                          rolling admission with 7/30 closing date.) Field
 *                          stays null. Provenance refreshed to authoritative
 *                          UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://ir.pitt.edu/sites/default/files/assets/2024-2025%20CDS%20Pittsburgh_2.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8im90007z0ti2n04hf3n';

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
  if (!school) throw new Error(`School ${SCHOOL_ID} (Pitt) not found`);
  console.log(`Updating ${school.name} (${school.id})`);
  console.log(`  isPrivate=${school.isPrivate} (public)`);
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
    generatedBy: 'phase3-pitt-validation',
  };

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'OFFICIAL',
      source: 'CDS_OFFICIAL',
      value: 58.08,
      policyLabel: 'Overall admit rate',
      reason:
        'CDS 2024-25 Section C1 (Pittsburgh Campus): 35,372 admits / 60,898 applicants = 58.0840% (rounded to 58.08%). Value matches prior LEGACY_DB value exactly; tier upgraded LEGACY_DB → OFFICIAL with refreshed provenance pointing to ir.pitt.edu CDS PDF.',
      realDataStatus: 'VERIFIED_REAL',
    },
    sat25: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 25th percentile',
      reason:
        'CDS 2024-25 Section C9 (SAT/ACT score distributions): ALL SCORE CELLS BLANK. Pitt\'s CDS C9-C12 first-year profile is explicitly annotated "Data is posted as it becomes available" — the SAT/ACT percentile and score-range tables are structurally empty for the 2024-25 cycle. Prior DB value 1290 (LEGACY_DB / PR-15 heuristic) cleared because no OFFICIAL CDS value is available to validate it. Marked UNAVAILABLE/OFFICIAL_BLANK_SECTION until Pitt publishes the score profile.',
      realDataStatus: 'NOT_DISCLOSED',
    },
    sat75: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'SAT composite 75th percentile',
      reason:
        'CDS 2024-25 Section C9: ALL SCORE CELLS BLANK ("Data is posted as it becomes available"). Same blank-section reason as sat25. Prior DB value 1450 (LEGACY_DB / PR-15 heuristic) cleared. Marked UNAVAILABLE/OFFICIAL_BLANK_SECTION.',
      realDataStatus: 'NOT_DISCLOSED',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'International admit rate',
      reason:
        "CDS 2024-25 Section C1 residency table (C120-C131): International row applicants/admits/enrolled BLANK — Pitt's CDS does not publish a residency breakdown for Fall 2024 (in-state, out-of-state, and international cells are all empty). Prior DB value 40.18 (INFERRED/PERMANENT_HEURISTIC — note: identical to the prior oosAR value, indicating a duplicated heuristic placeholder rather than two independent real measurements) cleared. Marked UNAVAILABLE/OFFICIAL_BLANK_SECTION until Pitt publishes the residency breakdown.",
      realDataStatus: 'NOT_DISCLOSED',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Out-of-state admit rate',
      reason:
        'CDS 2024-25 Section C1 residency table (C120-C131): Out-of-State row BLANK. Pitt is a PUBLIC institution (Commonwealth-related university of Pennsylvania) — in-state vs. out-of-state distinction carries real policy meaning (different tuition tiers, residency preference), so oosAR is in eligible scope and SHOULD carry a real CDS number when available. HOWEVER, Pitt\'s CDS does not publish residency breakdown for 2024-25 — the section is structurally empty (not just missing for OOS, but for all residency categories). Prior DB value 40.18 (INFERRED/PERMANENT_HEURISTIC, duplicated with intlAR) cleared. Marked UNAVAILABLE/OFFICIAL_BLANK_SECTION — public-school convention preserved (real number when available, blank-section marker when not), NOT TERMINAL (it would be inappropriate to treat as "never applicable" since Pitt is public).',
      realDataStatus: 'NOT_DISCLOSED',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Decision admit rate',
      reason:
        'CDS 2024-25 Section C21: "Does your institution offer an early decision plan?" — NO checked. Pitt does NOT offer Early Decision. Field stays null. CORRECTION to schema: hasEarlyDecision was true in DB — set to false to match CDS reality. Provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 (value=undefined with tier=OFFICIAL, semantically inconsistent) to authoritative UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 1.0,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS 2024-25 Section C22: "Do you have a nonbinding early action plan?" — NO checked. Pitt does NOT offer Early Action. (Pitt operates rolling admissions, application closing date 30-Jul per C1402.) Field stays null. Provenance refreshed from prior CDS_LLM_EXTRACT_2026_04 (value=undefined with tier=OFFICIAL, semantically inconsistent) to authoritative UNAVAILABLE/OFFICIAL_BLANK_SECTION/NOT_OFFERED.',
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

  // Bypass SchoolWriteService (schema drift). Minimal update with explicit select.
  await prisma.school.update({
    where: { id: school.id },
    data: {
      acceptanceRate: new Prisma.Decimal('58.08'),
      sat25: null,
      sat75: null,
      intlAcceptanceRate: null,
      oosAcceptanceRate: null,
      edAcceptanceRate: null,
      eaAcceptanceRate: null,
      // CDS C21 "No" — Pitt does not offer ED; correct stale DB true
      hasEarlyDecision: false,
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ updated 7 fields (AR=58.08, sat25=BLANK, sat75=BLANK, intlAR=BLANK, oosAR=BLANK, edAR=NOT_OFFERED, eaAR=NOT_OFFERED, hasED=false)',
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
