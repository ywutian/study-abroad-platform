/**
 * School Lookup Helper
 *
 * Centralizes the repeated school search-by-ID-or-name pattern
 * used across 7+ tool implementations.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { normalizeSchoolName } from '../../../../common/utils/school-name.util';
import { getSchoolDisplayName } from '../../../../common/utils/locale.util';

type SchoolSelect = {
  id: string;
  name: string;
  nameZh: string | null;
  [key: string]: any;
};

@Injectable()
export class SchoolLookupHelper {
  constructor(private prisma: PrismaService) {}

  /**
   * Find school by ID or name (fuzzy), returns null if not found.
   * Uses nameNorm index first, then falls back to fuzzy search.
   */
  async findSchool<T extends Record<string, boolean>>(
    schoolId?: string,
    schoolName?: string,
    select?: T,
  ): Promise<SchoolSelect | null> {
    const defaultSelect = {
      id: true,
      name: true,
      nameZh: true,
    };
    const selectFields = select || defaultSelect;

    if (schoolId) {
      return this.prisma.school.findUnique({
        where: { id: schoolId },
        select: selectFields as any,
      });
    }

    if (schoolName) {
      // Try exact normalized name first (uses UNIQUE index)
      const norm = normalizeSchoolName(schoolName);
      let school = await this.prisma.school.findUnique({
        where: { nameNorm: norm },
        select: selectFields as any,
      });
      if (school) return school;

      // Fallback: fuzzy search
      const searchTerm = schoolName.trim();
      school = await this.prisma.school.findFirst({
        where: {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { nameZh: { contains: searchTerm, mode: 'insensitive' } },
            { aliases: { has: searchTerm } },
            {
              aliases: {
                hasSome: [
                  searchTerm,
                  searchTerm.toUpperCase(),
                  searchTerm.toLowerCase(),
                ],
              },
            },
          ],
        },
        select: selectFields as any,
      });
      return school;
    }

    return null;
  }

  /**
   * Get display name for a school based on locale.
   */
  displayName(
    school: { name: string; nameZh?: string | null },
    locale: string,
  ): string {
    return getSchoolDisplayName(school, locale);
  }

  /**
   * Fuzzy search for schools with relevance scoring.
   */
  async searchSchools(args: {
    query?: string;
    rankRange?: string;
    maxTuition?: number;
    state?: string;
  }) {
    const where: any = {};

    if (args.query) {
      const searchTerm = args.query.trim();
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { nameZh: { contains: searchTerm, mode: 'insensitive' } },
        { aliases: { has: searchTerm } },
        {
          aliases: {
            hasSome: [
              searchTerm,
              searchTerm.toUpperCase(),
              searchTerm.toLowerCase(),
            ],
          },
        },
      ];
    }

    if (args.rankRange) {
      const [min, max] = args.rankRange.split('-').map(Number);
      where.usNewsRank = { gte: min, lte: max };
    }

    if (args.maxTuition) {
      where.tuition = { lte: args.maxTuition };
    }

    if (args.state) {
      where.state = args.state;
    }

    return this.prisma.school.findMany({
      where,
      take: 20,
      orderBy: { usNewsRank: 'asc' },
      select: {
        id: true,
        name: true,
        nameZh: true,
        state: true,
        usNewsRank: true,
        acceptanceRate: true,
        tuition: true,
        aliases: true,
      },
    });
  }

  /**
   * Sort schools by relevance to search term.
   */
  sortByRelevance(
    schools: Array<{
      name: string;
      nameZh: string | null;
      usNewsRank: number | null;
      aliases: string[];
      [key: string]: any;
    }>,
    searchTerm: string,
  ) {
    const lowerSearch = searchTerm.toLowerCase();

    return [...schools].sort((a, b) => {
      const scoreA = this.getRelevanceScore(a, lowerSearch, searchTerm);
      const scoreB = this.getRelevanceScore(b, lowerSearch, searchTerm);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return (a.usNewsRank ?? 9999) - (b.usNewsRank ?? 9999);
    });
  }

  private getRelevanceScore(
    school: {
      name: string;
      nameZh: string | null;
      usNewsRank: number | null;
      aliases: string[];
    },
    lowerSearch: string,
    originalSearch: string,
  ): number {
    let score = 0;

    if (school.aliases?.some((a) => a.toLowerCase() === lowerSearch)) {
      score += 100;
    }

    if (school.name.toLowerCase().startsWith(lowerSearch)) {
      score += 80;
    } else if (school.nameZh?.startsWith(originalSearch)) {
      score += 80;
    }

    if (score < 80) {
      if (school.name.toLowerCase().includes(lowerSearch)) {
        score += 60;
      } else if (school.nameZh?.includes(originalSearch)) {
        score += 60;
      }
    }

    if (school.usNewsRank) {
      if (school.usNewsRank <= 20) score += 10;
      else if (school.usNewsRank <= 50) score += 5;
    }

    return score;
  }
}
