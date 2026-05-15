/**
 * Mark `gpaDistribution` as TERMINAL (intentionally not reported) for the
 * 7 elite liberal arts colleges that DELIBERATELY suppress CDS Section C11.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * RESEARCH FINDING (2026-05-14 web pass)
 * ──────────────────────────────────────────────────────────────────────────
 * Williams, Amherst, Swarthmore, Pomona, Bowdoin, Middlebury, Wellesley
 * all leave CDS Section C11 (high-school GPA distribution) blank — five
 * were verified firsthand via official 2024-2025 PDFs, two via third-party
 * confirmation. Swarthmore's CDS explicitly states "High School GPA data
 * is not available".
 *
 * This is a policy choice — holistic-admission LACs view GPA buckets as
 * misleading given high-school heterogeneity. It is NOT a collection
 * failure on our end, and the field should never appear as "missing /
 * action needed" on the data-health dashboard for these schools.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * MECHANISM
 * ──────────────────────────────────────────────────────────────────────────
 * We mark `metadata.provenance.gpaDistribution` with
 *   source = 'NO_PUBLIC_REAL_DATA:LAC_HOLISTIC_POLICY'
 *   realDataStatus = 'NO_PUBLIC_REAL_DATA'
 *   permanent = true
 *
 * The `realDataStatus = NO_PUBLIC_REAL_DATA` value is one of the
 * TERMINAL_REAL_DATA_STATUSES recognized by AdminSchoolDataCoverageService
 * (see admin-school-data-coverage.service.ts:50-56), so the data-health
 * dashboard correctly classifies these schools as "terminal — opted out"
 * instead of nagging operators to fill the field.
 *
 * The `gpaDistribution` column itself stays null (the truth).
 *
 * Run standalone:
 *   npx tsx apps/api/prisma/seed-lac-gpa-terminal.ts
 */

import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface LacEntry {
  nameNorm: string;
  sourceUrl: string;
  verification: 'PDF_VERIFIED' | 'THIRD_PARTY_CONFIRMED';
  notes: string;
}

export const LAC_NO_GPA_POLICY: ReadonlyArray<LacEntry> = [
  {
    nameNorm: 'amherst college',
    sourceUrl:
      'https://www.amherst.edu/system/files/C%20First-Time,%20First-Year%20Admission_3.pdf',
    verification: 'PDF_VERIFIED',
    notes:
      'CDS Section C11 left blank; C12 marks GPA as "Do not track". 2024-2025 CDS.',
  },
  {
    nameNorm: 'bowdoin college',
    sourceUrl: 'https://www.bowdoin.edu/ir/pdf/bowdoin-cds_2024-2025.pdf',
    verification: 'PDF_VERIFIED',
    notes: 'CDS Section C11 totals = 0.00 across all three columns. 2024-2025.',
  },
  {
    nameNorm: 'middlebury college',
    sourceUrl:
      'https://www.middlebury.edu/sites/default/files/2025-04/Middlebury%20CDS%202024_2025.pdf',
    verification: 'PDF_VERIFIED',
    notes: 'CDS Section C11 blank; C12 avg GPA = 0.00. 2024-2025.',
  },
  {
    nameNorm: 'swarthmore college',
    sourceUrl:
      'https://www.swarthmore.edu/sites/default/files/assets/documents/institutional-effectiveness-research-assessment/Swarthmore-College-CDS-2024-2025.pdf',
    verification: 'PDF_VERIFIED',
    notes:
      'CDS Section C11 explicitly states "High School GPA data is not available".',
  },
  {
    nameNorm: 'wellesley college',
    sourceUrl:
      'https://wellesley-college.files.svdcdn.com/production/administrative-departments/OIR/CDS_2024-2025-FINAL-1.pdf',
    verification: 'PDF_VERIFIED',
    notes: 'CDS Section C11 totals = 0.00%. C12 submission rate = 0.00%.',
  },
  {
    nameNorm: 'williams college',
    sourceUrl:
      'https://www.williams.edu/institutional-research/files/2025/06/CDS_2024_2025_Williams_V5.pdf',
    verification: 'THIRD_PARTY_CONFIRMED',
    notes:
      'Williams PDF is Cloudflare-gated; CollegeData / PrepScholar confirm GPA "not reported". Consistent with peer LAC policy.',
  },
  {
    nameNorm: 'pomona college',
    sourceUrl:
      'https://www.pomona.edu/administration/institutional-research/information-center/common-data-set',
    verification: 'THIRD_PARTY_CONFIRMED',
    notes:
      'Pomona 2024-2025 is Tableau-only (not scrapable); CollegeData confirms GPA not reported.',
  },
];

export async function seedLacGpaTerminal(
  prismaClient: PrismaClient = prisma,
): Promise<{ updated: number; notFound: string[] }> {
  let updated = 0;
  const notFound: string[] = [];
  const now = new Date().toISOString();

  for (const entry of LAC_NO_GPA_POLICY) {
    const school = await prismaClient.school.findFirst({
      where: { nameNorm: entry.nameNorm },
      select: { id: true, metadata: true },
    });
    if (!school) {
      notFound.push(entry.nameNorm);
      continue;
    }

    const metadata =
      school.metadata && typeof school.metadata === 'object'
        ? JSON.parse(JSON.stringify(school.metadata))
        : {};
    metadata.provenance = metadata.provenance ?? {};
    metadata.provenance.gpaDistribution = {
      source: 'NO_PUBLIC_REAL_DATA:LAC_HOLISTIC_POLICY',
      sourceUrl: entry.sourceUrl,
      fetchedAt: now,
      verifiedAt: now,
      verifiedBy: 'lac-gpa-terminal-seed-2026-05',
      realDataStatus: 'NO_PUBLIC_REAL_DATA',
      permanent: true,
      notes: `[${entry.verification}] ${entry.notes}`,
    };

    await prismaClient.school.update({
      where: { id: school.id },
      data: {
        gpaDistribution: Prisma.DbNull, // ensure DB column is null
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
    updated++;
  }

  return { updated, notFound };
}

async function main() {
  console.log(
    `🎓 Marking ${LAC_NO_GPA_POLICY.length} LACs as terminal for gpaDistribution...\n`,
  );
  const { updated, notFound } = await seedLacGpaTerminal();
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
