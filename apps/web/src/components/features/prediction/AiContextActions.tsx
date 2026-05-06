'use client';

import { useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { AgentType } from '@study-abroad/shared';
import {
  BarChart3,
  TrendingUp,
  School,
  Target,
  Lightbulb,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { getSchoolName, formatAcceptanceRate } from '@/lib/utils';
import { openFloatingAgentChat } from '@/components/features/agent-chat/floating-chat-bridge';
import type { PredictionResult, SchoolSearchItem } from './types';

interface AiContextActionsProps {
  results: PredictionResult[];
  selectedSchools: SchoolSearchItem[];
}

type ActionContextMode = 'prediction' | 'selected' | 'auto';

export function AiContextActions({ results, selectedSchools }: AiContextActionsProps) {
  const t = useTranslations();
  const locale = useLocale();

  const actions = useMemo(() => {
    const items: Array<{
      id: string;
      label: string;
      icon: React.ReactNode;
      prompt: string;
      contextMode: ActionContextMode;
    }> = [];

    if (results.length > 0) {
      const resultsText = results
        .map((r) => {
          const range =
            r.probabilityLow && r.probabilityHigh
              ? ` (${(r.probabilityLow * 100).toFixed(0)}-${(r.probabilityHigh * 100).toFixed(0)}%)`
              : '';
          const probability =
            r.probability == null ? 'not enough data' : `${(r.probability * 100).toFixed(0)}%`;
          return `- ${r.schoolName}: ${probability}${range} [${r.tier}] (${r.factors.map((f) => `${f.name}: ${f.detail}`).join(', ')})`;
        })
        .join('\n');
      const resultsShort = results
        .map((r) => {
          const probability =
            r.probability == null ? 'not enough data' : `${(r.probability * 100).toFixed(0)}%`;
          return `- ${r.schoolName}: ${probability}`;
        })
        .join('\n');

      items.push(
        {
          id: 'analyze-results',
          label: t('prediction.aiActions.analyzeResults'),
          prompt: t('prediction.aiActions.analyzeResultsPrompt', { results: resultsText }),
          icon: <BarChart3 className="h-4 w-4" />,
          contextMode: 'prediction',
        },
        {
          id: 'improve-chances',
          label: t('prediction.aiActions.improveChances'),
          prompt: t('prediction.aiActions.improveChancesPrompt', { results: resultsShort }),
          icon: <TrendingUp className="h-4 w-4" />,
          contextMode: 'prediction',
        }
      );
    }

    if (selectedSchools.length > 0) {
      const schoolsText = selectedSchools
        .map(
          (s) =>
            `- ${getSchoolName(s, locale)}${s.usNewsRank ? ` (#${s.usNewsRank})` : ''}${s.acceptanceRate ? ` (${t('prediction.acceptanceRateLabel', { rate: formatAcceptanceRate(s.acceptanceRate).replace('%', '') })})` : ''}`
        )
        .join('\n');
      items.push({
        id: 'school-analysis',
        label: t('prediction.aiActions.analyzeSelectedSchools'),
        prompt: t('prediction.aiActions.analyzeSelectedSchoolsPrompt', { schools: schoolsText }),
        icon: <School className="h-4 w-4" />,
        contextMode: 'selected',
      });
    }

    items.push(
      {
        id: 'recommend-schools',
        label: t('prediction.aiActions.recommendSchools'),
        prompt: t('prediction.aiActions.recommendSchoolsPrompt'),
        icon: <Target className="h-4 w-4" />,
        contextMode: 'auto',
      },
      {
        id: 'application-strategy',
        label: t('prediction.aiActions.applicationStrategy'),
        prompt: t('prediction.aiActions.applicationStrategyPrompt'),
        icon: <Lightbulb className="h-4 w-4" />,
        contextMode: 'auto',
      },
      {
        id: 'explain-prediction',
        label: t('prediction.aiActions.explainModel'),
        prompt: t('prediction.aiActions.explainModelPrompt'),
        icon: <GraduationCap className="h-4 w-4" />,
        contextMode: 'auto',
      }
    );

    return items;
  }, [results, selectedSchools, locale, t]);

  const predictionContext = useMemo(() => {
    if (results.length === 0) return undefined;
    const numericResults = results.filter((r) => r.probability != null);
    return {
      type: 'prediction-results' as const,
      source: 'prediction_page' as const,
      results: results.map((r) => ({
        schoolId: r.schoolId,
        schoolName: r.schoolName,
        probability: r.probability ?? 0,
        tier: r.tier,
        confidence: r.confidence,
        source: r.source,
        modelVersion: r.modelVersion,
        roundContext: r.roundContext,
        cohortKey: r.cohortKey,
        sourceSummary: r.sourceSummary,
        uncertaintyReasons: r.uncertaintyReasons,
        confidenceReason: r.confidenceReason,
        latestOutcomeLabel: r.latestOutcomeLabel,
        schoolMeta: r.schoolMeta,
      })),
      summary: {
        total: results.length,
        reach: results.filter((r) => r.tier === 'reach').length,
        match: results.filter((r) => r.tier === 'match').length,
        safety: results.filter((r) => r.tier === 'safety').length,
        avgProbability:
          numericResults.length > 0
            ? numericResults.reduce((acc, r) => acc + (r.probability ?? 0), 0) /
              numericResults.length
            : 0,
      },
    };
  }, [results]);

  const selectedSchoolsContext = useMemo(() => {
    if (selectedSchools.length === 0) return undefined;
    const predictionBySchoolId = new Map(
      results.map((result) => [
        result.schoolId,
        {
          probability: result.probability ?? 0,
          tier: result.tier,
          confidence: result.confidence,
          source: result.source,
          modelVersion: result.modelVersion,
        },
      ])
    );

    return {
      type: 'selected-schools' as const,
      source: 'prediction_page' as const,
      schools: selectedSchools.map((school) => ({
        id: school.id,
        name: school.name,
        nameZh: school.nameZh,
        usNewsRank: school.usNewsRank,
        acceptanceRate: school.acceptanceRate ?? undefined,
        prediction: predictionBySchoolId.get(school.id),
      })),
    };
  }, [results, selectedSchools]);

  const dispatchAction = (prompt: string, contextMode: ActionContextMode) => {
    const context =
      contextMode === 'prediction'
        ? predictionContext
        : contextMode === 'selected'
          ? selectedSchoolsContext
          : (predictionContext ?? selectedSchoolsContext);

    openFloatingAgentChat({
      message: prompt,
      context,
      agentHint: AgentType.SCHOOL,
    });
  };

  return (
    <div className="mt-6 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">{t('prediction.aiAssistantTitle')}</span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {t('prediction.aiAssistantDescWithResults')}
      </p>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.id}
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => dispatchAction(action.prompt, action.contextMode)}
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
