import type { AgentType, ToolCall } from '../types';
import type { ToolExecutionResult } from './types';
import type { AgentRunCheckpoint } from './agent-run-state';
import {
  AgentRunBudgetTracker,
  buildAgentRunContextSummary,
} from './agent-run-context';

export enum WorkflowPhase {
  PLAN = 'plan',
  EXECUTE = 'execute',
  SOLVE = 'solve',
  DONE = 'done',
}

export interface PlannedStep {
  toolCall: ToolCall;
  status: 'pending' | 'running' | 'success' | 'failed';
  result?: ToolExecutionResult;
  error?: string;
  duration?: number;
}

export interface ExecutionPlan {
  planningContent: string;
  steps: PlannedStep[];
  delegation?: {
    targetAgent: AgentType;
    task: string;
    context?: string;
  };
}

export interface WorkflowResult {
  message: string;
  toolsUsed: string[];
  delegation?: ExecutionPlan['delegation'];
  plan: ExecutionPlan;
  timing: {
    planMs: number;
    executeMs: number;
    solveMs: number;
    totalMs: number;
  };
  usage?: ReturnType<AgentRunBudgetTracker['snapshot']>;
  contextSummary?: ReturnType<typeof buildAgentRunContextSummary>;
}

export interface WorkflowRunContext {
  runId: string;
  approvalsEnabled: boolean;
}

export interface WorkflowStreamEvent {
  type:
    | 'phase_change'
    | 'plan_content'
    | 'tool_start'
    | 'tool_end'
    | 'approval_required'
    | 'run_paused'
    | 'run_resumed'
    | 'solve_content'
    | 'done'
    | 'error';
  phase?: WorkflowPhase;
  content?: string;
  tool?: string;
  toolResult?: ToolExecutionResult;
  toolCall?: ToolCall;
  checkpoint?: AgentRunCheckpoint;
  pendingStepIndex?: number;
  runId?: string;
  result?: WorkflowResult;
  error?: string;
}

export const TOOL_TIMEOUT_MS = 30000;
export const MAX_SUPPLEMENTAL_PLANNING_ROUNDS = 2;
export const MAX_TOOL_CALLS_PER_RUN = 16;
export const PHASE_WARN_MS: Record<string, number> = {
  plan: 10_000,
  execute: 30_000,
  solve: 15_000,
};

export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

export function getPlanSystemSuffix(
  locale: string,
  harnessEnabled = false,
): string {
  const observationNote = harnessEnabled
    ? locale === 'en'
      ? '\n- Tool results may be followed by a bounded supplemental planning round; never repeat an already successful call with identical arguments'
      : '\n- 工具结果可能触发有界的补充规划；不要重复已经成功且参数完全相同的调用'
    : '';

  if (locale === 'en') {
    return `

## Workflow Instructions (Must Follow Strictly)
You are in the **planning phase**. Your tasks are:
1. Analyze the user's request
2. Determine which tools need to be called to collect information or perform actions
3. Call **all** needed tools at once (do not split into multiple rounds)

Important rules:
- Think carefully, then list all tool calls at once
- Each tool should be called at most once
- If no tools are needed, reply to the user directly
- Do not explain which tools you are calling; just call them${observationNote}

## Tool Selection Principles
- The user's profile summary is provided in "Current User Info" above. Do NOT call get_profile unless you need to verify the latest data or the summary is insufficient.
- Prefer local database tools (get_school_details, search_cases, get_deadlines, etc.)
- Only use web_search or search_school_website when local tools clearly cannot answer (latest policies, current dates, information unlikely in the database)
- search_schools / get_school_details: school basic info from database
- search_school_website: school's official latest info (e.g., confirming deadline changes)
- web_search: only for cross-school general timely information (policies, visas, trends)`;
  }
  return `

## 工作流指令（必须严格遵守）
你正处于 **规划阶段**。你的任务是：
1. 分析用户的需求
2. 判断需要调用哪些工具来收集信息或执行操作
3. **一次性** 调用所有需要的工具（不要分多轮）

重要规则：
- 仔细思考后，一次性列出所有需要的工具调用
- 每种工具最多调用一次
- 如果不需要任何工具，直接回复用户即可
- 不要在回复中解释"我要调用什么工具"，直接调用即可${observationNote}

## 工具选择原则
- 用户档案已在"当前用户信息"中提供，无需调用 get_profile，除非需要验证最新数据
- 优先使用本地数据库工具（get_school_details, search_cases, get_deadlines 等）
- 仅当本地工具明确不足以回答时（最新政策、当前日期、数据库不太可能有的信息），才使用 web_search 或 search_school_website
- search_schools / get_school_details：获取学校基本信息
- search_school_website：获取学校官方最新信息（如确认截止日期变更）
- web_search：仅用于跨学校的通用时效性信息（政策、签证、趋势）`;
}

export function getSolveSystemSuffix(locale: string): string {
  if (locale === 'en') {
    return `

## Workflow Instructions (Must Follow Strictly)
You are in the **summarization phase**. All tools have been executed and their results are in the conversation history.
Your task is: Based on all tool results, generate a complete, friendly, well-organized **English** response.

Important rules:
- **Never** call any tools again
- Generate the response directly based on existing tool results
- If a tool returned an error, inform the user that functionality is temporarily unavailable and answer based on other tool results. Do not fabricate data that the failed tool should have returned
- The response should be complete, organized, and not omit important information
- For prediction explanations, only use safe public fields already returned by tools, such as sourceSummary, uncertaintyReasons, confidenceReason, roundContext, and latestOutcomeLabel. Do not invent hidden policy logic, raw traces, or shadow-model conclusions
- If tool results contain search results (web_search or search_school_website), you **must** cite information from the search results and include source links. Search results are real-time data; use them directly. Do not say "I cannot search" or "I cannot get real-time information"`;
  }
  return `

## 工作流指令（必须严格遵守）
你正处于 **总结阶段**。所有工具已经执行完毕，结果已包含在对话历史中。
你的任务是：基于所有工具返回的数据，生成一个完整、友好、有条理的中文回复。

重要规则：
- **绝对不要** 再调用任何工具
- 直接基于已有的工具结果生成回复
- 如果某个工具返回了 error 信息，告知用户该功能暂时不可用，并基于其他工具结果尽量回答。不要编造该工具本应返回的数据
- 回复要完整、有条理，不要遗漏重要信息
- 涉及预测解释时，只能使用工具已经返回的公开字段，例如 sourceSummary、uncertaintyReasons、confidenceReason、roundContext、latestOutcomeLabel。不要猜测内部 policy 逻辑、raw trace 或 shadow 模型结论
- 如果工具结果中包含搜索结果（web_search 或 search_school_website），你**必须**引用搜索结果中的信息来回答用户问题，并附上来源链接。搜索结果就是实时数据，直接使用即可，不要说"我无法搜索"或"我无法获取实时信息"`;
}
