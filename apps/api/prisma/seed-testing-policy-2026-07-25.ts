/**
 * Per-school SAT/ACT testing policy for the 2026-27 application cycle
 * (fall 2027 entry). Populates `School.testingPolicy`, which drives
 * `testBandMultiplier` in the counselor engine.
 *
 * WHY THIS EXISTS
 * ---------------
 * A 2026-07-24 prod audit found 234/243 schools sitting at the `UNKNOWN`
 * default with REQUIRED and OPTIONAL both completely unused — College
 * Scorecard does not publish the field and nothing else backfilled it. The
 * engine therefore gave a no-score applicant the same treatment at Harvard as
 * at an open-admission school. This file covers the 59 schools under a 20%
 * admit rate, where the error costs the most.
 *
 * COLLECTION
 * ----------
 * Four research agents, each verifying against the school's own admissions
 * page (FairTest only as a cross-check). Every row carries the URL and the
 * wording it was read from. Three separate third-party claims of reinstated
 * testing — Bowdoin, Northwestern, Williams, Middlebury, Boston College —
 * were checked against the official pages and rejected as wrong.
 *
 * DELIBERATELY NOT INCLUDED (9). Leaving these UNKNOWN is the honest answer,
 * and post-audit UNKNOWN no longer means "no penalty".
 *
 * Four were cut by an independent reviewer that re-verified every REQUIRED row
 * from scratch — which is the entire reason to run one:
 *   - Carnegie Mellon University — test-FLEXIBLE university-wide (SAT, ACT, IB,
 *     AP and A-Level all satisfy it). Only the School of Computer Science hard-
 *     requires SAT/ACT; the College of Fine Arts is optional.
 *   - University of Miami — the requirement carries an exemption list that
 *     explicitly names students graduating from a high school outside the US,
 *     i.e. essentially this platform's entire user base.
 *   - Dartmouth College — conditional on schooling: US high school students
 *     must submit SAT/ACT, applicants abroad may substitute three APs, IB,
 *     A-Level or a national exam.
 *   - University of Pennsylvania — RESOLVED 2026-08-03, now REQUIRED below.
 *     The downgrade was correct at the time and the recheck was the right call:
 *     the page had not rolled yet, it had not changed policy. It is now headed
 *     "2026-2027 Admissions Cycle" and carries that cycle's own test dates, so
 *     the scoping that was missing is there. Penn's waiver is hardship-scoped,
 *     which is why it reads as REQUIRED and Miami/Dartmouth do not.
 *
 * Five were held back during collection:
 *   - Curtis Institute of Music, The Juilliard School — admission is by
 *     audition; a testing policy does not describe how they admit.
 *   - Cooper Union — Engineering requires (54% of the class), Architecture and
 *     Art do not. No school-level value is true for both halves.
 *   - Harvey Mudd College, Grinnell College — policy published only through
 *     fall 2026, with the re-evaluation point landing on this very cycle.
 *
 * The first three cuts look like an enum gap — no FLEXIBLE value, no way to
 * condition on where the applicant went to school. Widening the enum was the
 * obvious next move and it is the WRONG one; measured, not assumed:
 *
 *   profile        REQUIRED  OPTIONAL  UNKNOWN  FLEXIBLE(hypothetical)
 *   IB 45            1.200     1.200    1.200          1.200
 *   A-Level 168      1.000     1.000    1.000          1.000
 *   Gaokao 680       1.000     1.000    1.000          1.000
 *   AP only          0.100     0.850    0.850          0.850
 *
 * FLEXIBLE is bit-identical to the UNKNOWN these three already carry, because
 * `testingPolicy` is only read when the applicant has none of the five
 * band-comparable tests. Give it its own branch and the only profile that
 * moves is AP-only: +1.75pp at CMU, +0.81pp at Dartmouth — against served
 * interval widths of 16.0pp and 8.1pp. Miami's delta is exactly zero.
 * The bill would be an enum migration plus the union type that is hand-copied
 * 18 times across shared/api/web, seven `as any` reads that typecheck cannot
 * catch, and four i18n surfaces resolved dynamically (so the missing-key lint
 * stays silent and users see a raw key).
 *
 * So UNKNOWN is not a placeholder here, it is the correct value: we know
 * something the schema cannot say, and saying it wrong in either direction is
 * worse than saying nothing. What is actually missing is per-school
 * accepted-test data — which tests satisfy which school — and that is a
 * separate, larger change to the served numbers.
 *
 * Run standalone (also applied to prod via migrate.sh run_seed):
 *   npx tsx apps/api/prisma/seed-testing-policy-2026-07-25.ts
 */
