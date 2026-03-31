// AI Agent

export enum AgentType {
  ORCHESTRATOR = 'orchestrator',
  ESSAY = 'essay',
  SCHOOL = 'school',
  PROFILE = 'profile',
  TIMELINE = 'timeline',
  RESUME = 'resume',
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  agentType?: AgentType;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  timestamp: Date;
}

export interface ToolCall {
  id?: string;
  name: string;
  arguments?: Record<string, unknown>;
  result?: unknown;
  status?: string;
}

export interface ActionButton {
  label: string;
  action: string;
  variant?: 'default' | 'outline' | 'ghost';
}

export interface AgentResponse {
  message: string;
  agentType: AgentType;
  toolsUsed?: string[];
  suggestions?: string[];
  actions?: ActionButton[];
  data?: Record<string, unknown>;
}

export interface StreamEvent {
  type: 'start' | 'content' | 'tool_start' | 'tool_end' | 'agent_switch' | 'done' | 'error';
  agent?: AgentType;
  conversationId?: string;
  title?: string;
  content?: string;
  tool?: string;
  toolResult?: unknown;
  response?: AgentResponse;
  error?: string;
  memoryContext?: {
    recentMemories: number;
    relevantFacts: number;
    entities: string[];
  };
}

// AI Analysis (Profile)
export type SectionStatus = 'green' | 'yellow' | 'red';

export interface SectionAnalysis {
  status: SectionStatus;
  score: number;
  feedback: string;
  highlights?: string[];
  improvements?: string[];
}

export interface AIAnalysisResult {
  sections: {
    academic: SectionAnalysis;
    testScores: SectionAnalysis;
    activities: SectionAnalysis;
    awards: SectionAnalysis;
  };
  overallScore: number;
  tier: 'top10' | 'top30' | 'top50' | 'top100' | 'other';
  suggestions: {
    majors: string[];
    competitions: string[];
    activities: string[];
    summerPrograms: string[];
    timeline: string[];
  };
  summary: string;
}
