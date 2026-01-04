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

// 分页默认值
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

