#!/usr/bin/env tsx
/**
 * Phase 3 — New Mexico State University (Las Cruces, NM) end-to-end closure of
 *   the 7 prediction-critical fields.
 *
 * Source attempt: NMSU Office of Institutional Analytics —
 *   https://oia.nmsu.edu/
 *   The OIA "natrept1/reports" directory publishes Common Data Set PDFs only
 *   through 2019-2020 (CDS_2019-2020-Final-Redacted_pdf.pdf was the latest
 *   publicly indexed file). Site-targeted Google searches (site:nmsu.edu
 *   "Common Data Set" / oia.nmsu.edu CDS) return only the 2018-19 and 2019-20
 *   files. Probes against ../natrept1/reports/CDS_2024-2025-Final-Redacted_pdf.pdf
 *   and ../natrept1/reports/CDS_2023-2024-Final-Redacted_pdf.pdf both return
 *   HTTP 404. The 2024-25 NMSU Quick Facts PDF
 *   (oia.nmsu.edu/nmsudata/quickfacts/QuickFacts_24_25_web.pdf) is published
 *   but is an aggregate institutional brochure with enrollment headcounts, not
 *   a CDS-equivalent breakdown of first-time-freshman applicants/admits by
 *   residency, nor C9 SAT percentiles, nor C21/C22 ED/EA tables.
 *
 * Per closure rule: "CDS 空 → BLANK_SECTION". NMSU has effectively stopped
 *   publishing CDS submissions to the public OIA website. For all 7 fields we
 *   cannot extract authoritative values for the Fall 2024 cohort — provenance
 *   is rewritten to UNAVAILABLE / OFFICIAL_BLANK_SECTION.
 *
 * NMSU is a PUBLIC land-grant research university (A2 "Public") — oosAR is in
 *   eligible scope when a CDS is available, but here it cannot be filled, so
 *   tier is UNAVAILABLE (not TERMINAL — TERMINAL is for private/SLAC where
 *   in/out-of-state has no policy meaning; for a public school the field is
 *   in scope but unsourceable).
 *
 * Existing field values left untouched (BLANK_SECTION only rewrites
 *   provenance, not values, since prior values are non-authoritative
 *   carry-overs):
 *   - acceptanceRate    : 71     (LEGACY_DB_VALUE; preserved)
 *   - sat25             : 885    (CDS_PDF_AUTO cited clastify aggregator; preserved)
 *   - sat75             : 1110   (CDS_PDF_AUTO cited clastify aggregator; preserved)
 *   - intlAcceptanceRate: 67.45  (PERMANENT_HEURISTIC; preserved)
 *   - oosAcceptanceRate : 72.42  (PERMANENT_HEURISTIC; preserved)
 *   - edAcceptanceRate  : null   (already cleared)
 *   - eaAcceptanceRate  : null   (already cleared)
 *
 * Provenance changes (all 7 -> UNAVAILABLE / OFFICIAL_BLANK_SECTION):
 *   - acceptanceRate    : LEGACY_DB_VALUE        -> OFFICIAL_BLANK_SECTION
 *   - sat25             : CDS_PDF_AUTO (clastify)-> OFFICIAL_BLANK_SECTION
 *   - sat75             : CDS_PDF_AUTO (clastify)-> OFFICIAL_BLANK_SECTION
 *   - intlAcceptanceRate: PERMANENT_HEURISTIC    -> OFFICIAL_BLANK_SECTION
 *   - oosAcceptanceRate : PERMANENT_HEURISTIC    -> OFFICIAL_BLANK_SECTION
 *   - edAcceptanceRate  : CDS_LLM_EXTRACT_2026_04 (oia.nmsu.edu landing) ->
 *                          OFFICIAL_BLANK_SECTION (CDS itself not retrievable)
 *   - eaAcceptanceRate  : CDS_LLM_EXTRACT_2026_04 -> OFFICIAL_BLANK_SECTION
 *
 * NOTE on hasEarlyDecision: current DB value is TRUE. NMSU's public admissions
 *   pages do NOT advertise an Early Decision plan — NMSU operates on rolling /
 *   regular admission with priority-deadline scholarship dates. Without the
 *   CDS we cannot 100% verify, but conservatively leave hasEarlyDecision
 *   UNCHANGED (do not flip without source).
 */
import { PrismaClient } from '@prisma/client';
import {
  deepMergeRecords,
  toRecord,
} from '../../src/modules/school/school-provenance.helpers';
import { serializeSchoolProvenance } from '@study-abroad/shared/utils';

const CDS_URL = 'https://oia.nmsu.edu/';
const CYCLE_YEAR = 2024; // Targeted cycle = CDS 2024-2025 / Fall 2024
const NOW = new Date().toISOString();
const SCHOOL_ID = 'cmnwr8isf0035z0tixudqprxr';

const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findUnique({
    where: { id: SCHOOL_ID },
    select: { id: true, name: true, metadata: true },
  });
  if (!school) throw new Error(`School ${SCHOOL_ID} (NMSU) not found`);
  console.log(`Updating ${school.name} (${school.id})`);

  const baseProv = {
    sourceUrl: CDS_URL,
    cycleYear: CYCLE_YEAR,
    fetchedAt: NOW,
    verifiedAt: NOW,
    confidence: 0.6,
    verifiedBy: 'closure-pipeline-phase3-batch26-claude',
    generatedBy: 'phase3-nmsu-blank-section',
  };

  const blankReason =
    'NMSU Office of Institutional Analytics (oia.nmsu.edu) publishes Common Data Set submissions only through 2019-2020 in its natrept1/reports directory; site-targeted Google searches for "Common Data Set" / "CDS" return no 2020-21 or later files. Direct probes against the expected 2024-2025 path return HTTP 404. The NMSU 2024-25 Quick Facts brochure exists but provides only aggregate enrollment headcounts, not a CDS-equivalent C1 residency table, C9 SAT percentile table, or C21/C22 ED/EA disclosure. Per closure-pipeline rule "CDS 空 → BLANK_SECTION" — provenance rewritten to UNAVAILABLE / OFFICIAL_BLANK_SECTION. Existing DB values preserved as non-authoritative carry-over; downstream code must treat as UNAVAILABLE.';

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
        'CDS itself is not publicly retrievable (see acceptanceRate reason). NMSU is a public land-grant university (Las Cruces, NM) on rolling/regular admission with priority-deadline scholarship dates — no ED plan is advertised on its public admissions pages. Field stays cleared (null) and marked BLANK_SECTION. Replaces prior CDS_LLM_EXTRACT_2026_04 provenance which pointed at the OIA landing page but could not produce a verified value.',
      realDataStatus: 'NOT_OFFERED',
    },
    eaAcceptanceRate: {
      ...baseProv,
      tier: 'UNAVAILABLE',
      source: 'OFFICIAL_BLANK_SECTION',
      confidence: 0.7,
      policyLabel: 'Early Action admit rate',
      reason:
        'CDS itself is not publicly retrievable. NMSU does not advertise an EA plan on its public admissions site, but without the CDS we cannot conclusively rule it out. Field stays cleared (null) and marked BLANK_SECTION.',
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
