/**
 * Scoring Constants
 *
 * Configurable weights and lookup tables for the unified scoring system.
 */

/** 综合分数权重 */
export const SCORING_WEIGHTS = {
  academic: 0.5,
  activity: 0.3,
  award: 0.2,
} as const;

/** 学术分数配置 */
export const ACADEMIC_CONFIG = {
  baseScore: 50,
  gpaMaxBonus: 40,
  gpaBaseline: 20, // 3.0 GPA 对应的 gpaScore
  satMaxBonus: 15,
  actMaxBonus: 15,
  toeflMaxBonus: 5,
  toeflBaseline: 100,
} as const;

/** 竞赛层级分值映射 (与 Competition.tier 对应) */
export const TIER_POINTS: Record<number, number> = {
  5: 25, // IMO, IPhO, ISEF, Regeneron STS
  4: 15, // USAMO, USABO, NSDA Nationals, YoungArts
  3: 8, // AIME, PhysicsBowl, Science Olympiad, NEC
  2: 4, // AMC 12, FBLA, USACO Silver, VEX
  1: 2, // AMC 8, NHS, National Latin Exam
};

/** 无竞赛关联时按 AwardLevel 的默认分值 (与 COMPETITION_DATABASE.md 第 6 节一致) */
export const LEVEL_POINTS: Record<string, number> = {
  INTERNATIONAL: 20,
  NATIONAL: 15,
  STATE: 8,
  REGIONAL: 5,
  SCHOOL: 2,
};

/** 领导力角色关键词（不区分大小写匹配） */
export const LEADERSHIP_KEYWORDS = [
  'president',
  'founder',
  'captain',
  'director',
  'head',
  'chair',
  'editor-in-chief',
  'lead',
  'co-founder',
  '社长',
  '主席',
  '队长',
  '创始人',
  '负责人',
] as const;