import { PrismaClient, TestingPolicy } from '@prisma/client';

const standalonePrisma = new PrismaClient();

/**
 * Provenance source token for this collection. Registered in
 * `SOURCE_PRIORITY` (school-data-merger) above the bulk aggregators so a
 * future Scorecard sync cannot silently revert these values — the failure
 * mode fixed on 2026-07-24.
 */
export const TESTING_POLICY_SOURCE = 'OFFICIAL_ADMISSIONS_PAGE';

/** Cycle these values describe: 2026-27 applications, fall 2027 entry. */
const CYCLE_YEAR = 2027;

type PolicyRow = {
  nameNorm: string;
  policy: keyof typeof TestingPolicy;
  sourceUrl: string;
  note: string;
};

export const TESTING_POLICIES: PolicyRow[] = [
  {
    nameNorm: 'university of california, berkeley',
    policy: 'BLIND',
    sourceUrl:
      'https://admissions.berkeley.edu/apply-to-berkeley/first-year-applicants-uc-berkeley/first-year-policy-changes/',
    note: '"UC Berkeley is test-free... will not use SAT/ACT scores in any part of our application process" (cycle: current (page updated 2026-06))',
  },
  {
    nameNorm: 'university of california, los angeles',
    policy: 'BLIND',
    sourceUrl:
      'https://admission.ucla.edu/apply/first-year/first-year-requirements',
    note: 'will not consider SAT or ACT scores for admission or scholarship (cycle: current (fall 2021+))',
  },
  {
    nameNorm: 'amherst college',
    policy: 'OPTIONAL',
    sourceUrl: 'https://www.amherst.edu/admission/apply/firstyear/testing',
    note: 'standardized testing is an optional part of the application (cycle: current)',
  },
  {
    nameNorm: 'barnard college',
    policy: 'OPTIONAL',
    sourceUrl: 'https://barnard.edu/admissions/temporary-test-optional-policy',
    note: 'test-optional for Fall 2027 (class of 2031) (cycle: Fall 2027 (temporary))',
  },
  {
    nameNorm: 'bates college',
    policy: 'OPTIONAL',
    sourceUrl: 'https://www.bates.edu/admission/optional-testing/',
    note: 'optional since the 1984 faculty vote (cycle: standing since 1984)',
  },
  {
    nameNorm: 'boston college',
    policy: 'OPTIONAL',
    sourceUrl: 'https://www.bc.edu/bc-web/admission/apply/test-optional.html',
    note: '"Boston College has a test-optional admission policy" (cycle: undated page; third-party reinstatement claims unconfirmed by BC)',
  },
  {
    nameNorm: 'boston university',
    policy: 'OPTIONAL',
    sourceUrl: 'https://www.bu.edu/admissions/apply/first-year/test-policy/',
    note: 'test optional through fall 2028 and spring 2029 (cycle: through fall 2028)',
  },
  {
    nameNorm: 'bowdoin college',
    policy: 'OPTIONAL',
    sourceUrl:
      'https://www.bowdoin.edu/admissions/apply/test-optional-policy/index.html',
    note: 'applicants indicate whether Bowdoin should review scores (cycle: current (since 1969))',
  },
  {
    nameNorm: 'claremont mckenna college',
    policy: 'OPTIONAL',
    sourceUrl:
      'https://www.cmc.edu/admission/first-year-application-instructions/test-optional-policy-faq',
    note: 'extended test-optional through the Fall 2027 admission cycle (cycle: Fall 2027 (REQUIRED from Fall 2028))',
  },
  {
    nameNorm: 'colby college',
    policy: 'OPTIONAL',
    sourceUrl: 'https://afa.colby.edu/apply/requirements/',
    note: '"Colby is a test optional institution" (cycle: current (2026-06-28 archive))',
  },
  {
    nameNorm: 'colgate university',
    policy: 'OPTIONAL',
    sourceUrl:
      'https://www.colgate.edu/news/stories/colgate-remain-test-optional-through-2026',
    note: 'not required through the 2026-27 application season (cycle: 2026-27 (last confirmed year))',
  },
  {
    nameNorm: 'columbia university',
    policy: 'OPTIONAL',
    sourceUrl:
      'https://undergrad.admissions.columbia.edu/apply/process/testing',
    note: '"fully test-optional for the 2026-2027 admissions cycle" (cycle: 2026-27 (REQUIRED from 2027-28))',
  },
  {
    nameNorm: 'davidson college',
    policy: 'OPTIONAL',
    sourceUrl:
      'https://www.davidson.edu/admission-and-financial-aid/admission-process-help/testing-policy',
    note: 'test-optional since 2020; choice rests entirely with the student (cycle: permanent (formalized 2022))',
  },
  {
    nameNorm: 'duke university',
    policy: 'OPTIONAL',
    sourceUrl: 'https://admissions.duke.edu/checklist/',
    note: '2026-2027 cycle checklist lists "SAT and/or ACT Scores (optional)" (cycle: 2026-27)',
  },
  {
    nameNorm: 'emory university',
    policy: 'OPTIONAL',
    sourceUrl:
      'https://blog.emoryadmission.com/2025/12/emory-university-remains-test-optional-for-2026-2027/',
    note: 'submitting scores completely optional; explicitly covers Fall 2027 (cycle: 2026-27 explicit)',
  },
  {
    nameNorm: 'hamilton college',
    policy: 'OPTIONAL',
    sourceUrl: 'https://www.hamilton.edu/admission/apply/testing',
    note: '"Hamilton does not require the SAT or ACT" (cycle: standing)',
  },
  {
    nameNorm: 'haverford college',
    policy: 'OPTIONAL',
    sourceUrl:
      'https://www.haverford.edu/admission/applying/application-instructions',
    note: "admission process is test-optional, entirely applicant's choice (cycle: current (pilot made permanent))",
  },
  {
    nameNorm: 'middlebury college',
    policy: 'OPTIONAL',
    sourceUrl:
      'https://www.middlebury.edu/college/admissions/apply/standardized-tests',
    note: '"Middlebury is test optional" (cycle: current)',
  },
  {
    nameNorm: 'new york university',
    policy: 'OPTIONAL',
    sourceUrl:
      'https://www.nyu.edu/admissions/undergraduate-admissions/how-to-apply/standardized-tests.html',
    note: 'test-optional through the 2027-2028 application cycle (cycle: through 2027-28)',
  },
  {
    nameNorm: 'northeastern university',
    policy: 'OPTIONAL',
    sourceUrl:
      'https://admissions.northeastern.edu/application-information/required-materials/',
    note: '"test-optional and does not require applicants to submit standardized testing" (cycle: standing)',
  },
  {
    nameNorm: 'northwestern university',
    policy: 'OPTIONAL',
    sourceUrl:
      'https://admissions.northwestern.edu/faqs/standardized-testing-policy/',
    note: 'test-optional, does not require ACT or SAT (cycle: current (2026-27 deadlines listed))',
  },
  {
    nameNorm: 'pomona college',
    policy: 'OPTIONAL',
    sourceUrl:
      'https://www.pomona.edu/news/2023/11/15-pomona-college-makes-test-optional-admissions-policy-permanent',
    note: 'SAT/ACT not required; made permanent by faculty vote Nov 2023 (cycle: permanent)',
  },
  {
    nameNorm: 'princeton university',
    policy: 'OPTIONAL',
    sourceUrl: 'https://admission.princeton.edu/apply/standardized-testing',
    note: 'applicants without a score "will not be at a disadvantage" in the 2026-27 cycle (cycle: 2026-27 (REQUIRED from 2027-28))',
  },
  {
    nameNorm: 'rice university',
    policy: 'OPTIONAL',
    sourceUrl:
      'https://admission.rice.edu/apply/first-year-domestic-applicants',
    note: 'recommends scores if available; full consideration without (cycle: current)',
  },
  {
    nameNorm: 'swarthmore college',
    policy: 'OPTIONAL',
    sourceUrl:
      'https://www.swarthmore.edu/admissions-aid/standardized-testing-policy',
    note: 'submitting scores is optional, no penalty (cycle: current)',
  },
  {
    nameNorm: 'tufts university',
    policy: 'OPTIONAL',
    sourceUrl:
      'https://admissions.tufts.edu/apply/applying-to-tufts/sat-and-act-tests/',
    note: 'test-optional for all undergraduate applicants (cycle: current)',
  },
  {
    nameNorm: 'tulane university',
    policy: 'OPTIONAL',
    sourceUrl:
      'https://admission.tulane.edu/apply/instructions/standardized-tests',
    note: '"will remain optional for Fall 2027 first-year and transfer admission" (cycle: fall 2027 explicit)',
  },
  {
    nameNorm: 'university of chicago',
    policy: 'OPTIONAL',
    sourceUrl:
      'https://collegeadmissions.uchicago.edu/apply/application/required-materials/',
    note: '"Submitting an SAT or ACT is optional and not required for admission" (cycle: standing)',
  },
  {
    nameNorm: 'university of colorado boulder',
    policy: 'OPTIONAL',
    sourceUrl: 'https://www.colorado.edu/admissions/process/first-year/apply',
    note: '"ACT and SAT scores are not required for first-year students" (cycle: undated standing policy)',
  },
  {
    nameNorm: 'university of michigan, ann arbor',
    policy: 'OPTIONAL',
    sourceUrl:
      'https://teamdynamix.umich.edu/TDClient/154/Portal/KB/Article/7490/Test-optional-Policy-for-SAT-and-ACT',
    note: '"For the 2027 application cycle, U-M will be test optional" (cycle: 2027 cycle explicit)',
  },
  {
    nameNorm: 'university of north carolina at chapel hill',
    policy: 'OPTIONAL',
    sourceUrl:
      'https://admissions.unc.edu/apply/types-of-applications/first-year/',
    note: 'weighted GPA >= 2.8 not required to submit; below 2.8 must submit ACT>=17/SAT>=930 (cycle: 2026-27 and beyond (GPA-conditional))',
  },
  {
    nameNorm: 'university of notre dame',
    policy: 'OPTIONAL',
    sourceUrl: 'https://admissions.nd.edu/apply/evaluation-criteria/',
    note: 'test-optional for all applicants through the 2026-27 school year (cycle: 2026-27 (last confirmed year))',
  },
  {
    nameNorm: 'university of southern california',
    policy: 'OPTIONAL',
    sourceUrl: 'https://admission.usc.edu/test-optional-faq/',
    note: 'applicant decides whether scores are considered; no penalty (cycle: current)',
  },
  {
    nameNorm: 'university of virginia',
    policy: 'OPTIONAL',
    sourceUrl: 'https://admission.virginia.edu/admission/testing',
    note: '"For first-year applicants for Fall 2027, students will have the choice" (cycle: fall 2027 explicit (403; wording via search echo))',
  },
  {
    nameNorm: 'vanderbilt university',
    policy: 'OPTIONAL',
    sourceUrl: 'https://admissions.vanderbilt.edu/apply/testing-policies/',
    note: '"not be required for students applying to enter the university for fall 2027 and 2028" (cycle: through fall 2028 (REQUIRED fall 2029))',
  },
  {
    nameNorm: 'vassar college',
    policy: 'OPTIONAL',
    sourceUrl: 'https://www.vassar.edu/admission/apply/requirements/',
    note: '"Vassar does not require applicants to submit SAT or ACT scores" (cycle: permanent since 2023-04)',
  },
  {
    nameNorm: 'washington university in st. louis',
    policy: 'OPTIONAL',
    sourceUrl: 'https://admissions.washu.edu/whats-new-at-washu/',
    note: 'continuing test-optional policy, listed under fall 2027 updates (cycle: 2026-27 explicit)',
  },
  {
    nameNorm: 'washington and lee university',
    policy: 'OPTIONAL',
    sourceUrl: 'https://www.wlu.edu/admissions/apply/test-optional-policy',
    note: 'scores not required "in the 2026-27 application cycle" (cycle: 2026-27 explicit)',
  },
  {
    nameNorm: 'wellesley college',
    policy: 'OPTIONAL',
    sourceUrl:
      'https://www.wellesley.edu/admission-aid/apply/first-year-applicants',
    note: '"will continue to be test optional for those applying for entry in fall 2027" (cycle: fall 2027 explicit)',
  },
  {
    nameNorm: 'williams college',
    policy: 'OPTIONAL',
    sourceUrl:
      'https://www.williams.edu/admission-aid/apply/requirements-deadlines/',
    note: '"Williams is truly test optional" (cycle: current (2026-27 deadlines on same page))',
  },
  {
    nameNorm: 'brown university',
    policy: 'REQUIRED',
    sourceUrl: 'https://admission.brown.edu/first-year/standardized-tests',
    note: '"returned to a policy requiring standardized test scores ... beginning with the 2024-25 admission cycle" (cycle: 2024-25+)',
  },
  {
    nameNorm: 'california institute of technology',
    policy: 'REQUIRED',
    sourceUrl:
      'https://www.admissions.caltech.edu/apply/first-year-applicants/standardized-tests',
    note: '"Caltech requires first-year applicants to submit either the SAT or the ACT" (cycle: standing (page detail still shows fall 2026 entry))',
  },
  {
    nameNorm: 'cornell university',
    policy: 'REQUIRED',
    sourceUrl:
      'https://admissions.cornell.edu/policies/standardized-testing-policy',
    note: 'reinstituted standardized testing requirements (cycle: fall 2026+)',
  },
  {
    nameNorm: 'georgetown university',
    policy: 'REQUIRED',
    sourceUrl: 'https://bulletin.georgetown.edu/admissions/',
    note: '"All applicants are required to take the SAT or the ACT" (cycle: standing policy, never test-optional)',
  },
  {
    nameNorm: 'georgia institute of technology',
    policy: 'REQUIRED',
    sourceUrl: 'https://admission.gatech.edu/first-year/standardized-tests',
    note: '"All first-year applicants must submit results from at least one SAT and/or ACT" (cycle: standing; USG mandate fall 2026+)',
  },
  {
    nameNorm: 'harvard university',
    policy: 'REQUIRED',
    sourceUrl:
      'https://college.harvard.edu/admissions/apply/application-requirements',
    note: '"Harvard requires the SAT or ACT to meet its standardized testing requirement" (cycle: standing)',
  },
  {
    nameNorm: 'johns hopkins university',
    policy: 'REQUIRED',
    sourceUrl:
      'https://apply.jhu.edu/how-to-apply/application-deadlines-requirements/standardized-testing/',
    note: 'requires first-year applicants to submit SAT or ACT scores (cycle: fall 2026+)',
  },
  {
    nameNorm: 'massachusetts institute of technology',
    policy: 'REQUIRED',
    sourceUrl: 'https://mitadmissions.org/apply/firstyear/tests-scores/',
    note: '"We require the SAT or the ACT" (cycle: standing)',
  },
  {
    nameNorm: 'stanford university',
    policy: 'REQUIRED',
    sourceUrl: 'https://admission.stanford.edu/apply/first-year/testing.html',
    note: '"ACT or SAT scores are required" (cycle: standing (page updated 2026-07-22))',
  },
  {
    nameNorm: 'university of pennsylvania',
    policy: 'REQUIRED',
    sourceUrl:
      'https://admissions.upenn.edu/how-to-apply/preparing-your-application/testing',
    note: '"Penn applicants are required to submit scores for the SAT or ACT." Page is now headed "2026-2027 Admissions Cycle" and lists that cycle\'s own deadlines (ED: SAT 2026-11-07 / ACT 2026-10-17; RD: SAT 2026-12-05 / ACT 2026-12-12), which is what was missing at collection time. The waiver is hardship-scoped ("lack of test center availability, financial hardship, natural disaster or civil unrest") — not an origin-based exemption like Miami\'s and not an AP/IB substitute like Dartmouth\'s, so it does not make the policy conditional for our users (cycle: 2026-27, rechecked 2026-08-03)',
  },
  {
    nameNorm: 'yale university',
    policy: 'REQUIRED',
    sourceUrl: 'https://admissions.yale.edu/standardized-testing',
    note: 'Yale announced 2026-05-27 that it drops test-flexible: "Beginning with the next admissions cycle, applicants will be required to submit scores from the ACT or SAT" — AP/IB no longer substitute (cycle: 2026-27 (tightened from test-flexible, announced 2026-05-27))',
  },
];

