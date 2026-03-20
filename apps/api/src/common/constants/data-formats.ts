/**
 * Standardized intermediate data formats for all data sources.
 * All scrapers, CSV imports, and manual entries convert to these formats
 * before entering the unified validation pipeline.
 */

// ============================================
// Case Standard Format
// ============================================

export interface CaseGpa {
  value?: number;
  range?: string; // "3.7-3.9"
  scale: 4 | 5 | 100;
  weighted?: boolean;
  gpa9?: number;
  gpa10?: number;
  gpa11?: number;
  gpa12?: number;
  ucCapped?: number;
  ucUncapped?: number;
}

export interface CaseSat {
  total?: number;
  range?: string; // "1500-1550"
  math?: number;
  reading?: number;
}

export interface CaseAct {
  composite?: number;
  range?: string;
}

export interface CaseToefl {
  total?: number;
  range?: string;
}

export interface CaseIelts {
  overall?: number;
}

export interface CaseAp {
  count?: number;
  subjects?: string[];
}

export interface CaseIb {
  score?: number;
  predicted?: boolean;
}

export interface CaseTestScore {
  type: 'SAT' | 'ACT' | 'TOEFL' | 'IELTS' | 'AP' | 'IB';
  score: number;
  subscores?: Record<string, number>;
  testDate?: string; // ISO8601
}

export interface CaseActivity {
  category?: string;
  description: string;
  role?: string;
  tier?: 1 | 2 | 3 | 4;
  hoursPerWeek?: number;
  weeksPerYear?: number;
}

export interface CaseAward {
  name: string;
  level: 'school' | 'regional' | 'state' | 'national' | 'international';
  competition?: string;
  tier?: 1 | 2 | 3 | 4 | 5;
  year?: number;
}

export interface CaseEssay {
  type: string;
  prompt?: string;
  content?: string;
  promptNumber?: number;
}

export type CaseSource =
  | 'reddit'
  | 'onepoint3acres'
  | 'manual'
  | 'csv_import'
  | 'user_submit'
  | 'legacy';

export type CaseRound = 'ED' | 'ED2' | 'EA' | 'REA' | 'RD' | 'ROLLING';
export type CaseResult = 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED';

export interface CaseStandardFormat {
  // Source
  source: CaseSource;
  sourceUrl?: string;
  sourceId?: string; // Original platform ID (dedup)
  scrapedAt?: string; // ISO8601

  // School
  schoolName: string; // Raw school name
  schoolId?: string; // Resolved system ID

  // Application info
  year: number; // 2000-2100
  round?: CaseRound;
  result: CaseResult;
  major?: string;

  // Scores
  gpa?: CaseGpa;
  sat?: CaseSat;
  act?: CaseAct;
  toefl?: CaseToefl;
  ielts?: CaseIelts;
  ap?: CaseAp;
  ib?: CaseIb;

  // Structured test scores (preferred over individual score objects)
  testScores?: CaseTestScore[];

  // Extracurriculars
  activities?: CaseActivity[];
  activityList?: string;
  awards?: CaseAward[];

  // Essays
  essays?: CaseEssay[];

  // Student background
  highSchoolType?: string;
  curriculumType?: string;
  demographicTags?: string[];

  // Application context
  financialAid?: string;
  enrollmentStatus?: string;
  narrative?: string;

  // Metadata
  tags?: string[];
  visibility?: 'PRIVATE' | 'PUBLIC' | 'ANONYMOUS' | 'VERIFIED_ONLY';
}

// ============================================
// Type-safe JSON parsers for Prisma Json? fields
// ============================================

