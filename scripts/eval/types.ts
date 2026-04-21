/**
 * AI Agent 离线评测类型定义
 */

// ==================== Bad Case 分类 ====================

export type BadCaseType =
  // 路由错误
  | 'WRONG_AGENT'
  | 'WRONG_TOOL'
  | 'MISSING_TOOL'
  | 'REDUNDANT_TOOL'
  // 格式错误
  | 'JSON_PARSE_FAIL'
  | 'MISSING_FIELD'
  | 'WRONG_TYPE'
  // 幻觉
  | 'FAKE_SCHOOL'
  | 'FAKE_DATA'
  | 'FAKE_PROGRAM'
  // 质量问题
  | 'SHALLOW'
  | 'WRONG_LANGUAGE'
  | 'IGNORED_CONTEXT';

export type BadCaseCategory = 'ROUTING_ERROR' | 'FORMAT_ERROR' | 'HALLUCINATION' | 'QUALITY_ERROR';

export const BAD_CASE_CATEGORY_MAP: Record<BadCaseType, BadCaseCategory> = {
  WRONG_AGENT: 'ROUTING_ERROR',
  WRONG_TOOL: 'ROUTING_ERROR',
  MISSING_TOOL: 'ROUTING_ERROR',
  REDUNDANT_TOOL: 'ROUTING_ERROR',
  JSON_PARSE_FAIL: 'FORMAT_ERROR',
  MISSING_FIELD: 'FORMAT_ERROR',
  WRONG_TYPE: 'FORMAT_ERROR',
  FAKE_SCHOOL: 'HALLUCINATION',
  FAKE_DATA: 'HALLUCINATION',
  FAKE_PROGRAM: 'HALLUCINATION',
  SHALLOW: 'QUALITY_ERROR',
  WRONG_LANGUAGE: 'QUALITY_ERROR',
  IGNORED_CONTEXT: 'QUALITY_ERROR',
};

// ==================== 评测用例 ====================

export type EvalCategory =
  | 'tool_routing'
  | 'deadline_accuracy'
  | 'school_recommendation'
  | 'probability_calibration'
  | 'international_student'
  | 'json_compliance'
  | 'essay_guidance'
  | 'terminology_accuracy';

export type Severity = 'critical' | 'major' | 'minor';

export interface EvalCase {
  /** 唯一标识 */
  id: string;
  /** 分类 */
  category: EvalCategory;
  /** 用例描述 */
  description: string;
  /** 用户输入 */
  input: string;
  /** 用户 locale */
  locale?: 'zh' | 'en';
  /** 期望的工具调用（工具名列表） */
  expectedToolCalls?: string[];
  /** 不应调用的工具 */
  forbiddenToolCalls?: string[];
  /** 期望输出中的 JSON 字段（用于 JSON 合规检查） */
  expectedJsonFields?: string[];
  /** 期望输出中必须包含的关键字 */
  expectedKeywords?: string[];
  /** 输出中不可出现的内容 */
  forbiddenContent?: string[];
  /** mock LLM 返回的 tool_calls（用于 MVP1 fixtures 模式） */
  mockToolCalls?: Array<{
    name: string;
    arguments: Record<string, unknown>;
  }>;
  /** mock 工具返回结果（用于 MVP1 fixtures 模式） */
  mockToolResults?: Record<string, string>;
  /** mock 助手输出（用于 fixtures/live 内容断言） */
  mockAssistantOutput?: string;
  /** 严重程度 */
  severity: Severity;
  /** 是否主观评价（主观 case 不纳入自动化指标） */
  subjective?: boolean;
}

// ==================== 评测结果 ====================

export type EvalVerdict = 'pass' | 'fail' | 'skip';

export interface EvalResult {
  /** 对应的 case ID */
  caseId: string;
  /** 评测模式 */
  mode: 'fixtures' | 'live';
  /** 通过/失败/跳过 */
  verdict: EvalVerdict;
  /** 失败时的 bad case 类型 */
  badCaseType?: BadCaseType;
  /** 详细信息 */
  details?: string;
  /** 实际调用的工具 */
  actualToolCalls?: string[];
  /** LLM 原始输出（live 模式） */
  rawOutput?: string;
  /** 耗时 ms（live 模式） */
  latencyMs?: number;
  /** 时间戳 */
  timestamp: string;
}

export interface EvalSummary {
  mode: 'fixtures' | 'live';
  totalCases: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: number;
  byCategory: Record<EvalCategory, { total: number; passed: number }>;
  bySeverity: Record<Severity, { total: number; passed: number }>;
  badCaseBreakdown: Partial<Record<BadCaseType, number>>;
  timestamp: string;
}
