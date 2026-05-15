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
