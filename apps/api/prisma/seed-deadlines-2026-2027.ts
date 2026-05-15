/**
 * Seed SchoolDeadline rows for the 2026-2027 application cycle.
 *
 * "year" in our schema follows the SchoolDeadline convention: it stores
 * the **fall-entry year**, i.e. an applicant submitting in fall 2026 to
 * enroll in fall 2027 has year = 2027.
 *
 * Source: 2026-05-14 web-research pass. ~50 Top schools covered.
 *   - 9 schools are CONFIRMED (school's own page already lists 2026-2027 dates)
 *   - 41 schools are TENTATIVE_BASED_ON_PRIOR_YEAR (most schools refresh
 *     dates in August; year-over-year drift is typically ≤ 1-2 days).
 *
 * The `source` column on each row reflects this so the admin UI can
 * surface "awaiting school confirmation" badges.
 *
 * Idempotent — re-running upserts on (schoolId, year, round).
 *
 * Run standalone:
 *   npx tsx apps/api/prisma/seed-deadlines-2026-2027.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CYCLE_YEAR = 2027; // fall-entry year for the 2026-2027 application cycle

type Status = 'CONFIRMED' | 'TENTATIVE_BASED_ON_PRIOR_YEAR';

interface DeadlineRow {
  nameNorm: string;
  status: Status;
  sourceUrl: string;
  /** Map of round → ISO date `YYYY-MM-DD`. */
  deadlines: Record<string, string>;
  notes?: string;
}

