import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { GoldCase } from '../gold-cases/schema';

const CASES_DIR = path.resolve(__dirname, '../gold-cases/cases');
const ANALYSIS_VERSION = 'application-analysis-v2';
const OWNER_EMAIL = 'governance@study-abroad.local';
const REVIEW_DATE = '2026-04-21';

type Locale = 'en' | 'zh';
type SchoolDef = {
  id: string;
  name: string;
  nameZh: string;
  usNewsRank: number;
  acceptanceRate: number;
  sat25: number;
  sat75: number;
  satAvg: number;
  testingPolicy: 'BLIND' | 'OPTIONAL' | 'REQUIRED' | 'UNKNOWN';
  testOptional: boolean;
  needBlindInternational: boolean;
  intlAcceptanceRate: number | null;
  deadline: string;
};

const SCHOOLS = {
  berkeley: {
    id: 'ucb',
    name: 'University of California, Berkeley',
    nameZh: '加州大学伯克利分校',
    usNewsRank: 1,
    acceptanceRate: 11,
    sat25: 1490,
    sat75: 1560,
    satAvg: 1530,
    testingPolicy: 'BLIND',
    testOptional: false,
    needBlindInternational: false,
    intlAcceptanceRate: 7,
    deadline: 'November 30',
  },
  columbia: {
    id: 'columbia',
    name: 'Columbia University',
    nameZh: '哥伦比亚大学',
    usNewsRank: 12,
    acceptanceRate: 3.9,
    sat25: 1500,
    sat75: 1570,
    satAvg: 1540,
    testingPolicy: 'OPTIONAL',
    testOptional: true,
    needBlindInternational: false,
    intlAcceptanceRate: 4.1,
    deadline: 'November 1',
  },
  mit: {
    id: 'mit',
    name: 'Massachusetts Institute of Technology',
    nameZh: '麻省理工学院',
    usNewsRank: 2,
    acceptanceRate: 4,
    sat25: 1530,
    sat75: 1580,
    satAvg: 1560,
    testingPolicy: 'REQUIRED',
    testOptional: false,
    needBlindInternational: true,
    intlAcceptanceRate: 5,
    deadline: 'January 1',
  },
  stanford: {
    id: 'stanford',
    name: 'Stanford University',
    nameZh: '斯坦福大学',
    usNewsRank: 3,
    acceptanceRate: 3.7,
    sat25: 1510,
    sat75: 1570,
    satAvg: 1550,
    testingPolicy: 'REQUIRED',
    testOptional: false,
    needBlindInternational: false,
    intlAcceptanceRate: 4.4,
    deadline: 'January 5',
  },
  brown: {
    id: 'brown',
    name: 'Brown University',
    nameZh: '布朗大学',
    usNewsRank: 9,
    acceptanceRate: 5.2,
    sat25: 1490,
    sat75: 1560,
    satAvg: 1530,
    testingPolicy: 'OPTIONAL',
    testOptional: true,
    needBlindInternational: true,
    intlAcceptanceRate: 5.5,
    deadline: 'January 3',
  },
  unknownTech: {
    id: 'unknown-tech',
    name: 'Unknown Policy Institute',
    nameZh: '未知政策理工学院',
    usNewsRank: 28,
    acceptanceRate: 18,
    sat25: 1410,
    sat75: 1510,
    satAvg: 1460,
    testingPolicy: 'UNKNOWN',
    testOptional: false,
    needBlindInternational: false,
    intlAcceptanceRate: 10.4,
    deadline: 'January 10',
  },
} satisfies Record<string, SchoolDef>;

const RENDER_SMOKE_IDS = new Set([
  '001-uc-berkeley-blind-en',
  '002-no-target-schools-zh',
  '003-columbia-optional-en',
  '004-no-predictions-en',
  '005-insufficient-profile-en',
  '006-mit-required-en',
  '007-unknown-policy-zh',
  '008-berkeley-columbia-balanced-en',
  '009-stanford-required-zh',
  '010-brown-optional-aid-en',
]);

const NIGHTLY_LIVE_IDS = new Set([
  '001-uc-berkeley-blind-en',
  '002-no-target-schools-zh',
  '003-columbia-optional-en',
  '004-no-predictions-en',
  '006-mit-required-en',
]);

