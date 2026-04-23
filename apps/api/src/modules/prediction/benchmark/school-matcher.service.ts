import { Injectable } from '@nestjs/common';
import { normalizeSchoolName as normalizeSchoolNameForDb } from '@study-abroad/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { resolveSchoolAlias } from '../../../common/constants/school-aliases';

export type SchoolMatchType =
  | 'id'
  | 'exact'
  | 'normalized'
  | 'alias'
  | 'substring';

export type SuggestedSchool = { id: string; name: string };

export type SchoolIndex = {
  allSchools: Array<{ id: string; name: string; nameNorm: string }>;
  byNorm: Map<string, { id: string; name: string; nameNorm: string }>;
};

export type SchoolMatch =
  | {
      kind: 'ok';
      school: { id: string; name: string; nameNorm: string };
      matchType: SchoolMatchType;
    }
  | { kind: 'ambiguous'; candidates: SuggestedSchool[] }
  | { kind: 'none' };

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost,
      );
    }
  }
  return dp[m]![n]!;
}

@Injectable()
export class SchoolMatcherService {
  constructor(private readonly prisma: PrismaService) {}

  async loadSchoolIndex(): Promise<SchoolIndex> {
    const allSchools = await this.prisma.school.findMany({
      select: { id: true, name: true, nameNorm: true },
    });
    const byNorm = new Map<string, (typeof allSchools)[number]>();
    for (const school of allSchools) byNorm.set(school.nameNorm, school);
    return { allSchools, byNorm };
  }

  suggestSchools(
    schoolName: string | undefined,
    schoolIndex: SchoolIndex,
    limit = 5,
  ): SuggestedSchool[] {
    if (!schoolName?.trim()) return [];
    const norm = normalizeSchoolNameForDb(schoolName);
    const lower = schoolName.toLowerCase();
    const scored = schoolIndex.allSchools.map((school) => {
      const dNorm = levenshtein(norm, school.nameNorm);
      const dName = levenshtein(lower, school.name.toLowerCase());
      const d = Math.min(dNorm, dName);
      let bonus = 0;
      if (school.nameNorm.includes(norm) || norm.includes(school.nameNorm))
        bonus = -3;
      if (
        lower.includes(school.name.toLowerCase()) ||
        school.name.toLowerCase().includes(lower)
      ) {
        bonus -= 2;
      }
      return { school, score: d + bonus };
    });
    scored.sort((a, b) => a.score - b.score);

    const out: SuggestedSchool[] = [];
    const seen = new Set<string>();
    for (const { school } of scored) {
      if (seen.has(school.id)) continue;
      seen.add(school.id);
      out.push({ id: school.id, name: school.name });
      if (out.length >= limit) break;
    }
    return out;
  }

  matchSchool(
    input: { schoolName?: string; schoolId?: string },
    schoolIndex: SchoolIndex,
  ): SchoolMatch {
    const { schoolName, schoolId } = input;

    if (schoolId) {
      const school = schoolIndex.allSchools.find(
        (item) => item.id === schoolId,
      );
      if (school) return { kind: 'ok', school, matchType: 'id' };
    }
    if (!schoolName?.trim()) return { kind: 'none' };

    const exact = schoolIndex.allSchools.find(
      (item) => item.name === schoolName,
    );
    if (exact) return { kind: 'ok', school: exact, matchType: 'exact' };

    const norm = normalizeSchoolNameForDb(schoolName);
    const normHit = schoolIndex.byNorm.get(norm);
    if (normHit)
      return { kind: 'ok', school: normHit, matchType: 'normalized' };

    const aliased = resolveSchoolAlias(schoolName);
    if (aliased && aliased !== schoolName) {
      const aliasedNorm = normalizeSchoolNameForDb(aliased);
      const aliasedHit = schoolIndex.byNorm.get(aliasedNorm);
      if (aliasedHit)
        return { kind: 'ok', school: aliasedHit, matchType: 'alias' };
    }

    const lower = schoolName.toLowerCase();
    const substringCandidates = schoolIndex.allSchools.filter((school) => {
      const schoolNameLower = school.name.toLowerCase();
      return (
        schoolNameLower === lower ||
        lower.includes(schoolNameLower) ||
        schoolNameLower.includes(lower)
      );
    });

    if (substringCandidates.length > 1) {
      substringCandidates.sort((a, b) => a.name.length - b.name.length);
      return {
        kind: 'ambiguous',
        candidates: substringCandidates
          .slice(0, 8)
          .map((school) => ({ id: school.id, name: school.name })),
      };
    }

    if (substringCandidates.length === 1) {
      return {
        kind: 'ok',
        school: substringCandidates[0]!,
        matchType: 'substring',
      };
    }

    return { kind: 'none' };
  }
}
