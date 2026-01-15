/**
 * Core 服务类型定义
 *
 * 替代所有 any 使用，提供类型安全
 */

import { AgentType, ToolCall, Message } from '../types';

// ==================== LLM 相关类型 ====================

/**
 * OpenAI Chat Completion 请求体
 */
export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
  tools?: ToolDefinition[];
  tool_choice?:
    | 'auto'
    | 'none'
    | { type: 'function'; function: { name: string } };
  response_format?: { type: 'text' | 'json_object' };
}

/**
 * OpenAI Chat Message
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

/**
 * OpenAI Tool Call
 */
export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Tool Definition for OpenAI
 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, ToolParameterSchema>;
      required?: string[];
    };
  };
}

/**
 * Tool Parameter Schema
 */
export interface ToolParameterSchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: string[];
  items?: ToolParameterSchema;
  properties?: Record<string, ToolParameterSchema>;
  required?: string[];
}

/**
 * OpenAI Chat Completion Response
 */
export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Chat Completion Choice
 */
export interface ChatCompletionChoice {
  index: number;
  message: {
    role: 'assistant';
    content: string | null;
    tool_calls?: OpenAIToolCall[];
  };
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
}

/**
 * LLM Response (internal)
 */
export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  finishReason: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Streaming Chunk
 */
export interface StreamChunkData {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: StreamChoice[];
}

export interface StreamChoice {
  index: number;
  delta: {
    role?: 'assistant';
    content?: string;
    tool_calls?: Partial<OpenAIToolCall>[];
  };
  finish_reason: string | null;
}

// ==================== Orchestrator 相关类型 ====================

/**
 * 流式事件
 */
export interface StreamEvent {
  type:
    | 'thinking'
    | 'content'
    | 'tool_call'
    | 'tool_result'
    | 'agent_switch'
    | 'done'
    | 'error';
  content?: string;
  tool?: string;
  toolResult?: ToolExecutionResult;
  agentType?: AgentType;
  error?: string;
  actions?: ActionSuggestion[];
}

/**
 * 动作建议
 */
export interface ActionSuggestion {
  label: string;
  action: string;
  variant?: 'default' | 'outline' | 'ghost';
}

/**
 * 工具执行结果
 */
export interface ToolExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
}

/**
 * 委派调用
 */
export interface DelegateCall {
  id: string;
  type: 'function';
  function: {
    name: 'delegate_to_agent';
    arguments: string;
  };
}

/**
 * 委派参数
 */
export interface DelegateArguments {
  agent: AgentType;
  task: string;
  context?: string;
}

// ==================== Agent Runner 相关类型 ====================

/**
 * 待处理的工具调用
 */
export interface PendingToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  argumentsRaw?: string;
}

// ==================== Memory Service 相关类型 ====================

/**
 * 工具结果摘要
 */
export interface ToolResultSummary {
  type: 'array' | 'object' | 'scalar';
  count?: number;
  sample?: unknown;
  keys?: string[];
}

/**
 * Profile 快照
 */
export interface ProfileData {
  id: string;
  userId: string;
  gpa?: number;
  gpaScale?: number;
  testScores?: TestScoreData[];
  activities?: ActivityData[];
  awards?: AwardData[];
  targetMajor?: string;
  budgetTier?: string;
  grade?: string;
}

export interface TestScoreData {
  type: string;
  score: number;
  date?: Date;
}

export interface ActivityData {
  name: string;
  role: string;
  category: string;
  description?: string;
}

export interface AwardData {
  name: string;
  level: string;
  date?: Date;
}

// ==================== Token Tracker 相关类型 ====================

/**
 * Token 使用记录
 */
export interface TokenUsageRecord {
  requestId: string;
  userId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  timestamp: Date;
  metadata?: TokenUsageMetadata;
}

export interface TokenUsageMetadata {
  agentType?: AgentType;
  conversationId?: string;
  toolCalls?: number;
  [key: string]: unknown;
}

// ==================== Tool Executor 相关类型 ====================

/**
 * Legacy Context (兼容旧接口)
 */
export interface LegacyUserContext {
  userId: string;
  profile?: {
    gpa?: number;
    gpaScale?: number;
    testScores?: Array<{ type: string; score: number }>;
    activities?: Array<{ name: string; role: string; category: string }>;
    awards?: Array<{ name: string; level: string }>;
    targetMajor?: string;
    budgetTier?: string;
    grade?: string;
  };
  preferences?: {
    schoolSize?: string;
    location?: string[];
  };
}

// ==================== 类型守卫函数 ====================

/**
 * 检查是否为有效的 ChatCompletionResponse
 */
export function isChatCompletionResponse(
  data: unknown,
): data is ChatCompletionResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'choices' in data &&
    Array.isArray((data as ChatCompletionResponse).choices)
  );
}

/**
 * 检查是否为有效的 OpenAI Tool Call
 */
export function isOpenAIToolCall(data: unknown): data is OpenAIToolCall {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'type' in data &&
    'function' in data &&
    (data as OpenAIToolCall).type === 'function'
  );
}

/**
 * 安全解析 JSON
 */
export function safeParseJSON<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * 解析工具调用参数
 */
export function parseToolArguments(
  argumentsStr: string,
): Record<string, unknown> {
  return safeParseJSON(argumentsStr, {});
}