function schoolSnapshot(school: SchoolDef) {
  return {
    id: school.id,
    name: school.name,
    nameZh: school.nameZh,
    usNewsRank: school.usNewsRank,
    acceptanceRate: school.acceptanceRate,
    sat25: school.sat25,
    sat75: school.sat75,
    satAvg: school.satAvg,
    testingPolicy: school.testingPolicy,
    testOptional: school.testOptional,
    needBlindInternational: school.needBlindInternational,
    intlAcceptanceRate: school.intlAcceptanceRate,
    metadata: {
      standardDeadline: school.deadline,
    },
  };
}

function profileSnapshot(input: {
  index: number;
  locale: Locale;
  gpa: number | null;
  major: string;
  nationality: string;
  countryOfResidence: string;
  citizenship: string;
  needsFinancialAid: boolean;
  grade: string;
  round: string;
  includeTests: boolean;
  includeActivities: boolean;
  includeAwards?: boolean;
  firstGeneration?: boolean;
}) {
  const id = `profile-gold-${String(input.index).padStart(3, '0')}`;
  const activities = input.includeActivities
    ? [
        {
          id: `${id}-activity`,
          name:
            input.major === 'Computer Science'
              ? 'Robotics Lab'
              : input.major === 'Political Science'
                ? 'Student Newspaper'
                : input.major === 'Biology'
                  ? 'Hospital Volunteer'
                  : 'Community Initiative',
          category:
            input.major === 'Biology'
              ? 'COMMUNITY_SERVICE'
              : input.major === 'Political Science'
                ? 'LEADERSHIP'
                : 'ACADEMIC',
          role: 'Lead',
          description:
            'Structured leadership activity used for governance replay.',
          hoursPerWeek: 5,
          weeksPerYear: 30,
          order: 0,
          activityTemplate: {
            tier: 3,
          },
        },
      ]
    : [];
  const awards = input.includeAwards
    ? [
        {
          id: `${id}-award`,
          level: 'NATIONAL',
          name: `${input.major} Honor`,
          order: 0,
          competition: {
            tier: 4,
            name: `${input.major} Championship`,
          },
        },
      ]
    : [];

  return {
    id,
    userId: 'gold-runner',
    gpa: input.gpa,
    gpaScale: 4,
    targetMajor: input.major,
    intendedMajor: input.major,
    secondMajor: null,
    grade: input.grade,
    educationSystem: input.countryOfResidence === 'US' ? 'US' : 'AP',
    nationality: input.nationality,
    countryOfResidence: input.countryOfResidence,
    citizenship: input.citizenship,
    legacy: [],
    firstGeneration: input.firstGeneration ?? false,
    needsFinancialAid: input.needsFinancialAid,
    applicationRound: input.round,
    updatedAt: '2026-04-09T12:00:00.000Z',
    testScores: input.includeTests
      ? [
          {
            type: 'SAT',
            score: input.countryOfResidence === 'US' ? 1510 : 1490,
          },
        ]
      : [],
    activities,
    awards,
    education: [
      {
        id: `${id}-edu`,
        schoolName:
          input.countryOfResidence === 'US'
            ? 'Regional High School'
            : 'Global Academy',
        schoolType: 'HIGH_SCHOOL',
        highSchoolId: `${id}-hs`,
        highSchool: {
          name:
            input.countryOfResidence === 'US'
              ? 'Regional High School'
              : 'Global Academy',
          tier: input.countryOfResidence === 'US' ? 3 : 4,
          type: input.countryOfResidence === 'US' ? 'US_PUBLIC' : 'INTL_CN',
          country: input.countryOfResidence,
          state: input.countryOfResidence === 'US' ? 'CA' : null,
        },
      },
    ],
    essays: [],
    semesterGpas: [],
  };
}

function listItem(input: {
  caseIndex: number;
  school: SchoolDef;
  tier: 'REACH' | 'TARGET' | 'SAFETY';
  round: string;
}) {
  return {
    id: `sl-${input.caseIndex}-${input.school.id}`,
    schoolId: input.school.id,
    tier: input.tier,
    round: input.round,
    updatedAt: '2026-04-09T12:10:00.000Z',
    school: schoolSnapshot(input.school),
  };
}

