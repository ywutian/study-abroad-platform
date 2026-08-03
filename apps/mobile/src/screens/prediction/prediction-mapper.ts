import {
  resolveContextualBaseline,
  type PredictionDashboardData,
  type PredictionPublicExplanation,
} from '@study-abroad/shared';

export interface MobilePredictionResult {
  schoolId: string;
  schoolName: string;
  probability: number | null;
  confidence: 'low' | 'medium' | 'high';
  tier: 'reach' | 'match' | 'safety' | 'unavailable';
  factors: Array<{ name: string; impact: string; detail: string }>;
  suggestions: string[];
  publicExplanation?: PredictionPublicExplanation;
  schoolMeta?: {
    acceptanceRate?: number | null;
    intlAcceptanceRate?: number | null;
    needBlindInternational?: boolean | null;
  };
  roundContext?: string | null;
  contextualBaseline?: ReturnType<typeof resolveContextualBaseline>;
  confidenceReason?: string;
  sourceSummary?: Array<{ label: string; detail?: string }>;
  uncertaintyReasons?: string[];
  updatedAt?: string;
}

export function mapDashboardToPredictions(
  dashboard: PredictionDashboardData | undefined,
  isInternational: boolean
): MobilePredictionResult[] {
  if (!dashboard?.predictions) return [];
  return dashboard.predictions.map((prediction) => ({
    schoolId: prediction.schoolId,
    schoolName: prediction.school?.name || prediction.schoolId,
    probability: prediction.probability,
    confidence: prediction.confidence || 'medium',
    tier: prediction.tier,
    factors: prediction.factors ?? [],
    suggestions: prediction.suggestions ?? [],
    publicExplanation: prediction.publicExplanation,
    schoolMeta: prediction.school
      ? {
          acceptanceRate: prediction.school.acceptanceRate,
          intlAcceptanceRate: prediction.school.intlAcceptanceRate,
          needBlindInternational: prediction.school.needBlindInternational ?? null,
        }
      : undefined,
    roundContext: prediction.roundContext,
    contextualBaseline:
      prediction.probability == null
        ? null
        : resolveContextualBaseline({
            schoolMeta: prediction.school,
            isInternational,
            roundContext: prediction.roundContext,
            probability: prediction.probability,
          }),
    confidenceReason: prediction.confidenceReason,
    sourceSummary: prediction.sourceSummary,
    uncertaintyReasons: prediction.uncertaintyReasons,
    updatedAt: prediction.updatedAt,
  }));
}
