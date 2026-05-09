import type { AgentChatContext } from '@study-abroad/shared';
import { getSchoolName } from '@/lib/utils';
import type { SchoolPredictionData } from '@/hooks/use-prediction';
import type { SchoolDetail } from './types';

interface BuildSchoolAiContextArgs {
  school?: SchoolDetail | null;
  schoolId: string;
  locale: string;
  predictionData?: SchoolPredictionData;
}

export function buildSchoolAiContext({
  school,
  schoolId,
  locale,
  predictionData,
}: BuildSchoolAiContextArgs): AgentChatContext | undefined {
  if (!school) return undefined;

  if (predictionData?.current) {
    const current = predictionData.current;
    const numericProbability = current.probability ?? undefined;
    const aiTier =
      current.tier === 'reach' || current.tier === 'match' || current.tier === 'safety'
        ? current.tier
        : undefined;
    return {
      type: 'prediction-results',
      source: 'school_detail',
      results: [
        {
          schoolId,
          schoolName: getSchoolName(school, locale),
          probability: numericProbability,
          tier: aiTier,
          confidence: current.confidence as 'high' | 'medium' | 'low' | undefined,
          source: current.source,
          modelVersion: current.modelVersion,
          cohortKey: current.cohortKey,
          roundContext: current.roundContext,
          sourceSummary: current.sourceSummary,
          uncertaintyReasons: current.uncertaintyReasons,
          confidenceReason: current.confidenceReason,
          latestOutcomeLabel: current.latestOutcomeLabel,
          schoolMeta: {
            usNewsRank: school.usNewsRank,
            acceptanceRate: school.acceptanceRate,
            intlAcceptanceRate: school.intlAcceptanceRate,
            intlStudentPct: school.intlStudentPct,
            needBlindInternational: school.needBlindInternational,
            graduationRate: school.graduationRate,
            satAvg: school.satAvg,
            sat25: school.sat25,
            sat75: school.sat75,
          },
        },
      ],
      summary: {
        total: 1,
        reach: current.tier === 'reach' ? 1 : 0,
        match: current.tier === 'match' ? 1 : 0,
        safety: current.tier === 'safety' ? 1 : 0,
        avgProbability: numericProbability ?? 0,
      },
    };
  }

  return {
    type: 'selected-schools',
    source: 'school_detail',
    schools: [
      {
        id: schoolId,
        name: school.name,
        nameZh: school.nameZh,
        usNewsRank: school.usNewsRank,
        acceptanceRate: school.acceptanceRate,
      },
    ],
  };
}
