'use client';

import { memo, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useSchoolPrediction } from '@/hooks/use-prediction';
import { TIER_CONFIG } from './constants';
import type { TierType } from './types';

interface PredictionHistoryPanelProps {
  schoolId: string;
}

interface HistoryPoint {
  probability: number;
  tier?: string;
  confidence?: string;
  source?: string;
  modelVersion?: string;
  createdAt: string;
}

/** Mini SVG sparkline for probability trend */
function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;

  const width = 200;
  const height = 48;
  const padding = 4;

  const min = Math.min(...data) * 0.9;
  const max = Math.max(...data) * 1.1 || 1;
  const range = max - min || 0.01;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((v - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const lastPoint = data[data.length - 1];
  const prevPoint = data[data.length - 2];
  const isUp = lastPoint >= prevPoint;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-12"
      role="img"
      aria-label="Probability trend"
    >
      {/* Gradient fill */}
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isUp ? '#10b981' : '#f43f5e'} stopOpacity="0.2" />
          <stop offset="100%" stopColor={isUp ? '#10b981' : '#f43f5e'} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Area */}
      <polygon
        points={`${padding},${height - padding} ${points.join(' ')} ${width - padding},${height - padding}`}
        fill="url(#sparkFill)"
      />
      {/* Line */}
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={isUp ? '#10b981' : '#f43f5e'}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Current point dot */}
      {(() => {
        const lastX = padding + ((data.length - 1) / (data.length - 1)) * (width - padding * 2);
        const lastY = height - padding - ((lastPoint - min) / range) * (height - padding * 2);
        return <circle cx={lastX} cy={lastY} r="3" fill={isUp ? '#10b981' : '#f43f5e'} />;
      })()}
    </svg>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const PredictionHistoryPanel = memo(function PredictionHistoryPanel({
  schoolId,
}: PredictionHistoryPanelProps) {
  const t = useTranslations('prediction');
  const { data, isLoading } = useSchoolPrediction(schoolId);

  const history: HistoryPoint[] = useMemo(
    () => (data?.history ?? []).slice().reverse(), // oldest → newest for sparkline
    [data?.history]
  );

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="h-4 w-24 bg-muted rounded" />
        <div className="h-12 bg-muted rounded" />
      </div>
    );
  }

  if (history.length === 0) {
    return <p className="text-xs text-muted-foreground">{t('noHistory')}</p>;
  }

  const probabilities = history.map((h) => h.probability);

  return (
    <div className="space-y-3">
      <p className="text-overline text-muted-foreground flex items-center gap-1.5">
        <TrendingUp className="h-3.5 w-3.5" />
        {t('historyTrend')}
      </p>

      {/* Sparkline */}
      <Sparkline data={probabilities} />

      {/* Compact snapshot list (max 5 shown) */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase tracking-wide pb-0.5 border-b border-dashed">
          <span> </span>
          <span>{t('probability')}</span>
        </div>
        {history
          .slice(-5)
          .reverse()
          .map((h, i) => {
            const tier = (h.tier ?? 'match') as TierType;
            const config = TIER_CONFIG[tier] ?? TIER_CONFIG.match;
            return (
              <div
                key={i}
                className="flex items-center justify-between text-xs py-1 border-b border-dashed last:border-b-0"
              >
                <span className="text-muted-foreground">{formatDate(h.createdAt)}</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{(h.probability * 100).toFixed(0)}%</span>
                  <Badge variant="outline" className={cn('text-[10px] py-0 px-1.5', config.badge)}>
                    {t(`tier.${tier}`)}
                  </Badge>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
});
