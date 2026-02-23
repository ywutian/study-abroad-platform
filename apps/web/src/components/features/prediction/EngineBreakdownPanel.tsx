'use client';

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { ScoreItem } from '@/components/ui/score-item';
import { cn } from '@/lib/utils';
import { ENGINE_CONFIG } from './constants';
import type { EngineScores } from './types';

interface EngineBreakdownPanelProps {
  engineScores: EngineScores;
}

export const EngineBreakdownPanel = memo(function EngineBreakdownPanel({
  engineScores,
}: EngineBreakdownPanelProps) {
  const t = useTranslations('prediction');

  const engines = [
    { key: 'stats' as const, value: engineScores.stats },
    { key: 'ai' as const, value: engineScores.ai },
    { key: 'historical' as const, value: engineScores.historical },
  ].filter((e) => e.value !== undefined);

  return (
    <div className="space-y-4">
      {/* Engine individual scores */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        {engines.map((engine) => {
          const config = ENGINE_CONFIG[engine.key];
          return (
            <ScoreItem
              key={engine.key}
              label={t(`engine.${engine.key}`)}
              value={`${((engine.value ?? 0) * 100).toFixed(0)}%`}
              max="100"
              color={config.color}
              size="sm"
            />
          );
        })}
      </div>

      {/* Weight distribution stacked bar */}
      {engineScores.weights && Object.keys(engineScores.weights).length > 0 && (
        <div className="space-y-2">
          <p className="text-overline text-muted-foreground">{t('engineWeights')}</p>
          <div className="flex h-2.5 rounded-full overflow-hidden bg-muted/30">
            {Object.entries(engineScores.weights).map(([key, weight]) => {
              const config = ENGINE_CONFIG[key as keyof typeof ENGINE_CONFIG];
              if (!config) return null;
              return (
                <motion.div
                  key={key}
                  className={cn('h-full first:rounded-l-full last:rounded-r-full', config.barColor)}
                  initial={{ width: 0 }}
                  animate={{ width: `${weight * 100}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-3">
            {Object.entries(engineScores.weights).map(([key, weight]) => {
              const config = ENGINE_CONFIG[key as keyof typeof ENGINE_CONFIG];
              if (!config) return null;
              return (
                <div key={key} className="flex items-center gap-1.5">
                  <div className={cn('h-2.5 w-2.5 rounded-sm', config.barColor)} />
                  <span className="text-xs text-muted-foreground">
                    {t(`engine.${key}`)} {(weight * 100).toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Memory adjustment */}
      {engineScores.memoryAdjustment !== undefined && engineScores.memoryAdjustment !== 0 && (
        <Badge variant="outline" className="text-xs">
          {engineScores.memoryAdjustment > 0 ? '+' : ''}
          {(engineScores.memoryAdjustment * 100).toFixed(1)}% {t('memoryAdjustment')}
        </Badge>
      )}

      {/* Fusion method */}
      {engineScores.fusionMethod && (
        <span className="text-xs text-muted-foreground">{engineScores.fusionMethod}</span>
      )}
    </div>
  );
});
