#!/usr/bin/env tsx
/**
 * Phase 3 — Eastern Michigan University (Ypsilanti, MI) end-to-end closure of
 *   the 7 prediction-critical fields.
 *
 * Source attempt: Eastern Michigan University Institutional Research & Info
 *   Management — published CDS 2024-2025 PDF references:
 *     - https://www.emich.edu/irim/documents/common-data-sets/cds2024v3.pdf
 *     - https://irim.emich.edu/datafiles/pdf/cds2024.pdf
 *   Both URLs exist (200 OK with a PDF payload), but the published file is the
 *   BLANK CDS template — extracted text is only the Peterson's template
 *   preamble, definitions, and unfilled C1/C9/C21/C22 form fields. No
 *   institutional data has been populated. Independent verification via
 *   third-party aggregators (collegetuitioncompare.com, niche.com) shows
 *   admissions data exists, but those numbers cannot be back-traced to a
 *   published EMU CDS table, only to the IPEDS / Peterson's submission cycle.
 *
 * Per closure rule: "CDS 空 → BLANK_SECTION". EMU has uploaded what is
 *   structurally a CDS PDF, but the data sections are blank — equivalent to
 *   "CDS 空". For all 7 fields, provenance is rewritten to UNAVAILABLE /
 *   OFFICIAL_BLANK_SECTION; existing values preserved as non-authoritative
 *   carry-overs.
 *
 * Domain disambiguation: emu.edu is Eastern MENNONITE University (Virginia);
 *   eastern.edu is Eastern University (Pennsylvania); emich.edu / irim.emich.edu
 *   is the correct Eastern MICHIGAN University domain. Prior DB provenance
 *   incorrectly cited emu.edu and eastern.edu for some fields — corrected.
 *
 * EMU is a PUBLIC regional research university (A2 "Public" checked) — oosAR
 *   is in eligible scope when a CDS is available, but here it cannot be filled,
 *   so tier is UNAVAILABLE (not TERMINAL).
 *
 * Existing field values left untouched (BLANK_SECTION only rewrites
 *   provenance, not values):
 *   - acceptanceRate    : 83     (LEGACY_DB_VALUE; preserved)
 *   - sat25             : 930    (CDS_PDF_AUTO cited prepscholar; preserved)
 *   - sat75             : 1150   (CDS_PDF_AUTO cited prepscholar; preserved)
 *   - intlAcceptanceRate: 100    (LEGACY_DB_VALUE; preserved — value
 *                          implausibly high but no authoritative source to
 *                          correct)
 *   - oosAcceptanceRate : 100    (LEGACY_DB_VALUE; preserved — same caveat)
 *   - edAcceptanceRate  : null   (already cleared)
 *   - eaAcceptanceRate  : null   (already cleared)
 *
 * Provenance changes (all 7 -> UNAVAILABLE / OFFICIAL_BLANK_SECTION):
 *   - acceptanceRate    : LEGACY_DB_VALUE          -> OFFICIAL_BLANK_SECTION
 *   - sat25             : CDS_PDF_AUTO (prepscholar)-> OFFICIAL_BLANK_SECTION
 *   - sat75             : CDS_PDF_AUTO (prepscholar)-> OFFICIAL_BLANK_SECTION
 *   - intlAcceptanceRate: LEGACY_DB_VALUE (emu.edu)-> OFFICIAL_BLANK_SECTION
 *   - oosAcceptanceRate : LEGACY_DB_VALUE (emu.edu)-> OFFICIAL_BLANK_SECTION
 *   - edAcceptanceRate  : CDS_LLM_EXTRACT (eastern.edu wrong school) ->
 *                          OFFICIAL_BLANK_SECTION
 *   - eaAcceptanceRate  : CDS_LLM_EXTRACT (eastern.edu wrong school) ->
 *                          OFFICIAL_BLANK_SECTION
 *
 * NOTE on hasEarlyDecision: current DB value is TRUE. EMU's public admissions
 *   pages do NOT advertise an Early Decision plan — EMU operates on rolling
 *   admission with EOpriority/scholarship deadlines, not ED. Without the
 *   completed CDS we cannot 100% verify, but conservatively leave
 *   hasEarlyDecision UNCHANGED (do not flip without source).
 */