function prediction(input: {
  school: SchoolDef;
  probability: number;
  probabilityLow: number;
  probabilityHigh: number;
  tier: 'reach' | 'match' | 'safety';
  confidence: 'low' | 'medium' | 'high';
  round: string;
  suggestion: string;
}) {
  return {
    schoolId: input.school.id,
    probability: input.probability,
    probabilityLow: input.probabilityLow,
    probabilityHigh: input.probabilityHigh,
    tier: input.tier,
    confidence: input.confidence,
    factors: [],
    suggestions: [input.suggestion],
    confidenceReason: 'Governance gold case prediction baseline.',
    applicationRound: input.round,
    updatedAt: '2026-04-09T12:20:00.000Z',
  };
}

function buildReadyCase(input: {
  id: string;
  description: string;
  locale: Locale;
  tags?: string[];
  profile: ReturnType<typeof profileSnapshot>;
  schools: Array<{
    school: SchoolDef;
    tier: 'REACH' | 'TARGET' | 'SAFETY';
    round: string;
    probability: number;
    probabilityLow: number;
    probabilityHigh: number;
    predictionTier: 'reach' | 'match' | 'safety';
    confidence: 'low' | 'medium' | 'high';
    forbiddenKeywords?: string[];
    extraTags?: string[];
  }>;
  metaConfidence?: 'low' | 'medium' | 'high';
}): GoldCase {
  const caseIndex = Number(input.id.slice(0, 3));
  const schoolListItems = input.schools.map((entry) =>
    listItem({
      caseIndex,
      school: entry.school,
      tier: entry.tier,
      round: entry.round,
    }),
  );

  const predictions = input.schools.map((entry) =>
    prediction({
      school: entry.school,
      probability: entry.probability,
      probabilityLow: entry.probabilityLow,
      probabilityHigh: entry.probabilityHigh,
      tier: entry.predictionTier,
      confidence: entry.confidence,
      round: entry.round,
      suggestion: `Keep the ${entry.round} plan aligned with ${entry.school.name}.`,
    }),
  );

  const tags = new Set<string>(['deterministic', ...(input.tags ?? [])]);
  for (const school of input.schools) {
    if (school.school.testingPolicy === 'BLIND') tags.add('uc-test-blind');
    if (school.school.testingPolicy === 'OPTIONAL') tags.add('policy-optional');
    if (school.school.testingPolicy === 'REQUIRED') tags.add('policy-required');
    if (school.school.testingPolicy === 'UNKNOWN') tags.add('policy-unknown');
    for (const extraTag of school.extraTags ?? []) tags.add(extraTag);
  }
  if (RENDER_SMOKE_IDS.has(input.id)) tags.add('render-smoke');
  if (NIGHTLY_LIVE_IDS.has(input.id)) tags.add('nightly-live');

  return {
    id: input.id,
    description: input.description,
    createdAt: REVIEW_DATE,
    lastReviewedAt: REVIEW_DATE,
    inputConfig: {
      locale: input.locale,
    },
    analysisSnapshot: {
      locale: input.locale,
      analysisVersion: ANALYSIS_VERSION,
      profile: input.profile,
      schoolListItems,
      focusSchools: schoolListItems,
      predictions,
      approvedEvidence: [],
      historyBySchool: Object.fromEntries(
        input.schools.map((entry) => [entry.school.id, null]),
      ),
    },
    expected: {
      state: 'ready',
      schoolCards: input.schools.map((entry) => ({
        schoolId: entry.school.id,
        schoolName: entry.school.name,
        tier: entry.tier,
        testingPolicy: entry.school.testingPolicy,
        probabilityRange: [
          entry.probabilityLow - 0.01,
          entry.probabilityHigh + 0.01,
        ] as [number, number],
        forbidden:
          (entry.forbiddenKeywords?.length ?? 0) > 0
            ? {
                invalidActionKeywords: entry.forbiddenKeywords,
              }
            : undefined,
      })),
      meta: {
        confidence: input.metaConfidence ?? 'medium',
        minActionCount: 1,
      },
    },
    tags: [...tags],
    ownerEmail: OWNER_EMAIL,
  };
}

