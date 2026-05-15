/**
 * Seed need-blind / need-aware status for international applicants.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Schema context (2026-05 onwards):
 *   School.needBlindInternational is a nullable Boolean.
 *     true  → verified need-blind for international applicants
 *     false → verified need-aware for international applicants
 *     null  → not yet reviewed (counselor engine treats as "unknown" and
 *             applies a midpoint penalty between need-blind and need-aware)
 *
 *   See ADR-0020 and docs/PREDICTION_ACCURACY_STRATEGY.md for the rationale
 *   for distinguishing "unreviewed" from "verified need-aware".
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Authoritative lists below are sourced from each institution's official
 * financial aid / admissions page (the URL is recorded inline as evidence).
 * Last verification pass: 2026-05 (covers the 2024-2025 admissions cycle).
 *
 * Run standalone:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-intl-schools.ts
 *
 * Or import and call seedIntlSchools() from the main seed runner.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Schools that are need-BLIND for international applicants AND commit to
 * meet 100% of demonstrated need (the canonical "true need-blind for intl"
 * tier). Sourced from each school's official financial aid page.
 *
 * Confirmed list (2024-2025 cycle): 10 institutions.
 */
export const NEED_BLIND_INTL_SCHOOLS: ReadonlyArray<{
  nameNorm: string;
  effectiveYear: string;
  source: string;
}> = [
  {
    nameNorm: 'harvard university',
    effectiveYear: 'long-standing',
    source: 'https://college.harvard.edu/financial-aid/how-aid-works',
  },
  {
    nameNorm: 'massachusetts institute of technology',
    effectiveYear: 'long-standing',
    source: 'https://mitadmissions.org/help/faq/need-blind-admissions/',
  },
  {
    nameNorm: 'princeton university',
    effectiveYear: 'long-standing',
    source: 'https://admission.princeton.edu/apply/international-students',
  },
  {
    nameNorm: 'yale university',
    effectiveYear: 'long-standing',
    source:
      'https://admissions.yale.edu/financial-aid-international-applicants',
  },
  {
    nameNorm: 'amherst college',
    effectiveYear: '2008-09',
    source: 'https://www.amherst.edu/admission/apply/international',
  },
  {
    nameNorm: 'dartmouth college',
    effectiveYear: 'class-of-2026', // announced 2022-01
    source:
      'https://admissions.dartmouth.edu/news/2022/01/dartmouth-adopts-need-blind-international-admissions',
  },
  {
    nameNorm: 'bowdoin college',
    effectiveYear: '2022-23', // announced 2022-07
    source:
      'https://www.bowdoin.edu/news/2022/07/bowdoin-college-expands-need-blind-admissions-policy-to-include-international-students.html',
  },
  {
    nameNorm: 'brown university',
    effectiveYear: 'class-of-2029', // announced 2024-01
    source: 'https://www.brown.edu/news/2024-01-25/international-financial-aid',
  },
  {
    nameNorm: 'university of notre dame',
    effectiveYear: '2025-fall', // announced 2024-09
    source:
      'https://financialaid.nd.edu/apply-or-renew/international-students/',
  },
  {
    nameNorm: 'washington and lee university',
    effectiveYear: 'class-of-2029', // announced 2024-10
    source:
      'https://columns.wlu.edu/historic-gift-allows-washington-and-lee-university-to-adopt-need-blind-admissions-policy/',
  },
] as const;

/**
 * Schools that are commonly mistaken for "need-blind for international" but
 * are officially need-AWARE for international applicants. Seeded explicitly
 * as `needBlindInternational: false` (verified state) so the prediction
 * engine can apply the full need-aware penalty rather than the
 * unreviewed-midpoint fallback. Each entry must cite the school's own page.
 *
 * Selection: schools where (a) the school is a popular Top-50 target for
 * Chinese applicants AND (b) the school's official page is explicit about
 * need-aware status. The list is not exhaustive — additional schools will
 * be reviewed in the admin workflow.
 */
