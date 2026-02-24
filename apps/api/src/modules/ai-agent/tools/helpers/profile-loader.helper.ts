/**
 * Profile Loader Helper
 *
 * Centralizes loading user profile with relations,
 * used by 5+ tool implementations.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';

export interface LoadedProfile {
  gpa: number | null;
  gpaScale: number;
  targetMajor: string | null;
  grade: string | null;
  budgetTier: string | null;
  testScores: Array<{ type: string; score: number; date: Date | null }>;
  activities: Array<{
    name: string;
    category: string | null;
    role: string | null;
    duration: string;
  }>;
  awards: Array<{ name: string; level: string | null; year: number | null }>;
  education: Array<{
    school: string;
    degree: string | null;
    major: string | null;
  }>;
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
        activities: true,
        awards: true,
        education: true,
      },
    });

    if (!profile) return null;

    return {
      gpa: profile.gpa ? Number(profile.gpa) : null,
      gpaScale: profile.gpaScale ? Number(profile.gpaScale) : 4.0,
      targetMajor: profile.targetMajor,
      grade: profile.grade,
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
          duration: `${a.startDate} - ${a.endDate || (isZh ? '至今' : 'Present')}`,
        })) || [],
      awards:
        profile.awards?.map((a) => ({
          name: a.name,
          level: a.level,
          year: a.year,
        })) || [],
      education:
        profile.education?.map((e) => ({
          school: e.schoolName,
          degree: e.degree,
          major: e.major,
        })) || [],
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
