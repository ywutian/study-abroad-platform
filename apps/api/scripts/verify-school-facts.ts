import { PrismaClient } from '@prisma/client';
import type { SchoolTestingPolicy } from '@study-abroad/shared';

interface SchoolExpectation {
  name: string;
  testingPolicy: SchoolTestingPolicy;
  source: string;
  note?: string;
}

const UC_SOURCE =
  'https://admission.universityofcalifornia.edu/counselors/preparing-freshman-students/freshman-requirements.html';

const EXPECTATIONS: SchoolExpectation[] = [
  {
    name: 'University of California, Berkeley',
    testingPolicy: 'BLIND',
    source: UC_SOURCE,
  },
  {
    name: 'University of California, Los Angeles',
    testingPolicy: 'BLIND',
    source: UC_SOURCE,
  },
  {
    name: 'University of California, San Diego',
    testingPolicy: 'BLIND',
    source: UC_SOURCE,
  },
  {
    name: 'University of California, Davis',
    testingPolicy: 'BLIND',
    source: UC_SOURCE,
  },
  {
    name: 'University of California, Irvine',
    testingPolicy: 'BLIND',
    source: UC_SOURCE,
  },
  {
    name: 'University of California, Santa Barbara',
    testingPolicy: 'BLIND',
    source: UC_SOURCE,
  },
  {
    name: 'University of California, Santa Cruz',
    testingPolicy: 'BLIND',
    source: UC_SOURCE,
  },
  {
    name: 'University of California, Riverside',
    testingPolicy: 'BLIND',
    source: UC_SOURCE,
  },
  {
    name: 'University of California, Merced',
    testingPolicy: 'BLIND',
    source: UC_SOURCE,
  },
  {
    name: 'Princeton University',
    testingPolicy: 'OPTIONAL',
    source: 'https://admission.princeton.edu/apply/counselors',
  },
  {
    name: 'Harvard University',
    testingPolicy: 'REQUIRED',
    source:
      'https://college.harvard.edu/resources/faq/which-standardized-tests-does-harvard-require',
  },
  {
    name: 'Yale University',
    testingPolicy: 'REQUIRED',
    source: 'https://admissions.yale.edu/test-flexible',
    note: 'Mapped from Yale test-flexible into the current REQUIRED-like enum bucket.',
  },
  {
    name: 'Brown University',
    testingPolicy: 'REQUIRED',
    source: 'https://admission.brown.edu/first-year/standardized-tests',
  },
  {
    name: 'Dartmouth College',
    testingPolicy: 'REQUIRED',
    source: 'https://admissions.dartmouth.edu/apply/testing-policy',
  },
  {
    name: 'Columbia University',
    testingPolicy: 'OPTIONAL',
    source: 'https://undergrad.admissions.columbia.edu/apply/process/testing',
  },
  {
    name: 'Cornell University',
    testingPolicy: 'REQUIRED',
    source: 'https://admissions.cornell.edu/how-to-apply/first-year-applicants',
  },
  {
    name: 'University of Pennsylvania',
    testingPolicy: 'REQUIRED',
    source:
      'https://admissions.upenn.edu/how-to-apply/preparing-your-application/testing',
    note: 'Penn allows hardship waivers, but the base admissions policy is required testing.',
  },
  {
    name: 'Massachusetts Institute of Technology',
    testingPolicy: 'REQUIRED',
    source: 'https://news.mit.edu/2022/stuart-schmill-sat-act-requirement-0328',
  },
  {
    name: 'Stanford University',
    testingPolicy: 'REQUIRED',
    source: 'https://admission.stanford.edu/apply/first-year/testing.html',
  },
];

async function main() {
  const prisma = new PrismaClient();

  try {
    const failures: Array<
      SchoolExpectation & {
        actual?: string | null;
        reason: 'not_found' | 'policy_mismatch';
      }
    > = [];

    for (const expectation of EXPECTATIONS) {
      const school = await prisma.school.findFirst({
        where: { name: expectation.name },
        select: {
          id: true,
          name: true,
          testingPolicy: true,
        },
      });

      if (!school) {
        failures.push({
          ...expectation,
          reason: 'not_found',
        });
        continue;
      }

      if (school.testingPolicy !== expectation.testingPolicy) {
        failures.push({
          ...expectation,
          actual: school.testingPolicy,
          reason: 'policy_mismatch',
        });
      }
    }

    if (failures.length > 0) {
      console.error(
        JSON.stringify(
          {
            checked: EXPECTATIONS.length,
            failures,
          },
          null,
          2,
        ),
      );
      process.exit(1);
    }

    console.log(
      JSON.stringify(
        {
          checked: EXPECTATIONS.length,
          status: 'ok',
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main();
