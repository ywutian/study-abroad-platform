export interface JsonRecord {
  [key: string]: unknown;
  accessToken?: string;
  agentType?: string;
  approval?: JsonRecord;
  approvalId?: string;
  approvalRequired?: JsonRecord;
  conversationId?: string;
  data?: JsonRecord;
  enableMemory?: boolean;
  errorCode?: string;
  fingerprint?: string;
  id?: string;
  memoryContext?: JsonRecord;
  messageCount?: number;
  runId?: string;
  runStatus?: string;
  status?: string;
  summary?: string;
  title?: string;
  totalEntities?: number;
  totalMemories?: number;
  totals?: Record<string, number>;
  type?: string;
  user?: JsonRecord;
}
