'use client';

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import { Lightbulb, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IMPACT_CONFIG } from './constants';
import type { PredictionFactor } from './types';

interface FactorsPanelProps {
  factors: PredictionFactor[];
}

export const FactorsPanel = memo(function FactorsPanel({ factors }: FactorsPanelProps) {
  const t = useTranslations('prediction');

  if (factors.length === 0) return null;

  // Sort: positive first, then neutral, then negative
  const sorted = [...factors].sort((a, b) => {
    const order = { positive: 0, neutral: 1, negative: 2 };
    return order[a.impact] - order[b.impact];
  });

  return (
    <div className="space-y-2">
      <p className="text-overline text-muted-foreground">{t('impactFactors')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {sorted.map((factor) => {
          const config = IMPACT_CONFIG[factor.impact];
          const Icon = config.icon;
          return (
            <div
              key={factor.name}
              className={cn('rounded-xl border p-3 transition-all', config.border, config.bg)}
            >
              <div className="flex items-start justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Icon className={cn('h-3.5 w-3.5', config.text)} />
                  <span className="font-medium text-sm">{factor.name}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{factor.detail}</p>
              {factor.improvement && (
                <div className="mt-2 flex items-start gap-1.5">
                  <Lightbulb className="h-3 w-3 mt-0.5 text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-600 dark:text-amber-400">{factor.improvement}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10">
        <p className="text-xs text-amber-600 dark:text-amber-400">
          <Info className="inline h-3 w-3 mr-1" />
          {t('factorsDisclaimer')}
        </p>
      </div>
    </div>
  );
});
