'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { PageContainer } from '@/components/layout';
import { LoadingState } from '@/components/ui/loading-state';
import { cn, getSchoolName, getSchoolSubName } from '@/lib/utils';
import {
  BarChart3,
  Save,
  Play,
  Medal,
  ExternalLink,
  TrendingUp,
  DollarSign,
  Percent,
  Sparkles,
  Trophy,
  ChevronRight,
} from 'lucide-react';
import { useRouter } from '@/lib/i18n/navigation';

interface RankingWeights {
  usNewsRank: number;
  acceptanceRate: number;
  tuition: number;
  avgSalary: number;
}

interface RankedSchool {
  id: string;
  name: string;
  nameZh: string;
  usNewsRank: number;
  acceptanceRate: number;
  tuition: number;
  avgSalary: number;
  score: number;
  rank: number;
}

const WEIGHT_CONFIG = [
  {
    key: 'usNewsRank',
    icon: Trophy,
    bgColor: 'bg-amber-500/10',
    textColor: 'text-amber-500',
    barColor: 'bg-amber-500',
    descKey: null,
  },
  {
    key: 'acceptanceRate',
    icon: Percent,
    bgColor: 'bg-violet-500/10',
    textColor: 'text-violet-500',
    barColor: 'bg-violet-500',
    descKey: 'acceptanceRateHint',
  },
  {
    key: 'tuition',
    icon: DollarSign,
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-500',
    barColor: 'bg-blue-500',
    descKey: 'tuitionHint',
  },
  {
    key: 'avgSalary',
    icon: TrendingUp,
    bgColor: 'bg-emerald-500/10',
    textColor: 'text-emerald-500',
    barColor: 'bg-emerald-500',
    descKey: null,
  },
] as const;

