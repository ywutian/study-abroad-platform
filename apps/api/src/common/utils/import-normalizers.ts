/**
 * 通用导入数据标准化工具
 * 从 scripts/import-cases-csv.ts 提取并增强
 */

import { PrismaClient } from '@prisma/client';
import {
  SCHOOL_ALIASES,
  resolveSchoolAlias,
} from '../constants/school-aliases';

/**
 * @deprecated Use `SCHOOL_ALIASES` from `common/constants/school-aliases` directly.
 */
export const schoolNameMap = SCHOOL_ALIASES;

/**
 * 标准化学校名称（缩写 → 全称）
 */
export function normalizeSchoolName(name: string): string {
  return resolveSchoolAlias(name);
}

/**
 * 标准化录取结果（支持中英文和缩写）
 * Returns null for unrecognized values instead of silently defaulting to ADMITTED.
 */
export function normalizeResult(
  result: string,
): 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED' | null {
  const r = result.toLowerCase().trim();
  if (
    ['admitted', 'ad', 'offer', 'accept', 'accepted', '录取', '录了'].includes(
      r,
    )
  ) {
    return 'ADMITTED';
  }
  if (
    [
      'rejected',
      'rej',
      'reject',
      'deny',
      'denied',
      '拒绝',
      '拒了',
      '被拒',
    ].includes(r)
  ) {
    return 'REJECTED';
  }
  if (['waitlisted', 'wl', 'waitlist', '候补', '等待'].includes(r)) {
    return 'WAITLISTED';
  }
  if (['deferred', 'defer', '延期'].includes(r)) {
    return 'DEFERRED';
  }
  return null;
}

/**
 * 标准化申请轮次
 */
export function normalizeRound(round: string): string {
  if (!round) return '';
  const r = round.toLowerCase().trim();
  if (['ed', 'ed1', '早申'].includes(r)) return 'ED';
  if (['ed2'].includes(r)) return 'ED2';
  if (['ea', '早行动'].includes(r)) return 'EA';
  if (['rea', 'scea', '限制性早申'].includes(r)) return 'REA';
  if (['rd', '常规', '常规申请'].includes(r)) return 'RD';
  return round.toUpperCase();
}

/**
 * 标准化文书类型
 */
export function normalizeEssayType(type: string): string | null {
  if (!type) return null;
  const t = type.toUpperCase().trim().replace(/\s+/g, '_');
  const validTypes = [
    'COMMON_APP',
    'UC',
    'MAIN',
    'SUPPLEMENTAL',
    'WHY_SCHOOL',
    'SHORT_ANSWER',
    'ACTIVITY',
    'OPTIONAL',
    'OTHER',
  ];
  if (validTypes.includes(t)) return t;

  // 常见别名
  const aliases: Record<string, string> = {
    COMMONAPP: 'COMMON_APP',
    'COMMON APP': 'COMMON_APP',
    SUP: 'SUPPLEMENTAL',
    SUPP: 'SUPPLEMENTAL',
    WHY: 'WHY_SCHOOL',
    SUPPLEMENT: 'SUPPLEMENTAL',
    WHY_US: 'WHY_SCHOOL',
    SHORT: 'SHORT_ANSWER',
  };
  return aliases[t] || 'OTHER';
}

/**
 * 根据学校名查找学校 ID
 * 支持模糊匹配：缩写、英文名、中文名
 */
