#!/usr/bin/env -S ts-node --transpile-only
/**
 * Verifies that profile fields used by the launch prediction surface are not
 * silently dropped. Each signal must be used in probability, explanation,
 * missing-gap reporting, or explicitly ignored by policy.
 */

import { mkdirSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';
import { NestFactory } from '@nestjs/core';
import { CounselorEngineModule } from '../src/modules/prediction/counselor/counselor-engine.module';
import { CounselorEngineService } from '../src/modules/prediction/counselor/counselor-engine.service';
import { PredictionTransformerService } from '../src/modules/prediction/prediction-transformer.service';
import { PrismaService } from '../src/prisma/prisma.service';
import type { ProfileInput } from '../src/modules/prediction/prediction.prompts';

const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const REPORT_DIR = resolve(REPO_ROOT, 'verification-report', 'profile-signals');

const EXPECTED_SIGNAL_KEYS = [
  'gpaTrend',
  'activityStrength',
  'awardStrength',
  'highSchoolContext',
  'englishReadiness',
  'financialAidContext',
];

const POLICY_IGNORED = [
  'essays',
  'MBTI/Holland assessment',
  'budget preferences',
  'region preferences',
  'URM status',
  'unverified legacy/athlete hooks',
];

function hasEntry(list: string[] | undefined, key: string): boolean {
  return Boolean(list?.some((item) => item === key || item.includes(key)));
}

async function main() {
  mkdirSync(REPORT_DIR, { recursive: true });

  const app = await NestFactory.createApplicationContext(
    CounselorEngineModule,
    { logger: ['error', 'warn'] },
  );
  const counselor = app.get(CounselorEngineService);
  const transformer = app.get(PredictionTransformerService);
  const prisma = app.get(PrismaService);

  const school = await prisma.school.findFirst({
    where: {
      country: 'US',
      acceptanceRate: { not: null },
      institutionType: { notIn: ['ART_DESIGN', 'MUSIC_CONSERVATORY'] as any },
    },
    orderBy: { acceptanceRate: 'asc' },
  });
  if (!school) {
    throw new Error(
      'No numeric US school available for profile signal coverage verification.',
    );
  }

  const profile: ProfileInput = {
    gpa: 3.9,
    gpaScale: 4,
    gpaByGrade: { g9: 3.45, g10: 3.65, g11: 3.9, g12: 3.95 },
    gpaTrend: {
      direction: 'rising',
      delta: 0.5,
      evidence: 'G9 3.45 → G12 3.95',
    },
    targetMajor: 'Computer Science',
    isInternational: true,
    nationality: 'CN',
    highSchoolLocation: 'CN',
    highSchoolTier: 5,
    highSchoolRecognition: 5,
    highSchoolPlacementRecord: 5,
    highSchoolImpactEnabled: true,
    needsFinancialAid: true,
    testScores: [
      { type: 'SAT', score: 1550 },
      { type: 'TOEFL', score: 116 },
    ],
    englishProficiency: {
      type: 'TOEFL',
      score: 116,
      normalized: 116 / 120,
    },
    activities: [
      {
        name: 'Research',
        category: 'RESEARCH',
        role: 'Founder',
        tier: 1,
        annualHours: 360,
      },
      {
        name: 'Robotics',
        category: 'ACADEMIC',
        role: 'Captain',
        tier: 2,
        annualHours: 220,
      },
    ],
    awards: [
      {
        name: 'National Olympiad',
        level: 'NATIONAL',
        tier: 5,
        competitionName: 'Olympiad',
      },
    ],
    isLegacy: true,
    legacySchools: [school.name],
    recruitedAthlete: true,
    urmStatus: 'BLACK',
    assessment: { mbtiType: 'INTJ', hollandCodes: ['I', 'R'] },
  };

  const result = await counselor.compute(
    profile,
    transformer.schoolToInput(school as any),
    'RD',
  );
  const profileSignals = result.profileSignals;
  const [
    profileCount,
    gpaCount,
    gradeGpaCount,
    semesterGpaProfileCount,
    activityProfileCount,
    activityTemplateLinkedProfileCount,
    awardProfileCount,
    awardCompetitionLinkedProfileCount,
    educationProfileCount,
    highSchoolEducationCount,
    linkedHighSchoolEducationCount,
    currentSchoolOnlyCount,
    englishScoreProfileCount,
  ] = await Promise.all([
    prisma.profile.count(),
    prisma.profile.count({ where: { gpa: { not: null } } }),
    prisma.profile.count({
      where: {
        OR: [
          { gpa9: { not: null } },
          { gpa10: { not: null } },
          { gpa11: { not: null } },
          { gpa12: { not: null } },
        ],
      },
    }),
    prisma.semesterGpa
      .findMany({ distinct: ['profileId'], select: { profileId: true } })
      .then((rows) => rows.length),
    prisma.activity
      .findMany({ distinct: ['profileId'], select: { profileId: true } })
      .then((rows) => rows.length),
    prisma.activity
      .findMany({
        where: { activityTemplateId: { not: null } },
        distinct: ['profileId'],
        select: { profileId: true },
      })
      .then((rows) => rows.length),
    prisma.award
      .findMany({ distinct: ['profileId'], select: { profileId: true } })
      .then((rows) => rows.length),
    prisma.award
      .findMany({
        where: { competitionId: { not: null } },
        distinct: ['profileId'],
        select: { profileId: true },
      })
      .then((rows) => rows.length),
    prisma.education
      .findMany({ distinct: ['profileId'], select: { profileId: true } })
      .then((rows) => rows.length),
    prisma.education.count({
      where: { schoolType: { contains: 'HIGH_SCHOOL' } },
    }),
    prisma.education.count({
      where: {
        schoolType: { contains: 'HIGH_SCHOOL' },
        highSchoolId: { not: null },
      },
    }),
    prisma.profile.count({
      where: {
        currentSchool: { not: null },
        education: { none: { schoolType: { contains: 'HIGH_SCHOOL' } } },
      },
    }),
    prisma.testScore
      .findMany({
        where: { type: { in: ['TOEFL', 'IELTS', 'DUOLINGO'] } },
        distinct: ['profileId'],
        select: { profileId: true },
      })
      .then((rows) => rows.length),
  ]);
  const rows = EXPECTED_SIGNAL_KEYS.map((key) => ({
    key,
    covered:
      hasEntry(profileSignals?.usedInProbability, key) ||
      hasEntry(profileSignals?.usedInExplanation, key) ||
      hasEntry(profileSignals?.missingGaps, key),
    location: hasEntry(profileSignals?.usedInProbability, key)
      ? 'usedInProbability'
      : hasEntry(profileSignals?.usedInExplanation, key)
        ? 'usedInExplanation'
        : hasEntry(profileSignals?.missingGaps, key)
          ? 'missingGaps'
          : 'missing',
  }));
  const policyRows = POLICY_IGNORED.map((key) => ({
    key,
    covered: hasEntry(profileSignals?.ignoredByPolicy, key),
    location: 'ignoredByPolicy',
  }));
  const failures = [...rows, ...policyRows].filter((row) => !row.covered);
  const report = {
    generatedAt: new Date().toISOString(),
    school: { id: school.id, name: school.name },
    pass: failures.length === 0,
    dbCoverage: {
      profileCount,
      gpaCount,
      gradeGpaCount,
      semesterGpaProfileCount,
      activityProfileCount,
      activityTemplateLinkedProfileCount,
      awardProfileCount,
      awardCompetitionLinkedProfileCount,
      educationProfileCount,
      highSchoolEducationCount,
      linkedHighSchoolEducationCount,
      currentSchoolOnlyCount,
      englishScoreProfileCount,
    },
    profileContextMultiplier:
      result.modifierResults.profileContext?.multiplier ?? null,
    profileSignals,
    rows,
    policyRows,
    failures,
  };

  writeFileSync(
    join(REPORT_DIR, 'coverage.json'),
    JSON.stringify(report, null, 2),
  );
  await app.close();

  console.log(
    JSON.stringify({ pass: report.pass, failures: failures.length }, null, 2),
  );
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
