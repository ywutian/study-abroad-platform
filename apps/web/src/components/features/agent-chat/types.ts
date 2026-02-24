/**
 * Agent 聊天类型定义
 *
 * 基础类型从 @study-abroad/shared 导入，
 * 本文件仅保留前端 UI 专用的类型和常量。
 */

export { AgentType } from '@study-abroad/shared';
export type { StreamEvent, ActionButton, AgentResponse } from '@study-abroad/shared';
import { AgentType } from '@study-abroad/shared';

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
  result?: unknown;
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
