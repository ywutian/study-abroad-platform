/**
 * 记忆提取规则定义
 *
 * 每个规则包含:
 * - 模式匹配 (正则表达式)
 * - 数据验证
 * - 重要性计算
 * - 去重策略
 * - 冲突处理
 */

import { MemoryType, EntityType } from '@prisma/client';
import { ConflictStrategy } from './memory-conflict.service';

// ==================== 类型定义 ====================

export interface ValidationResult {
  valid: boolean;
  normalized?: string;
  error?: string;
}

export interface ExtractionRule {
  id: string;
  name: string;
  type: MemoryType;
  category: string;
  patterns: RegExp[];
  baseImportance: number;
  importanceBoosts: Array<{
    condition: string;
    boost: number;
  }>;
  validator: (value: string, match: RegExpMatchArray) => ValidationResult;
  dedupeKey: (value: string) => string;
  conflictStrategy: ConflictStrategy;
  ttlDays: number;
  formatContent?: (value: string, match: RegExpMatchArray) => string;
  extractEntity?: (
    value: string,
    match: RegExpMatchArray,
  ) => {
    type: EntityType;
    name: string;
    description?: string;
    attributes?: Record<string, any>;
  } | null;
}

// ==================== GPA 分制定义 ====================

interface GPAScale {
  name: string;
  min: number;
  max: number;
  normalize: (value: number) => number; // 转换为 4.0 制
}

const GPA_SCALES: GPAScale[] = [
  { name: '4.0制', min: 0, max: 4.0, normalize: (v) => v },
  { name: '4.3制', min: 0, max: 4.3, normalize: (v) => (v / 4.3) * 4.0 },
  { name: '5.0制', min: 0, max: 5.0, normalize: (v) => (v / 5.0) * 4.0 },
  { name: '10分制', min: 0, max: 10.0, normalize: (v) => (v / 10.0) * 4.0 },
  { name: '100分制', min: 0, max: 100, normalize: (v) => (v / 100) * 4.0 },
];

// ==================== 验证函数 ====================

/**
 * 增强的 GPA 验证器
 * 支持多种分制：4.0、4.3、5.0、10分、100分
 *
 * @param value GPA 数值字符串
 * @param context 可选的上下文字符串（如 "GPA 3.8/4.0"）用于推断分制
 */
function validateGPA(
  value: string,
  context?: string,
): ValidationResult & {
  metadata?: {
    originalValue: number;
    scale: string;
    normalizedValue: number;
  };
} {
  const num = parseFloat(value);
  if (isNaN(num)) {
    return { valid: false, error: 'GPA 必须是数字' };
  }

  if (num < 0) {
    return { valid: false, error: 'GPA 不能为负数' };
  }

  // 尝试从上下文推断分制
  let detectedScale: GPAScale | null = null;

  if (context) {
    // 检测分母格式如 "3.8/4.0" 或 "满分4.0"
    const scaleMatch = context.match(/(?:\/|满分\s*)(\d+(?:\.\d)?)/);
    if (scaleMatch) {
      const scaleMax = parseFloat(scaleMatch[1]);
      // 找到匹配的分制
      for (const scale of GPA_SCALES) {
        if (Math.abs(scaleMax - scale.max) < 0.1) {
          detectedScale = scale;
          break;
        }
      }
    }

    // 检测中文描述
    if (!detectedScale) {
      if (/满分\s*(4\.?0?|四)(?![.3])/i.test(context)) {
        detectedScale = GPA_SCALES[0]; // 4.0制
      } else if (/满分\s*4\.3/i.test(context)) {
        detectedScale = GPA_SCALES[1]; // 4.3制
      } else if (/满分\s*(5\.?0?|五)/i.test(context)) {
        detectedScale = GPA_SCALES[2]; // 5.0制
      } else if (/满分\s*(10|十)/i.test(context)) {
        detectedScale = GPA_SCALES[3]; // 10分制
      } else if (/满分\s*(100|百)|百分制/i.test(context)) {
        detectedScale = GPA_SCALES[4]; // 100分制
      }
    }
  }

  // 根据数值范围推断分制
  if (!detectedScale) {
    if (num <= 4.0) {
      detectedScale = GPA_SCALES[0]; // 4.0制
    } else if (num <= 4.3) {
      detectedScale = GPA_SCALES[1]; // 4.3制
    } else if (num <= 5.0) {
      detectedScale = GPA_SCALES[2]; // 5.0制
    } else if (num <= 10.0) {
      detectedScale = GPA_SCALES[3]; // 10分制
    } else if (num <= 100) {
      detectedScale = GPA_SCALES[4]; // 100分制
    } else {
      return { valid: false, error: 'GPA 数值超出所有已知分制范围 (最大100)' };
    }
  }

  // 验证范围
  if (num < detectedScale.min || num > detectedScale.max) {
    return {
      valid: false,
      error: `${detectedScale.name} GPA 范围应在 ${detectedScale.min}-${detectedScale.max}`,
    };
  }

  // 归一化到 4.0 制
  const normalizedValue = detectedScale.normalize(num);

  // 格式化输出
  let normalized: string;
  if (detectedScale.name === '4.0制') {
    normalized = num.toFixed(2);
  } else {
    normalized = `${num.toFixed(detectedScale.max >= 10 ? 1 : 2)} (${detectedScale.name}, 约合 ${normalizedValue.toFixed(2)}/4.0)`;
  }

  return {
    valid: true,
    normalized,
    metadata: {
      originalValue: num,
      scale: detectedScale.name,
      normalizedValue,
    },
  };
}