export const VERIFIED_NEED_AWARE_INTL_SCHOOLS: ReadonlyArray<{
  nameNorm: string;
  source: string;
}> = [
  {
    nameNorm: 'stanford university',
    source: 'https://admission.stanford.edu/apply/international/index.html',
  },
  {
    nameNorm: 'columbia university',
    source: 'https://undergrad.admissions.columbia.edu/apply/international/aid',
  },
  {
    nameNorm: 'university of pennsylvania',
    source: 'https://admissions.upenn.edu/affording-penn/international-aid',
  },
  {
    nameNorm: 'cornell university',
    source:
      'https://finaid.cornell.edu/first-year-and-transfer-students-international',
  },
  {
    nameNorm: 'duke university',
    source: 'https://financialaid.duke.edu/international-students/',
  },
  {
    nameNorm: 'wellesley college',
    source: 'https://www.wellesley.edu/admission-aid/faqs',
  },
  {
    nameNorm: 'pomona college',
    source:
      'https://www.pomona.edu/financial-aid/applying-for-aid/international-aid',
  },
  {
    nameNorm: 'swarthmore college',
    // Per swarthmore.edu official aid page: need-aware for international,
    // meets full need for admitted.
    source: 'https://www.swarthmore.edu/financial-aid',
  },
  {
    nameNorm: 'middlebury college',
    source:
      'https://www.middlebury.edu/admissions/apply/international-students',
  },
  {
    nameNorm: 'wesleyan university',
    source: 'https://www.wesleyan.edu/finaid/aid-for-international.html',
  },
  {
    nameNorm: 'williams college',
    source: 'https://www.williams.edu/admission-aid/financial-aid/',
  },
  {
    nameNorm: 'tufts university',
    source:
      'https://admissions.tufts.edu/tuition-and-aid/applying-for-aid/international-student-aid/',
  },
  {
    nameNorm: 'johns hopkins university',
    source: 'https://finaid.jhu.edu/types-of-aid/international-students/',
  },
  {
    nameNorm: 'california institute of technology',
    source: 'https://finaid.caltech.edu/types-of-aid/international-students',
  },
  {
    nameNorm: 'northwestern university',
    source:
      'https://undergradaid.northwestern.edu/apply/international-students/',
  },
  {
    nameNorm: 'vanderbilt university',
    source:
      'https://www.vanderbilt.edu/financialaid/types-of-aid/international.php',
  },
];

/** Back-compat export — name list only, for callers that already imported it. */
export const NEED_BLIND_INTL_NAME_NORMS = NEED_BLIND_INTL_SCHOOLS.map(
  (s) => s.nameNorm,
);

export async function seedIntlSchools(
  prismaClient: PrismaClient = prisma,
): Promise<{ needBlindCount: number; needAwareCount: number }> {
  // Apply verified need-blind status.
  const needBlind = await prismaClient.school.updateMany({
    where: {
      nameNorm: { in: NEED_BLIND_INTL_SCHOOLS.map((s) => s.nameNorm) },
    },
    data: { needBlindInternational: true },
  });

  // Apply verified need-aware status — explicitly distinguishes these
  // schools from the "unreviewed" majority that remain null.
  const needAware = await prismaClient.school.updateMany({
    where: {
      nameNorm: {
        in: VERIFIED_NEED_AWARE_INTL_SCHOOLS.map((s) => s.nameNorm),
      },
    },
    data: { needBlindInternational: false },
  });

  return {
    needBlindCount: needBlind.count,
    needAwareCount: needAware.count,
  };
}

async function main() {
  console.log('🏫 Seeding international financial-aid policy...\n');
  const { needBlindCount, needAwareCount } = await seedIntlSchools();
  console.log(
    `✅ Set ${needBlindCount} school(s) → needBlindInternational: true`,
  );
  console.log(
    `✅ Set ${needAwareCount} school(s) → needBlindInternational: false (verified need-aware)\n`,
  );
  console.log(
    'Schools not matched by either list remain `null` (unreviewed); the\n' +
      'counselor engine applies a midpoint penalty until they are reviewed.',
  );
}

// Run when executed directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seed failed:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
