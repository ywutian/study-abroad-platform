/**
 * Profile Loader Helper
 *
 * Centralizes loading user profile with relations,
 * used by 5+ tool implementations.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';

export interface LoadedHighSchool {
  name: string;
  tier: number;
  type: string;
  country: string;
  state: string | null;
}

export interface LoadedProfile {
  gpa: number | null;
  gpaScale: number;
  targetMajor: string | null;
  intendedMajor: string | null;
  secondMajor: string | null;
  grade: string | null;
  budgetTier: string | null;
  testScores: Array<{ type: string; score: number; date: Date | null }>;
  activities: Array<{
    name: string;
    category: string | null;
    role: string | null;
    description: string | null;
    hoursPerWeek: number | null;
    weeksPerYear: number | null;
    duration: string;
  }>;
  awards: Array<{
    name: string;
    level: string | null;
    year: number | null;
    competitionCategory: string | null;
  }>;
  education: Array<{
    school: string;
    degree: string | null;
    major: string | null;
    schoolType: string | null;
    highSchoolId: string | null;
  }>;
  nationality: string | null;
  /** Convenience: first HIGH_SCHOOL education's linked HighSchool, if any */
  highSchool: LoadedHighSchool | null;
}

@Injectable()
export class ProfileLoaderHelper {
  constructor(private prisma: PrismaService) {}

  /**
   * Load user profile with all relations, formatted for tool consumption.
   * Returns null if profile not found.
   */
  async loadProfile(
    userId: string,
    locale = 'zh',
  ): Promise<LoadedProfile | null> {
    const isZh = locale === 'zh';
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: {
        testScores: true,
        activities: {
          orderBy: { order: 'asc' },
          include: { activityTemplate: true },
        },
        awards: { include: { competition: true } },
        education: { include: { highSchool: true } },
      },
    });

    if (!profile) return null;

    return {
      gpa: profile.gpa ? Number(profile.gpa) : null,
      gpaScale: profile.gpaScale ? Number(profile.gpaScale) : 4.0,
      targetMajor: profile.targetMajor,
      intendedMajor: profile.intendedMajor,
      secondMajor: profile.secondMajor,
      grade: profile.grade,
      nationality: profile.nationality ?? null,
      budgetTier: profile.budgetTier,
      testScores:
        profile.testScores?.map((s) => ({
          type: s.type,
          score: s.score,
          date: s.testDate,
        })) || [],
      activities:
        profile.activities?.map((a) => ({
          name: a.name,
          category: a.category,
          role: a.role,
          description: a.description,
          hoursPerWeek: a.hoursPerWeek,
          weeksPerYear: a.weeksPerYear,
          duration: `${String(a.startDate)} - ${String(a.endDate || (isZh ? '至今' : 'Present'))}`,
        })) || [],
      awards:
        profile.awards?.map((a: any) => ({
          name: a.name,
          level: a.level,
          year: a.year,
          competitionCategory: a.competition?.category ?? null,
        })) || [],
      education:
        profile.education?.map((e: any) => ({
          school: e.schoolName,
          degree: e.degree,
          major: e.major,
          schoolType: e.schoolType,
          highSchoolId: e.highSchoolId,
        })) || [],
      highSchool: (() => {
        const hsEdu = profile.education?.find(
          (e: any) => e.schoolType === 'HIGH_SCHOOL',
        ) as any;
        if (!hsEdu?.highSchool) return null;
        const hs = hsEdu.highSchool;
        return {
          name: hs.name,
          tier: hs.tier,
          type: hs.type,
          country: hs.country,
          state: hs.state,
        };
      })(),
    };
  }

  /**
   * Get profile ID for a user. Returns null if not found.
   */
  async getProfileId(userId: string): Promise<string | null> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { id: true },
    });
    return profile?.id ?? null;
  }
}
