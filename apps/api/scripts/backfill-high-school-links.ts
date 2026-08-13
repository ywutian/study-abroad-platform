#!/usr/bin/env -S ts-node --transpile-only
/**
 * Backfill Education.highSchoolId for existing high-school education rows.
 *
 * This closes the profile-signal loop for users who entered a school name before
 * the HighSchool reference table existed. It is intentionally conservative:
 * exact/contains matches against name or abbreviation are linked; unmatched rows
 * become HighSchoolSuggestion rows for admin review instead of being guessed.
 */

import { mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const REPORT_DIR = resolve(REPO_ROOT, 'verification-report', 'profile-signals');

function isHighSchoolType(schoolType?: string | null): boolean {
  return (schoolType ?? '').toUpperCase().includes('HIGH_SCHOOL');
}

function inferSuggestionCountry(
  schoolName: string,
  schoolType?: string | null,
): string {
  const type = (schoolType ?? '').toUpperCase();
  if (/[\u3400-\u9fff]/.test(schoolName) || type.includes('CN')) return 'CN';
  if (type.includes('US')) return 'US';
  if (type.includes('INTL')) return 'UNKNOWN';
  return 'US';
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function highSchoolNameCandidates(raw: string): string[] {
  const candidates = new Set<string>();
  const trimmed = raw.trim();
  if (!trimmed) return [];
  candidates.add(trimmed);
  const knownAliases: Record<string, string[]> = {
    北京人大附中: [
      'RDFZ',
      'The High School Affiliated to Renmin University of China',
    ],
    上海中学: ['SHSID', 'Shanghai High School International Division'],
    上海世界外国语中学: ['WFLA', 'Shanghai World Foreign Language Academy'],
    南京外国语学校: ['NFLS', 'Nanjing Foreign Language School'],
    成都七中: ['Chengdu No.7 High School'],
    广州外国语学校: ['GZFLS', 'Guangzhou Foreign Language School'],
    北京四中: ['BJ4', 'Beijing No. 4 High School'],
    深圳外国语学校: ['SZFLS', 'Shenzhen Foreign Languages School'],
    深圳中学: ['SZMS Intl', 'Shenzhen Middle School International System'],
    深圳国际交流学院: ['SCIE', 'Shenzhen College of International Education'],
    'Lowell High School': ['LOWELL', 'Lowell'],
    'Shanghai Pinghe School': ['Pinghe', 'Shanghai Pinghe Bilingual School'],
  };
  for (const [alias, values] of Object.entries(knownAliases)) {
    if (trimmed.includes(alias)) {
      values.forEach((value) => candidates.add(value));
    }
  }

  for (const match of trimmed.matchAll(/\(([^)]+)\)/g)) {
    const inner = match[1]?.trim();
    if (inner) candidates.add(inner);
  }

  const withoutParenthetical = trimmed.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  if (withoutParenthetical) candidates.add(withoutParenthetical);

  for (const value of [...candidates]) {
    if (/high school/i.test(value)) {
      candidates.add(value.replace(/high school/gi, 'Middle School'));
    }
    if (/middle school/i.test(value)) {
      candidates.add(value.replace(/middle school/gi, 'High School'));
    }
  }

  return [...candidates].filter(Boolean);
}

async function findHighSchoolIdByName(schoolName: string) {
  const seen = new Set<string>();
  for (const candidate of highSchoolNameCandidates(schoolName)) {
    const normalized = normalizeName(candidate);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    const canUseBroadNameContains = normalized.replace(/\s/g, '').length > 4;

    const match = await prisma.highSchool.findFirst({
      where: {
        OR: [
          { name: { equals: candidate, mode: 'insensitive' } },
          { abbreviation: { equals: candidate, mode: 'insensitive' } },
          ...(canUseBroadNameContains
            ? [
                {
                  name: {
                    contains: candidate,
                    mode: 'insensitive' as const,
                  },
                },
              ]
            : []),
          { abbreviation: { contains: candidate, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ tier: 'desc' }, { recognition: 'desc' }],
      select: { id: true, name: true, abbreviation: true, tier: true },
    });
    if (match) return match;
  }
  return null;
}

async function ensureSuggestion(row: {
  profile: { userId: string };
  schoolName: string;
  schoolType: string | null;
}) {
  const country = inferSuggestionCountry(row.schoolName, row.schoolType);
  const existing = await prisma.highSchoolSuggestion.findUnique({
    where: { name_country: { name: row.schoolName, country } },
  });
  if (!existing) {
    await prisma.highSchoolSuggestion.create({
      data: {
        name: row.schoolName,
        country,
        submittedBy: [row.profile.userId],
      },
    });
    return { action: 'created_suggestion', country };
  }
  if (!existing.submittedBy.includes(row.profile.userId)) {
    await prisma.highSchoolSuggestion.update({
      where: { id: existing.id },
      data: {
        submittedBy: { set: [...existing.submittedBy, row.profile.userId] },
      },
    });
    return { action: 'updated_suggestion', country };
  }
  return { action: 'existing_suggestion', country };
}

async function main() {
  mkdirSync(REPORT_DIR, { recursive: true });

  const dryRun = process.argv.includes('--dry-run');
  const rows = await prisma.education.findMany({
    where: {
      highSchoolId: null,
      OR: [{ schoolType: { contains: 'HIGH_SCHOOL' } }, { schoolType: null }],
    },
    include: { profile: { select: { userId: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const currentSchoolOnlyProfiles = await prisma.profile.findMany({
    where: {
      currentSchool: { not: null },
      education: { none: { schoolType: { contains: 'HIGH_SCHOOL' } } },
    },
    select: {
      id: true,
      userId: true,
      currentSchool: true,
      currentSchoolType: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const results: Array<Record<string, unknown>> = [];
  for (const row of rows) {
    if (!isHighSchoolType(row.schoolType)) {
      results.push({
        educationId: row.id,
        schoolName: row.schoolName,
        action: 'skipped_non_high_school_type',
      });
      continue;
    }

    const match = await findHighSchoolIdByName(row.schoolName);
    if (match) {
      if (!dryRun) {
        await prisma.education.update({
          where: { id: row.id },
          data: { highSchoolId: match.id },
        });
      }
      results.push({
        educationId: row.id,
        schoolName: row.schoolName,
        action: dryRun ? 'would_link' : 'linked',
        highSchoolId: match.id,
        highSchoolName: match.name,
        highSchoolAbbreviation: match.abbreviation,
        highSchoolTier: match.tier,
      });
      continue;
    }

    const suggestion = dryRun
      ? {
          action: 'would_create_or_update_suggestion',
          country: inferSuggestionCountry(row.schoolName, row.schoolType),
        }
      : await ensureSuggestion(row);
    results.push({
      educationId: row.id,
      schoolName: row.schoolName,
      ...suggestion,
    });
  }

  for (const profile of currentSchoolOnlyProfiles) {
    if (!profile.currentSchool) continue;
    const match = await findHighSchoolIdByName(profile.currentSchool);
    if (!dryRun) {
      await prisma.education.create({
        data: {
          profileId: profile.id,
          schoolName: profile.currentSchool,
          schoolType: 'HIGH_SCHOOL',
          highSchoolId: match?.id ?? null,
        },
      });
    }
    if (match) {
      results.push({
        profileId: profile.id,
        schoolName: profile.currentSchool,
        action: dryRun
          ? 'would_create_education_and_link'
          : 'created_education_and_linked',
        highSchoolId: match.id,
        highSchoolName: match.name,
        highSchoolAbbreviation: match.abbreviation,
        highSchoolTier: match.tier,
      });
      continue;
    }
    const suggestion = dryRun
      ? {
          action: 'would_create_education_and_suggestion',
          country: inferSuggestionCountry(
            profile.currentSchool,
            profile.currentSchoolType,
          ),
        }
      : await ensureSuggestion({
          profile: { userId: profile.userId },
          schoolName: profile.currentSchool,
          schoolType: profile.currentSchoolType,
        });
    results.push({
      profileId: profile.id,
      schoolName: profile.currentSchool,
      action:
        suggestion.action === 'created_suggestion'
          ? 'created_education_and_suggestion'
          : suggestion.action,
      country: suggestion.country,
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    dryRun,
    scanned: rows.length,
    currentSchoolOnlyScanned: currentSchoolOnlyProfiles.length,
    linked: results.filter((row) => row.action === 'linked').length,
    createdEducationAndLinked: results.filter(
      (row) => row.action === 'created_education_and_linked',
    ).length,
    suggestions: results.filter((row) =>
      String(row.action).includes('suggestion'),
    ).length,
    results,
  };

  writeFileSync(
    join(REPORT_DIR, 'high-school-linkage.json'),
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