export async function resolveSchoolId(
  prisma: Pick<PrismaClient, 'school'>,
  name: string,
): Promise<{ id: string; name: string } | null> {
  const normalizedName = normalizeSchoolName(name);

  const school = await (prisma.school as any).findFirst({
    where: {
      OR: [
        { name: { equals: normalizedName, mode: 'insensitive' } },
        { name: { contains: normalizedName, mode: 'insensitive' } },
        { nameZh: { contains: name.trim(), mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true },
  });

  return school;
}

/**
 * 处理标签字符串（分号分隔 → 数组，去重）
 */
export function parseTags(tagsStr: string): string[] {
  if (!tagsStr) return [];
  return [
    ...new Set(
      tagsStr
        .split(';')
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ];
}

/**
 * 批量导入结果统计
 */
export interface BatchImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; school: string; message: string }>;
  importBatchId?: string;
}

// ============ Enrichment Field Parsers ============

import type {
  CaseActivity,
  CaseAward,
  CaseTestScore,
} from '../constants/data-formats';
import { HighSchoolType, EducationSystem } from '@prisma/client';

const ACTIVITY_CATEGORY_KEYWORDS: Record<string, string> = {
  research: 'RESEARCH',
  lab: 'RESEARCH',
  contest: 'ACADEMIC',
  competition: 'ACADEMIC',
  olympiad: 'ACADEMIC',
  math: 'ACADEMIC',
  science: 'ACADEMIC',
  club: 'CLUB',
  debate: 'CLUB',
  mun: 'CLUB',
  sport: 'ATHLETICS',
  track: 'ATHLETICS',
  swim: 'ATHLETICS',
  basketball: 'ATHLETICS',
  football: 'ATHLETICS',
  soccer: 'ATHLETICS',
  tennis: 'ATHLETICS',
  volunteer: 'COMMUNITY_SERVICE',
  community: 'COMMUNITY_SERVICE',
  tutor: 'COMMUNITY_SERVICE',
  music: 'ARTS',
  orchestra: 'ARTS',
  band: 'ARTS',
  choir: 'ARTS',
  art: 'ARTS',
  dance: 'ARTS',
  theater: 'ARTS',
  theatre: 'ARTS',
  intern: 'WORK',
  work: 'WORK',
  job: 'WORK',
  business: 'ENTREPRENEURSHIP',
  startup: 'ENTREPRENEURSHIP',
  found: 'ENTREPRENEURSHIP',
  president: 'LEADERSHIP',
  captain: 'LEADERSHIP',
  lead: 'LEADERSHIP',
  editor: 'LEADERSHIP',
  publish: 'WRITING',
  journal: 'WRITING',
  newspaper: 'WRITING',
  blog: 'WRITING',
};

/**
 * Parse semicolon/newline-separated activity text into structured CaseActivity[].
 * Supports formats: "Category - Description (Role)" or plain description.
 */
export function parseActivitiesText(text: string): CaseActivity[] {
  if (!text) return [];
  const lines = text
    .split(/[;\n]/)
    .map((l) => l.trim())
    .filter(Boolean);

  return lines.map((line) => {
    // Try "Category - Description (Role)" format
    const match = line.match(/^([^-–]+)\s*[-–]\s*(.+?)(?:\s*\((.+?)\))?$/);
    if (match) {
      const categoryHint = match[1].trim().toLowerCase();
      const description = match[2].trim();
      const role = match[3]?.trim();
      const category =
        inferActivityCategory(categoryHint) ||
        inferActivityCategory(description);
      return { category, description, role };
    }

    // Plain description — infer category from keywords
    return {
      category: inferActivityCategory(line),
      description: line,
    };
  });
}

function inferActivityCategory(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const [keyword, category] of Object.entries(
    ACTIVITY_CATEGORY_KEYWORDS,
  )) {
    if (lower.includes(keyword)) return category;
  }
  return undefined;
}

const AWARD_LEVEL_KEYWORDS: Record<string, CaseAward['level']> = {
  international: 'international',
  global: 'international',
  world: 'international',
  national: 'national',
  usamo: 'national',
  usabo: 'national',
  usaco: 'national',
  isef: 'international',
  imo: 'international',
  state: 'state',
  regional: 'regional',
  school: 'school',
};

/**
 * Parse semicolon/newline-separated award text into structured CaseAward[].
 */
export function parseAwardsText(text: string): CaseAward[] {
  if (!text) return [];
  const lines = text
    .split(/[;\n]/)
    .map((l) => l.trim())
    .filter(Boolean);

  return lines.map((line) => {
    const level = inferAwardLevel(line);
    return { name: line, level };
  });
}

function inferAwardLevel(text: string): CaseAward['level'] {
  const lower = text.toLowerCase();
  for (const [keyword, level] of Object.entries(AWARD_LEVEL_KEYWORDS)) {
    if (lower.includes(keyword)) return level;
  }
  return 'school';
}

/**
 * Convert range strings (e.g. "1500-1550") into structured CaseTestScore[].
 */
export function parseTestScoresFromRanges(
  sat?: string,
  act?: string,
  toefl?: string,
): CaseTestScore[] {
  const scores: CaseTestScore[] = [];

  if (sat) {
    const avg = parseRangeAvg(sat);
    if (avg) scores.push({ type: 'SAT', score: avg });
  }
  if (act) {
    const avg = parseRangeAvg(act);
    if (avg) scores.push({ type: 'ACT', score: avg });
  }
  if (toefl) {
    const avg = parseRangeAvg(toefl);
    if (avg) scores.push({ type: 'TOEFL', score: avg });
  }

  return scores;
}

function parseRangeAvg(range: string): number | null {
  const match = range.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/);
  if (match) {
    return Math.round((parseFloat(match[1]) + parseFloat(match[2])) / 2);
  }
  const single = parseFloat(range);
  return isNaN(single) ? null : Math.round(single);
}