function buildNoTargetCase(input: {
  id: string;
  description: string;
  locale: Locale;
  profile: ReturnType<typeof profileSnapshot>;
  tags?: string[];
}): GoldCase {
  const tags = new Set<string>([
    'deterministic',
    'no-target-schools',
    ...(input.tags ?? []),
  ]);
  if (RENDER_SMOKE_IDS.has(input.id)) tags.add('render-smoke');
  if (NIGHTLY_LIVE_IDS.has(input.id)) tags.add('nightly-live');
  return {
    id: input.id,
    description: input.description,
    createdAt: REVIEW_DATE,
    lastReviewedAt: REVIEW_DATE,
    inputConfig: { locale: input.locale },
    analysisSnapshot: {
      locale: input.locale,
      analysisVersion: ANALYSIS_VERSION,
      profile: input.profile,
      schoolListItems: [],
      focusSchools: [],
      predictions: [],
      approvedEvidence: [],
      historyBySchool: {},
    },
    expected: {
      state: 'noTargetSchools',
      schoolCards: [],
      meta: {
        minActionCount: 1,
      },
    },
    tags: [...tags],
    ownerEmail: OWNER_EMAIL,
  };
}

function buildNoPredictionsCase(input: {
  id: string;
  description: string;
  locale: Locale;
  profile: ReturnType<typeof profileSnapshot>;
  school: SchoolDef;
  tier: 'REACH' | 'TARGET' | 'SAFETY';
  round: string;
  tags?: string[];
}): GoldCase {
  const caseIndex = Number(input.id.slice(0, 3));
  const schoolListItems = [
    listItem({
      caseIndex,
      school: input.school,
      tier: input.tier,
      round: input.round,
    }),
  ];
  const tags = new Set<string>([
    'deterministic',
    'no-predictions',
    ...(input.tags ?? []),
  ]);
  if (RENDER_SMOKE_IDS.has(input.id)) tags.add('render-smoke');
  if (NIGHTLY_LIVE_IDS.has(input.id)) tags.add('nightly-live');

  return {
    id: input.id,
    description: input.description,
    createdAt: REVIEW_DATE,
    lastReviewedAt: REVIEW_DATE,
    inputConfig: { locale: input.locale },
    analysisSnapshot: {
      locale: input.locale,
      analysisVersion: ANALYSIS_VERSION,
      profile: input.profile,
      schoolListItems,
      focusSchools: schoolListItems,
      predictions: [],
      approvedEvidence: [],
      historyBySchool: {
        [input.school.id]: null,
      },
    },
    expected: {
      state: 'noPredictions',
      schoolCards: [],
      meta: {
        minActionCount: 1,
      },
    },
    tags: [...tags],
    ownerEmail: OWNER_EMAIL,
  };
}

function buildInsufficientCase(input: {
  id: string;
  description: string;
  locale: Locale;
  school: SchoolDef;
  round: string;
  tags?: string[];
}): GoldCase {
  const caseIndex = Number(input.id.slice(0, 3));
  const profile = profileSnapshot({
    index: caseIndex,
    locale: input.locale,
    gpa: null,
    major: 'Undecided',
    nationality: 'United States',
    countryOfResidence: 'US',
    citizenship: 'US',
    needsFinancialAid: false,
    grade: 'JUNIOR',
    round: input.round,
    includeTests: false,
    includeActivities: false,
    includeAwards: false,
  });
  const schoolListItems = [
    listItem({
      caseIndex,
      school: input.school,
      tier: 'REACH',
      round: input.round,
    }),
  ];
  const tags = new Set<string>([
    'deterministic',
    'insufficient-profile',
    ...(input.tags ?? []),
  ]);
  if (RENDER_SMOKE_IDS.has(input.id)) tags.add('render-smoke');

  return {
    id: input.id,
    description: input.description,
    createdAt: REVIEW_DATE,
    lastReviewedAt: REVIEW_DATE,
    inputConfig: { locale: input.locale },
    analysisSnapshot: {
      locale: input.locale,
      analysisVersion: ANALYSIS_VERSION,
      profile,
      schoolListItems,
      focusSchools: schoolListItems,
      predictions: [],
      approvedEvidence: [],
      historyBySchool: {
        [input.school.id]: null,
      },
    },
    expected: {
      state: 'insufficientProfileData',
      schoolCards: [],
      meta: {
        minActionCount: 1,
      },
    },
    tags: [...tags],
    ownerEmail: OWNER_EMAIL,
  };
}

