#!/usr/bin/env -S ts-node --transpile-only
/**
 * Counselor distribution audit.
 *
 * Sweeps every US school with an acceptanceRate and a fixed synthetic profile
 * matrix, then asserts the counselor engine never violates its hard anchored
 * clamp: [max(0.02, anchor * 0.3), min(0.98, anchor * 2.5)].
 */

import { mkdirSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';
import { NestFactory } from '@nestjs/core';
import { CounselorEngineModule } from '../src/modules/prediction/counselor/counselor-engine.module';
import { CounselorEngineService } from '../src/modules/prediction/counselor/counselor-engine.service';
import { PrismaService } from '../src/prisma/prisma.service';
import type {
  ProfileInput,
  SchoolInput,
} from '../src/modules/prediction/prediction.prompts';

const REPORTS_DIR = resolve(
  __dirname,
  '..',
  'gold-cases',
  'counselor',
  'reports',
);
const EPSILON = 0.001;

const PROFILE_VARIANTS: Array<{
  id: string;
  profile: ProfileInput;
  round?: string;
}> = [
  {
    id: 'strong-ca-instate-cs-rd',
    round: 'RD',
    profile: {
      gpa: 3.9,
      gpaScale: 4,
      targetMajor: 'Computer Science',
      highSchoolLocation: 'CA',
      isInternational: false,
      nationality: 'US',
      testScores: [{ type: 'SAT', score: 1500 }],
      activities: [],
      awards: [],
    },
  },
  {
    id: 'average-ca-rd',
    round: 'RD',
    profile: {
      gpa: 3.4,
      gpaScale: 4,
      highSchoolLocation: 'CA',
      isInternational: false,
      nationality: 'US',
      testScores: [{ type: 'SAT', score: 1250 }],
      activities: [],
      awards: [],
    },
  },
  {
    id: 'strong-ny-oos-cs-rd',
    round: 'RD',
    profile: {
      gpa: 3.95,
      gpaScale: 4,
      targetMajor: 'Computer Science',
      highSchoolLocation: 'NY',
      isInternational: false,
      nationality: 'US',
      testScores: [{ type: 'SAT', score: 1550 }],
      activities: [],
      awards: [],
    },
  },
  {
    id: 'weak-oos-rd',
    round: 'RD',
    profile: {
      gpa: 2.8,
      gpaScale: 4,
      highSchoolLocation: 'WA',
      isInternational: false,
      nationality: 'US',
      testScores: [{ type: 'SAT', score: 1050 }],
      activities: [],
      awards: [],
    },
  },
  {
    id: 'china-intl-strong-rd',
    round: 'RD',
    profile: {
      gpa: 3.85,
      gpaScale: 4,
      targetMajor: 'Computer Science',
      highSchoolLocation: 'CN',
      isInternational: true,
      nationality: 'CN',
      testScores: [{ type: 'SAT', score: 1500 }],
      activities: [],
      awards: [],
    },
  },
  {
    id: 'india-intl-act-rd',
    round: 'RD',
    profile: {
      gpa: 3.75,
      gpaScale: 4,
      highSchoolLocation: 'IN',
      isInternational: true,
      nationality: 'IN',
      testScores: [{ type: 'ACT', score: 34 }],
      activities: [],
      awards: [],
    },
  },
  {
    id: 'first-gen-rd',
    round: 'RD',
    profile: {
      gpa: 3.7,
      gpaScale: 4,
      highSchoolLocation: 'CA',
      isInternational: false,
      nationality: 'US',
      isFirstGen: true,
      testScores: [{ type: 'SAT', score: 1400 }],
      activities: [],
      awards: [],
    },
  },
  {
    id: 'legacy-ed',
    round: 'ED',
    profile: {
      gpa: 3.9,
      gpaScale: 4,
      highSchoolLocation: 'MA',
      isInternational: false,
      nationality: 'US',
      isLegacy: true,
      legacySchools: [],
      testScores: [{ type: 'SAT', score: 1500 }],
      activities: [],
      awards: [],
    },
  },
  {
    id: 'athlete-ea',
    round: 'EA',
    profile: {
      gpa: 3.6,
      gpaScale: 4,
      highSchoolLocation: 'TX',
      isInternational: false,
      nationality: 'US',
      recruitedAthlete: true,
      testScores: [{ type: 'SAT', score: 1350 }],
      activities: [],
      awards: [],
    },
  },
  {
    id: 'test-optional-no-score-rd',
    round: 'RD',
    profile: {
      gpa: 3.8,
      gpaScale: 4,
      highSchoolLocation: 'CA',
      isInternational: false,
      nationality: 'US',
      testScores: [],
      activities: [],
      awards: [],
    },
  },
];

async function main() {
  const app = await NestFactory.createApplicationContext(
    CounselorEngineModule,
    {
      logger: ['error', 'warn'],
    },
  );
  const counselor = app.get(CounselorEngineService);
  const prisma = app.get(PrismaService);

  const schools = await prisma.school.findMany({
    where: { country: 'US', acceptanceRate: { not: null } },
    select: {
      id: true,
      name: true,
      nameZh: true,
      country: true,
      state: true,
      acceptanceRate: true,
      intlAcceptanceRate: true,
      intlStudentPct: true,
      needBlindInternational: true,
      satAvg: true,
      sat25: true,
      sat75: true,
      actAvg: true,
      act25: true,
      act75: true,
      isPrivate: true,
      usNewsRank: true,
      graduationRate: true,
    },
    orderBy: [{ usNewsRank: 'asc' }, { name: 'asc' }],
  });

  const violations: Array<{
    schoolId: string;
    schoolName: string;
    profileId: string;
    probability: number;
    anchor: number;
    lower: number;
    upper: number;
    tier: number;
    anchorSource: string;
  }> = [];
  const rows: Array<Record<string, unknown>> = [];

  for (const school of schools) {
    const schoolInput: SchoolInput = {
      id: school.id,
      name: school.name,
      nameZh: school.nameZh ?? undefined,
      country: school.country,
      state: school.state ?? undefined,
      isPrivate: school.isPrivate,
      acceptanceRate: school.acceptanceRate
        ? Number(school.acceptanceRate)
        : undefined,
      intlAcceptanceRate: school.intlAcceptanceRate
        ? Number(school.intlAcceptanceRate)
        : undefined,
      intlStudentPct: school.intlStudentPct
        ? Number(school.intlStudentPct)
        : undefined,
      needBlindInternational: school.needBlindInternational,
      satAvg: school.satAvg ?? undefined,
      sat25: school.sat25 ?? undefined,
      sat75: school.sat75 ?? undefined,
      actAvg: school.actAvg ?? undefined,
      act25: school.act25 ?? undefined,
      act75: school.act75 ?? undefined,
      usNewsRank: school.usNewsRank ?? undefined,
      graduationRate: school.graduationRate
        ? Number(school.graduationRate)
        : undefined,
    };

    for (const variant of PROFILE_VARIANTS) {
      const profile =
        variant.id === 'legacy-ed'
          ? { ...variant.profile, legacySchools: [school.name] }
          : variant.profile;
      const result = await counselor.compute(
        profile,
        schoolInput,
        variant.round,
      );
      if (result.tier === 4) {
        rows.push({
          schoolId: school.id,
          schoolName: school.name,
          profileId: variant.id,
          tier: result.tier,
          skipped: true,
        });
        continue;
      }
      const lower = Math.max(0.02, result.anchor * 0.3);
      const upper = Math.min(0.98, result.anchor * 2.5);
      const row = {
        schoolId: school.id,
        schoolName: school.name,
        profileId: variant.id,
        probability: result.probability,
        anchor: result.anchor,
        lower,
        upper,
        tier: result.tier,
        anchorSource: result.anchorSource,
      };
      rows.push(row);
      if (
        result.probability < lower - EPSILON ||
        result.probability > upper + EPSILON
      ) {
        violations.push(row);
      }
    }
  }

  await app.close();

  mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPath = join(
    REPORTS_DIR,
    `audit-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        schoolCount: schools.length,
        profileVariantCount: PROFILE_VARIANTS.length,
        rowCount: rows.length,
        violationCount: violations.length,
        violations,
        rows,
      },
      null,
      2,
    ),
  );

  console.log(
    `Counselor audit complete: ${rows.length} rows, ${violations.length} clamp violation(s).`,
  );
  console.log(`Report written to ${reportPath}`);
  if (violations.length > 0) {
    console.table(violations.slice(0, 20));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Counselor audit failed:', error);
  process.exit(1);
});
