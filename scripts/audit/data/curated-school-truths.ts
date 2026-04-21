import type { SchoolTruthRecord } from '../types';

export const OFFICIAL_SOURCE_RETRIEVED_AT = '2026-04-19';

export const UC_SYSTEM_SCHOOL_NAMES = [
  'University of California, Berkeley',
  'University of California, Davis',
  'University of California, Irvine',
  'University of California, Los Angeles',
  'University of California, Merced',
  'University of California, Riverside',
  'University of California, San Diego',
  'University of California, Santa Barbara',
  'University of California, Santa Cruz',
] as const;

const UC_SYSTEM_SOURCE =
  'https://admission.universityofcalifornia.edu/how-to-apply/applying-as-a-first-year/';
const UC_TESTING_SOURCE =
  'https://admission.universityofcalifornia.edu/counselors/preparing-freshman-students/freshman-requirements.html';

export const OFFICIAL_SCHOOL_TRUTH_OVERRIDES: SchoolTruthRecord[] = [
  {
    schoolId: null,
    schoolName: 'Stanford University',
    facts: {
      standardDeadline: 'January 5',
      earlyDeadlinePolicy: 'Restrictive Early Action: November 1',
      testingPolicy: 'REQUIRED',
      notes: ['Source states ACT or SAT test scores are required application components.'],
    },
    sourceUrl: 'https://admission.stanford.edu/apply/first-year/index.html',
    retrievedAt: OFFICIAL_SOURCE_RETRIEVED_AT,
    sourceType: 'official_admissions_page',
    confidence: 'high',
    scope: 'top50-plus-uc',
  },
  {
    schoolId: null,
    schoolName: 'Harvard University',
    facts: {
      standardDeadline: 'January 1',
      earlyDeadlinePolicy: 'Restrictive Early Action: November 1',
      testingPolicy: 'REQUIRED',
      intlAidPolicy: 'NEED_BLIND',
      notes: [
        'Admissions deadlines sourced from Harvard first-year applicants page.',
        'Need-blind and 100 percent need-based aid for international applicants sourced from financial aid page.',
      ],
    },
    sourceUrl: 'https://college.harvard.edu/admissions/apply/first-year-applicants',
    retrievedAt: OFFICIAL_SOURCE_RETRIEVED_AT,
    sourceType: 'official_admissions_page',
    confidence: 'high',
    scope: 'top50-plus-uc',
  },
  {
    schoolId: null,
    schoolName: 'Massachusetts Institute of Technology',
    facts: {
      intlAidPolicy: 'NEED_BLIND',
      notes: [
        'MIT states its admissions process is need-blind for all students, foreign and domestic.',
      ],
    },
    sourceUrl: 'https://mitadmissions.org/help/faq/need-blind-admissions/',
    retrievedAt: OFFICIAL_SOURCE_RETRIEVED_AT,
    sourceType: 'official_policy_page',
    confidence: 'high',
    scope: 'top50-plus-uc',
  },
  {
    schoolId: null,
    schoolName: 'Princeton University',
    facts: {
      intlAidPolicy: 'NEED_BLIND',
      notes: [
        'Princeton states it meets full need for admitted international students and admission is need-blind.',
      ],
    },
    sourceUrl: 'https://admission.princeton.edu/apply/international-students',
    retrievedAt: OFFICIAL_SOURCE_RETRIEVED_AT,
    sourceType: 'official_admissions_page',
    confidence: 'high',
    scope: 'top50-plus-uc',
  },
  {
    schoolId: null,
    schoolName: 'Yale University',
    facts: {
      intlAidPolicy: 'NEED_BLIND',
      notes: [
        'Yale FAQ states international students are eligible under need-blind admissions and need-based aid.',
      ],
    },
    sourceUrl:
      'https://admissions.yale.edu/are-international-students-eligible-financial-aid-if-so-how-do-i-apply',
    retrievedAt: OFFICIAL_SOURCE_RETRIEVED_AT,
    sourceType: 'official_financial_aid_page',
    confidence: 'high',
    scope: 'top50-plus-uc',
  },
  {
    schoolId: null,
    schoolName: 'Amherst College',
    facts: {
      intlAidPolicy: 'NEED_BLIND',
      notes: [
        'Amherst catalog PDF states the college practices need-blind admission for all international applicants.',
      ],
    },
    sourceUrl:
      'https://www.amherst.edu/system/files/media/Amherst%20College%20Catalog%20Section%20III.pdf',
    retrievedAt: OFFICIAL_SOURCE_RETRIEVED_AT,
    sourceType: 'official_pdf',
    confidence: 'high',
    scope: 'top50-plus-uc',
  },
  ...UC_SYSTEM_SCHOOL_NAMES.map<SchoolTruthRecord>((schoolName) => ({
    schoolId: null,
    schoolName,
    facts: {
      standardDeadline: 'December 1',
      testingPolicy: 'BLIND',
      notes: [
        `Deadlines sourced from ${UC_SYSTEM_SOURCE}.`,
        'The current official page says December 1 for fall 2026 applicants; the typical cycle is November 30.',
        `Testing policy sourced from ${UC_TESTING_SOURCE}; UC states it does not consider SAT or ACT scores for admission or scholarships.`,
      ],
    },
    sourceUrl: UC_SYSTEM_SOURCE,
    retrievedAt: OFFICIAL_SOURCE_RETRIEVED_AT,
    sourceType: 'official_system_page',
    confidence: 'high',
    scope: 'top50-plus-uc',
  })),
];