function generateCases(): GoldCase[] {
  const cases: GoldCase[] = [];

  cases.push(
    buildReadyCase({
      id: '001-uc-berkeley-blind-en',
      description:
        'UC Berkeley should remain test-blind in structured analysis output.',
      locale: 'en',
      profile: profileSnapshot({
        index: 1,
        locale: 'en',
        gpa: 3.88,
        major: 'Computer Science',
        nationality: 'China',
        countryOfResidence: 'China',
        citizenship: 'China',
        needsFinancialAid: true,
        grade: 'JUNIOR',
        round: 'UC',
        includeTests: false,
        includeActivities: true,
        includeAwards: true,
      }),
      schools: [
        {
          school: SCHOOLS.berkeley,
          tier: 'REACH',
          round: 'UC',
          probability: 0.27,
          probabilityLow: 0.22,
          probabilityHigh: 0.33,
          predictionTier: 'reach',
          confidence: 'medium',
          forbiddenKeywords: ['SAT', 'ACT'],
        },
      ],
    }),
  );

  cases.push(
    buildNoTargetCase({
      id: '002-no-target-schools-zh',
      description:
        'When the applicant has not built a school list, the state must stay noTargetSchools.',
      locale: 'zh',
      profile: profileSnapshot({
        index: 2,
        locale: 'zh',
        gpa: 3.82,
        major: 'Economics',
        nationality: 'China',
        countryOfResidence: 'China',
        citizenship: 'China',
        needsFinancialAid: true,
        grade: 'JUNIOR',
        round: 'RD',
        includeTests: true,
        includeActivities: true,
      }),
    }),
  );

  cases.push(
    buildReadyCase({
      id: '003-columbia-optional-en',
      description:
        'Columbia should surface as test-optional in the current policy contract.',
      locale: 'en',
      profile: profileSnapshot({
        index: 3,
        locale: 'en',
        gpa: 3.91,
        major: 'Political Science',
        nationality: 'United States',
        countryOfResidence: 'US',
        citizenship: 'US',
        needsFinancialAid: false,
        grade: 'JUNIOR',
        round: 'ED',
        includeTests: true,
        includeActivities: true,
      }),
      schools: [
        {
          school: SCHOOLS.columbia,
          tier: 'TARGET',
          round: 'ED',
          probability: 0.19,
          probabilityLow: 0.14,
          probabilityHigh: 0.24,
          predictionTier: 'match',
          confidence: 'medium',
        },
      ],
    }),
  );

  cases.push(
    buildNoPredictionsCase({
      id: '004-no-predictions-en',
      description:
        'Focus schools without predictions should resolve to noPredictions instead of fabricating certainty.',
      locale: 'en',
      profile: profileSnapshot({
        index: 4,
        locale: 'en',
        gpa: 3.72,
        major: 'Biology',
        nationality: 'United States',
        countryOfResidence: 'US',
        citizenship: 'US',
        needsFinancialAid: false,
        grade: 'SENIOR',
        round: 'RD',
        includeTests: true,
        includeActivities: true,
      }),
      school: SCHOOLS.stanford,
      tier: 'TARGET',
      round: 'RD',
    }),
  );

  cases.push(
    buildInsufficientCase({
      id: '005-insufficient-profile-en',
      description:
        'Thin profiles should degrade to insufficientProfileData without pretending school-level confidence.',
      locale: 'en',
      school: SCHOOLS.mit,
      round: 'RD',
    }),
  );

  cases.push(
    buildReadyCase({
      id: '006-mit-required-en',
      description:
        'MIT should stay test-required in ready-state analysis output.',
      locale: 'en',
      profile: profileSnapshot({
        index: 6,
        locale: 'en',
        gpa: 3.95,
        major: 'Engineering',
        nationality: 'India',
        countryOfResidence: 'India',
        citizenship: 'India',
        needsFinancialAid: true,
        grade: 'JUNIOR',
        round: 'RD',
        includeTests: true,
        includeActivities: true,
        includeAwards: true,
      }),
      schools: [
        {
          school: SCHOOLS.mit,
          tier: 'REACH',
          round: 'RD',
          probability: 0.17,
          probabilityLow: 0.12,
          probabilityHigh: 0.22,
          predictionTier: 'reach',
          confidence: 'medium',
        },
      ],
    }),
  );

  cases.push(
    buildReadyCase({
      id: '007-unknown-policy-zh',
      description:
        'Unknown school policy should remain explicit instead of being inferred into a false optional/required label.',
      locale: 'zh',
      profile: profileSnapshot({
        index: 7,
        locale: 'zh',
        gpa: 3.78,
        major: 'Design',
        nationality: 'China',
        countryOfResidence: 'China',
        citizenship: 'China',
        needsFinancialAid: false,
        grade: 'JUNIOR',
        round: 'RD',
        includeTests: false,
        includeActivities: true,
      }),
      schools: [
        {
          school: SCHOOLS.unknownTech,
          tier: 'TARGET',
          round: 'RD',
          probability: 0.48,
          probabilityLow: 0.4,
          probabilityHigh: 0.56,
          predictionTier: 'match',
          confidence: 'medium',
        },
      ],
    }),
  );

  cases.push(
    buildReadyCase({
      id: '008-berkeley-columbia-balanced-en',
      description:
        'A multi-school ready case should preserve ordering and policy labels across mixed blind/optional schools.',
      locale: 'en',
      profile: profileSnapshot({
        index: 8,
        locale: 'en',
        gpa: 3.9,
        major: 'Economics',
        nationality: 'United States',
        countryOfResidence: 'US',
        citizenship: 'US',
        needsFinancialAid: false,
        grade: 'JUNIOR',
        round: 'ED',
        includeTests: true,
        includeActivities: true,
      }),
      schools: [
        {
          school: SCHOOLS.berkeley,
          tier: 'REACH',
          round: 'UC',
          probability: 0.29,
          probabilityLow: 0.23,
          probabilityHigh: 0.35,
          predictionTier: 'reach',
          confidence: 'medium',
          forbiddenKeywords: ['SAT', 'ACT'],
        },
        {
          school: SCHOOLS.columbia,
          tier: 'TARGET',
          round: 'ED',
          probability: 0.23,
          probabilityLow: 0.18,
          probabilityHigh: 0.29,
          predictionTier: 'match',
          confidence: 'medium',
        },
      ],
    }),
  );

  cases.push(
    buildReadyCase({
      id: '009-stanford-required-zh',
      description:
        'Stanford required-policy output should hold under zh locale render parity.',
      locale: 'zh',
      profile: profileSnapshot({
        index: 9,
        locale: 'zh',
        gpa: 3.93,
        major: 'Mathematics',
        nationality: 'China',
        countryOfResidence: 'China',
        citizenship: 'China',
        needsFinancialAid: true,
        grade: 'SENIOR',
        round: 'RD',
        includeTests: true,
        includeActivities: true,
      }),
      schools: [
        {
          school: SCHOOLS.stanford,
          tier: 'REACH',
          round: 'RD',
          probability: 0.15,
          probabilityLow: 0.11,
          probabilityHigh: 0.21,
          predictionTier: 'reach',
          confidence: 'medium',
        },
      ],
    }),
  );

  cases.push(
    buildReadyCase({
      id: '010-brown-optional-aid-en',
      description:
        'Aid-sensitive optional-policy schools should keep applicant-facing actions concise and policy-aware.',
      locale: 'en',
      profile: profileSnapshot({
        index: 10,
        locale: 'en',
        gpa: 3.86,
        major: 'International Relations',
        nationality: 'Kenya',
        countryOfResidence: 'Kenya',
        citizenship: 'Kenya',
        needsFinancialAid: true,
        grade: 'JUNIOR',
        round: 'RD',
        includeTests: false,
        includeActivities: true,
      }),
      schools: [
        {
          school: SCHOOLS.brown,
          tier: 'TARGET',
          round: 'RD',
          probability: 0.24,
          probabilityLow: 0.18,
          probabilityHigh: 0.31,
          predictionTier: 'match',
          confidence: 'medium',
        },
      ],
    }),
  );

  const readyPatterns = [
    {
      school: SCHOOLS.berkeley,
      locale: 'en' as const,
      tier: 'REACH' as const,
      round: 'UC',
      probability: 0.26,
      probabilityLow: 0.21,
      probabilityHigh: 0.33,
      predictionTier: 'reach' as const,
      confidence: 'medium' as const,
      major: 'Computer Science',
      aid: true,
      country: 'China',
      nationality: 'China',
      citizenship: 'China',
      includeTests: false,
      forbiddenKeywords: ['SAT', 'ACT'],
      descriptionPrefix:
        'UC blind policy should stay stable for repeat deterministic replays.',
    },
    {
      school: SCHOOLS.columbia,
      locale: 'en' as const,
      tier: 'TARGET' as const,
      round: 'ED',
      probability: 0.2,
      probabilityLow: 0.15,
      probabilityHigh: 0.27,
      predictionTier: 'match' as const,
      confidence: 'medium' as const,
      major: 'Political Science',
      aid: false,
      country: 'US',
      nationality: 'United States',
      citizenship: 'US',
      includeTests: true,
      descriptionPrefix:
        'Optional-policy output should remain stable for domestic applicants.',
    },
    {
      school: SCHOOLS.mit,
      locale: 'en' as const,
      tier: 'REACH' as const,
      round: 'RD',
      probability: 0.16,
      probabilityLow: 0.11,
      probabilityHigh: 0.22,
      predictionTier: 'reach' as const,
      confidence: 'medium' as const,
      major: 'Engineering',
      aid: true,
      country: 'India',
      nationality: 'India',
      citizenship: 'India',
      includeTests: true,
      descriptionPrefix:
        'Required-policy output should remain deterministic for engineering applicants.',
    },
    {
      school: SCHOOLS.stanford,
      locale: 'zh' as const,
      tier: 'REACH' as const,
      round: 'RD',
      probability: 0.14,
      probabilityLow: 0.1,
      probabilityHigh: 0.2,
      predictionTier: 'reach' as const,
      confidence: 'medium' as const,
      major: 'Economics',
      aid: false,
      country: 'US',
      nationality: 'United States',
      citizenship: 'US',
      includeTests: true,
      descriptionPrefix:
        'Required-policy zh output should stay stable for replay.',
    },
    {
      school: SCHOOLS.brown,
      locale: 'zh' as const,
      tier: 'TARGET' as const,
      round: 'RD',
      probability: 0.23,
      probabilityLow: 0.17,
      probabilityHigh: 0.3,
      predictionTier: 'match' as const,
      confidence: 'medium' as const,
      major: 'History',
      aid: true,
      country: 'China',
      nationality: 'China',
      citizenship: 'China',
      includeTests: false,
      descriptionPrefix:
        'Optional-policy zh output should stay stable for aid-sensitive applicants.',
    },
    {
      school: SCHOOLS.unknownTech,
      locale: 'en' as const,
      tier: 'SAFETY' as const,
      round: 'RD',
      probability: 0.61,
      probabilityLow: 0.54,
      probabilityHigh: 0.69,
      predictionTier: 'safety' as const,
      confidence: 'high' as const,
      major: 'Design',
      aid: false,
      country: 'US',
      nationality: 'United States',
      citizenship: 'US',
      includeTests: false,
      descriptionPrefix:
        'Unknown-policy schools should stay explicitly unknown in deterministic replay.',
    },
    {
      school: SCHOOLS.columbia,
      locale: 'zh' as const,
      tier: 'TARGET' as const,
      round: 'RD',
      probability: 0.18,
      probabilityLow: 0.13,
      probabilityHigh: 0.25,
      predictionTier: 'match' as const,
      confidence: 'medium' as const,
      major: 'Journalism',
      aid: true,
      country: 'Brazil',
      nationality: 'Brazil',
      citizenship: 'Brazil',
      includeTests: true,
      descriptionPrefix:
        'Optional-policy zh output should remain deterministic for international applicants.',
    },
  ];

  for (let index = 11; index <= 38; index += 1) {
    const pattern = readyPatterns[(index - 11) % readyPatterns.length];
    const variant = Math.floor((index - 11) / readyPatterns.length) + 1;
    cases.push(
      buildReadyCase({
        id: `${String(index).padStart(3, '0')}-${pattern.school.id}-${variant}`,
        description: `${pattern.descriptionPrefix} Variant ${variant}.`,
        locale: pattern.locale,
        profile: profileSnapshot({
          index,
          locale: pattern.locale,
          gpa: Number((3.7 + ((index - 11) % 6) * 0.05).toFixed(2)),
          major: pattern.major,
          nationality: pattern.nationality,
          countryOfResidence: pattern.country,
          citizenship: pattern.citizenship,
          needsFinancialAid: pattern.aid,
          grade: index % 3 === 0 ? 'SENIOR' : 'JUNIOR',
          round: pattern.round,
          includeTests: pattern.includeTests,
          includeActivities: true,
          includeAwards: index % 4 === 0,
          firstGeneration: index % 5 === 0,
        }),
        schools: [
          {
            school: pattern.school,
            tier: pattern.tier,
            round: pattern.round,
            probability: pattern.probability,
            probabilityLow: pattern.probabilityLow,
            probabilityHigh: pattern.probabilityHigh,
            predictionTier: pattern.predictionTier,
            confidence: pattern.confidence,
            forbiddenKeywords: pattern.forbiddenKeywords,
          },
        ],
      }),
    );
  }

  for (let index = 39; index <= 42; index += 1) {
    cases.push(
      buildNoTargetCase({
        id: `${String(index).padStart(3, '0')}-no-target-${index - 38}`,
        description:
          'No target-school state should remain deterministic across replay variants.',
        locale: index % 2 === 0 ? 'en' : 'zh',
        profile: profileSnapshot({
          index,
          locale: index % 2 === 0 ? 'en' : 'zh',
          gpa: 3.8,
          major: index % 2 === 0 ? 'Economics' : 'Computer Science',
          nationality: index % 2 === 0 ? 'United States' : 'China',
          countryOfResidence: index % 2 === 0 ? 'US' : 'China',
          citizenship: index % 2 === 0 ? 'US' : 'China',
          needsFinancialAid: index % 2 !== 0,
          grade: 'JUNIOR',
          round: 'RD',
          includeTests: true,
          includeActivities: true,
        }),
      }),
    );
  }

  for (let index = 43; index <= 46; index += 1) {
    const school = [
      SCHOOLS.mit,
      SCHOOLS.stanford,
      SCHOOLS.columbia,
      SCHOOLS.berkeley,
    ][index - 43];
    const round =
      school.testingPolicy === 'BLIND' ? 'UC' : index % 2 === 0 ? 'ED' : 'RD';
    cases.push(
      buildNoPredictionsCase({
        id: `${String(index).padStart(3, '0')}-no-predictions-${school.id}`,
        description:
          'No-predictions state should remain explicit until prediction coverage exists.',
        locale: index % 2 === 0 ? 'zh' : 'en',
        profile: profileSnapshot({
          index,
          locale: index % 2 === 0 ? 'zh' : 'en',
          gpa: 3.76,
          major: 'Biology',
          nationality: index % 2 === 0 ? 'China' : 'United States',
          countryOfResidence: index % 2 === 0 ? 'China' : 'US',
          citizenship: index % 2 === 0 ? 'China' : 'US',
          needsFinancialAid: index % 2 === 0,
          grade: 'SENIOR',
          round,
          includeTests: true,
          includeActivities: true,
        }),
        school,
        tier: school.testingPolicy === 'OPTIONAL' ? 'TARGET' : 'REACH',
        round,
      }),
    );
  }

  for (let index = 47; index <= 50; index += 1) {
    const school = [
      SCHOOLS.berkeley,
      SCHOOLS.columbia,
      SCHOOLS.mit,
      SCHOOLS.unknownTech,
    ][index - 47];
    cases.push(
      buildInsufficientCase({
        id: `${String(index).padStart(3, '0')}-insufficient-${school.id}`,
        description:
          'Insufficient-profile state should never fabricate school-level certainty.',
        locale: index % 2 === 0 ? 'zh' : 'en',
        school,
        round: school.testingPolicy === 'BLIND' ? 'UC' : 'RD',
      }),
    );
  }

  if (cases.length !== 50) {
    throw new Error(`Expected 50 gold cases, generated ${cases.length}.`);
  }

  return cases;
}

async function main() {
  const cases = generateCases();
  await mkdir(CASES_DIR, { recursive: true });
  const existingFiles = await readdir(CASES_DIR);
  await Promise.all(
    existingFiles
      .filter((file) => file.endsWith('.json'))
      .map((file) => rm(path.join(CASES_DIR, file))),
  );

  await Promise.all(
    cases.map((goldCase) =>
      writeFile(
        path.join(CASES_DIR, `${goldCase.id}.json`),
        `${JSON.stringify(goldCase, null, 2)}\n`,
        'utf8',
      ),
    ),
  );

  console.log(
    JSON.stringify(
      {
        status: 'ok',
        outputDir: path.relative(process.cwd(), CASES_DIR),
        totalCases: cases.length,
        renderSmokeCases: cases.filter((goldCase) =>
          goldCase.tags.includes('render-smoke'),
        ).length,
        nightlyLiveCases: cases.filter((goldCase) =>
          goldCase.tags.includes('nightly-live'),
        ).length,
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
