'use client';

import { useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
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
import type { PredictionResult, SchoolSearchItem } from './types';

interface AiContextActionsProps {
  results: PredictionResult[];
  selectedSchools: SchoolSearchItem[];
}

export function AiContextActions({ results, selectedSchools }: AiContextActionsProps) {
  const t = useTranslations();
  const locale = useLocale();

  const actions = useMemo(() => {
    const items: Array<{ id: string; label: string; icon: React.ReactNode; prompt: string }> = [];

    if (results.length > 0) {
      const resultsText = results
        .map((r) => {
          const range =
            r.probabilityLow && r.probabilityHigh
              ? ` (${(r.probabilityLow * 100).toFixed(0)}-${(r.probabilityHigh * 100).toFixed(0)}%)`
              : '';
          return `- ${r.schoolName}: ${(r.probability * 100).toFixed(0)}%${range} [${r.tier}] (${r.factors.map((f) => `${f.name}: ${f.detail}`).join(', ')})`;
        })
        .join('\n');
      const resultsShort = results
        .map((r) => `- ${r.schoolName}: ${(r.probability * 100).toFixed(0)}%`)
        .join('\n');

      items.push(
        {
          id: 'analyze-results',
          label: t('prediction.aiActions.analyzeResults'),
          prompt: t('prediction.aiActions.analyzeResultsPrompt', { results: resultsText }),
          icon: <BarChart3 className="h-4 w-4" />,
        },
        {
          id: 'improve-chances',
          label: t('prediction.aiActions.improveChances'),
          prompt: t('prediction.aiActions.improveChancesPrompt', { results: resultsShort }),
          icon: <TrendingUp className="h-4 w-4" />,
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
      });
    }

    items.push(
      {
        id: 'recommend-schools',
        label: t('prediction.aiActions.recommendSchools'),
        prompt: t('prediction.aiActions.recommendSchoolsPrompt'),
        icon: <Target className="h-4 w-4" />,
      },
      {
        id: 'application-strategy',
        label: t('prediction.aiActions.applicationStrategy'),
        prompt: t('prediction.aiActions.applicationStrategyPrompt'),
        icon: <Lightbulb className="h-4 w-4" />,
      },
      {
        id: 'explain-prediction',
        label: t('prediction.aiActions.explainModel'),
        prompt: t('prediction.aiActions.explainModelPrompt'),
        icon: <GraduationCap className="h-4 w-4" />,
      }
    );

    return items;
  }, [results, selectedSchools, locale, t]);

  const predictionContext = useMemo(() => {
    if (results.length === 0) return undefined;
    return {
      type: 'prediction-results' as const,
      results: results.map((r) => ({
        schoolName: r.schoolName,
        probability: r.probability,
        tier: r.tier,
        confidence: r.confidence,
        actualResult: r.actualResult,
        schoolMeta: r.schoolMeta,
      })),
      summary: {
        total: results.length,
        reach: results.filter((r) => r.tier === 'reach').length,
        match: results.filter((r) => r.tier === 'match').length,
        safety: results.filter((r) => r.tier === 'safety').length,
        avgProbability: results.reduce((acc, r) => acc + r.probability, 0) / results.length,
      },
    };
  }, [results]);

  const dispatchAction = (prompt: string) => {
    window.dispatchEvent(
      new CustomEvent('ai-assistant-action', {
        detail: { message: prompt, context: predictionContext },
      })
    );
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
        {actions.slice(0, 4).map((action) => (
          <Button
            key={action.id}
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => dispatchAction(action.prompt)}
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
