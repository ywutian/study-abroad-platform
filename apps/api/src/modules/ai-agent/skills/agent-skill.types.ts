import type { AgentConfig, AgentType } from '../types';

export const AGENT_SKILL_SCHEMA_VERSION = 1 as const;

export type AgentSkillSource =
  'BOOTSTRAP' | 'ADMIN' | 'AUTO_EVOLUTION' | 'ROLLBACK';

export interface AgentSkillExample {
  input: string;
  output: string;
}

export interface AgentSkillOutputRules {
  requiredSections?: string[];
  requiredJsonFields?: string[];
  forbiddenClaims?: string[];
}

/**
 * The complete set of fields evolution is allowed to change.
 * There is intentionally no model, credential, budget, policy, handler or code field.
 */
export interface DeclarativeAgentSkill {
  schemaVersion: typeof AGENT_SKILL_SCHEMA_VERSION;
  agentType: AgentType;
  instructions: {
    zh: string[];
    en: string[];
  };
  examples: AgentSkillExample[];
  toolHints: Record<string, string>;
  allowedTools: string[];
  outputRules: AgentSkillOutputRules;
  workflowTemplate: string[];
}

export interface ResolvedAgentSkill {
  config: AgentConfig;
  versionId?: string;
  version?: number;
  contentHash?: string;
}

export interface AgentSkillCandidatePatch {
  instructions?: Partial<DeclarativeAgentSkill['instructions']>;
  examples?: AgentSkillExample[];
  toolHints?: Record<string, string>;
  allowedTools?: string[];
  outputRules?: AgentSkillOutputRules;
  workflowTemplate?: string[];
}

export interface AgentSkillGateMetrics {
  totalCases: number;
  passedCases: number;
  taskSuccessRate: number;
  toolAccuracy: number;
  refusalAccuracy: number;
  schemaCompliance: number;
  privacyCompliance: number;
  permissionCompliance: number;
  averageTokens: number;
  p95LatencyMs: number;
  failureRate: number;
  targetFailureRate: number;
}

export interface AgentSkillComparison {
  baseline: AgentSkillGateMetrics;
  candidate: AgentSkillGateMetrics;
}
