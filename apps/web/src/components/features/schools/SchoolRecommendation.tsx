'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn, getSchoolName, getSchoolSubName } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import {
  Brain,
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Target,
  Shield,
  Rocket,
  School,
  TrendingUp,
  ExternalLink,
  Star,
  Info,
} from 'lucide-react';
import Link from 'next/link';

interface SchoolInfo {
  id: string;
  name: string;
  nameZh?: string;
  usNewsRank?: number;
  acceptanceRate?: number;
}

interface RecommendationItem {
  schoolId: string;
  probability: number;
  reason: string;
  highlights: string[];
  school?: SchoolInfo;
}

interface RecommendationResponse {
  reach: RecommendationItem[];
  target: RecommendationItem[];
  safety: RecommendationItem[];
  summary: string;
}

const CATEGORY_STYLES = {
  reach: {
    icon: Rocket,
    color: 'bg-destructive',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    text: 'text-rose-600 dark:text-rose-400',
  },
  target: {
    icon: Target,
    color: 'bg-primary',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-600 dark:text-blue-400',
  },
  safety: {
    icon: Shield,
    color: 'bg-success',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
};

interface SchoolRecommendationProps {
  className?: string;
}

export function SchoolRecommendation({ className }: SchoolRecommendationProps) {
  const t = useTranslations('recommendation');
  const locale = useLocale();
  const [expandedCategory, setExpandedCategory] = useState<string | null>('target');

  const getCategoryConfig = (key: string) => {
    const styles = CATEGORY_STYLES[key as keyof typeof CATEGORY_STYLES];
    return {
      ...styles,
      label: t(`categories.${key}.label`),
      description: t(`categories.${key}.description`),
    };
  };

  const { data, isLoading, refetch, isFetching, error } = useQuery({
    queryKey: ['school-ai-recommendations'],
    queryFn: () => apiClient.get<RecommendationResponse>('/schools/ai/recommend'),
    staleTime: 10 * 60 * 1000, // 10分钟缓存
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <div className="h-1.5 bg-primary animate-pulse" />
        <CardContent className="py-12">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-lg bg-gradient-to-br bg-primary/10 animate-pulse" />
              <Brain className="absolute inset-0 m-auto h-8 w-8 text-blue-500/50" />
            </div>
            <div className="text-center">
              <p className="font-medium">{t('loading')}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('loadingDesc')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <div className="h-1.5 bg-primary" />
        <CardContent className="py-12">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted">
              <Info className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">{t('errorTitle')}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('errorDesc')}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('retry')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalSchools = data.reach.length + data.target.length + data.safety.length;

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* 顶部渐变条 */}
      <div className="h-1.5 bg-primary" />

      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-lg">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                {t('aiSmartMatch')}
                <Sparkles className="h-4 w-4 text-blue-500" />
              </CardTitle>
              <CardDescription>{t('recommendCount', { count: totalSchools })}</CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 策略总结 */}
        <div className="rounded-xl bg-primary/5 border p-4">
          <div className="flex items-start gap-3">
            <TrendingUp className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <p className="font-medium text-sm">{t('strategyTitle')}</p>
              <p className="text-sm text-muted-foreground mt-1">{data.summary}</p>
            </div>
          </div>
        </div>

        {/* 三分类学校列表 */}
        <div className="space-y-3">
          {(['reach', 'target', 'safety'] as const).map((category) => {
            const config = getCategoryConfig(category);
            const items = data[category];
            const isExpanded = expandedCategory === category;
            const Icon = config.icon;

            return (
              <div key={category} className={cn('rounded-xl border transition-all', config.border)}>
                <button
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors rounded-xl"
                  onClick={() => setExpandedCategory(isExpanded ? null : category)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br text-white',
                        config.color
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{config.label}</span>
                        <Badge variant="secondary" className={cn('text-xs', config.text)}>
                          {t('schoolCount', { count: items.length })}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{config.description}</p>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>

                <AnimatePresence>
                  {isExpanded && items.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-2">
                        {items.map((item, index) => (
                          <motion.div
                            key={item.schoolId}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={cn(
                              'rounded-lg p-3 transition-all hover:shadow-md',
                              config.bg
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {item.school?.usNewsRank && (
                                    <Badge variant="outline" className="text-xs font-mono">
                                      #{item.school.usNewsRank}
                                    </Badge>
                                  )}
                                  <Link
                                    href={`/schools/${item.schoolId}`}
                                    className="font-medium hover:underline truncate"
                                  >
                                    {getSchoolName(item.school, locale) || t('unknownSchool')}
                                  </Link>
                                </div>
                                {getSchoolSubName(item.school, locale) && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {getSchoolSubName(item.school, locale)}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {item.reason}
                                </p>
                                {item.highlights.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {item.highlights.map((h, i) => (
                                      <Badge key={i} variant="secondary" className="text-xs">
                                        <Star className="h-3 w-3 mr-1" />
                                        {h}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <div className="text-right">
                                  <span className={cn('text-lg font-bold', config.text)}>
                                    {item.probability}%
                                  </span>
                                  <p className="text-xs text-muted-foreground">
                                    {t('admissionChance')}
                                  </p>
                                </div>
                                <Progress value={item.probability} className="w-16 h-1.5" />
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {isExpanded && items.length === 0 && (
                  <div className="px-4 pb-4">
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {t('noSchoolsInCategory', { category: config.label })}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 底部提示 */}
        <p className="text-xs text-muted-foreground text-center pt-2">💡 {t('disclaimer')}</p>
      </CardContent>
    </Card>
  );
}
