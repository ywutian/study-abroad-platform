/**
 * AI Agent 系统类型定义
 * 
 * 统一的类型系统，确保各层之间的类型一致性
 */

// ==================== 核心枚举 ====================

export enum AgentType {
  ORCHESTRATOR = 'orchestrator',  // 协调者
  ESSAY = 'essay',                // 文书专家
  SCHOOL = 'school',              // 选校专家
  PROFILE = 'profile',            // 档案分析
  TIMELINE = 'timeline',          // 时间规划
}

export enum MemoryType {
  FACT = 'FACT',           // 事实信息
  PREFERENCE = 'PREFERENCE', // 用户偏好
  DECISION = 'DECISION',   // 决策记录
  SUMMARY = 'SUMMARY',     // 对话摘要
  FEEDBACK = 'FEEDBACK',   // 用户反馈
}

export enum EntityType {
  SCHOOL = 'SCHOOL',       // 学校
  PERSON = 'PERSON',       // 人物
  EVENT = 'EVENT',         // 事件
  TOPIC = 'TOPIC',         // 话题
}

// ==================== 消息类型 ====================

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  agentType?: AgentType;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  callId: string;
  name: string;
  result: any;
  error?: string;
}

// ==================== 上下文 ====================

export interface UserContext {
  userId: string;
  profile?: ProfileSnapshot;
  preferences?: UserPreferences;
  currentGoals?: string[];
  recentActions?: string[];
}

export interface ProfileSnapshot {
  gpa?: number;
  gpaScale?: number;
  testScores?: Array<{ type: string; score: number }>;
  activities?: Array<{ name: string; role: string; category: string }>;
  awards?: Array<{ name: string; level: string }>;
  targetMajor?: string;
  targetSchools?: string[];
  budgetTier?: string;
  grade?: string;
}

export interface UserPreferences {
  schoolSize?: 'small' | 'medium' | 'large';
  location?: string[];
  climate?: string;
  urbanRural?: 'urban' | 'suburban' | 'rural';
}

// ==================== 会话状态 ====================

export interface ConversationState {
  id: string;
  userId: string;
  messages: Message[];
  context: UserContext;
  activeAgent?: AgentType;
  pendingTasks?: Task[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== 任务 ====================

export interface Task {
  id: string;
  type: TaskType;
  status: 'pending' | 'running' | 'completed' | 'failed';
  assignedAgent: AgentType;
  input: any;
  output?: any;
  error?: string;
  parentTaskId?: string;
  childTaskIds?: string[];
}

export enum TaskType {
  // 文书任务
  ESSAY_BRAINSTORM = 'essay_brainstorm',
  ESSAY_OUTLINE = 'essay_outline',
  ESSAY_WRITE = 'essay_write',
  ESSAY_REVIEW = 'essay_review',
  ESSAY_POLISH = 'essay_polish',
  
  // 选校任务
  SCHOOL_RECOMMEND = 'school_recommend',
  SCHOOL_ANALYZE = 'school_analyze',
  SCHOOL_COMPARE = 'school_compare',
  
  // 档案任务
  PROFILE_ANALYZE = 'profile_analyze',
  PROFILE_SUGGEST = 'profile_suggest',
  
  // 规划任务
  TIMELINE_CREATE = 'timeline_create',
  DEADLINE_CHECK = 'deadline_check',
  
  // 通用
  SEARCH = 'search',
  ANSWER = 'answer',
}

// ==================== Agent 响应 ====================

export interface AgentResponse {
  message: string;
  agentType: AgentType;
  toolsUsed?: string[];
  delegatedTo?: AgentType;
  tasks?: Task[];
  suggestions?: string[];
  actions?: ActionButton[];
  data?: any;
}

export interface ActionButton {
  label: string;
  action: string;  // 'navigate:/path' | 'agent:command' | 'copy:text'
  variant?: 'default' | 'outline' | 'ghost';
}

// ==================== Agent 配置 ====================

export interface AgentConfig {
  type: AgentType;
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  canDelegate: AgentType[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

// ==================== 工具定义 ====================

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required: string[];
  };
  handler: string;  // 处理器标识
}

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: string[];
  items?: { type: string };
  properties?: Record<string, ToolParameter>;
  required?: string[];
}

// ==================== 工具执行 ====================

export interface ToolExecutionContext {
  userId: string;
  conversationId?: string;
  agentType: AgentType;
  requestId: string;
  timeout?: number;
}

export interface ToolExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
  cached?: boolean;
}

