import type { AIAnalysisResult } from '../types/ai-agent';

/**
 * Stable client view of application analysis. Top-level V2 fields are the
 * authority; nested V1 fields remain fallbacks for previously cached payloads.
 */
export function normalizeApplicationAnalysis(analysis: AIAnalysisResult) {
  return {
    overallVerdict: analysis.overallVerdict || analysis.portfolioSummary.verdict,
    schoolCards: analysis.schoolCards?.length ? analysis.schoolCards : analysis.schools,
    topReasons: analysis.topReasons?.length
      ? analysis.topReasons
      : analysis.portfolioSummary.keyReasons,
    topRisks: analysis.topRisks?.length
      ? analysis.topRisks
      : analysis.portfolioSummary.riskBoundaries,
    nextActions: analysis.nextActions?.length
      ? analysis.nextActions
      : [
          ...(analysis.actionPlan.now ?? []),
          ...(analysis.actionPlan.next90Days ?? []),
          ...(analysis.actionPlan.beforeSubmission ?? []),
        ],
    evidenceSummary: analysis.evidenceSummary ?? [],
    confidenceSummary: analysis.confidenceSummary ?? {
      level: 'low' as const,
      summary: '',
      signals: [],
    },
    freshnessSummary: analysis.freshnessSummary ?? {
      status: analysis.status ?? ('degraded' as const),
      summary: '',
      generatedAt: '',
    },
  };
}