function isArray(val: unknown): val is unknown[] {
  return Array.isArray(val);
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

const VALID_TEST_TYPES = new Set(['SAT', 'ACT', 'TOEFL', 'IELTS', 'AP', 'IB']);
const VALID_AWARD_LEVELS = new Set([
  'school',
  'regional',
  'state',
  'national',
  'international',
]);

/**
 * Safely parse CaseTestScore[] from Prisma Json? field.
 * Returns empty array for invalid/null input.
 */
export function parseCaseTestScores(json: unknown): CaseTestScore[] {
  if (!json || !isArray(json)) return [];
  return json.filter((item): item is CaseTestScore => {
    if (!isObject(item)) return false;
    return (
      VALID_TEST_TYPES.has(item.type as string) &&
      typeof item.score === 'number' &&
      item.score >= 0
    );
  });
}

/**
 * Safely parse CaseActivity[] from Prisma Json? field.
 * Returns empty array for invalid/null input.
 */
export function parseCaseActivities(json: unknown): CaseActivity[] {
  if (!json || !isArray(json)) return [];
  return json.filter((item): item is CaseActivity => {
    if (!isObject(item)) return false;
    return typeof item.description === 'string' && item.description.length > 0;
  });
}

/**
 * Safely parse CaseAward[] from Prisma Json? field.
 * Returns empty array for invalid/null input.
 */
export function parseCaseAwards(json: unknown): CaseAward[] {
  if (!json || !isArray(json)) return [];
  return json.filter((item): item is CaseAward => {
    if (!isObject(item)) return false;
    return (
      typeof item.name === 'string' &&
      item.name.length > 0 &&
      VALID_AWARD_LEVELS.has(item.level as string)
    );
  });
}

// ============================================
// School Standard Format
// ============================================

export type SchoolSource =
  | 'college_scorecard'
  | 'ipeds'
  | 'bigfuture'
  | 'appily'
  | 'niche'
  | 'manual'
  | 'scraper';

export interface SchoolSatStats {
  avg?: number;
  p25?: number;
  p75?: number;
  math25?: number;
  math75?: number;
  reading25?: number;
  reading75?: number;
}

export interface SchoolActStats {
  avg?: number;
  p25?: number;
  p75?: number;
}

export interface SchoolDeadlineEntry {
  round: string;
  date: string; // ISO date
  year: number;
}

export interface SchoolStandardFormat {
  source: SchoolSource;
  sourceUrl?: string;
  scrapedAt?: string;

  name: string;
  nameZh?: string;
  country?: string;
  state?: string;
  city?: string;
  aliases?: string[];
  website?: string;
  logoUrl?: string;

  usNewsRank?: number;
  qsRank?: number;
  acceptanceRate?: number;
  intlAcceptanceRate?: number;
  intlStudentPercent?: number;
  totalEnrollment?: number;
  totalApplicants?: number;

  sat?: SchoolSatStats;
  act?: SchoolActStats;

  tuition?: number;
  roomAndBoard?: number;
  applicationFee?: number;
  averageAidPackage?: number;
  averageNetPrice?: number;
  percentNeedMet?: number;

  graduationRate?: number;
  retentionRate?: number;
  avgSalary?: number;
  salary6YrPostGrad?: number;

  testOptional?: boolean;
  acceptsCommonApp?: boolean;
  hasEarlyDecision?: boolean;

  nicheOverallGrade?: string;
  nicheSafetyGrade?: string;
  nicheLifeGrade?: string;
  nicheFoodGrade?: string;

  deadlines?: SchoolDeadlineEntry[];
}

// ============================================
// Essay Prompt Standard Format
// ============================================

export type EssayPromptSource =
  | 'official'
  | 'collegevine'
  | 'common_app'
  | 'llm_extracted'
  | 'manual';

export interface EssayPromptStandardFormat {
  source: EssayPromptSource;
  sourceUrl?: string;

  schoolName: string;
  schoolId?: string;
  year: number;
  type: string;
  prompt: string;
  promptZh?: string;

  wordLimit?: number;
  isRequired?: boolean;
  sortOrder?: number;
  aiTips?: string;
  confidence?: number;
}

// ============================================
// Quality Scoring
// ============================================

/**
 * Compute quality score for a case (0-100).
 * Used by the tiered review pipeline.
 *
 * Rebalanced to reward structured data (activities, awards, testScores)
 * alongside legacy fields (ranges, tags).
 */
export function computeCaseQualityScore(
  c: CaseStandardFormat & { isVerified?: boolean },
): number {
  let score = 0;

  // Core identity (41 pts)
  if (c.schoolName || c.schoolId) score += 15;
  if (c.year) score += 8;
  if (c.result) score += 8;
  if (c.round) score += 6;
  if (c.major) score += 4;

  // Academic scores (18 pts)
  if (
    c.gpa?.value ||
    c.gpa?.range ||
    c.gpa?.gpa9 ||
    c.gpa?.gpa10 ||
    c.gpa?.gpa11
  )
    score += 10;
  if (c.sat?.total || c.sat?.range || c.act?.composite || c.act?.range)
    score += 8;

  // Structured test scores bonus (up to 8 pts)
  if (c.testScores && c.testScores.length > 0) {
    score += 5;
    // Bonus for subscores
    if (
      c.testScores.some(
        (t) => t.subscores && Object.keys(t.subscores).length > 0,
      )
    ) {
      score += 3;
    }
  }

  // Structured activities (up to 8 pts)
  if (c.activities && c.activities.length > 0) {
    score += 5;
    // Bonus for detailed activities (with tier or hours)
    if (c.activities.some((a) => a.tier || a.hoursPerWeek)) {
      score += 3;
    }
  }

  // Structured awards (up to 6 pts)
  if (c.awards && c.awards.length > 0) {
    score += 4;
    // Bonus for competition-linked awards (with tier)
    if (c.awards.some((a) => a.tier)) {
      score += 2;
    }
  }

  // Student background (8 pts)
  if (c.highSchoolType) score += 3;
  if (c.curriculumType) score += 3;
  if (c.demographicTags && c.demographicTags.length > 0) score += 2;

  // AP/IB (4 pts)
  if (c.ap?.count || c.ib?.score) score += 4;

  // Essays & narrative (7 pts)
  if (c.essays && c.essays.length > 0) score += 5;
  if (c.narrative) score += 2;

  // Legacy fields fallback (only if structured fields not present)
  if (
    !c.activities?.length &&
    !c.awards?.length &&
    c.tags &&
    c.tags.length > 0
  ) {
    score += 2;
  }

  // Verified bonus (20% boost)
  if (c.isVerified) score = Math.min(100, Math.round(score * 1.2));

  return Math.min(100, score);
}

/**
 * Compute data completeness as a percentage of non-null optional fields.
 * Unlike quality score (which measures correctness), completeness measures how
 * many optional fields are filled, giving operators visibility into enrichment potential.
 */
export function computeCaseCompleteness(c: CaseStandardFormat): number {
  const fields = [
    { filled: !!(c.schoolName || c.schoolId), weight: 1 },
    { filled: !!c.year, weight: 1 },
    { filled: !!c.result, weight: 1 },
    { filled: !!c.round, weight: 1 },
    { filled: !!c.major, weight: 1 },
    { filled: !!(c.gpa?.value || c.gpa?.range), weight: 1 },
    { filled: !!(c.sat?.total || c.sat?.range), weight: 1 },
    { filled: !!(c.act?.composite || c.act?.range), weight: 1 },
    { filled: !!(c.toefl?.total || c.toefl?.range), weight: 1 },
    { filled: !!(c.testScores && c.testScores.length > 0), weight: 1 },
    { filled: !!(c.activities && c.activities.length > 0), weight: 1 },
    { filled: !!(c.awards && c.awards.length > 0), weight: 1 },
    { filled: !!c.highSchoolType, weight: 1 },
    { filled: !!c.curriculumType, weight: 1 },
    {
      filled: !!(c.demographicTags && c.demographicTags.length > 0),
      weight: 1,
    },
    { filled: !!(c.ap?.count || c.ib?.score), weight: 1 },
    { filled: !!(c.essays && c.essays.length > 0), weight: 1 },
    { filled: !!c.narrative, weight: 1 },
    { filled: !!c.financialAid, weight: 1 },
    { filled: !!c.enrollmentStatus, weight: 1 },
  ];

  const totalWeight = fields.reduce((sum, f) => sum + f.weight, 0);
  const filledWeight = fields.reduce(
    (sum, f) => sum + (f.filled ? f.weight : 0),
    0,
  );

  return Math.round((filledWeight / totalWeight) * 100);
}

/**
 * Review routing thresholds
 */
export const QUALITY_THRESHOLDS = {
  AUTO_APPROVE: 80,
  PENDING_REVIEW: 50,
  // Below 50 → staging table
} as const;
