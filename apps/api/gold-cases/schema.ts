import type {
  AnalysisState,
  SchoolTestingPolicy,
} from '../src/modules/ai/ai.types';

export interface GoldCaseExpectedSchool {
  schoolId?: string;
  schoolName: string;
  tier: 'REACH' | 'TARGET' | 'SAFETY';
  testingPolicy: SchoolTestingPolicy;
  probabilityRange?: [number, number];
  forbidden?: {
    fieldInSummary?: string[];
    invalidActionKeywords?: string[];
  };
}

export interface GoldCase {
  id: string;
  description: string;
  createdAt: string;
  lastReviewedAt: string;
  inputConfig: {
    locale: 'en' | 'zh';
  };
  analysisSnapshot: Record<string, unknown>;
  profileSnapshotRef?: string;
  expected: {
    state: AnalysisState;
    portfolioBalance?:
      | 'balanced'
      | 'reachHeavy'
      | 'safetyHeavy'
      | 'undermatch'
      | 'insufficient';
    schoolCards: GoldCaseExpectedSchool[];
    meta?: {
      confidence?: 'low' | 'medium' | 'high';
      minActionCount?: number;
    };
  };
  tags: string[];
  ownerEmail: string;
}

export interface GoldReplayFailure {
  dimension:
    | 'state'
    | 'school_presence'
    | 'tier'
    | 'testingPolicy'
    | 'probability'
    | 'forbiddenKeyword'
    | 'contract'
    | 'actionability';
  expected: unknown;
  actual: unknown;
  severity: 'block' | 'warn';
  message: string;
}

export interface GoldReplayCaseResult {
  caseId: string;
  passed: boolean;
  failures: GoldReplayFailure[];
  durationMs: number;
  journeyScore: number;
  actionabilityScore: number;
}
