#!/usr/bin/env -S ts-node --transpile-only
/**
 * Seed the small set of manually reviewed high-school reference gaps found by
 * profile-signal coverage backfill.
 *
 * Real schools are inserted into HighSchool with conservative, structured
 * dimensions so they can participate in the capped high-school context signal.
 * Governance/test fixtures are explicitly rejected instead of polluting the
 * real reference table.
 */

import { mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { HighSchoolType, PrismaClient } from '@prisma/client';
import { computeHsQualityScore } from '@study-abroad/shared/scoring';

const prisma = new PrismaClient();
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const REPORT_DIR = resolve(REPO_ROOT, 'verification-report', 'profile-signals');

type ReferenceGapSchool = {
  name: string;
  nameZh: string;
  abbreviation: string;
  country: string;
  state: string;
  city: string;
  type: HighSchoolType;
  tier: number;
  description: string;
  recognition: number;
  academicRigor: number;
  placementRecord: number;
  studentQuality: number;
  resources: number;
  gradeInflation: 'deflation' | 'neutral' | 'inflation';
  aliases: string[];
  suggestionNames: string[];
};

const REFERENCE_GAPS: ReferenceGapSchool[] = [
  {
    name: 'Beijing No. 4 High School',
    nameZh: '北京四中',
    abbreviation: 'BJ4',
    country: 'CN',
    state: '北京',
    city: '北京',
    type: 'PUBLIC_CN',
    tier: 4,
    description:
      'Selective Beijing public high school; added from manual profile-signal reference review.',
    recognition: 4,
    academicRigor: 4,
    placementRecord: 4,
    studentQuality: 4,
    resources: 4,
    gradeInflation: 'neutral',
    aliases: ['北京四中'],
    suggestionNames: ['北京四中'],
  },
  {
    name: 'Shenzhen Foreign Languages School',
    nameZh: '深圳外国语学校',
    abbreviation: 'SZFLS',
    country: 'CN',
    state: '广东',
    city: '深圳',
    type: 'PUBLIC_CN',
    tier: 4,
    description:
      'Selective Shenzhen public foreign-language high school; added from manual profile-signal reference review.',
    recognition: 4,
    academicRigor: 4,
    placementRecord: 4,
    studentQuality: 4,
    resources: 4,
    gradeInflation: 'neutral',
    aliases: ['深圳外国语学校'],
    suggestionNames: ['深圳外国语学校'],
  },
  {
    name: 'Lowell High School',
    nameZh: '洛厄尔高中',
    abbreviation: 'LOWELL',
    country: 'US',
    state: 'CA',
    city: 'San Francisco',
    type: 'PUBLIC_US',
    tier: 4,
    description:
      'Selective San Francisco public high school; added from manual profile-signal reference review.',
    recognition: 4,
    academicRigor: 4,
    placementRecord: 4,
    studentQuality: 4,
    resources: 4,
    gradeInflation: 'neutral',
    aliases: ['Lowell'],
    suggestionNames: ['Lowell High School'],
  },
];

function allNames(school: ReferenceGapSchool): string[] {
  return [
    school.name,
    school.nameZh,
    school.abbreviation,
    ...school.aliases,
    ...school.suggestionNames,
  ].filter(Boolean);
}

async function upsertHighSchool(school: ReferenceGapSchool) {
  const quality = computeHsQualityScore({
    name: school.name,
    country: school.country,
    type: school.type,
    state: school.state,
    city: school.city,
    nameZh: school.nameZh,
    tier: school.tier,
    recognition: school.recognition,
    academicRigor: school.academicRigor,
    placementRecord: school.placementRecord,
    studentQuality: school.studentQuality,
    resources: school.resources,
    gradeInflation: school.gradeInflation,
    evaluatedBy: 'system',
  });

  const existing = await prisma.highSchool.findUnique({
    where: { abbreviation: school.abbreviation },
  });

  const data = {
    name: school.name,
    nameZh: school.nameZh,
    abbreviation: school.abbreviation,
    country: school.country,
    state: school.state,
    city: school.city,
    type: school.type,
    tier: school.tier,
    description: school.description,
    recognition: school.recognition,
    academicRigor: school.academicRigor,
    placementRecord: school.placementRecord,
    studentQuality: school.studentQuality,
    resources: school.resources,
    gradeInflation: school.gradeInflation,
    qualityScore: quality.score,
    qualityGrade: quality.grade,
    hsImpactEnabled: quality.grade !== 'D',
    evaluatedAt: new Date(),
    evaluatedBy: 'system',
    evaluationNotes:
      'Manual reference-gap seed. Conservative tier-4 dimensions; no accuracy claim attached.',
  };

  if (existing) {
    return prisma.highSchool.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.highSchool.create({ data });
}

async function linkEducations(
  school: ReferenceGapSchool,
  highSchoolId: string,
) {
  const names = [...new Set(allNames(school))];
  const rows = await prisma.education.findMany({
    where: {
      schoolName: { in: names },
    },
    select: { id: true, schoolName: true, highSchoolId: true },
  });
  const rowsToUpdate = rows.filter((row) => row.highSchoolId !== highSchoolId);

  if (rowsToUpdate.length > 0) {
    await prisma.education.updateMany({
      where: { id: { in: rowsToUpdate.map((row) => row.id) } },
      data: { highSchoolId },
    });
  }

  return { rows, rowsToUpdate };
}

async function mergeSuggestions(
  school: ReferenceGapSchool,
  highSchoolId: string,
) {
  const suggestions = await prisma.highSchoolSuggestion.findMany({
    where: { name: { in: school.suggestionNames } },
    select: { id: true, name: true, country: true, status: true },
  });

  if (suggestions.length > 0) {
    await prisma.highSchoolSuggestion.updateMany({
      where: { id: { in: suggestions.map((row) => row.id) } },
      data: {
        status: 'merged',
        mergedInto: highSchoolId,
      },
    });
  }

  return prisma.highSchoolSuggestion.findMany({
    where: { id: { in: suggestions.map((row) => row.id) } },
    select: {
      id: true,
      name: true,
      country: true,
      status: true,
      mergedInto: true,
    },
  });
}

async function rejectGovernanceFixture() {
  const suggestions = await prisma.highSchoolSuggestion.findMany({
    where: { name: 'Governance QA High School' },
    select: { id: true, name: true, country: true, status: true },
  });

  if (suggestions.length > 0) {
    await prisma.highSchoolSuggestion.updateMany({
      where: { id: { in: suggestions.map((row) => row.id) } },
      data: {
        status: 'rejected',
        mergedInto: null,
      },
    });
  }

  return prisma.highSchoolSuggestion.findMany({
    where: { id: { in: suggestions.map((row) => row.id) } },
    select: {
      id: true,
      name: true,
      country: true,
      status: true,
      mergedInto: true,
    },
  });
}

async function main() {
  mkdirSync(REPORT_DIR, { recursive: true });

  const results = [];
  for (const school of REFERENCE_GAPS) {
    const highSchool = await upsertHighSchool(school);
    const educationLinkage = await linkEducations(school, highSchool.id);
    const mergedSuggestions = await mergeSuggestions(school, highSchool.id);
    results.push({
      name: school.name,
      nameZh: school.nameZh,
      abbreviation: school.abbreviation,
      highSchoolId: highSchool.id,
      qualityGrade: highSchool.qualityGrade,
      hsImpactEnabled: highSchool.hsImpactEnabled,
      matchedEducationCount: educationLinkage.rows.length,
      updatedEducationCount: educationLinkage.rowsToUpdate.length,
      linkedEducations: educationLinkage.rows.map((row) => ({
        id: row.id,
        schoolName: row.schoolName,
      })),
      mergedSuggestionCount: mergedSuggestions.length,
      mergedSuggestions,
    });
  }

  const rejectedFixtures = await rejectGovernanceFixture();
  const report = {
    generatedAt: new Date().toISOString(),
    seededReferenceCount: results.length,
    matchedEducationCount: results.reduce(
      (sum, row) => sum + row.matchedEducationCount,
      0,
    ),
    updatedEducationCount: results.reduce(
      (sum, row) => sum + row.updatedEducationCount,
      0,
    ),
    mergedSuggestionCount: results.reduce(
      (sum, row) => sum + row.mergedSuggestionCount,
      0,
    ),
    rejectedFixtureSuggestions: rejectedFixtures,
    results,
  };

  writeFileSync(
    join(REPORT_DIR, 'high-school-reference-gaps.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