import { PrismaClient } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL =
  'https://www.emich.edu/irim/documents/common-data-sets/cds2024v3.pdf';
const CYCLE_YEAR = 2024; // CDS 2024-2025 = Fall 2024 entering class
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8isn0039z0tik49prelk';

const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findUnique({
    where: { id: SCHOOL_ID },
    select: { id: true, name: true, metadata: true },
  });
  if (!school)
    throw new Error(`School ${SCHOOL_ID} (Eastern Michigan) not found`);
  console.log(`Updating ${school.name} (${school.id})`);

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 0.6,
    verifiedBy: 'closure-pipeline-phase3-batch26-claude',
    generatedBy: 'phase3-emu-blank-section',
  };

  const blankReason =
    'Eastern Michigan University IRIM has uploaded a 2024-2025 CDS PDF at https://www.emich.edu/irim/documents/common-data-sets/cds2024v3.pdf (and a duplicate at irim.emich.edu/datafiles/pdf/cds2024.pdf), but the file is the unfilled Peterson\'s blank CDS template — extracted text contains only the template preamble, definitions, and empty form fields for C1/C9/C21/C22. No EMU institutional data has been populated. Per closure-pipeline rule "CDS 空 → BLANK_SECTION" — provenance rewritten to UNAVAILABLE / OFFICIAL_BLANK_SECTION. Existing DB values preserved as non-authoritative carry-over (some prior provenance incorrectly cited emu.edu = Eastern Mennonite, or eastern.edu = Eastern University PA — neither is Eastern Michigan; emich.edu is the correct domain). Downstream code must treat as UNAVAILABLE.';

  const provenance = {
    acceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      policyLabel: 'Overall admit rate',
      reason: blankReason,
      realDataStatus: 'BLANK_IN_OFFICIAL_SOURCE',
    },
    sat25: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      policyLabel: 'SAT composite 25th percentile',
      reason: blankReason,
      realDataStatus: 'BLANK_IN_OFFICIAL_SOURCE',
    },
    sat75: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      policyLabel: 'SAT composite 75th percentile',
      reason: blankReason,
      realDataStatus: 'BLANK_IN_OFFICIAL_SOURCE',
    },
    intlAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      policyLabel: 'International admit rate',
      reason: blankReason,
      realDataStatus: 'BLANK_IN_OFFICIAL_SOURCE',
    },
    oosAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      policyLabel: 'Out-of-state admit rate',
      reason: blankReason,
      realDataStatus: 'BLANK_IN_OFFICIAL_SOURCE',
    },
    edAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 0.9,
      policyLabel: 'Early Decision admit rate',
      reason:
        "EMU's published CDS PDF is a blank template (see acceptanceRate reason). EMU is a public regional research university (Ypsilanti, MI) on rolling admission with EO priority / scholarship deadlines — no ED plan is advertised on its public admissions pages. Field stays cleared (null) and marked BLANK_SECTION. Replaces prior CDS_LLM_EXTRACT_2026_04 provenance which incorrectly cited eastern.edu = Eastern University in PA, NOT Eastern Michigan.",
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 0.7,
      policyLabel: 'Early Action admit rate',
      reason:
        "EMU's published CDS PDF is a blank template. EMU does not advertise an EA plan on its public admissions site, but without the completed CDS we cannot conclusively rule it out. Field stays cleared (null) and marked BLANK_SECTION. Replaces prior CDS_LLM_EXTRACT which incorrectly cited eastern.edu (Eastern University PA).",
      realDataStatus: 'BLANK_IN_OFFICIAL_SOURCE',
    },
  };

  const existingMeta = toRecord(school.metadata);
  const serialized = serializeSchoolProvenance(provenance as any);
  const nextMetadata = {
    ...existingMeta,
    provenance: deepMergeRecords(toRecord(existingMeta.provenance), serialized),
    closureSourceIndex: CDS_URL,
  };

  // Values preserved as-is; only provenance + lastDataReviewAt + metadata change.
  await prisma.school.update({
    where: { id: school.id },
    data: {
      lastDataReviewAt: new Date(),
      metadata: nextMetadata,
    },
    select: { id: true },
  });

  console.log(
    '  ✅ provenance updated to BLANK_SECTION for all 7 fields (values preserved; hasEarlyDecision left as-is per rule "do not flip without source")',
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