const validators = {
  /**
   * GPA 验证 - 支持多种分制
   * 通过 context 参数可以提供额外上下文帮助推断分制
   */
  gpa: (value: string, context?: string): ValidationResult => {
    return validateGPA(value, context);
  },

  sat: (value: string): ValidationResult => {
    const num = parseInt(value, 10);
    if (isNaN(num)) return { valid: false, error: 'SAT 必须是整数' };
    if (num < 400 || num > 1600)
      return { valid: false, error: 'SAT 范围应在 400-1600' };
    return { valid: true, normalized: num.toString() };
  },

  act: (value: string): ValidationResult => {
    const num = parseInt(value, 10);
    if (isNaN(num)) return { valid: false, error: 'ACT 必须是整数' };
    if (num < 1 || num > 36)
      return { valid: false, error: 'ACT 范围应在 1-36' };
    return { valid: true, normalized: num.toString() };
  },

  toefl: (value: string): ValidationResult => {
    const num = parseInt(value, 10);
    if (isNaN(num)) return { valid: false, error: 'TOEFL 必须是整数' };
    if (num < 0 || num > 120)
      return { valid: false, error: 'TOEFL 范围应在 0-120' };
    return { valid: true, normalized: num.toString() };
  },

  ielts: (value: string): ValidationResult => {
    const num = parseFloat(value);
    if (isNaN(num)) return { valid: false, error: 'IELTS 必须是数字' };
    if (num < 0 || num > 9)
      return { valid: false, error: 'IELTS 范围应在 0-9' };
    return { valid: true, normalized: num.toFixed(1) };
  },

  school: (value: string): ValidationResult => {
    const trimmed = value.trim();
    if (trimmed.length < 2) return { valid: false, error: '学校名称过短' };
    if (trimmed.length > 100) return { valid: false, error: '学校名称过长' };
    return { valid: true, normalized: trimmed };
  },

  major: (value: string): ValidationResult => {
    const trimmed = value.trim();
    if (trimmed.length < 2) return { valid: false, error: '专业名称过短' };
    return { valid: true, normalized: trimmed };
  },

  ranking: (value: string): ValidationResult => {
    const num = parseInt(value, 10);
    if (isNaN(num)) return { valid: false, error: '排名必须是整数' };
    if (num < 1 || num > 1000)
      return { valid: false, error: '排名范围应在 1-1000' };
    return { valid: true, normalized: num.toString() };
  },

  percentage: (value: string): ValidationResult => {
    const num = parseFloat(value);
    if (isNaN(num)) return { valid: false, error: '百分比必须是数字' };
    if (num < 0 || num > 100)
      return { valid: false, error: '百分比范围应在 0-100' };
    return { valid: true, normalized: num.toFixed(1) + '%' };
  },

  year: (value: string): ValidationResult => {
    const num = parseInt(value, 10);
    const currentYear = new Date().getFullYear();
    if (isNaN(num)) return { valid: false, error: '年份必须是整数' };
    if (num < currentYear - 10 || num > currentYear + 10) {
      return { valid: false, error: '年份不在合理范围内' };
    }
    return { valid: true, normalized: num.toString() };
  },

  text: (value: string): ValidationResult => {
    const trimmed = value.trim();
    if (trimmed.length === 0) return { valid: false, error: '内容不能为空' };
    return { valid: true, normalized: trimmed };
  },
};