export const DEADLINE_SEEDS_2026_2027: ReadonlyArray<DeadlineRow> = [
  // ── CONFIRMED ─────────────────────────────────────────────────────────
  {
    nameNorm: 'princeton university',
    status: 'CONFIRMED',
    sourceUrl:
      'https://admission.princeton.edu/apply/first-year-application-dates-deadlines',
    deadlines: { SCEA: '2026-11-01', RD: '2027-01-01' },
  },
  {
    nameNorm: 'georgetown university',
    status: 'CONFIRMED',
    sourceUrl: 'https://uadmissions.georgetown.edu/applying/first-year/',
    deadlines: { EA: '2026-11-01', RD: '2027-01-10' },
    notes: 'Uses own Georgetown Application (not Common App)',
  },
  {
    nameNorm: 'university of michigan, ann arbor',
    status: 'CONFIRMED',
    sourceUrl:
      'https://admissions.umich.edu/apply/first-year-applicants/requirements-deadlines',
    deadlines: { ED: '2026-11-01', EA: '2026-11-01', RD: '2027-02-01' },
    notes: 'Michigan launches binding ED for the first time in this cycle',
  },
  {
    nameNorm: 'university of southern california',
    status: 'CONFIRMED',
    sourceUrl:
      'https://www.provost.usc.edu/early-decision-admissions-fall-2027-applicants/',
    deadlines: { ED: '2026-11-01', EA: '2026-11-01', RD: '2027-01-10' },
    notes: 'USC launches ED for the first time in fall-2027 cycle',
  },
  {
    nameNorm: 'university of florida',
    status: 'CONFIRMED',
    sourceUrl: 'https://admissions.ufl.edu/apply/freshman/deadlines',
    deadlines: { EA: '2026-11-01', RD: '2027-01-15' },
  },
  // UC system — all campuses share the same window
  ...(
    [
      'university of california, berkeley',
      'university of california, los angeles',
      'university of california, san diego',
      'university of california, davis',
      'university of california, irvine',
      'university of california, santa barbara',
      'university of california, riverside',
      'university of california, santa cruz',
      'university of california, merced',
    ] as const
  ).map((nameNorm) => ({
    nameNorm,
    status: 'CONFIRMED' as const,
    sourceUrl:
      'https://admission.universityofcalifornia.edu/how-to-apply/applying-as-a-first-year/dates-and-deadlines.html',
    deadlines: { RD: '2026-12-01' },
    notes:
      'UC system unified window: opens 8/1, submits 10/1-11/30, ends 12/1 PST',
  })),

  // ── TENTATIVE (most schools refresh in August) ────────────────────────
  {
    nameNorm: 'massachusetts institute of technology',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl:
      'https://mitadmissions.org/apply/firstyear/deadlines-requirements/',
    deadlines: { EA: '2026-11-01', RD: '2027-01-05' },
  },
  {
    nameNorm: 'harvard university',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl:
      'https://college.harvard.edu/admissions/apply/application-deadlines',
    deadlines: { REA: '2026-11-01', RD: '2027-01-01' },
  },
  {
    nameNorm: 'stanford university',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl:
      'https://admission.stanford.edu/apply/first-year/decision_process.html',
    deadlines: { REA: '2026-11-01', RD: '2027-01-05' },
  },
  {
    nameNorm: 'yale university',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl: 'https://admissions.yale.edu/timelines',
    deadlines: { SCEA: '2026-11-01', RD: '2027-01-02' },
  },
  {
    nameNorm: 'california institute of technology',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl:
      'https://www.admissions.caltech.edu/apply/first-year-applicants/deadlines',
    deadlines: { REA: '2026-11-01', RD: '2027-01-05' },
  },
  {
    nameNorm: 'duke university',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl: 'https://admissions.duke.edu/checklist/',
    deadlines: { ED: '2026-11-02', RD: '2027-01-04' },
  },
  {
    nameNorm: 'university of chicago',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl:
      'https://collegeadmissions.uchicago.edu/apply/first-year-applicants',
    deadlines: {
      ED: '2026-11-02',
      EA: '2026-11-02',
      ED2: '2027-01-04',
      RD: '2027-01-04',
    },
  },
  {
    nameNorm: 'university of pennsylvania',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl:
      'https://admissions.upenn.edu/how-to-apply/first-year-applicants',
    deadlines: { ED: '2026-11-01', RD: '2027-01-05' },
  },
  {
    nameNorm: 'cornell university',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl:
      'https://admissions.cornell.edu/how-to-apply/first-year-applicants',
    deadlines: { ED: '2026-11-01', RD: '2027-01-02' },
  },
  {
    nameNorm: 'brown university',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl: 'https://admission.brown.edu/first-year/application-checklist',
    deadlines: { ED: '2026-11-01', RD: '2027-01-05' },
  },
  {
    nameNorm: 'johns hopkins university',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl:
      'https://apply.jhu.edu/how-to-apply/application-deadlines-requirements/',
    deadlines: { ED: '2026-11-01', ED2: '2027-01-02', RD: '2027-01-02' },
  },
  {
    nameNorm: 'columbia university',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl: 'https://undergrad.admissions.columbia.edu/apply/firstyear',
    deadlines: { ED: '2026-11-01', RD: '2027-01-01' },
  },
  {
    nameNorm: 'dartmouth college',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl: 'https://admissions.dartmouth.edu/apply-dartmouth',
    deadlines: { ED: '2026-11-01', RD: '2027-01-01' },
  },
  {
    nameNorm: 'northwestern university',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl:
      'https://admissions.northwestern.edu/apply/application-deadlines.html',
    deadlines: { ED: '2026-11-01', RD: '2027-01-02' },
  },
  {
    nameNorm: 'university of notre dame',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl: 'https://admissions.nd.edu/apply/early-action-regular-decision/',
    deadlines: { REA: '2026-11-01', RD: '2027-01-01' },
  },
  {
    nameNorm: 'vanderbilt university',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl: 'https://admissions.vanderbilt.edu/apply/',
    deadlines: { ED: '2026-11-01', ED2: '2027-01-01', RD: '2027-01-01' },
  },
  {
    nameNorm: 'carnegie mellon university',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl:
      'https://www.cmu.edu/admission/admission/application-plans-deadlines',
    deadlines: { ED: '2026-11-03', RD: '2027-01-05' },
  },
  {
    nameNorm: 'rice university',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl:
      'https://admission.rice.edu/apply/first-year-domestic-applicants',
    deadlines: { ED: '2026-11-01', ED2: '2027-01-04', RD: '2027-01-04' },
  },
  {
    nameNorm: 'washington university in st. louis',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl:
      'https://admissions.washu.edu/how-to-apply/application-dates-deadlines/',
    deadlines: { ED: '2026-11-03', ED2: '2027-01-02', RD: '2027-01-02' },
  },
  {
    nameNorm: 'emory university',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl:
      'https://apply.emory.edu/apply/first-year/plans-deadlines/index.html',
    deadlines: { ED: '2026-11-01', ED2: '2027-01-01', RD: '2027-01-01' },
  },
  {
    nameNorm: 'university of virginia',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl:
      'https://admission.virginia.edu/admission/deadlines-instructions',
    deadlines: { ED: '2026-11-01', EA: '2026-11-01', RD: '2027-01-05' },
  },
  {
    nameNorm: 'university of north carolina at chapel hill',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl:
      'https://admissions.unc.edu/apply/types-of-applications/first-year/',
    deadlines: { EA: '2026-10-15', RD: '2027-01-15' },
  },
  {
    nameNorm: 'new york university',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl:
      'https://www.nyu.edu/admissions/undergraduate-admissions/how-to-apply/all-freshmen-applicants.html',
    deadlines: { ED: '2026-11-01', ED2: '2027-01-01', RD: '2027-01-05' },
  },
  {
    nameNorm: 'tufts university',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl:
      'https://admissions.tufts.edu/apply/applying-to-tufts/checklist-and-deadlines/',
    deadlines: { ED: '2026-11-01', ED2: '2027-01-05', RD: '2027-01-05' },
  },
  {
    nameNorm: 'wake forest university',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl: 'https://admissions.wfu.edu/',
    deadlines: { ED: '2026-11-15', ED2: '2027-01-01', RD: '2027-01-01' },
  },
  {
    nameNorm: 'university of texas at austin',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl: 'https://admissions.utexas.edu/apply/freshman/',
    deadlines: { EA: '2026-10-15', RD: '2026-12-01' },
  },
  {
    nameNorm: 'boston college',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl:
      'https://www.bc.edu/content/bc-web/admission/apply/early-decision.html',
    deadlines: { ED: '2026-11-01', ED2: '2027-01-02', RD: '2027-01-02' },
  },
  {
    nameNorm: 'georgia institute of technology',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl: 'https://admission.gatech.edu/first-year/deadlines',
    deadlines: { EA: '2026-10-15', RD: '2027-01-05' },
    notes: 'EA1 = in-state only, EA2 (≈ 11/3) = OOS / international',
  },
  {
    nameNorm: 'university of illinois urbana-champaign',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl: 'https://www.admissions.illinois.edu/apply/freshman/dates',
    deadlines: { EA: '2026-11-01', RD: '2027-01-05' },
  },
  {
    nameNorm: 'boston university',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl: 'https://www.bu.edu/admissions/apply/deadlines/',
    deadlines: { ED: '2026-11-01', ED2: '2026-12-01', RD: '2027-01-06' },
  },
  {
    nameNorm: 'tulane university',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl: 'https://admission.tulane.edu/apply/deadlines-forms',
    deadlines: {
      ED: '2026-11-01',
      EA: '2026-11-15',
      ED2: '2027-01-13',
      RD: '2027-01-15',
    },
  },
  {
    nameNorm: 'william and mary',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl:
      'https://www.wm.edu/admission/undergraduateadmission/how-to-apply/datesdeadlines/',
    deadlines: { ED: '2026-11-01', ED2: '2027-01-05', RD: '2027-01-05' },
  },
  {
    nameNorm: 'university of rochester',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl: 'https://admissions.rochester.edu/applying/dates-and-deadlines/',
    deadlines: { ED: '2026-11-01', ED2: '2027-01-05', RD: '2027-01-05' },
  },
  {
    nameNorm: 'university of washington',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl: 'https://admit.washington.edu/apply/dates-deadlines/',
    deadlines: { RD: '2026-11-15' },
    notes: 'UW Seattle uses a single submission deadline (no EA/ED)',
  },
  {
    nameNorm: 'lehigh university',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl: 'https://www2.lehigh.edu/admissions',
    deadlines: { ED: '2026-11-01', ED2: '2027-01-01', RD: '2027-01-01' },
  },
  {
    nameNorm: 'ohio state university, columbus',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl:
      'https://undergrad.osu.edu/apply/freshmen-columbus/apply-step-by-step',
    deadlines: { EA: '2026-11-01', RD: '2027-02-01' },
  },
  {
    nameNorm: 'purdue university',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl: 'https://www.admissions.purdue.edu/apply/deadlines.php',
    deadlines: { EA: '2026-11-01', RD: '2027-01-15' },
  },
  {
    nameNorm: 'northeastern university',
    status: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
    sourceUrl:
      'https://admissions.northeastern.edu/application-information/admissions-deadlines-decisions/',
    deadlines: {
      ED: '2026-11-01',
      EA: '2026-11-01',
      ED2: '2027-01-01',
      RD: '2027-01-01',
    },
  },
];

