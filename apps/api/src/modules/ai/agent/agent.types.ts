/**
 * 留学申请 AI Agent 类型定义
 */

// Agent 可用的工具
export enum AgentTool {
  // 档案相关
  GET_PROFILE = 'get_profile',
  UPDATE_PROFILE = 'update_profile',

  // 学校相关
  SEARCH_SCHOOLS = 'search_schools',
  GET_SCHOOL_DETAILS = 'get_school_details',
  COMPARE_SCHOOLS = 'compare_schools',

  // 文书相关
  GET_ESSAYS = 'get_essays',
  REVIEW_ESSAY = 'review_essay',
  POLISH_ESSAY = 'polish_essay',
  GENERATE_OUTLINE = 'generate_outline',
  BRAINSTORM_IDEAS = 'brainstorm_ideas',

  // 选校相关
  RECOMMEND_SCHOOLS = 'recommend_schools',
  ANALYZE_ADMISSION_CHANCE = 'analyze_admission_chance',

  // 案例相关
  SEARCH_CASES = 'search_cases',

  // 时间线相关
  GET_DEADLINES = 'get_deadlines',
  CREATE_TIMELINE = 'create_timeline',
  GET_PERSONAL_EVENTS = 'get_personal_events',
  CREATE_PERSONAL_EVENT = 'create_personal_event',

  // 测评相关
  GET_ASSESSMENT_RESULTS = 'get_assessment_results',
  INTERPRET_ASSESSMENT = 'interpret_assessment',
  SUGGEST_ACTIVITIES_FROM_ASSESSMENT = 'suggest_activities_from_assessment',

  // 论坛相关
  SEARCH_FORUM_POSTS = 'search_forum_posts',
  GET_POPULAR_DISCUSSIONS = 'get_popular_discussions',
  ANSWER_FORUM_QUESTION = 'answer_forum_question',

  // 案例预测游戏相关
  EXPLAIN_CASE_RESULT = 'explain_case_result',
  ANALYZE_PREDICTION_ACCURACY = 'analyze_prediction_accuracy',
  COMPARE_CASE_WITH_PROFILE = 'compare_case_with_profile',

  // 档案排名相关
  ANALYZE_PROFILE_RANKING = 'analyze_profile_ranking',
  SUGGEST_PROFILE_IMPROVEMENTS = 'suggest_profile_improvements',
  COMPARE_WITH_ADMITTED_PROFILES = 'compare_with_admitted_profiles',

  // 外部搜索相关
  WEB_SEARCH = 'web_search',
  SEARCH_SCHOOL_WEBSITE = 'search_school_website',
}

// 工具定义
export interface ToolDefinition {
  name: AgentTool;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<
      string,
      {
        type: string;
        description: string;
        enum?: string[];
      }
    >;
    required: string[];
  };
}

// Agent 消息
export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

// 工具调用
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

// 工具执行结果
export interface ToolResult {
  toolCallId: string;
  result: any;
  error?: string;
}

// Agent 状态
export interface AgentState {
  userId: string;
  conversationId: string;
  messages: AgentMessage[];
  context: AgentContext;
  currentPlan?: AgentPlan;
}

// Agent 上下文 - 记忆用户信息
export interface AgentContext {
  profile?: {
    gpa?: number;
    gpaScale?: number;
    testScores?: Array<{ type: string; score: number }>;
    targetMajor?: string;
    targetSchools?: string[];
    budgetTier?: string;
  };
  preferences?: {
    schoolSize?: string;
    location?: string;
    climate?: string;
  };
  currentTasks?: string[];
  completedTasks?: string[];
  lastUpdated?: Date;
}

// Agent 计划
export interface AgentPlan {
  goal: string;
  steps: AgentStep[];
  currentStep: number;
  status: 'planning' | 'executing' | 'completed' | 'failed';
}

// 计划步骤
export interface AgentStep {
  id: string;
  description: string;
  tool?: AgentTool;
  toolArgs?: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  reasoning?: string;
}

// Agent 响应
export interface AgentResponse {
  message: string;
  toolsUsed?: string[];
  plan?: AgentPlan;
  suggestions?: string[];
  nextActions?: Array<{
    label: string;
    action: string;
  }>;
}

// Agent 配置
export interface AgentConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  maxIterations: number;
  tools: AgentTool[];
}