// ==================== 规则定义 ====================

export const EXTRACTION_RULES: ExtractionRule[] = [
  // ===== 学术成绩 =====
  {
    id: 'gpa',
    name: 'GPA',
    type: MemoryType.FACT,
    category: 'academic',
    patterns: [
      // 支持多种表达方式
      /(?:我的?)?(?:GPA|绩点)\s*(?:是|为|有)?\s*([\d.]+)(?:\s*\/\s*([\d.]+))?/i,
      /(?:GPA|绩点)\s*[:：]\s*([\d.]+)(?:\s*\/\s*([\d.]+))?/i,
      /([\d.]+)\s*(?:的|\/)?\s*(?:GPA|绩点)(?:\s*\/\s*([\d.]+))?/i,
      // 支持 "3.8/4.0" 格式
      /([\d.]+)\s*\/\s*([\d.]+)\s*(?:GPA|绩点|分)?/i,
      // 支持百分制
      /(?:平均分|均分|加权平均分|weighted GPA)\s*(?:是|为)?\s*([\d.]+)/i,
      // 支持满分描述
      /(?:GPA|绩点)\s*([\d.]+)\s*(?:满分\s*)?([\d.]+)?/i,
    ],
    baseImportance: 0.9,
    importanceBoosts: [
      { condition: 'unweighted', boost: 0.05 },
      { condition: 'weighted', boost: 0.03 },
      { condition: '最终', boost: 0.02 },
    ],
    validator: (value: string, match: RegExpMatchArray) => {
      // 从匹配中提取上下文信息（如分母）
      const context = match[0]; // 完整匹配作为上下文
      return validators.gpa(value, context);
    },
    dedupeKey: () => 'user:gpa',
    conflictStrategy: ConflictStrategy.KEEP_LATEST,
    ttlDays: 365,
    formatContent: (value, match) => {
      const result = validateGPA(value, match[0]);
      return result.normalized ? `GPA: ${result.normalized}` : `GPA: ${value}`;
    },
  },

  {
    id: 'class_rank',
    name: '年级排名',
    type: MemoryType.FACT,
    category: 'academic',
    patterns: [
      /(?:年级|班级)\s*排名\s*(?:是|为)?\s*(?:第\s*)?([\d]+)/i,
      /排名\s*(?:第\s*)?([\d]+)\s*(?:名|位)/i,
      /(?:top|前)\s*([\d]+)(?:%|名)/i,
    ],
    baseImportance: 0.8,
    importanceBoosts: [
      { condition: 'top 10', boost: 0.1 },
      { condition: '第一', boost: 0.1 },
    ],
    validator: validators.ranking,
    dedupeKey: () => 'user:rank',
    conflictStrategy: ConflictStrategy.KEEP_LATEST,
    ttlDays: 365,
    formatContent: (value) => `年级排名: 第${value}名`,
  },

  // ===== 标化成绩 =====
  {
    id: 'sat',
    name: 'SAT',
    type: MemoryType.FACT,
    category: 'test_score',
    patterns: [
      /SAT\s*(?:成绩|分数)?\s*(?:是|为|有|考了)?\s*(1[0-6]\d{2}|[4-9]\d{2})/i,
      /(1[0-6]\d{2}|[4-9]\d{2})\s*(?:分|分数)?\s*(?:的\s*)?SAT/i,
      /SAT\s*[:：]\s*(1[0-6]\d{2}|[4-9]\d{2})/i,
    ],
    baseImportance: 0.9,
    importanceBoosts: [
      { condition: '1550', boost: 0.05 },
      { condition: '1500', boost: 0.03 },
      { condition: '最高', boost: 0.02 },
    ],
    validator: validators.sat,
    dedupeKey: () => 'user:sat',
    conflictStrategy: ConflictStrategy.KEEP_HIGHEST,
    ttlDays: 730, // 2年
    formatContent: (value) => `SAT: ${value}`,
  },

  {
    id: 'act',
    name: 'ACT',
    type: MemoryType.FACT,
    category: 'test_score',
    patterns: [
      /ACT\s*(?:成绩|分数)?\s*(?:是|为|有|考了)?\s*(3[0-6]|[12]?\d)/i,
      /(3[0-6]|[12]?\d)\s*(?:分|分数)?\s*(?:的\s*)?ACT/i,
      /ACT\s*[:：]\s*(3[0-6]|[12]?\d)/i,
    ],
    baseImportance: 0.9,
    importanceBoosts: [
      { condition: '35', boost: 0.05 },
      { condition: '34', boost: 0.03 },
    ],
    validator: validators.act,
    dedupeKey: () => 'user:act',
    conflictStrategy: ConflictStrategy.KEEP_HIGHEST,
    ttlDays: 730,
    formatContent: (value) => `ACT: ${value}`,
  },

  {
    id: 'toefl',
    name: 'TOEFL',
    type: MemoryType.FACT,
    category: 'test_score',
    patterns: [
      /(?:TOEFL|托福)\s*(?:成绩|分数)?\s*(?:是|为|有|考了)?\s*(1[0-2]\d|\d{1,2})/i,
      /(1[0-2]\d|\d{1,2})\s*(?:分|分数)?\s*(?:的\s*)?(?:TOEFL|托福)/i,
      /(?:TOEFL|托福)\s*[:：]\s*(1[0-2]\d|\d{1,2})/i,
    ],
    baseImportance: 0.85,
    importanceBoosts: [
      { condition: '110', boost: 0.05 },
      { condition: '100', boost: 0.03 },
    ],
    validator: validators.toefl,
    dedupeKey: () => 'user:toefl',
    conflictStrategy: ConflictStrategy.KEEP_HIGHEST,
    ttlDays: 730,
    formatContent: (value) => `TOEFL: ${value}`,
  },

  {
    id: 'ielts',
    name: 'IELTS',
    type: MemoryType.FACT,
    category: 'test_score',
    patterns: [
      /(?:IELTS|雅思)\s*(?:成绩|分数)?\s*(?:是|为|有|考了)?\s*([0-9](?:\.[05])?)/i,
      /([0-9](?:\.[05])?)\s*(?:分|分数)?\s*(?:的\s*)?(?:IELTS|雅思)/i,
    ],
    baseImportance: 0.85,
    importanceBoosts: [
      { condition: '8.0', boost: 0.05 },
      { condition: '7.5', boost: 0.03 },
    ],
    validator: validators.ielts,
    dedupeKey: () => 'user:ielts',
    conflictStrategy: ConflictStrategy.KEEP_HIGHEST,
    ttlDays: 730,
    formatContent: (value) => `IELTS: ${value}`,
  },

  // ===== 目标学校 =====
  {
    id: 'target_school',
    name: '目标学校',
    type: MemoryType.PREFERENCE,
    category: 'school',
    patterns: [
      /(?:想|要|打算|计划|准备)(?:申请|去|上)\s*([\u4e00-\u9fa5a-zA-Z\s]+(?:大学|学院|University|College|MIT|Stanford|Harvard|Yale|Princeton|Berkeley|UCLA|Columbia|CMU|NYU|Duke))/i,
      /(?:梦校|dream school|目标)\s*(?:是|为)?\s*([\u4e00-\u9fa5a-zA-Z\s]+)/i,
      /(MIT|Stanford|Harvard|Yale|Princeton|Berkeley|UCLA|Columbia|CMU|NYU|Duke|Cornell|Brown|UPenn|Caltech|Northwestern|Chicago|JHU|Rice|Vanderbilt|Notre Dame|Emory|Georgetown|USC|UMich|UVA|NYU)\s*(?:是我的?|是目标)/i,
    ],
    baseImportance: 0.85,
    importanceBoosts: [
      { condition: '梦校', boost: 0.1 },
      { condition: 'ED', boost: 0.1 },
      { condition: '第一志愿', boost: 0.1 },
    ],
    validator: validators.school,
    dedupeKey: (value) => `school:${value.toLowerCase().replace(/\s+/g, '_')}`,
    conflictStrategy: ConflictStrategy.KEEP_BOTH,
    ttlDays: 365,
    formatContent: (value) => `目标学校: ${value}`,
    extractEntity: (value) => ({
      type: EntityType.SCHOOL,
      name: value,
      description: '用户目标学校',
      attributes: { interest: 'target' },
    }),
  },

  // ===== ED 决定 =====
  {
    id: 'ed_decision',
    name: 'ED 决定',
    type: MemoryType.DECISION,
    category: 'application',
    patterns: [
      /(?:ED|早申|绑定|提前决定)\s*(?:申请|选择|定了|决定)?\s*([\u4e00-\u9fa5a-zA-Z\s]+(?:大学|学院|University|College|MIT|Stanford|Harvard|Yale|Princeton|Berkeley|UCLA|Columbia|CMU|NYU|Duke))/i,
      /(?:决定|已经|要)\s*ED\s*([\u4e00-\u9fa5a-zA-Z\s]+)/i,
    ],
    baseImportance: 0.95,
    importanceBoosts: [
      { condition: '确定', boost: 0.05 },
      { condition: '最终', boost: 0.05 },
    ],
    validator: validators.school,
    dedupeKey: () => 'user:ed_decision',
    conflictStrategy: ConflictStrategy.KEEP_LATEST,
    ttlDays: 365,
    formatContent: (value) => `ED 决定: ${value}`,
    extractEntity: (value) => ({
      type: EntityType.SCHOOL,
      name: value,
      description: '用户 ED 学校',
      attributes: { round: 'ED', decision: true },
    }),
  },

  // ===== 专业意向 =====
  {
    id: 'intended_major',
    name: '意向专业',
    type: MemoryType.PREFERENCE,
    category: 'academic',
    patterns: [
      /(?:想学|打算学|意向|专业)\s*(?:是|为)?\s*([\u4e00-\u9fa5a-zA-Z\s]+)/i,
      /(?:学|读)\s*(计算机|CS|Computer Science|工程|Engineering|商科|Business|经济|Economics|数学|Mathematics|物理|Physics|生物|Biology|化学|Chemistry|心理学|Psychology|艺术|Art)/i,
      /(?:major|专业)\s*[:：]\s*([\u4e00-\u9fa5a-zA-Z\s]+)/i,
    ],
    baseImportance: 0.8,
    importanceBoosts: [
      { condition: 'STEM', boost: 0.05 },
      { condition: '确定', boost: 0.05 },
    ],
    validator: validators.major,
    dedupeKey: () => 'user:intended_major',
    conflictStrategy: ConflictStrategy.KEEP_LATEST,
    ttlDays: 365,
    formatContent: (value) => `意向专业: ${value}`,
  },

  // ===== 活动经历 =====
  {
    id: 'activity',
    name: '课外活动',
    type: MemoryType.FACT,
    category: 'extracurricular',
    patterns: [
      /(?:参加了?|加入了?|做过|有)\s*([\u4e00-\u9fa5a-zA-Z]+)\s*(?:活动|社团|组织|俱乐部|项目|比赛|竞赛)/i,
      /(?:是|担任)\s*([\u4e00-\u9fa5a-zA-Z]+)\s*(?:主席|会长|社长|队长|负责人|创始人)/i,
      /(?:获得|赢得|拿到)\s*([\u4e00-\u9fa5a-zA-Z]+)\s*(?:奖|奖项|名次|荣誉)/i,
    ],
    baseImportance: 0.7,
    importanceBoosts: [
      { condition: '国际', boost: 0.15 },
      { condition: '全国', boost: 0.1 },
      { condition: '省级', boost: 0.05 },
      { condition: '创始人', boost: 0.1 },
      { condition: '主席', boost: 0.08 },
    ],
    validator: validators.text,
    dedupeKey: (value) =>
      `activity:${value.toLowerCase().replace(/\s+/g, '_')}`,
    conflictStrategy: ConflictStrategy.KEEP_BOTH,
    ttlDays: 730,
    formatContent: (value, match) => `活动: ${match[0]}`,
  },

  // ===== 竞赛经历 =====
  {
    id: 'competition',
    name: '竞赛',
    type: MemoryType.FACT,
    category: 'competition',
    patterns: [
      /(?:参加了?|报名了?|准备)\s*(AMC|AIME|USAMO|USABO|ISEF|USACO|Physics Olympiad|数学竞赛|物理竞赛|生物竞赛|化学竞赛|信息学竞赛|Science Olympiad|Math Olympiad|Intel|Regeneron|HMMT|ARML|MATHCOUNTS)/i,
      /(?:参加了?|报名了?|准备)\s*([\u4e00-\u9fa5a-zA-Z]+)\s*(?:竞赛|奥赛|奥林匹克)/i,
      /(?:获得|拿到|赢得)\s*([\u4e00-\u9fa5a-zA-Z]+)\s*(?:竞赛|奥赛)\s*(?:金|银|铜|一等|二等|三等)?(?:奖|名次)/i,
    ],
    baseImportance: 0.85,
    importanceBoosts: [
      { condition: '国际', boost: 0.1 },
      { condition: '全国', boost: 0.08 },
      { condition: '金奖', boost: 0.1 },
      { condition: '银奖', boost: 0.05 },
      { condition: 'USAMO', boost: 0.1 },
      { condition: 'AIME', boost: 0.08 },
      { condition: 'ISEF', boost: 0.1 },
    ],
    validator: validators.text,
    dedupeKey: (value) =>
      `competition:${value.toLowerCase().replace(/\s+/g, '_')}`,
    conflictStrategy: ConflictStrategy.KEEP_BOTH,
    ttlDays: 730,
    formatContent: (value, match) => `竞赛: ${match[0]}`,
    extractEntity: (value, match) => ({
      type: EntityType.EVENT,
      name: value,
      description: `竞赛经历: ${match[0]}`,
      attributes: { category: 'competition' },
    }),
  },

  // ===== 夏校/暑期项目 =====
  {
    id: 'summer_program',
    name: '夏校',
    type: MemoryType.FACT,
    category: 'summer_program',
    patterns: [
      /(?:参加了?|申请了?|去了?|录取了?)\s*([\u4e00-\u9fa5a-zA-Z\s]+)\s*(?:夏校|暑期项目|暑期课程|summer program|summer school)/i,
      /(?:RSI|ROSS|PROMYS|SUMaC|SSP|TASP|MITES|Clark Scholar|Garcia|Simons|SuMac|Telluride|MOSTEC|LaunchX)\b/i,
      /(?:参加了?|申请了?|录取了?)\s*(RSI|ROSS|PROMYS|SUMaC|SSP|TASP|MITES|Clark Scholar|Garcia|Simons)/i,
    ],
    baseImportance: 0.8,
    importanceBoosts: [
      { condition: 'RSI', boost: 0.15 },
      { condition: 'TASP', boost: 0.1 },
      { condition: 'SSP', boost: 0.1 },
      { condition: '录取', boost: 0.05 },
    ],
    validator: validators.text,
    dedupeKey: (value) => `summer:${value.toLowerCase().replace(/\s+/g, '_')}`,
    conflictStrategy: ConflictStrategy.KEEP_BOTH,
    ttlDays: 730,
    formatContent: (value, match) => `夏校: ${match[0]}`,
    extractEntity: (value) => ({
      type: EntityType.EVENT,
      name: value,
      description: '暑期项目/夏校',
      attributes: { category: 'summer_program' },
    }),
  },

  // ===== 实习经历 =====
  {
    id: 'internship',
    name: '实习',
    type: MemoryType.FACT,
    category: 'internship',
    patterns: [
      /(?:在|去)\s*([\u4e00-\u9fa5a-zA-Z\s]+)\s*(?:实习|intern)/i,
      /(?:做了?|有)\s*([\u4e00-\u9fa5a-zA-Z\s]+)\s*(?:的\s*)?(?:实习|研究助理|research assistant|RA)/i,
      /(?:实习|intern)\s*(?:在|于)\s*([\u4e00-\u9fa5a-zA-Z\s]+)/i,
    ],
    baseImportance: 0.75,
    importanceBoosts: [
      { condition: '研究', boost: 0.1 },
      { condition: '教授', boost: 0.08 },
      { condition: 'lab', boost: 0.08 },
    ],
    validator: validators.text,
    dedupeKey: (value) => `intern:${value.toLowerCase().replace(/\s+/g, '_')}`,
    conflictStrategy: ConflictStrategy.KEEP_BOTH,
    ttlDays: 730,
    formatContent: (value, match) => `实习: ${match[0]}`,
  },

  // ===== 材料准备 =====
  {
    id: 'material_prep',
    name: '材料准备',
    type: MemoryType.FACT,
    category: 'material',
    patterns: [
      /(?:推荐信|recommendation letter)\s*(?:找了?|请了?|联系了?)\s*([\u4e00-\u9fa5a-zA-Z\s]+)/i,
      /(?:成绩单|transcript|作品集|portfolio)\s*(?:已经|准备好|寄了|提交了)/i,
      /(?:已经|刚|正在)\s*(?:准备|提交|寄送)\s*(推荐信|成绩单|作品集|transcript|portfolio|简历|CV|resume)/i,
    ],
    baseImportance: 0.65,
    importanceBoosts: [
      { condition: '推荐信', boost: 0.1 },
      { condition: '作品集', boost: 0.1 },
    ],
    validator: validators.text,
    dedupeKey: (value) =>
      `material:${value.toLowerCase().replace(/\s+/g, '_')}`,
    conflictStrategy: ConflictStrategy.KEEP_BOTH,
    ttlDays: 365,
    formatContent: (value, match) => `材料: ${match[0]}`,
  },

  // ===== 入学年份 =====
  {
    id: 'enrollment_year',
    name: '入学年份',
    type: MemoryType.FACT,
    category: 'timeline',
    patterns: [
      /(?:准备|计划|打算)\s*(20\d{2})\s*(?:年|fall|spring)?\s*(?:入学|入读|开始)/i,
      /(20\d{2})\s*(?:届|级|fall|spring)\s*(?:学生|申请者)?/i,
      /(?:class of|毕业于)\s*(20\d{2})/i,
    ],
    baseImportance: 0.85,
    importanceBoosts: [],
    validator: validators.year,
    dedupeKey: () => 'user:enrollment_year',
    conflictStrategy: ConflictStrategy.KEEP_LATEST,
    ttlDays: 365,
    formatContent: (value) => `入学年份: ${value}`,
  },

  // ===== 地区偏好 =====
  {
    id: 'location_preference',
    name: '地区偏好',
    type: MemoryType.PREFERENCE,
    category: 'preference',
    patterns: [
      /(?:喜欢|想去|偏好|prefer)\s*(东海岸|西海岸|East Coast|West Coast|加州|California|纽约|New York|波士顿|Boston|中部|南部)/i,
      /(?:不想去|不喜欢|避开)\s*([\u4e00-\u9fa5a-zA-Z]+)\s*(?:的学校|地区|城市)/i,
    ],
    baseImportance: 0.6,
    importanceBoosts: [
      { condition: '明确', boost: 0.1 },
      { condition: '必须', boost: 0.15 },
    ],
    validator: validators.text,
    dedupeKey: () => 'user:location_pref',
    conflictStrategy: ConflictStrategy.KEEP_LATEST,
    ttlDays: 365,
    formatContent: (value) => `地区偏好: ${value}`,
  },

  // ===== 预算 =====
  {
    id: 'budget',
    name: '预算',
    type: MemoryType.FACT,
    category: 'financial',
    patterns: [
      /(?:预算|budget|每年|一年)\s*(?:是|为|大约|约)?\s*(\d+)\s*(?:万|w|k|美元|刀)?/i,
      /(?:家里|父母|家庭)\s*(?:能出|可以出|支持)\s*(\d+)\s*(?:万|w|k|美元|刀)?/i,
      /(?:需要|必须|希望)\s*(?:拿到|获得)?\s*(?:奖学金|助学金|financial aid)/i,
    ],
    baseImportance: 0.75,
    importanceBoosts: [
      { condition: '奖学金', boost: 0.1 },
      { condition: '助学金', boost: 0.1 },
    ],
    validator: validators.text,
    dedupeKey: () => 'user:budget',
    conflictStrategy: ConflictStrategy.KEEP_LATEST,
    ttlDays: 365,
    formatContent: (value, match) => `预算: ${match[0]}`,
  },

  // ===== 申请轮次 =====
  {
    id: 'application_round',
    name: '申请轮次',
    type: MemoryType.DECISION,
    category: 'application',
    patterns: [
      /(?:准备|打算|计划)\s*(?:申请)?\s*(EA|ED|RD|ED2|REA|SCEA|早申|常规|提前)\s*(?:轮|轮次)?/i,
      /(EA|ED|RD|ED2|REA|SCEA)\s*(?:申请|deadline|截止)/i,
    ],
    baseImportance: 0.8,
    importanceBoosts: [
      { condition: 'ED', boost: 0.1 },
      { condition: 'REA', boost: 0.1 },
    ],
    validator: validators.text,
    dedupeKey: (value) => `round:${value.toUpperCase()}`,
    conflictStrategy: ConflictStrategy.KEEP_BOTH,
    ttlDays: 365,
    formatContent: (value) => `申请轮次: ${value.toUpperCase()}`,
  },
];
