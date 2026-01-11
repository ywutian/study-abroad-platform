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

export const AGENT_INFO: Record<AgentType, { name: string; icon: string; color: string }> = {
  orchestrator: { name: '智能助手', icon: '🤖', color: 'text-primary' },
  essay: { name: '文书专家', icon: '📝', color: 'text-purple-500' },
  school: { name: '选校专家', icon: '🎯', color: 'text-blue-500' },
  profile: { name: '档案分析', icon: '📊', color: 'text-green-500' },
  timeline: { name: '时间规划', icon: '📅', color: 'text-orange-500' },
};

export const QUICK_ACTIONS: QuickAction[] = [
  { label: '分析我的档案', message: '请帮我分析一下我的档案竞争力' },
  { label: '推荐学校', message: '根据我的背景推荐一些适合的学校' },
  { label: '评估文书', message: '帮我评估一下我的文书' },
  { label: '查看截止日期', message: '帮我整理一下目标学校的申请截止日期' },
];