const DEMOGRAPHIC_TAGS = new Set([
  'first_gen',
  'legacy',
  'athlete',
  'recruited',
  'urm',
  'international',
  'low_income',
  'rural',
  'military',
]);

/**
 * Extract demographic tags from a mixed tags array, returning demographics and remaining tags.
 */
export function extractDemographicTags(tags: string[]): {
  demographics: string[];
  remaining: string[];
} {
  const demographics: string[] = [];
  const remaining: string[] = [];

  for (const tag of tags) {
    if (DEMOGRAPHIC_TAGS.has(tag.toLowerCase().trim())) {
      demographics.push(tag.toLowerCase().trim());
    } else {
      remaining.push(tag);
    }
  }

  return { demographics, remaining };
}

const HS_TYPE_MAP: Record<string, HighSchoolType> = {
  public_school: HighSchoolType.PUBLIC_US,
  public_us: HighSchoolType.PUBLIC_US,
  private_school: HighSchoolType.PRIVATE_US,
  private_us: HighSchoolType.PRIVATE_US,
  boarding: HighSchoolType.BOARDING_US,
  boarding_us: HighSchoolType.BOARDING_US,
  china_intl: HighSchoolType.INTL_CN,
  intl_cn: HighSchoolType.INTL_CN,
  chinese_intl: HighSchoolType.INTL_CN,
  public_cn: HighSchoolType.PUBLIC_CN,
  private_cn: HighSchoolType.PRIVATE_CN,
  intl_other: HighSchoolType.INTL_OTHER,
  public_other: HighSchoolType.PUBLIC_OTHER,
  private_other: HighSchoolType.PRIVATE_OTHER,
};

/**
 * Extract high school type from tags array.
 */
export function extractHighSchoolType(tags: string[]): {
  hsType: HighSchoolType | null;
  remaining: string[];
} {
  let hsType: HighSchoolType | null = null;
  const remaining: string[] = [];

  for (const tag of tags) {
    const key = tag.toLowerCase().trim();
    if (HS_TYPE_MAP[key]) {
      hsType = HS_TYPE_MAP[key];
    } else {
      remaining.push(tag);
    }
  }

  return { hsType, remaining };
}

const CURRICULUM_MAP: Record<string, EducationSystem> = {
  ib: EducationSystem.IB,
  ib_student: EducationSystem.IB,
  ap: EducationSystem.AP,
  ap_curriculum: EducationSystem.AP,
  a_level: EducationSystem.A_LEVEL,
  a_levels: EducationSystem.A_LEVEL,
  gaokao: EducationSystem.GAOKAO,
  canadian: EducationSystem.CANADIAN,
  australian: EducationSystem.AUSTRALIAN,
  other: EducationSystem.OTHER,
};

/**
 * Extract curriculum type from tags array.
 */
export function extractCurriculumType(tags: string[]): {
  curriculum: EducationSystem | null;
  remaining: string[];
} {
  let curriculum: EducationSystem | null = null;
  const remaining: string[] = [];

  for (const tag of tags) {
    const key = tag.toLowerCase().trim();
    if (CURRICULUM_MAP[key]) {
      curriculum = CURRICULUM_MAP[key];
    } else {
      remaining.push(tag);
    }
  }

  return { curriculum, remaining };
}

/**
 * Normalize a high school type string (from batch import) to HighSchoolType enum.
 */
export function normalizeHighSchoolType(value: string): HighSchoolType | null {
  if (!value) return null;
  const key = value.toLowerCase().trim();
  return (
    HS_TYPE_MAP[key] ||
    (Object.values(HighSchoolType).includes(value as any)
      ? (value as HighSchoolType)
      : null)
  );
}

/**
 * Normalize a curriculum string (from batch import) to EducationSystem enum.
 */
export function normalizeCurriculum(value: string): EducationSystem | null {
  if (!value) return null;
  const key = value.toLowerCase().trim();
  return (
    CURRICULUM_MAP[key] ||
    (Object.values(EducationSystem).includes(value as any)
      ? (value as EducationSystem)
      : null)
  );
}
