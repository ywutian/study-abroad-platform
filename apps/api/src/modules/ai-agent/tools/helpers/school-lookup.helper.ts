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
import {
  compareSchoolsByCatalogRank,
  getCatalogRanking,
  getCoreRankingForRange,
  normalizeRankingListSelection,
} from '../../../school/school-ranking-catalog';

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

    // governance: system-scope — School is published institution data
    // (name/aliases/rank/tuition/state) with no User or Profile relation; every
    // lookup below is keyed by a school id or name from the tool args.
    if (schoolId) {
      return this.prisma.school.findUnique({
        where: { id: schoolId },
        select: selectFields as any,
      }) as Promise<SchoolSelect | null>;
    }

    if (schoolName) {
      // Try exact normalized name first (uses UNIQUE index)
      const norm = normalizeSchoolName(schoolName);
      // governance: system-scope — School, no User relation (see findSchool above)
      const school = await (this.prisma.school.findUnique({
        where: { nameNorm: norm },
        select: selectFields as any,
      }) as Promise<SchoolSelect | null>);
      if (school) return school;

      // Fallback: fuzzy search
      const searchTerm = schoolName.trim();
      // governance: system-scope — School, no User relation (see findSchool above)
      return this.prisma.school.findFirst({
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
      }) as Promise<SchoolSelect | null>;
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
    rankingList?: string;
  }) {
    const where: any = {};
    const rankingList = normalizeRankingListSelection(args.rankingList);

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

    const rankRange = this.parseRankRange(args.rankRange);

    if (args.maxTuition) {
      where.tuition = { lte: args.maxTuition };
    }

    if (args.state) {
      where.state = args.state;
    }

    // governance: system-scope — School is published institution data with no
    // User relation; the filters are tuition/state/name from the tool args.
    const schools = await this.prisma.school.findMany({
      where,
      orderBy: { usNewsRank: 'asc' },
      select: {
        id: true,
        name: true,
        nameZh: true,
        state: true,
        institutionType: true,
        usNewsRank: true,
        acceptanceRate: true,
        tuition: true,
        aliases: true,
        rankings: {
          select: {
            source: true,
            list: true,
            rank: true,
            year: true,
            sourceUrl: true,
          },
        },
      },
    });

    const filtered = rankRange
      ? schools.filter((school) => {
          const ranking =
            rankingList === 'US_NEWS_CORE'
              ? getCoreRankingForRange(school)
              : getCatalogRanking(school, rankingList);
          return (
            ranking &&
            ranking.rank >= rankRange.min &&
            ranking.rank <= rankRange.max
          );
        })
      : schools;

    return filtered
      .sort((a, b) => compareSchoolsByCatalogRank(a, b, rankingList))
      .slice(0, 20)
      .map((school) => ({
        ...school,
        displayRanking: getCatalogRanking(school, rankingList),
      }));
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
      return compareSchoolsByCatalogRank(a, b);
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

    const ranking = getCatalogRanking(school);
    if (ranking) {
      if (ranking.rank <= 20) score += 10;
      else if (ranking.rank <= 50) score += 5;
    }

    return score;
  }

  private parseRankRange(
    rankRange?: string,
  ): { min: number; max: number } | null {
    if (!rankRange) return null;
    const [min, max] = rankRange.split('-').map(Number);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
    return { min: Math.max(1, min), max: Math.max(min, max) };
  }
}
