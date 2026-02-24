export interface GlobalMemoryStats {
  totalMemories: number;
  totalConversations: number;
  totalMessages: number;
  totalEntities: number;
  memoryByType: Record<string, number>;
  entityByType: Record<string, number>;
  recentActivity: {
    memoriesLast7Days: number;
    conversationsLast7Days: number;
    messagesLast7Days: number;
  };
  compaction: {
    totalCompactions: number;
    averageCompressionRatio: number;
  };
}

export interface EnhancedMemoryStats {
  totalMemories: number;
  totalConversations: number;
  totalMessages: number;
  totalEntities: number;
  memoryByType: Record<string, number>;
  recentActivity: {
    conversationsLast7Days: number;
    messagesLast7Days: number;
  };
  decay?: {
    totalMemories: number;
    byTier: Record<string, number>;
    averageImportance: number;
    averageFreshness: number;
    scheduledForArchive: number;
    scheduledForDelete: number;
  };
  scoring?: {
    averageScore: number;
    tierDistribution: Record<string, number>;
  };
}

export interface MemoryItem {
  id: string;
  userId: string;
  type: string;
  category: string | null;
  content: string;
  importance: number;
  accessCount: number;
  lastAccessedAt: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationItem {
  id: string;
  userId: string;
  title: string | null;
  summary: string | null;
  agentType: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MessageItem {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  agentType?: string;
  tokensUsed?: number;
  latencyMs?: number;
  createdAt: string;
}

export interface EntityItem {
  id: string;
  userId: string;
  type: string;
  name: string;
  description: string | null;
  attributes: Record<string, any> | null;
  relations: any[] | null;
  createdAt: string;
}

export interface DecayConfig {
  enabled: boolean;
  decayRate: number;
  minImportance: number;
  accessBoost: number;
  maxAccessBoost: number;
  archiveThreshold: number;
  archiveAfterDays: number;
  deleteAfterDays: number;
  batchSize: number;
}

export interface DecayStats {
  totalMemories: number;
  byTier: Record<string, number>;
  averageImportance: number;
  averageFreshness: number;
  scheduledForArchive: number;
  scheduledForDelete: number;
}

export interface DecayResult {
  success: boolean;
  result?: {
    processed: number;
    decayed: number;
    archived: number;
    deleted: number;
    errors: number;
    durationMs: number;
  };
}

export const MEMORY_TYPES = ['FACT', 'PREFERENCE', 'DECISION', 'SUMMARY', 'FEEDBACK'] as const;
export const ENTITY_TYPES = ['SCHOOL', 'PERSON', 'EVENT', 'TOPIC'] as const;

export const memoryTypeBadge: Record<string, string> = {
  FACT: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  PREFERENCE: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  DECISION: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  SUMMARY: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400',
  FEEDBACK: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
};

export const entityTypeBadge: Record<string, string> = {
  SCHOOL: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  PERSON: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  EVENT: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  TOPIC: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
};

export const formatDate = (d: string) => new Date(d).toLocaleString();
export const truncate = (s: string, len: number) => (s.length > len ? s.slice(0, len) + '...' : s);
