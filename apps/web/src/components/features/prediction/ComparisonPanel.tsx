'use client';

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { AnimatedProgress } from '@/components/ui/motion';
import { cn } from '@/lib/utils';
import type { PredictionComparison } from './types';

interface ComparisonPanelProps {
  comparison: PredictionComparison;
}

const STRENGTH_CONFIG = {
  weak: { text: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-900/30' },
  average: { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  strong: {
    text: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
};

export const ComparisonPanel = memo(function ComparisonPanel({ comparison }: ComparisonPanelProps) {
  const t = useTranslations('prediction');

  const strengthConfig = STRENGTH_CONFIG[comparison.activityStrength];

  return (
    <div className="space-y-3">
      <p className="text-overline text-muted-foreground">{t('comparison.title')}</p>

      {/* GPA Percentile */}
      <div className="space-y-1">
        <div className="flex items-baseline justify-between">
          <span id="gpa-label" className="text-xs text-muted-foreground">
            {t('comparison.gpaPercentile')}
          </span>
          <span className="text-sm font-semibold text-metric">{comparison.gpaPercentile}th</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={comparison.gpaPercentile}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-labelledby="gpa-label"
        >
          <AnimatedProgress
            value={comparison.gpaPercentile}
            className="h-2"
            barClassName="bg-emerald-500"
          />
        </div>
      </div>

      {/* Test Score Percentile */}
      <div className="space-y-1">
        <div className="flex items-baseline justify-between">
          <span id="test-score-label" className="text-xs text-muted-foreground">
            {t('comparison.testScorePercentile')}
          </span>
          <span className="text-sm font-semibold text-metric">
            {comparison.testScorePercentile}th
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={comparison.testScorePercentile}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-labelledby="test-score-label"
        >
          <AnimatedProgress
            value={comparison.testScorePercentile}
            className="h-2"
            barClassName="bg-blue-500"
          />
        </div>
      </div>

      {/* Activity Strength */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{t('comparison.activityStrength')}</span>
        <Badge variant="outline" className={cn('text-xs', strengthConfig.text, strengthConfig.bg)}>
          {t(`comparison.strength.${comparison.activityStrength}`)}
        </Badge>
      </div>
    </div>
  );
});
