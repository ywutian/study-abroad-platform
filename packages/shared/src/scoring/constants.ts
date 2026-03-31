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

/** 学术分数配置 (针对国际生申请美本校准) */
export const ACADEMIC_CONFIG = {
  baseScore: 45,
  gpaMaxBonus: 36,
  gpaBaseline: 18, // 3.0 GPA 对应的 gpaScore (normalizedGpa/4*36)
  satMaxBonus: 18,
  actMaxBonus: 18,
  toeflMaxBonus: 10, // doubled for intl students — TOEFL is a gatekeeper
  toeflBaseline: 105, // higher bar: 105 is the neutral point
  toeflHardPenaltyThreshold: 90, // below this → hard penalty
  toeflHardPenalty: -8,
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

/** Activity tier scoring points (aligned with ActivityTemplate.tier) */
export const ACTIVITY_TIER_POINTS: Record<number, number> = {
  1: 12, // National/International Elite (RSI, TASP, etc.)
  2: 8, // State/Regional + Significant Impact
  3: 5, // School Leadership + Commitment
  4: 2, // General/Common activities
};

/** Major-to-activity category alignment map for spike detection */
export const MAJOR_ACTIVITY_MAP: Record<string, string[]> = {
  STEM: ['ACADEMIC', 'RESEARCH', 'INTERNSHIP'],
  BUSINESS: ['LEADERSHIP', 'WORK', 'INTERNSHIP'],
  HUMANITIES: ['ARTS', 'COMMUNITY_SERVICE', 'CLUB'],
  ARTS: ['ARTS', 'HOBBY'],
  ENGINEERING: ['ACADEMIC', 'RESEARCH', 'INTERNSHIP', 'CLUB'],
  SOCIAL_SCIENCE: ['COMMUNITY_SERVICE', 'LEADERSHIP', 'RESEARCH'],
};

/**
 * Education system-specific scoring adjustments.
 *
 * gpaScaleDefault — default GPA scale for this curriculum
 * toeflWeight     — multiplier on TOEFL bonus (>1 = more important, e.g. Gaokao students)
 * baseCompetitiveness — regional applicant pool strength (>1 = tougher peer competition)
 *
 * Future: load from DB so admins can tune without code deploys.
 */
export const EDUCATION_SYSTEM_CONFIG: Record<
  string,
  {
    gpaScaleDefault: number;
    toeflWeight: number;
    baseCompetitiveness: number;
  }
> = {
  IB: { gpaScaleDefault: 45, toeflWeight: 1.0, baseCompetitiveness: 1.1 },
  AP: { gpaScaleDefault: 5, toeflWeight: 0.8, baseCompetitiveness: 1.0 },
  A_LEVEL: { gpaScaleDefault: 100, toeflWeight: 0.9, baseCompetitiveness: 1.05 },
  GAOKAO: { gpaScaleDefault: 100, toeflWeight: 1.2, baseCompetitiveness: 1.15 },
  CANADIAN: { gpaScaleDefault: 100, toeflWeight: 0.7, baseCompetitiveness: 0.95 },
  AUSTRALIAN: { gpaScaleDefault: 100, toeflWeight: 0.8, baseCompetitiveness: 0.95 },
  OTHER: { gpaScaleDefault: 100, toeflWeight: 1.0, baseCompetitiveness: 1.0 },
};

/**
 * Region-level competitiveness multipliers.
 *
 * Applied to selectivity index to model quota-like dynamics.
 * >1.0 = harder odds from this region (e.g. mainland China at popular US schools).
 *
 * Future: per-school-region matrix loaded from DB.
 */
export const REGION_COMPETITIVENESS: Record<string, number> = {
  CN: 1.12,
  KR: 1.08,
  IN: 1.1,
  DEFAULT: 1.0,
};

/**
 * Application round multipliers.
 * ED/ED2 have notably higher acceptance rates; RD is the baseline (1.0).
 */
export const ROUND_MULTIPLIERS: Record<string, number> = {
  ED: 1.35,
  ED2: 1.25,
  REA: 1.15,
  SCEA: 1.15,
  EA: 1.1,
  ROLLING: 1.05,
  RD: 1.0,
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
  'vice president',
  'vp',
  'coordinator',
  'organizer',
  'chief',
  'manager',
  'supervisor',
  '社长',
  '主席',
  '队长',
  '创始人',
  '负责人',
  '班长',
  '团支书',
  '副主席',
  '副社长',
  '部长',
  '总监',
  '总编',
  '发起人',
  '组织者',
  '会长',
  '理事长',
  '学生会',
] as const;