// ==================== 错误类型 ====================

export enum AgentErrorCode {
  // 系统错误
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  
  // LLM 错误
  LLM_TIMEOUT = 'LLM_TIMEOUT',
  LLM_RATE_LIMIT = 'LLM_RATE_LIMIT',
  LLM_INVALID_RESPONSE = 'LLM_INVALID_RESPONSE',
  LLM_CONTENT_FILTER = 'LLM_CONTENT_FILTER',
  
  // 工具错误
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  TOOL_EXECUTION_FAILED = 'TOOL_EXECUTION_FAILED',
  TOOL_TIMEOUT = 'TOOL_TIMEOUT',
  TOOL_INVALID_PARAMS = 'TOOL_INVALID_PARAMS',
  
  // 业务错误
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  INVALID_AGENT = 'INVALID_AGENT',
  MAX_ITERATIONS_EXCEEDED = 'MAX_ITERATIONS_EXCEEDED',
  
  // 用户错误
  INVALID_INPUT = 'INVALID_INPUT',
  PROFILE_NOT_FOUND = 'PROFILE_NOT_FOUND',
  CONVERSATION_NOT_FOUND = 'CONVERSATION_NOT_FOUND',
}

export interface AgentError {
  code: AgentErrorCode;
  message: string;
  details?: Record<string, any>;
  retryable: boolean;
  timestamp: Date;
}

// ==================== 事件类型 ====================

export enum AgentEventType {
  // 生命周期
  REQUEST_START = 'request.start',
  REQUEST_END = 'request.end',
  
  // Agent
  AGENT_START = 'agent.start',
  AGENT_END = 'agent.end',
  AGENT_DELEGATE = 'agent.delegate',
  
  // LLM
  LLM_START = 'llm.start',
  LLM_STREAM = 'llm.stream',
  LLM_END = 'llm.end',
  
  // 工具
  TOOL_START = 'tool.start',
  TOOL_END = 'tool.end',
  
  // 记忆
  MEMORY_SAVE = 'memory.save',
  MEMORY_RECALL = 'memory.recall',
  
  // 错误
  ERROR = 'error',
}

export interface AgentEvent {
  type: AgentEventType;
  timestamp: Date;
  requestId: string;
  userId?: string;
  agentType?: AgentType;
  data?: Record<string, any>;
}

// ==================== 流式输出 ====================

export interface StreamChunk {
  type: 'content' | 'tool_call' | 'tool_result' | 'agent_switch' | 'thinking' | 'done' | 'error';
  content?: string;
  toolCall?: Partial<ToolCall>;
  toolResult?: ToolResult;
  agentType?: AgentType;
  error?: AgentError;
  metadata?: Record<string, any>;
}

// ==================== 统计指标 ====================

export interface AgentStats {
  requestCount: number;
  successCount: number;
  errorCount: number;
  avgLatencyMs: number;
  p99LatencyMs: number;
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
  toolUsage: Record<string, number>;
  agentUsage: Record<AgentType, number>;
}

// ==================== 健康检查 ====================

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    llm: ComponentHealth;
    storage: ComponentHealth;
    memory: ComponentHealth;
  };
  timestamp: Date;
}

export interface ComponentHealth {
  status: 'up' | 'down' | 'degraded';
  latencyMs?: number;
  errorRate?: number;
  details?: Record<string, any>;
}

// ==================== 类型守卫 ====================

export function isAgentType(value: string): value is AgentType {
  return Object.values(AgentType).includes(value as AgentType);
}

export function isMemoryType(value: string): value is MemoryType {
  return Object.values(MemoryType).includes(value as MemoryType);
}

export function isAgentError(error: any): error is AgentError {
  return error && typeof error.code === 'string' && typeof error.retryable === 'boolean';
}

