// GPA 区间化（用于脱敏展示）
export const GPA_RANGES = [
  { min: 0, max: 2.0, label: '< 2.0' },
  { min: 2.0, max: 2.5, label: '2.0 - 2.5' },
  { min: 2.5, max: 3.0, label: '2.5 - 3.0' },
  { min: 3.0, max: 3.3, label: '3.0 - 3.3' },
  { min: 3.3, max: 3.5, label: '3.3 - 3.5' },
  { min: 3.5, max: 3.7, label: '3.5 - 3.7' },
  { min: 3.7, max: 3.9, label: '3.7 - 3.9' },
  { min: 3.9, max: 4.0, label: '3.9 - 4.0' },
  { min: 4.0, max: 5.0, label: '4.0+' },
] as const;

// SAT 区间化
export const SAT_RANGES = [
  { min: 400, max: 1000, label: '< 1000' },
  { min: 1000, max: 1100, label: '1000 - 1100' },
  { min: 1100, max: 1200, label: '1100 - 1200' },
  { min: 1200, max: 1300, label: '1200 - 1300' },
  { min: 1300, max: 1400, label: '1300 - 1400' },
  { min: 1400, max: 1450, label: '1400 - 1450' },
  { min: 1450, max: 1500, label: '1450 - 1500' },
  { min: 1500, max: 1550, label: '1500 - 1550' },
  { min: 1550, max: 1600, label: '1550 - 1600' },
] as const;

// ACT 区间化
export const ACT_RANGES = [
  { min: 1, max: 20, label: '< 20' },
  { min: 20, max: 24, label: '20 - 24' },
  { min: 24, max: 28, label: '24 - 28' },
  { min: 28, max: 32, label: '28 - 32' },
  { min: 32, max: 34, label: '32 - 34' },
  { min: 34, max: 36, label: '34 - 36' },
] as const;

// TOEFL 区间化
export const TOEFL_RANGES = [
  { min: 0, max: 80, label: '< 80' },
  { min: 80, max: 90, label: '80 - 90' },
  { min: 90, max: 100, label: '90 - 100' },
  { min: 100, max: 105, label: '100 - 105' },
  { min: 105, max: 110, label: '105 - 110' },
  { min: 110, max: 120, label: '110 - 120' },
] as const;

// 学校档位
export const SCHOOL_TIERS = {
  TOP_10: 'Top 10',
  TOP_20: 'Top 20',
  TOP_30: 'Top 30',
  TOP_50: 'Top 50',
  TOP_100: 'Top 100',
  OTHER: 'Other',
} as const;

// 预算档位
export const BUDGET_TIERS = {
  LOW: { label: '< $30,000/年', labelZh: '< 3万美元/年' },
  MEDIUM: { label: '$30,000 - $50,000/年', labelZh: '3-5万美元/年' },
  HIGH: { label: '$50,000 - $70,000/年', labelZh: '5-7万美元/年' },
  UNLIMITED: { label: '> $70,000/年', labelZh: '> 7万美元/年' },
} as const;

// 活动类别
export const ACTIVITY_CATEGORIES = {
  ACADEMIC: { label: 'Academic', labelZh: '学术' },
  ARTS: { label: 'Arts', labelZh: '艺术' },
  ATHLETICS: { label: 'Athletics', labelZh: '体育' },
  COMMUNITY_SERVICE: { label: 'Community Service', labelZh: '社区服务' },
  LEADERSHIP: { label: 'Leadership', labelZh: '领导力' },
  WORK: { label: 'Work Experience', labelZh: '工作经验' },
  RESEARCH: { label: 'Research', labelZh: '科研' },
  OTHER: { label: 'Other', labelZh: '其他' },
} as const;

// 奖项级别
export const AWARD_LEVELS = {
  SCHOOL: { label: 'School', labelZh: '校级' },
  REGIONAL: { label: 'Regional', labelZh: '地区级' },
  STATE: { label: 'State/Provincial', labelZh: '省/州级' },
  NATIONAL: { label: 'National', labelZh: '国家级' },
  INTERNATIONAL: { label: 'International', labelZh: '国际级' },
} as const;

// 年级
export const GRADES = {
  FRESHMAN: { label: 'Freshman (9th)', labelZh: '高一' },
  SOPHOMORE: { label: 'Sophomore (10th)', labelZh: '高二' },
  JUNIOR: { label: 'Junior (11th)', labelZh: '高三' },
  SENIOR: { label: 'Senior (12th)', labelZh: '高四/Gap Year' },
  GAP_YEAR: { label: 'Gap Year', labelZh: 'Gap Year' },
} as const;