export default function RankingPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  const [weights, setWeights] = useState<RankingWeights>({
    usNewsRank: 30,
    acceptanceRate: 20,
    tuition: 25,
    avgSalary: 25,
  });

  const [rankingName, setRankingName] = useState('');

  const {
    data: ranking,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['ranking', weights],
    queryFn: async () => {
      const response = await apiClient.post<RankedSchool[]>('/rankings/calculate', weights);
      return response;
    },
    enabled: false,
  });

  const saveMutation = useMutation({
    mutationFn: (data: { name: string; isPublic: boolean } & RankingWeights) =>
      apiClient.post('/rankings', data),
    onSuccess: () => {
      toast.success(t('ranking.toast.saved'));
      setRankingName('');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleCalculate = () => {
    refetch();
  };

  const handleSave = () => {
    if (!rankingName.trim()) {
      toast.error(t('ranking.toast.enterName'));
      return;
    }
    saveMutation.mutate({
      name: rankingName,
      isPublic: false,
      ...weights,
    });
  };

  const updateWeight = (key: keyof RankingWeights, value: number) => {
    setWeights((prev) => ({ ...prev, [key]: value }));
  };

  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);

  return (
    <PageContainer maxWidth="fluid">
      {/* 页面头部 */}
      <div className="relative mb-6 lg:mb-8 overflow-hidden rounded-lg bg-warning/5 p-4 sm:p-6 lg:p-8">
        {/* 装饰元素 */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-warning/15 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-warning/15 blur-3xl" />

        <div className="relative z-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-warning ">
                  <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-title">{t('ranking.title')}</h1>
                  <p className="text-sm sm:text-base text-muted-foreground">
                    {t('ranking.description')}
                  </p>
                </div>
              </div>
            </div>

            {/* 统计卡片 */}
            <div className="flex gap-3 sm:gap-4">
              <div className="rounded-xl border bg-card/50 backdrop-blur-sm px-3 sm:px-4 py-2 sm:py-3">
                <p className="text-xs text-muted-foreground">{t('ranking.totalWeight')}</p>
                <p
                  className={cn(
                    'text-xl sm:text-2xl font-bold',
                    totalWeight === 100 ? 'text-emerald-500' : 'text-amber-500'
                  )}
                >
                  {totalWeight}%
                </p>
              </div>
              {ranking && ranking.length > 0 && (
                <div className="rounded-xl border bg-card/50 backdrop-blur-sm px-3 sm:px-4 py-2 sm:py-3">
                  <p className="text-xs text-muted-foreground">{t('ranking.schoolsCount')}</p>
                  <p className="text-xl sm:text-2xl font-bold text-blue-500">{ranking.length}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 响应式网格：移动端堆叠，大屏幕两列固定比例 */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[380px_1fr] xl:grid-cols-[420px_1fr] 2xl:grid-cols-[480px_1fr]">
        {/* 权重配置 */}
        <div className="space-y-4 sm:space-y-6">
          <Card className="overflow-hidden">
            <div className="h-1.5 bg-warning" />
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">{t('ranking.weights')}</CardTitle>
                  <CardDescription>{t('ranking.weightsDesc')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {WEIGHT_CONFIG.map((config, index) => {
                const key = config.key as keyof RankingWeights;
                const Icon = config.icon;
                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.08 }}
                    className="group"
                  >
                    {/* 标签行 */}
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-lg',
                          config.bgColor
                        )}
                      >
                        <Icon className={cn('h-4 w-4', config.textColor)} />
                      </div>
                      <Label className="flex-1 font-medium">{t(`ranking.${key}`)}</Label>
                      <div className="px-3 py-1 rounded-full bg-muted border border-border/50 text-xs font-semibold tabular-nums min-w-[52px] text-center">
                        {weights[key]}%
                      </div>
                    </div>

                    {/* 进度条滑块 */}
                    <div className="ml-12">
                      <div className="relative">
                        {/* 自定义进度条背景 */}
                        <div className="absolute inset-0 h-2 rounded-full bg-muted" />
                        {/* 彩色进度条 */}
                        <motion.div
                          className={cn('absolute h-2 rounded-full', config.barColor)}
                          initial={false}
                          animate={{ width: `${weights[key]}%` }}
                          transition={{ duration: 0.2, ease: 'easeOut' }}
                        />
                        {/* 滑块 */}
                        <Slider
                          value={[weights[key]]}
                          onValueChange={([v]) => updateWeight(key, v)}
                          max={100}
                          step={5}
                          className={cn(
                            'relative',
                            '[&_[data-slot=slider-track]]:bg-transparent',
                            '[&_[data-slot=slider-range]]:bg-transparent',
                            '[&_[data-slot=slider-thumb]]:border-2',
                            '[&_[data-slot=slider-thumb]]:shadow-md',
                            '[&_[data-slot=slider-thumb]]:transition-transform',
                            '[&_[data-slot=slider-thumb]]:hover:scale-110',
                            config.textColor.replace(
                              'text-',
                              '[&_[data-slot=slider-thumb]]:border-'
                            )
                          )}
                        />
                      </div>
                      {/* 描述文字 */}
                      {config.descKey && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {t(`ranking.${config.descKey}`)}
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}

              {/* 预览按钮 */}
              <div className="pt-2">
                <Button
                  onClick={handleCalculate}
                  className="w-full gap-2 h-11 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/25"
                  disabled={isLoading}
                >
                  <Play className="h-4 w-4" />
                  {isLoading ? t('common.loading') : t('ranking.preview')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 保存配置 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Save className="h-4 w-4 text-muted-foreground" />
                {t('ranking.saveRanking')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder={t('ranking.namePlaceholder')}
                value={rankingName}
                onChange={(e) => setRankingName(e.target.value)}
                className="h-11"
              />
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleSave}
                disabled={saveMutation.isPending || !ranking?.length}
              >
                <Save className="h-4 w-4" />
                {saveMutation.isPending ? t('common.loading') : t('common.save')}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 排名结果 */}
        <div className="min-w-0">
          <Card className="overflow-hidden">
            <div className="h-1.5 bg-primary" />
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                  <Medal className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">{t('ranking.rankingResults')}</CardTitle>
                  <CardDescription>{t('ranking.rankingResultsDesc')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <LoadingState variant="table" />
              ) : ranking?.length ? (
                <div className="space-y-2">
                  <AnimatePresence>
                    {ranking.map((school: RankedSchool, index: number) => (
                      <motion.div
                        key={school.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className={cn(
                          'group relative rounded-xl border p-4 transition-all hover:shadow-md cursor-pointer',
                          school.rank <= 3 && 'bg-warning/5'
                        )}
                        onClick={() => router.push(`/schools/${school.id}`)}
                      >
                        <div className="flex items-center gap-4">
                          {/* 排名 */}
                          <div
                            className={cn(
                              'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-bold',
                              school.rank === 1 &&
                                'bg-gradient-to-br bg-warning text-white border-2 border-amber-500/30',
                              school.rank === 2 &&
                                'bg-gradient-to-br bg-slate-400 text-white border-2 border-slate-400/30',
                              school.rank === 3 &&
                                'bg-warning text-white shadow-lg shadow-amber-600/30',
                              school.rank > 3 && 'bg-muted text-muted-foreground'
                            )}
                          >
                            {school.rank <= 3 ? (
                              <span className="text-lg">
                                {school.rank === 1 ? '🥇' : school.rank === 2 ? '🥈' : '🥉'}
                              </span>
                            ) : (
                              <span>#{school.rank}</span>
                            )}
                          </div>

                          {/* 学校信息 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold truncate group-hover:text-primary transition-colors">
                                {getSchoolName(school, locale)}
                              </p>
                              <ExternalLink className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                            </div>
                            {getSchoolSubName(school, locale) && (
                              <p className="text-sm text-muted-foreground truncate">
                                {getSchoolSubName(school, locale)}
                              </p>
                            )}
                          </div>

                          {/* 数据指标 */}
                          <div className="hidden sm:flex items-center gap-3">
                            <div className="text-center px-3">
                              <p className="text-xs text-muted-foreground">US News</p>
                              <p className="font-semibold">#{school.usNewsRank || '-'}</p>
                            </div>
                            <div className="text-center px-3 hidden md:block">
                              <p className="text-xs text-muted-foreground">
                                {t('ranking.tableHeaders.acceptance')}
                              </p>
                              <p className="font-semibold">
                                {school.acceptanceRate ? `${school.acceptanceRate}%` : '-'}
                              </p>
                            </div>
                            <div className="text-center px-3 hidden lg:block">
                              <p className="text-xs text-muted-foreground">
                                {t('ranking.tableHeaders.tuition')}
                              </p>
                              <p className="font-semibold">
                                {school.tuition ? `$${(school.tuition / 1000).toFixed(0)}k` : '-'}
                              </p>
                            </div>
                          </div>

                          {/* 综合评分 */}
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">
                                {t('ranking.tableHeaders.score')}
                              </p>
                              <p className="text-xl font-bold text-primary">
                                {school.score?.toFixed(1) ?? '-'}
                              </p>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="py-16 text-center">
                  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-lg bg-warning/10">
                    <BarChart3 className="h-10 w-10 text-amber-500/50" />
                  </div>
                  <h3 className="text-lg font-semibold">{t('ranking.empty.title')}</h3>
                  <p className="mt-1 text-muted-foreground max-w-sm mx-auto">
                    {t('ranking.empty.description')}
                  </p>
                  <Button onClick={handleCalculate} className="mt-6 gap-2" variant="outline">
                    <Play className="h-4 w-4" />
                    {t('ranking.preview')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
