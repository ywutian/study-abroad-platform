'use client';

/**
 * ResultsGrid — right column card: the ranking results list with a sort
 * control, each row rendered as a RankingCard (header + CompetitorDistribution
 * + AiPanel). Empty + loading states handled here.
 */

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/loading-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trophy, ChevronUp, ChevronDown, Minus, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AiAnalysisResult, RankingResult } from '@/types/hall';
import { POSITION_CONFIG, type SortMode } from './ranking-shared';
import { CompetitorDistribution } from './CompetitorDistribution';
import { AiPanel } from './AiPanel';

function rankIcon(percentile: number) {
  if (percentile >= 70) return <ChevronUp className="h-4 w-4 text-emerald-500" />;
  if (percentile >= 40) return <Minus className="h-4 w-4 text-amber-500" />;
  return <ChevronDown className="h-4 w-4 text-red-500" />;
}

interface ResultsGridProps {
  rankings: RankingResult[];
  isLoading: boolean;
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
  aiAnalysis: Record<string, AiAnalysisResult>;
  analysisLoading: string | null;
  onRequestAnalysis: (schoolId: string) => void;
}

export function ResultsGrid({
  rankings,
  isLoading,
  sortMode,
  onSortModeChange,
  aiAnalysis,
  analysisLoading,
  onRequestAnalysis,
}: ResultsGridProps) {
  const t = useTranslations();

  return (
    <Card className="overflow-hidden lg:col-span-2">
      <div className="h-1.5 bg-success" />
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <Trophy className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg">{t('hall.ranking.title')}</CardTitle>
              <CardDescription>{t('hall.ranking.resultsDesc')}</CardDescription>
            </div>
          </div>
          {rankings.length > 1 && (
            <Select value={sortMode} onValueChange={(v) => onSortModeChange(v as SortMode)}>
              <SelectTrigger className="w-32 h-9 text-xs">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentile">{t('hall.ranking.sortByPercentile')}</SelectItem>
                <SelectItem value="score">{t('hall.ranking.sortByScore')}</SelectItem>
                <SelectItem value="applicants">{t('hall.ranking.sortByApplicants')}</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingState variant="card" count={3} />
        ) : rankings.length > 0 ? (
          <div className="space-y-4">
            {rankings.map((result, index) => (
              <RankingCard
                key={result.schoolId}
                result={result}
                index={index}
                aiAnalysis={aiAnalysis[result.schoolId]}
                analysisLoading={analysisLoading === result.schoolId}
                onRequestAnalysis={() => onRequestAnalysis(result.schoolId)}
              />
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-emerald-500/10">
              <Trophy className="h-8 w-8 text-emerald-500/50" />
            </div>
            <p className="font-medium">{t('hall.ranking.emptyTitle')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('hall.ranking.emptyDesc')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface RankingCardProps {
  result: RankingResult;
  index: number;
  aiAnalysis?: AiAnalysisResult;
  analysisLoading: boolean;
  onRequestAnalysis: () => void;
}

const RankingCard = memo(function RankingCard({
  result,
  index,
  aiAnalysis,
  analysisLoading,
  onRequestAnalysis,
}: RankingCardProps) {
  const t = useTranslations();
  const positionConfig = result.competitivePosition
    ? POSITION_CONFIG[result.competitivePosition]
    : null;
  const PositionIcon = positionConfig?.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="rounded-xl border p-3 sm:p-4 hover:shadow-md transition-all"
    >
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="font-semibold text-sm sm:text-base truncate">{result.schoolName}</h4>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <p className="text-xs sm:text-sm text-muted-foreground">
              {t('hall.ranking.competitorsCount', {
                count: result.competitorStats?.totalCount ?? result.totalApplicants,
              })}
            </p>
            {result.yourScore !== undefined && (
              <Badge variant="outline" className="text-xs">
                {result.yourScore.toFixed(1)}
              </Badge>
            )}
            {positionConfig && PositionIcon && (
              <Badge variant="outline" className={cn('text-xs gap-1', positionConfig.className)}>
                <PositionIcon className="h-3 w-3" />
                {t(`hall.ranking.${result.competitivePosition}`)}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {rankIcon(result.percentile)}
          <div className="text-right">
            <p className="text-xl sm:text-2xl font-bold text-primary">#{result.yourRank}</p>
            <Badge variant="secondary" className="text-xs">
              {t('hall.ranking.topPercentile', { percent: result.percentile })}
            </Badge>
          </div>
        </div>
      </div>

      <CompetitorDistribution result={result} index={index} />

      <AiPanel
        analysis={aiAnalysis}
        loading={analysisLoading}
        onRequest={onRequestAnalysis}
      />
    </motion.div>
  );
});
