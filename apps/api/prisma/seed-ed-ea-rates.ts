/**
 * Seed `School.edAcceptanceRate` and `School.eaAcceptanceRate` from the
 * 2026-05 research pass.
 *
 * Source: combination of nextgenadmit (Common Data Set aggregator) and
 * each school's own admissions stats page. Each row records the source URL
 * for auditability.
 *
 * Rates are stored as percentages (e.g. 13.6 means 13.6%) per the
 * `Decimal(5,2)` schema convention.
 *
 * Idempotent: updateMany on nameNorm. Re-running overwrites only if
 * the value or source changed.
 *
 * Run standalone:
 *   npx tsx apps/api/prisma/seed-ed-ea-rates.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Confidence = 'HIGH' | 'MEDIUM';

interface EdEaSeed {
  nameNorm: string;
  edAcceptanceRatePct?: number;
  eaAcceptanceRatePct?: number;
  dataYear: string;
  source: string;
  confidence: Confidence;
  notes?: string;
}

export const ED_EA_RATE_SEEDS: ReadonlyArray<EdEaSeed> = [
  // ── HIGH confidence (school's own page or CDS PDF) ────────────────────
  {
    nameNorm: 'massachusetts institute of technology',
    eaAcceptanceRatePct: 5.98,
    dataYear: 'Class of 2029',
    source: 'https://mitadmissions.org/apply/process/stats/',
    confidence: 'HIGH',
    notes: 'MIT is EA-only (no ED)',
  },
  {
    nameNorm: 'rice university',
    edAcceptanceRatePct: 13.2,
    dataYear: 'Class of 2029',
    source:
      'https://ideas.rice.edu/wp-content/uploads/2025/10/CDS_2024-25_WEBSITE.pdf',
    confidence: 'HIGH',
    notes: 'ED1 391/2970 (13.2%); ED2 separately at 6.0%',
  },
  {
    nameNorm: 'washington university in st. louis',
    edAcceptanceRatePct: 25.26,
    dataYear: 'Class of 2029',
    source: 'https://washu.edu/app/uploads/2025/06/2024-2025-WashU-CDS.pdf',
    confidence: 'HIGH',
  },
  {
    nameNorm: 'carnegie mellon university',
    edAcceptanceRatePct: 20.6,
    dataYear: 'Class of 2029',
    source:
      'https://www.cmu.edu/ira/CDS/pdf/cds_2024-25/common-data-set-2024-2025-21feb2025.pdf',
    confidence: 'HIGH',
  },
  {
    nameNorm: 'emory university',
    edAcceptanceRatePct: 22.2,
    dataYear: 'Class of 2029',
    source:
      'https://provost.emory.edu/planning-administration/_includes/documents/sections/institutional-data/emory-common-data-set-2024-2025.pdf',
    confidence: 'HIGH',
  },
  {
    nameNorm: 'university of notre dame',
    eaAcceptanceRatePct: 13.0,
    dataYear: 'Class of 2029',
    source: 'https://www3.nd.edu/~instres/CDS/2024-2025/CDS_2024-2025.pdf',
    confidence: 'HIGH',
    notes: 'Notre Dame uses Restrictive EA (no ED)',
  },
  {
    nameNorm: 'university of southern california',
    eaAcceptanceRatePct: 8.4,
    dataYear: 'Class of 2029',
    source:
      'https://oir.usc.edu/common-data-set-archive/common-data-set-2024-2025/',
    confidence: 'HIGH',
    notes: 'USC uses non-restrictive EA; ED launches in fall 2027 cycle',
  },
  {
    nameNorm: 'georgetown university',
    eaAcceptanceRatePct: 11.11,
    dataYear: 'Class of 2029',
    source: 'https://oads.georgetown.edu/commondataset/',
    confidence: 'HIGH',
    notes: 'Georgetown uses Restrictive EA (no ED)',
  },
  {
    nameNorm: 'university of virginia',
    edAcceptanceRatePct: 25.8,
    eaAcceptanceRatePct: 16.1,
    dataYear: 'Class of 2029',
    source:
      'https://www.cavalierdaily.com/article/2025/02/university-offers-admission-to-6746-early-action-applicants-for-the-class-of-2029',
    confidence: 'HIGH',
    notes: 'UVA has both ED and non-restrictive EA',
  },
  {
    nameNorm: 'georgia institute of technology',
    eaAcceptanceRatePct: 16.0,
    dataYear: 'Class of 2028',
    source: 'https://admission.gatech.edu/admission-snapshot',
    confidence: 'HIGH',
    notes: 'GT uses EA1 (in-state) + EA2 (OOS/intl)',
  },
  {
    nameNorm: 'williams college',
    edAcceptanceRatePct: 26.66,
    dataYear: 'Class of 2029',
    source:
      'https://williamsrecord.com/468578/news/college-admits-26-6-percent-of-early-decision-applicants-to-class-of-2029/',
    confidence: 'HIGH',
  },
  {
    nameNorm: 'amherst college',
    edAcceptanceRatePct: 22.25,
    dataYear: 'Class of 2029',
    source: 'https://www.amherst.edu/about/facts/common_data_sets',
    confidence: 'HIGH',
  },
  {
    nameNorm: 'boston university',
    edAcceptanceRatePct: 31.0,
    dataYear: 'Class of 2029',
    source: 'https://www.bu.edu/asir/files/2025/03/cds-2025.pdf',
    confidence: 'HIGH',
  },

  // ── MEDIUM confidence (nextgenadmit, CDS-based aggregator) ────────────
  {
    nameNorm: 'columbia university',
    edAcceptanceRatePct: 13.2,
    dataYear: 'Class of 2028 (last split)',
    source:
      'https://nextgenadmit.com/columbia-university-admission-statistics/',
    confidence: 'MEDIUM',
    notes: 'Columbia stopped publishing ED/RD splits starting Class of 2028',
  },
  {
    nameNorm: 'university of pennsylvania',
    edAcceptanceRatePct: 13.6,
    dataYear: 'Class of 2029',
    source:
      'https://nextgenadmit.com/university-of-pennsylvania-admission-statistics/',
    confidence: 'MEDIUM',
  },
  {
    nameNorm: 'brown university',
    edAcceptanceRatePct: 17.9,
    dataYear: 'Class of 2029',
    source: 'https://nextgenadmit.com/brown-university-admission-statistics/',
    confidence: 'MEDIUM',
  },
  {
    nameNorm: 'dartmouth college',
    edAcceptanceRatePct: 17.0,
    dataYear: 'Class of 2029',
    source: 'https://nextgenadmit.com/dartmouth-admission-statistics/',
    confidence: 'MEDIUM',
  },
  {
    nameNorm: 'cornell university',
    edAcceptanceRatePct: 21.5,
    dataYear: 'Class of 2029',
    source: 'https://nextgenadmit.com/cornell-admission-statistics/',
    confidence: 'MEDIUM',
  },
  {
    nameNorm: 'duke university',
    edAcceptanceRatePct: 12.8,
    dataYear: 'Class of 2029',
    source: 'https://nextgenadmit.com/duke-admission-statistics/',
    confidence: 'MEDIUM',
  },
  {
    nameNorm: 'johns hopkins university',
    edAcceptanceRatePct: 11.0,
    dataYear: 'Class of 2029',
    source: 'https://nextgenadmit.com/johns-hopkins-admission-statistics/',
    confidence: 'MEDIUM',
  },
  {
    nameNorm: 'northwestern university',
    edAcceptanceRatePct: 20.0,
    dataYear: 'Class of 2029',
    source:
      'https://nextgenadmit.com/northwestern-university-admission-statistics/',
    confidence: 'MEDIUM',
  },
  {
    nameNorm: 'vanderbilt university',
    edAcceptanceRatePct: 13.2,
    dataYear: 'Class of 2029',
    source: 'https://nextgenadmit.com/vanderbilt-admission-statistics/',
    confidence: 'MEDIUM',
  },
  {
    nameNorm: 'yale university',
    eaAcceptanceRatePct: 10.8,
    dataYear: 'Class of 2029',
    source: 'https://nextgenadmit.com/yale-admission-statistics/',
    confidence: 'MEDIUM',
    notes: 'SCEA 728/6754',
  },
  {
    nameNorm: 'pomona college',
    edAcceptanceRatePct: 12.98,
    dataYear: 'Class of 2029',
    source:
      'https://www.collegeessayadvisors.com/acceptance-rates-and-admissions-statistics-for-top-schools/',
    confidence: 'MEDIUM',
  },
  {
    nameNorm: 'bowdoin college',
    edAcceptanceRatePct: 14.8,
    dataYear: 'Class of 2029',
    source:
      'https://www.collegeessayadvisors.com/acceptance-rates-and-admissions-statistics-for-top-schools/',
    confidence: 'MEDIUM',
  },
  {
    nameNorm: 'middlebury college',
    edAcceptanceRatePct: 38.9,
    dataYear: 'Class of 2029',
    source:
      'https://www.collegeessayadvisors.com/acceptance-rates-and-admissions-statistics-for-top-schools/',
    confidence: 'MEDIUM',
  },
  {
    nameNorm: 'northeastern university',
    edAcceptanceRatePct: 43.0,
    dataYear: 'Class of 2028',
    source: 'https://nextgenadmit.com/northeastern-admission-statistics/',
    confidence: 'MEDIUM',
  },

  // ── 2026-05-30 marginal-backfill research pass (CDS C21, primary-sourced) ──
  // 22 schools added below to fill the round data-driven path (was ~28% covered).
  // 14 other researched schools yielded NO public early-round rate and are
  // intentionally absent: Princeton/Stanford/Caltech stopped disclosing REA;
  // Wake Forest/NYU/Tufts/Colby suppress CDS C21 counts; 7 publics (UNC/UF/UIUC/
  // Wisconsin/Maryland/Purdue/Ohio State) publish no separate EA admit count
  // (CDS C22 has no count fields). This is a structural data wall, not a gap.
  // Rationale + research: docs/PREDICTION_DATA_DRIVEN_STRATEGY_2026-05-30.md
  {
    nameNorm: 'harvard university',
    eaAcceptanceRatePct: 8.74,
    dataYear: 'Class of 2028',
    source:
      'https://news.harvard.edu/gazette/story/2023/12/college-accepts-692-under-early-action-program/',
    confidence: 'HIGH',
    notes: 'Restrictive (Single-Choice) EA, no ED. 692/7921.',
  },
  {
    nameNorm: 'swarthmore college',
    edAcceptanceRatePct: 17.8,
    dataYear: 'Class of 2029',
    source:
      'https://www.swarthmore.edu/sites/default/files/assets/documents/institutional-effectiveness-research-assessment/Swarthmore-CDS-2025-26.pdf',
    confidence: 'HIGH',
    notes: 'Own CDS C21 combined ED1+ED2: 228/1281.',
  },
  {
    nameNorm: 'wellesley college',
    edAcceptanceRatePct: 29.42,
    dataYear: 'Class of 2029',
    source:
      'https://wellesley-college.files.svdcdn.com/production/administrative-departments/OIR/CDS_2025-2026-FINAL.pdf',
    confidence: 'HIGH',
    notes: 'Own CDS C21 combined ED1+ED2: 301/1023.',
  },
  {
    nameNorm: 'carleton college',
    edAcceptanceRatePct: 36.58,
    dataYear: 'Class of 2028',
    source:
      'https://carleton-wp-production.s3.amazonaws.com/uploads/sites/292/2025/07/2024-2025-CDS_06032025.pdf',
    confidence: 'HIGH',
    notes:
      'Own CDS 2024-25 C21 combined ED1+ED2: 244/667. NB 2025-26 file shows 263/760 also labeled Fall 2024 (template lag).',
  },
  {
    nameNorm: 'harvey mudd college',
    edAcceptanceRatePct: 18.35,
    dataYear: 'Class of 2028',
    source:
      'https://www.hmc.edu/institutional-research/wp-content/uploads/sites/42/2026/03/CDS-HMC-2025.2026_shared.pdf',
    confidence: 'HIGH',
    notes: 'Own CDS C21 combined ED1+ED2: 109/594 (corrects stale 16.16%).',
  },
  {
    nameNorm: 'claremont mckenna college',
    edAcceptanceRatePct: 22.09,
    dataYear: 'Class of 2029',
    source: 'https://www.cmc.edu/sites/default/files/CDS_2025-26_0.pdf',
    confidence: 'HIGH',
    notes: 'Own CDS C21 combined ED1+ED2: 216/978.',
  },
  {
    nameNorm: 'grinnell college',
    edAcceptanceRatePct: 34.18,
    dataYear: 'Class of 2028',
    source:
      'https://www.grinnell.edu/sites/default/files/docs/2025-03/Grinnell-2024-2025-Common-Data-Set.pdf',
    confidence: 'HIGH',
    notes: 'Own CDS C21 combined ED1+ED2: 283/828.',
  },
  {
    nameNorm: 'barnard college',
    edAcceptanceRatePct: 25.62,
    dataYear: 'Class of 2028',
    source:
      'https://barnard.edu/sites/default/files/inline-files/Barnard%20CDS%202024-2025.pdf',
    confidence: 'HIGH',
    notes: 'Own CDS C21: 434/1694 (corrects press-release 23.8%).',
  },
  {
    nameNorm: 'davidson college',
    edAcceptanceRatePct: 29.06,
    dataYear: 'Class of 2028',
    source: 'https://www.davidson.edu/media/9718/download',
    confidence: 'HIGH',
    notes: 'Own CDS C21 combined ED1+ED2: 358/1232.',
  },
  {
    nameNorm: 'washington and lee university',
    edAcceptanceRatePct: 27.58,
    dataYear: 'Class of 2029',
    source: 'https://my.wlu.edu/document/2025-common-data-set',
    confidence: 'HIGH',
    notes: 'Own CDS C21: 289/1048. ED only, no EA.',
  },
  {
    nameNorm: 'bates college',
    edAcceptanceRatePct: 27.13,
    dataYear: 'Class of 2028',
    source: 'https://www.bates.edu/research/files/2026/03/CDS_2024-2025.pdf',
    confidence: 'HIGH',
    notes:
      'Own CDS C21 combined ED1+ED2: 306/1128 (apps surged; stale figure was 41.7%).',
  },
  {
    nameNorm: 'boston college',
    edAcceptanceRatePct: 33.44,
    dataYear: 'Class of 2028',
    source:
      'https://www.bc.edu/content/dam/bc1/offices/irp/ir/cds/Boston_College_CDS_2024-2025_Final.pdf',
    confidence: 'HIGH',
    notes:
      'Own CDS C21 combined ED1+ED2: 1434/4288 (corrects wrong 44.6%/30%).',
  },
  {
    nameNorm: 'lehigh university',
    edAcceptanceRatePct: 47.35,
    dataYear: 'Class of 2029',
    source:
      'https://data.lehigh.edu/sites/data.lehigh.edu/files/1302026-CDS-2025-2026-FINAL.pdf',
    confidence: 'HIGH',
    notes: 'Own CDS C21 combined ED1+ED2: 966/2040.',
  },
  {
    nameNorm: 'university of rochester',
    edAcceptanceRatePct: 38.05,
    dataYear: 'Class of 2028',
    source:
      'https://www.rochester.edu/provost/wp-content/uploads/2025/06/CDS_2024-2025-completed-for-web.pdf',
    confidence: 'HIGH',
    notes: 'Own CDS C21 combined ED1+ED2: 527/1385 (AS&E).',
  },
  {
    nameNorm: 'brandeis university',
    edAcceptanceRatePct: 42.22,
    dataYear: 'Class of 2028',
    source:
      'https://www.brandeis.edu/institutional-research/docs/cds-2024-25.pdf',
    confidence: 'HIGH',
    notes: 'Own CDS C21 combined ED1+ED2: 323/765.',
  },
  {
    nameNorm: 'case western reserve university',
    edAcceptanceRatePct: 24.98,
    dataYear: 'Class of 2029',
    source:
      'https://case.edu/ir/sites/default/files/2026-02/CDS%202025-26%20Adjusted%20Final.pdf',
    confidence: 'HIGH',
    notes:
      'Own CDS C21 combined ED1+ED2: 263/1053. Also EA but no EA counts published.',
  },
  {
    nameNorm: 'university of georgia',
    eaAcceptanceRatePct: 32.0,
    dataYear: 'Class of 2030',
    source:
      'https://admissions.uga.edu/blog/2026-ea-totals-and-out-of-state-international-decisions/',
    confidence: 'HIGH',
    notes:
      'Non-binding EA. UGA blog: 10,760/34,280 = ~32% (45% in-state, 22% OOS).',
  },
  {
    nameNorm: 'hamilton college',
    edAcceptanceRatePct: 29.44,
    dataYear: 'Class of 2028',
    source:
      'https://www.ivycoach.com/the-ivy-coach-blog/early-decision-early-action/hamilton-college-early-decision-admission-statistics/',
    confidence: 'MEDIUM',
    notes: 'Combined ED1+ED2 247/839 (Ivy Coach citing Hamilton CDS).',
  },
  {
    nameNorm: 'vassar college',
    edAcceptanceRatePct: 31.2,
    dataYear: 'Class of 2028',
    source:
      'https://www.ivycoach.com/the-ivy-coach-blog/early-decision-early-action/vassar-college-early-decision-admission-statistics/',
    confidence: 'MEDIUM',
    notes: 'Combined ED1+ED2 312/999 (Ivy Coach citing Vassar CDS).',
  },
  {
    nameNorm: 'smith college',
    edAcceptanceRatePct: 32.58,
    dataYear: 'Class of 2028',
    source:
      'https://www.ivycoach.com/the-ivy-coach-blog/early-decision-early-action/smith-college-early-decision-admission-statistics/',
    confidence: 'MEDIUM',
    notes: 'Combined ED1+ED2 (Ivy Coach citing Smith CDS).',
  },
  {
    nameNorm: 'haverford college',
    edAcceptanceRatePct: 33.12,
    dataYear: 'Class of 2028',
    source:
      'https://www.ivycoach.com/the-ivy-coach-blog/early-decision-early-action/haverford-college-early-decision-admission-statistics/',
    confidence: 'MEDIUM',
    notes:
      'Combined ED1+ED2 vs 12.37% overall (Ivy Coach citing Haverford CDS).',
  },
  {
    nameNorm: 'colgate university',
    edAcceptanceRatePct: 35.25,
    dataYear: 'Class of 2029',
    source:
      'https://www.ivycoach.com/the-ivy-coach-blog/early-decision-early-action/colgate-university-early-decision-admission-statistics/',
    confidence: 'MEDIUM',
    notes:
      'Combined ED1+ED2 (Ivy Coach citing Colgate CDS; discarded conflicting 19.2%).',
  },
];

export async function seedEdEaRates(
  prismaClient: PrismaClient = prisma,
): Promise<{ updated: number; notFound: string[] }> {
  let updated = 0;
  const notFound: string[] = [];

  for (const row of ED_EA_RATE_SEEDS) {
    const data: { edAcceptanceRate?: number; eaAcceptanceRate?: number } = {};
    if (row.edAcceptanceRatePct != null) {
      data.edAcceptanceRate = row.edAcceptanceRatePct;
    }
    if (row.eaAcceptanceRatePct != null) {
      data.eaAcceptanceRate = row.eaAcceptanceRatePct;
    }
    if (Object.keys(data).length === 0) continue;

    const result = await prismaClient.school.updateMany({
      where: { nameNorm: row.nameNorm },
      data,
    });
    if (result.count === 0) {
      notFound.push(row.nameNorm);
    } else {
      updated += result.count;
    }
  }

  return { updated, notFound };
}

async function main() {
  console.log('🎯 Seeding ED / EA acceptance rates from research data...\n');
  const { updated, notFound } = await seedEdEaRates();
  console.log(`✅ Updated ${updated} school(s)`);
  if (notFound.length > 0) {
    console.warn(`⚠ ${notFound.length} school(s) not in DB:`, notFound);
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seed failed:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