export async function seedDeadlines20262027(
  prismaClient: PrismaClient = prisma,
): Promise<{ upserted: number; notFound: string[] }> {
  let upserted = 0;
  const notFound: string[] = [];

  for (const row of DEADLINE_SEEDS_2026_2027) {
    const school = await prismaClient.school.findFirst({
      where: { nameNorm: row.nameNorm },
      select: { id: true, name: true },
    });
    if (!school) {
      notFound.push(row.nameNorm);
      continue;
    }

    for (const [round, isoDate] of Object.entries(row.deadlines)) {
      const sourceTag = `WEB_RESEARCH_2026-05:${row.status}`;
      await prismaClient.schoolDeadline.upsert({
        where: {
          schoolId_year_round: {
            schoolId: school.id,
            year: CYCLE_YEAR,
            round,
          },
        },
        create: {
          schoolId: school.id,
          year: CYCLE_YEAR,
          round,
          applicationDeadline: new Date(`${isoDate}T23:59:00Z`),
          source: sourceTag,
          notes: row.notes
            ? `${row.notes} | source: ${row.sourceUrl}`
            : `source: ${row.sourceUrl}`,
        },
        update: {
          applicationDeadline: new Date(`${isoDate}T23:59:00Z`),
          source: sourceTag,
          notes: row.notes
            ? `${row.notes} | source: ${row.sourceUrl}`
            : `source: ${row.sourceUrl}`,
        },
      });
      upserted++;
    }
  }

  return { upserted, notFound };
}

async function main() {
  console.log(
    `📅 Seeding SchoolDeadline rows for the ${CYCLE_YEAR - 1}-${CYCLE_YEAR} application cycle...\n`,
  );
  const { upserted, notFound } = await seedDeadlines20262027();
  console.log(
    `✅ Upserted ${upserted} deadline row(s) across ${DEADLINE_SEEDS_2026_2027.length} schools`,
  );
  if (notFound.length > 0) {
    console.warn(
      `⚠ ${notFound.length} school(s) not found in DB — skipped:`,
      notFound,
    );
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
