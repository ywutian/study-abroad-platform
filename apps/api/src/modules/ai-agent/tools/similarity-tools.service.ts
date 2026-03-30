/**
 * Similarity Tools Service
 *
 * Graph Memory-integrated tool for finding applicants with similar backgrounds.
 * Uses multi-dimensional scoring (GPA, SAT, nationality, curriculum) with
 * optional graph entity enhancement.
 *
 * Tools: FIND_SIMILAR_APPLICANTS
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CASE_REVIEW_APPROVED_WHERE } from '../../../common/constants/prisma-selects';
import {
  parseCaseActivities,
  parseCaseAwards,
  parseCaseTestScores,
} from '../../../common/constants/data-formats';
import { parseRange } from '../../../common/utils/scoring';
import { ProfileLoaderHelper } from './helpers/profile-loader.helper';
import { SchoolLookupHelper } from './helpers/school-lookup.helper';
import { ToolHandler, IToolHandlerProvider } from './tool-handler.interface';
import { PersistentMemoryService } from '../memory/persistent-memory.service';

interface SimilarApplicantResult {
  cases: Array<{
    school: string;
    result: string;
    year: number;
    round?: string;
    gpa?: string;
    sat?: string;
    nationality?: string;
    highSchoolType?: string;
    curriculumType?: string;
    topActivities: string[];
    topAwards: string[];
    similarityScore: number;
  }>;
  summary: string;
  matchCriteria: {
    gpa?: string;
    sat?: string;
    nationality?: string;
    curriculumType?: string;
    schoolFilter?: string;
  };
  totalMatched: number;
  graphEnhanced: boolean;
}

@Injectable()
export class SimilarityToolsService implements IToolHandlerProvider {
  private readonly logger = new Logger(SimilarityToolsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly profileLoader: ProfileLoaderHelper,
    private readonly schoolLookup: SchoolLookupHelper,
    @Optional() private readonly persistentMemory?: PersistentMemoryService,
  ) {}

  getHandlers(): Map<string, ToolHandler> {
    return new Map<string, ToolHandler>([
      [
        'find_similar_applicants',
        (args, userId, _ctx, locale) =>
          this.findSimilarApplicants(
            args as Record<string, any>,
            userId,
            locale,
          ),
      ],
    ]);
  }

  /**
   * Find applicants with similar backgrounds using multi-dimensional scoring.
   * Optionally enhanced with Graph Memory relationships.
   */
  async findSimilarApplicants(
    args: { schoolName?: string; limit?: number; includeRejected?: boolean },
    userId: string,
    locale = 'zh',
  ): Promise<SimilarApplicantResult | { error: string }> {
    const isZh = locale === 'zh';

    try {
      const profile = await this.profileLoader.loadProfile(userId, locale);
      if (!profile) {
        return {
          error: isZh
            ? '请先完善您的档案信息'
            : 'Please complete your profile first',
        };
      }

      const take = Math.min(args.limit ?? 15, 30);
      const userGpa = profile.gpa ? Number(profile.gpa) : null;
      const userGpaScale = Number(profile.gpaScale) || 4.0;

      // Extract SAT score from profile
      let userSat: number | null = null;
      if (profile.testScores?.length) {
        const satScore = profile.testScores.find(
          (ts: any) => ts.type === 'SAT',
        );
        if (satScore) userSat = satScore.score;
      }

      // Resolve school filter
      let schoolId: string | null = null;
      if (args.schoolName) {
        const school = await this.schoolLookup.findSchool(args.schoolName);
        if (school) schoolId = school.id;
      }

      // ── Query candidates with loose filters ──
      const where: any = {
        isVerified: true,
        ...CASE_REVIEW_APPROVED_WHERE,
        visibility: { in: ['ANONYMOUS', 'PUBLIC', 'VERIFIED_ONLY'] },
      };

      if (schoolId) {
        where.schoolId = schoolId;
      }

      if (args.includeRejected === false) {
        where.result = 'ADMITTED';
      }

      const candidates = await this.prisma.admissionCase.findMany({
        where,
        take: take * 5, // Over-fetch for scoring/filtering
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          result: true,
          year: true,
          round: true,
          gpa11: true,
          gpa10: true,
          gpaRange: true,
          gpaScale: true,
          satRange: true,
          testScores: true,
          nationality: true,
          highSchoolType: true,
          curriculumType: true,
          tags: true,
          activities: true,
          awards: true,
          schoolId: true,
          school: { select: { name: true, nameZh: true } },
        },
      });

      if (!candidates.length) {
        return {
          error: isZh ? '未找到匹配的案例数据' : 'No matching case data found',
        };
      }

      // ── Score each candidate ──
      const scored = candidates.map((c) => {
        let score = 0;
        let maxScore = 0;

        // GPA similarity (weight: 0.3)
        if (userGpa != null) {
          maxScore += 0.3;
          const caseGpa =
            c.gpa11 != null
              ? Number(c.gpa11)
              : c.gpa10 != null
                ? Number(c.gpa10)
                : c.gpaRange
                  ? parseRange(c.gpaRange)
                  : null;
          if (caseGpa != null) {
            // Normalize to 4.0 scale for comparison
            const normUser =
              userGpaScale !== 4.0 ? (userGpa / userGpaScale) * 4.0 : userGpa;
            const caseScale = Number(c.gpaScale) || 4.0;
            const normCase =
              caseScale !== 4.0 ? (caseGpa / caseScale) * 4.0 : caseGpa;
            const gpaDiff = Math.abs(normUser - normCase);
            if (gpaDiff <= 0.1) score += 0.3;
            else if (gpaDiff <= 0.3) score += 0.2;
            else if (gpaDiff <= 0.5) score += 0.1;
          }
        }

        // SAT similarity (weight: 0.25)
        if (userSat != null) {
          maxScore += 0.25;
          let caseSat: number | null = null;
          if (c.testScores && Array.isArray(c.testScores)) {
            const satEntry = (
              c.testScores as Array<{ type: string; score: number }>
            ).find((ts) => ts.type === 'SAT');
            if (satEntry) caseSat = satEntry.score;
          }
          if (caseSat == null && c.satRange) {
            caseSat = parseRange(c.satRange);
          }
          if (caseSat != null) {
            const satDiff = Math.abs(userSat - caseSat);
            if (satDiff <= 30) score += 0.25;
            else if (satDiff <= 80) score += 0.15;
            else if (satDiff <= 150) score += 0.05;
          }
        }

        // Nationality match (weight: 0.2)
        if (profile.nationality) {
          maxScore += 0.2;
          if (
            c.nationality &&
            c.nationality.toLowerCase() === profile.nationality.toLowerCase()
          ) {
            score += 0.2;
          }
        }

        // Curriculum/school type match (weight: 0.25) — from education entries
        const hsEntry = profile.education?.find(
          (e: any) => e.schoolType === 'HIGH_SCHOOL',
        );
        if (hsEntry) {
          maxScore += 0.15;
          if (c.highSchoolType && hsEntry.schoolType) {
            score += 0.15;
          }
        }

        // Normalize score to 0-1
        const normalizedScore = maxScore > 0 ? score / maxScore : 0;

        return {
          ...c,
          similarityScore: Math.round(normalizedScore * 100) / 100,
        };
      });

      // Sort by similarity score descending, take top N
      scored.sort((a, b) => b.similarityScore - a.similarityScore);
      const topCases = scored
        .filter((c) => c.similarityScore > 0)
        .slice(0, take);

      if (!topCases.length) {
        return {
          error: isZh
            ? '未找到与您背景相似的申请者'
            : 'No similar applicants found for your profile',
        };
      }

      // ── Graph Memory: populate entities for future queries ──
      let graphEnhanced = false;
      if (this.persistentMemory) {
        try {
          // Record the user's school interests as graph entities
          if (schoolId && args.schoolName) {
            await this.persistentMemory.upsertGraphEntity(
              userId,
              'school',
              args.schoolName,
              { schoolId },
            );
          }
          graphEnhanced = true;
        } catch {
          // Graph population is non-critical
        }
      }

      // ── Format results ──
      const admittedCount = topCases.filter(
        (c) => c.result === 'ADMITTED',
      ).length;
      const rejectedCount = topCases.filter(
        (c) => c.result === 'REJECTED',
      ).length;
      const waitlistedCount = topCases.filter(
        (c) => c.result === 'WAITLISTED',
      ).length;

      const matchCriteria: SimilarApplicantResult['matchCriteria'] = {};
      if (userGpa != null) matchCriteria.gpa = `${userGpa}/${userGpaScale}`;
      if (userSat != null) matchCriteria.sat = String(userSat);
      if (profile.nationality) matchCriteria.nationality = profile.nationality;
      if (args.schoolName) matchCriteria.schoolFilter = args.schoolName;

      const summary = isZh
        ? `找到 ${topCases.length} 位背景相似的申请者：${admittedCount} 人录取，${rejectedCount} 人拒绝，${waitlistedCount} 人候补`
        : `Found ${topCases.length} similar applicants: ${admittedCount} admitted, ${rejectedCount} rejected, ${waitlistedCount} waitlisted`;

      return {
        cases: topCases.map((c) => ({
          school: this.schoolLookup.displayName(c.school, locale),
          result: c.result,
          year: c.year,
          round: c.round ?? undefined,
          gpa: c.gpa11 != null ? `${c.gpa11}` : (c.gpaRange ?? undefined),
          sat: c.satRange ?? undefined,
          nationality: c.nationality ?? undefined,
          highSchoolType: c.highSchoolType ?? undefined,
          curriculumType: c.curriculumType ?? undefined,
          topActivities: parseCaseActivities(c.activities)
            .slice(0, 3)
            .map((a) => `${a.category}${a.role ? ` (${a.role})` : ''}`),
          topAwards: parseCaseAwards(c.awards)
            .slice(0, 2)
            .map((a) => `${a.name} (${a.level})`),
          similarityScore: c.similarityScore,
        })),
        summary,
        matchCriteria,
        totalMatched: topCases.length,
        graphEnhanced,
      };
    } catch (error) {
      this.logger.error('Failed to find similar applicants', error);
      return {
        error: isZh
          ? '查找相似申请者失败'
          : 'Failed to find similar applicants',
      };
    }
  }
}
