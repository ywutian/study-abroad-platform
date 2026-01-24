/**
 * Agent 聊天类型定义
 */

export type AgentType = 'orchestrator' | 'essay' | 'school' | 'profile' | 'timeline';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agent?: AgentType;
  toolCalls?: ToolCallInfo[];
  isStreaming?: boolean;
  timestamp: Date;
}

export interface ToolCallInfo {
  name: string;
  status: 'running' | 'completed' | 'error';
  result?: any;
}

export interface StreamEvent {
  type: 'start' | 'content' | 'tool_start' | 'tool_end' | 'agent_switch' | 'done' | 'error';
  agent?: AgentType;
  conversationId?: string; // 对话 ID，用于保持上下文
  title?: string; // 对话标题（新对话时在 start 事件中返回）
  content?: string;
  tool?: string;
  toolResult?: any;
  response?: AgentResponse;
  error?: string;
}

export interface AgentResponse {
  message: string;
  agentType: AgentType;
  toolsUsed?: string[];
  suggestions?: string[];
  actions?: ActionButton[];
}

export interface ActionButton {
  label: string;
  action: string;
  variant?: 'default' | 'outline' | 'ghost';
}

export interface QuickAction {
  label: string;
  message: string;
  icon?: React.ReactNode;
}

export const AGENT_INFO: Record<
  AgentType,
  { name: string; nameZh: string; icon: string; color: string }
> = {
  orchestrator: { name: 'AI Assistant', nameZh: '智能助手', icon: '🤖', color: 'text-primary' },
  essay: { name: 'Essay Expert', nameZh: '文书专家', icon: '📝', color: 'text-purple-500' },
  school: { name: 'School Advisor', nameZh: '选校专家', icon: '🎯', color: 'text-blue-500' },
  profile: { name: 'Profile Analyst', nameZh: '档案分析', icon: '📊', color: 'text-green-500' },
  timeline: { name: 'Timeline Planner', nameZh: '时间规划', icon: '📅', color: 'text-orange-500' },
};

export interface ConversationSummary {
  id: string;
  title?: string;
  summary?: string;
  agentType?: AgentType;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export const QUICK_ACTION_KEYS = [
  { labelKey: 'analyzeProfile', messageKey: 'analyzeProfileMessage' },
  { labelKey: 'recommendSchools', messageKey: 'recommendSchoolsMessage' },
  { labelKey: 'evaluateEssay', messageKey: 'evaluateEssayMessage' },
  { labelKey: 'viewDeadlines', messageKey: 'viewDeadlinesMessage' },
];