// 举报原因
export const REPORT_REASONS = {
  SPAM: { label: 'Spam', labelZh: '垃圾信息' },
  HARASSMENT: { label: 'Harassment', labelZh: '骚扰' },
  INAPPROPRIATE: { label: 'Inappropriate Content', labelZh: '不当内容' },
  FAKE_INFO: { label: 'Fake Information', labelZh: '虚假信息' },
  OTHER: { label: 'Other', labelZh: '其他' },
} as const;

// API 错误码
export const ERROR_CODES = {
  // Auth
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',

  // Permission
  FORBIDDEN: 'FORBIDDEN',
  NOT_VERIFIED_USER: 'NOT_VERIFIED_USER',

  // Resource
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',

  // Rate Limit
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Chat
  MUTUAL_FOLLOW_REQUIRED: 'MUTUAL_FOLLOW_REQUIRED',
  USER_BLOCKED: 'USER_BLOCKED',

  // Server
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

// 支持的语言
export const SUPPORTED_LOCALES = ['en', 'zh'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'zh';

// 积分系统开关 — 已迁移至 SystemSetting (由管理员在运行时配置)
// 旧常量保留为向后兼容的默认值，实际控制逻辑在 PointsConfigService
/** @deprecated Use PointsConfigService.isEnabled() instead */
export const POINTS_ENABLED = false;

// 分页默认值
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * Max schools a single batch operation may target in one request — shared by the
 * prediction endpoint (`POST /predictions`) and timeline batch generation
 * (`POST /timelines/generate`). This is the single source of truth for that cap:
 * the backend DTOs enforce it (`@ArrayMaxSize`) and the frontend pre-validates
 * against it so an over-limit selection shows a toast instead of a silent 400.
 *
 * Set to 100 to comfortably cover a full school list plus UC cross-campus
 * expansion (≤9) while still bounding cost. The served prediction path is the
 * deterministic counselor engine (no per-school LLM, internal CONCURRENCY=3), so
 * 100 schools complete in seconds. Previously this was an unintentional 10
 * (prediction) vs 50 (timeline) divergence — the root cause of the over-limit
 * 400s when a user predicted a large school list.
 *
 * This is a guard on the INCOMING request array, not a hard served-count ceiling:
 * `POST /predictions` expands a UC selection to the user's owned campuses AFTER
 * DTO validation, so the effective served count can reach ~MAX + (UC campuses − 1)
 * ≈ 108. That is intended headroom (every expanded id is owned, so it never 400s).
 *
 * Tripwire before raising this much further: one run holds a per-profile lock
 * (`runPredictionWithLock`, TTL ≈ 120s, not renewed) and runs under the ~120s AI
 * request timeout. At 100 the deterministic path finishes in ~7–15s (wide margin),
 * but a substantially higher cap (or a per-school I/O regression) would erode it —
 * add lock renewal / raise the TTL above the realistic worst-case run time first.
 */
export const MAX_SCHOOLS_PER_BATCH = 100;

/**
 * Per-field array caps for user-submitted multi-value inputs. Each is the single
 * source of truth shared by the backend DTO (`@ArrayMaxSize`) and the client(s):
 * the client pre-validates and shows a graceful message instead of letting an
 * over-limit array hit the validation pipe and 400 silently (the #396 bug class).
 *
 * Two flavours:
 *  - Fixed-set / roster-derived sources → the cap is sized to the source so the
 *    full set is always valid (regions/majors match the 15-chip mobile pickers;
 *    invitees match the ≤100 team-size ceiling). No client guard needed.
 *  - Free-form comma inputs → the cap is the deliberate product limit; the client
 *    must pre-validate and surface an over-limit toast (no silent truncation).
 */
// Recommendation preferences — mobile renders 15 fixed chips for each, so the cap
// matches the picker (raised from an unintentional 10 that 400'd a full selection).
export const MAX_PREFERRED_REGIONS = 15;
export const MAX_PREFERRED_MAJORS = 15;
// Team recruitment / community-context — free-form comma inputs; caps are product
// limits and the client must guard against them.
export const MAX_RECRUITMENT_ROLES = 8; // offerRoles, needRoles
export const MAX_RECRUITMENT_SKILL_TAGS = 10;
export const MAX_TEAM_LANGUAGES = 5; // recruitment + community-context languages
export const MAX_ROLE_PRESETS = 8;
// Match invitees — roster-derived; sized to the ≤100 team-size ceiling (@Max(100))
// so a full matched team can always be invited (raised from an unintentional 10).
export const MAX_TEAM_INVITEES = 100;

// --- Uncapped-array sweep (2026-06) — fields that had @IsArray but NO @ArrayMaxSize,
// so a user could POST an arbitrarily large array (DoS / payload bloat / silent 400).
// Free-form text inputs additionally get a client-side guard; the rest are server-side
// ceilings where the UI bound was cosmetic/bypassable. ---
// Profile (PUT /profiles/me, POST/PUT /profiles/me/activities, reorder)
export const MAX_LEGACY_AFFILIATIONS = 20; // free-form comma <Input> — client must guard
export const MAX_REGION_PREFERENCES = 20; // defensive ceiling (no active form input)
export const MAX_ACTIVITY_GRADE_LEVELS = 4; // grades 9–12; FE checkbox-bounded
export const MAX_REORDER_IDS = 100; // reorder builds a per-id $transaction — server ceiling
// Vault / Forum tags — free-form tag inputs; client must guard
export const MAX_VAULT_TAGS = 50;
export const MAX_FORUM_POST_TAGS = 10; // mirrors the existing images cap (6) on the same DTO
// Resume builder (POST /resumes, /resume/evidence, /targets, sections, import)
export const MAX_RESUME_TARGET_KEYWORDS = 20;
export const MAX_RESUME_EVIDENCE_TAGS = 50;
export const MAX_RESUME_EVIDENCE_SKILLS = 50;
export const MAX_RESUME_PROOF_LINKS = 10; // 1000 chars each — payload-bloat vector
export const MAX_RESUME_SECTION_EVIDENCE_REFS = 50;
export const MAX_RESUME_SECTION_IDS = 50; // reorder; realistic section count ~14
export const MAX_RESUME_IMPORT_SECTIONS = 50;
export const MAX_RESUME_IMPORT_EVIDENCE = 100;
// Case submission (POST /cases — authed, not admin)
export const MAX_CASE_TEST_SCORES = 10;
export const MAX_CASE_ACTIVITIES = 50;
export const MAX_CASE_AWARDS = 50;
// Assessment answers — bound to the server question count; generous ceiling
export const MAX_ASSESSMENT_ANSWERS = 200;
// AI memory queries — enum arrays via query string (bypasses the body limit); tight cap
export const MAX_MEMORY_QUERY_TYPES = 12;
// Case submission metadata string lists (tags / apSubjects / demographicTags)
export const MAX_CASE_METADATA_TAGS = 50;
// AI school-preference value lists (size / type) — small fixed-vocab preference sets
export const MAX_SCHOOL_PREFERENCE_VALUES = 10;

/**
 * Single source of truth for the AI request timeout budget (ms), shared by:
 *  - the API `TimeoutMiddleware` (server-side 408 budget for AI endpoints — its
 *    env override `AI_REQUEST_TIMEOUT_MS` falls back to this value),
 *  - the web `apiClient` (`AI_TIMEOUTS.AI_REQUEST`),
 *  - the mobile `apiClient` per-request `timeout` on every AI call.
 *
 * Keeping client and server on one constant prevents the FE/BE drift class where
 * a client aborts BEFORE the server finishes (mobile was hardcoded to 60_000 —
 * half this — so a multi-school application analysis the server completes within
 * budget was cut off client-side; see the #393/#395 timeout review). The client
 * timeout must be >= the server budget so the server's 408 is authoritative.
 *
 * Sized for the heaviest served AI path — application analysis fans out up to
 * MAX_FOCUS_SCHOOLS (5) sequential per-school LLM calls + a portfolio synthesis
 * call (~33s observed for 3 schools, ~50–55s worst case for 5).
 */
export const AI_REQUEST_TIMEOUT_MS = 120_000;

/** Fast AI-adjacent writes (e.g. analysis feedback POST) — a plain DB write, not an LLM call. */
export const AI_FEEDBACK_TIMEOUT_MS = 15_000;

// 订阅计划
export * from './subscription';

// 密码策略
export * from './password';

// 推荐功能
export * from './recommendation';

// API 路由常量
export * from './api-routes';
export * from './application-rounds';

// 预测功能常量
export * from './prediction';

// React Query 缓存档位（web + mobile 共享的 staleTime 真相源）
export * from './query-cache';

// 共享枚举
export * from './enums';

// 真实案例 CSV 导入
export * from './real-cases-ingest';
