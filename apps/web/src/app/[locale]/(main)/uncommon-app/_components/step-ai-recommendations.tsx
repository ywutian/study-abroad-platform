'use client';

import { Sparkles, Brain, MessageSquare, RefreshCw, Shield, Target, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn, getSchoolName } from '@/lib/utils';
import { tierConfig } from './constants';
import { RecommendationLoadingState } from './progress-stepper';
import type { TieredRecommendations, SchoolRecommendation } from './types';

interface StepAIRecommendationsProps {
  t: (key: string, values?: Record<string, string | number>) => string;
  locale: string;
  aiLoading: boolean;
  aiRecommendations: TieredRecommendations | null;
  onGetRecommendations: () => void;
}

export function StepAIRecommendations({
  t,
  locale,
  aiLoading,
  aiRecommendations,
  onGetRecommendations,
}: StepAIRecommendationsProps) {
  return (
    <Card className="overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-primary via-violet-500 to-primary" />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            {t('aiRecommendations')}
          </CardTitle>
          <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
            <Brain className="h-3 w-3 mr-1" />
            {t('recommendationSystem')}
          </Badge>
        </div>
        <CardDescription className="flex items-center gap-1">
          <MessageSquare className="h-3 w-3" />
          {t('aiRecommendationsDesc')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AnimatePresence mode="wait">
          {aiLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <RecommendationLoadingState t={t} />
            </motion.div>
          ) : aiRecommendations ? (
            <RecommendationResults
              t={t}
              locale={locale}
              recommendations={aiRecommendations}
              onRefresh={onGetRecommendations}
            />
          ) : (
            <RecommendationEmptyState t={t} onGetRecommendations={onGetRecommendations} />
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

function RecommendationResults({
  t,
  locale,
  recommendations,
  onRefresh,
}: {
  t: (key: string, values?: Record<string, string | number>) => string;
  locale: string;
  recommendations: TieredRecommendations;
  onRefresh: () => void;
}) {
  const total =
    (recommendations.reach?.length || 0) +
    (recommendations.target?.length || 0) +
    (recommendations.safety?.length || 0);

  return (
    <motion.div
      key="results"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-4"
    >
      {/* Distribution mini-bar */}
      {total > 0 && (
        <div className="flex h-2 rounded-full overflow-hidden">
          {recommendations.reach?.length > 0 && (
            <div
              className="bg-amber-500 transition-all"
              style={{
                width: `${(recommendations.reach.length / total) * 100}%`,
              }}
            />
          )}
          {recommendations.target?.length > 0 && (
            <div
              className="bg-blue-500 transition-all"
              style={{
                width: `${(recommendations.target.length / total) * 100}%`,
              }}
            />
          )}
          {recommendations.safety?.length > 0 && (
            <div
              className="bg-emerald-500 transition-all"
              style={{
                width: `${(recommendations.safety.length / total) * 100}%`,
              }}
            />
          )}
        </div>
      )}

      {/* Tier sections */}
      {(['reach', 'target', 'safety'] as const).map((tier) => {
        const schools = recommendations[tier] || [];
        if (!schools.length) return null;
        const config = tierConfig[tier.toUpperCase() as keyof typeof tierConfig];
        const TierIcon = config.icon;

        return (
          <div key={tier} className={cn('rounded-lg border p-3', config.border)}>
            <div className="flex items-center gap-2 mb-2.5">
              <div className={cn('p-1 rounded-md', config.iconBg)}>
                <TierIcon className={cn('h-3.5 w-3.5', config.iconColor)} />
              </div>
              <span className="text-sm font-semibold">{t(`tier.${tier}`)}</span>
              <Badge variant="outline" className={cn('text-xs ml-auto', config.badgeClass)}>
                {schools.length}
              </Badge>
            </div>
            <div className="space-y-2">
              {schools.map((school: SchoolRecommendation, i: number) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 p-2 rounded-md bg-background/60 hover:bg-muted/50 transition-colors"
                >
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold',
                      config.iconBg,
                      config.iconColor
                    )}
                  >
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{getSchoolName(school, locale)}</p>
                    {(school.reason || school.description) && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {school.reason || school.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Refresh */}
      <div className="flex items-center justify-between pt-2 border-t">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Brain className="h-3 w-3" />
          {t('poweredByRecommendations')}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          {t('reAnalyze')}
        </Button>
      </div>
    </motion.div>
  );
}

function RecommendationEmptyState({
  t,
  onGetRecommendations,
}: {
  t: (key: string, values?: Record<string, string | number>) => string;
  onGetRecommendations: () => void;
}) {
  return (
    <motion.div
      key="empty"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center text-center py-8 px-4"
    >
      <div className="relative mb-5">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
          <Brain className="h-8 w-8 text-primary" />
        </div>
        <motion.div
          className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500"
          animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <motion.div
          className="absolute -bottom-1 -left-1 w-2.5 h-2.5 rounded-full bg-amber-500"
          animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.7 }}
        />
        <motion.div
          className="absolute top-0 -left-2 w-2 h-2 rounded-full bg-blue-500"
          animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity, delay: 1.4 }}
        />
      </div>

      <h4 className="text-sm font-semibold mb-1">{t('clickToGetRecommendations')}</h4>
      <p className="text-xs text-muted-foreground mb-5 max-w-[240px]">
        {t('aiRecommendationsHint')}
      </p>

      <div className="flex items-center gap-2 mb-5">
        {[
          {
            labelKey: 'safety',
            colorCls:
              'bg-emerald-500/15 text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800',
            icon: Shield,
          },
          {
            labelKey: 'target',
            colorCls:
              'bg-blue-500/15 text-blue-700 border-blue-200 dark:text-blue-400 dark:border-blue-800',
            icon: Target,
          },
          {
            labelKey: 'reach',
            colorCls:
              'bg-amber-500/15 text-amber-700 border-amber-200 dark:text-amber-400 dark:border-amber-800',
            icon: Zap,
          },
        ].map(({ labelKey, colorCls, icon: Icon }) => (
          <span
            key={labelKey}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs',
              colorCls
            )}
          >
            <Icon className="h-3 w-3" />
            {t(`tier.${labelKey}`)}
          </span>
        ))}
      </div>

      <Button
        size="lg"
        onClick={onGetRecommendations}
        className="w-full max-w-[280px] bg-gradient-to-r from-primary to-violet-600 dark:from-primary dark:to-violet-500 hover:from-primary/90 hover:to-violet-600/90 text-white border-0"
      >
        <Sparkles className="h-4 w-4 mr-2" />
        {t('getRecommendations')}
      </Button>
    </motion.div>
  );
}