export async function applyTestingPolicies(
  prisma: PrismaClient = standalonePrisma,
): Promise<number> {
  const fetchedAt = new Date().toISOString();
  let n = 0;

  for (const row of TESTING_POLICIES) {
    const school = await prisma.school.findFirst({
      where: { nameNorm: row.nameNorm },
      select: { id: true, metadata: true },
    });
    if (!school) continue;

    // Write provenance alongside the value. Without it the merger takes the
    // "no provenance recorded — allow override" path and every one of these
    // rows is free for the next bulk sync to overwrite.
    const metadata =
      school.metadata && typeof school.metadata === 'object'
        ? (school.metadata as Record<string, unknown>)
        : {};
    const provenance =
      metadata.provenance && typeof metadata.provenance === 'object'
        ? (metadata.provenance as Record<string, unknown>)
        : {};

    await prisma.school.update({
      where: { id: school.id },
      data: {
        testingPolicy: TestingPolicy[row.policy],
        metadata: {
          ...metadata,
          provenance: {
            ...provenance,
            testingPolicy: {
              source: TESTING_POLICY_SOURCE,
              tier: 'OFFICIAL',
              fetchedAt,
              sourceUrl: row.sourceUrl,
              cycleYear: CYCLE_YEAR,
              verifiedBy: 'testing-policy-agents-2026-07-25',
              notes: row.note,
            },
          },
        },
      },
    });
    n += 1;
  }
  return n;
}

async function main() {
  const n = await applyTestingPolicies();
  console.log(
    `🎯 Testing policy: updated ${n} school row(s) from ${TESTING_POLICIES.length} verified entries.`,
  );
  await standalonePrisma.$disconnect();
}

if (require.main === module) {
  main().catch((e) => {
    console.error('❌ testing policy seed failed:', (e as Error).message);
    process.exit(1);
  });
}
