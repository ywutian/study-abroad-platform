/**
 * 通用导入数据标准化工具
 * 从 scripts/import-cases-csv.ts 提取并增强
 */

import { PrismaClient } from '@prisma/client';

// 学校名缩写映射表
export const schoolNameMap: Record<string, string> = {
  mit: 'Massachusetts Institute of Technology',
  stanford: 'Stanford University',
  harvard: 'Harvard University',
  yale: 'Yale University',
  princeton: 'Princeton University',
  columbia: 'Columbia University',
  upenn: 'University of Pennsylvania',
  penn: 'University of Pennsylvania',
  duke: 'Duke University',
  northwestern: 'Northwestern University',
  caltech: 'California Institute of Technology',
  uchicago: 'University of Chicago',
  jhu: 'Johns Hopkins University',
  cornell: 'Cornell University',
  brown: 'Brown University',
  dartmouth: 'Dartmouth College',
  rice: 'Rice University',
  vanderbilt: 'Vanderbilt University',
  'notre dame': 'University of Notre Dame',
  washu: 'Washington University in St. Louis',
  emory: 'Emory University',
  georgetown: 'Georgetown University',
  ucb: 'University of California, Berkeley',
  berkeley: 'University of California, Berkeley',
  ucla: 'University of California, Los Angeles',
  usc: 'University of Southern California',
  nyu: 'New York University',
  cmu: 'Carnegie Mellon University',
  umich: 'University of Michigan',
  gatech: 'Georgia Institute of Technology',
  uiuc: 'University of Illinois Urbana-Champaign',
  purdue: 'Purdue University',
  utaustin: 'University of Texas at Austin',
  uw: 'University of Washington',
  bu: 'Boston University',
  bc: 'Boston College',
  neu: 'Northeastern University',
  tufts: 'Tufts University',
  williams: 'Williams College',
  amherst: 'Amherst College',
  pomona: 'Pomona College',
  swarthmore: 'Swarthmore College',
  wellesley: 'Wellesley College',
  bowdoin: 'Bowdoin College',
  middlebury: 'Middlebury College',
  carleton: 'Carleton College',
};

/**
 * 标准化学校名称（缩写 → 全称）
 */
export function normalizeSchoolName(name: string): string {
  const lower = name.toLowerCase().trim();
  return schoolNameMap[lower] || name.trim();
}

/**
 * 标准化录取结果（支持中英文和缩写）
 */
export function normalizeResult(
  result: string,
): 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED' {
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
  return 'ADMITTED';
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
    'SUPPLEMENT',
    'WHY_SCHOOL',
    'WHY_US',
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
    WHY: 'WHY_US',
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
}
