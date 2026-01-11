'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Clock,
  Trophy,
  Target,
  Flame,
  Crown,
  Medal,
  Star,
  Zap,
  GraduationCap,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ChevronRight,
  TrendingUp,
  Award,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';

interface SwipeCase {
  id: string;
  schoolName: string;
  schoolNameZh?: string;
  year: number;
  round?: string;
  major?: string;
  gpaRange?: string;
  satRange?: string;
  actRange?: string;
  toeflRange?: string;
  tags: string[];
  isVerified: boolean;
  usNewsRank?: number;
  acceptanceRate?: number;
}

interface SwipeResult {
  caseId: string;
  prediction: string;
  actualResult: string;
  isCorrect: boolean;
  currentStreak: number;
  pointsEarned: number;
  badgeUpgraded: boolean;
  currentBadge: string;
}

interface SwipeStats {
  totalSwipes: number;
  correctCount: number;
  accuracy: number;
  currentStreak: number;
  bestStreak: number;
  badge: string;
  toNextBadge: number;
  dailyChallengeCount: number;
  dailyChallengeTarget: number;
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName?: string;
  accuracy: number;
  totalSwipes: number;
  correctCount: number;
  badge: string;
  isCurrentUser: boolean;
}

// 徽章配置
const BADGE_CONFIG: Record<string, { icon: any; color: string; bgColor: string; label: string }> = {
  bronze: { icon: Medal, color: 'text-amber-700', bgColor: 'bg-amber-100', label: '青铜' },
  silver: { icon: Medal, color: 'text-gray-400', bgColor: 'bg-gray-100', label: '白银' },
  gold: { icon: Trophy, color: 'text-yellow-500', bgColor: 'bg-yellow-100', label: '黄金' },
  platinum: { icon: Crown, color: 'text-cyan-500', bgColor: 'bg-cyan-100', label: '铂金' },
  diamond: { icon: Star, color: 'text-violet-500', bgColor: 'bg-violet-100', label: '钻石' },
};

// 结果映射
const RESULT_MAP: Record<string, { label: string; color: string; icon: any }> = {
  admitted: { label: '录取', color: 'text-emerald-500', icon: CheckCircle2 },
  rejected: { label: '拒绝', color: 'text-red-500', icon: XCircle },
  waitlisted: { label: '候补', color: 'text-amber-500', icon: Clock },
  deferred: { label: '延期', color: 'text-blue-500', icon: Clock },
};

// 滑动阈值
const SWIPE_THRESHOLD = 100;

export default function SwipePage() {
  const t = useTranslations('swipe');
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('play');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [result, setResult] = useState<SwipeResult | null>(null);
  const [showResult, setShowResult] = useState(false);

  // Motion values
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const admitOpacity = useTransform(x, [0, 100], [0, 1]);
  const rejectOpacity = useTransform(x, [-100, 0], [1, 0]);

  // 获取案例批次
  const { data: cases, isLoading: casesLoading, refetch: refetchCases } = useQuery<SwipeCase[]>({
    queryKey: ['swipe-cases'],
    queryFn: () => apiClient.get('/swipe/batch?count=5'),
    enabled: activeTab === 'play',
  });

  // 获取统计
  const { data: stats, refetch: refetchStats } = useQuery<SwipeStats>({
    queryKey: ['swipe-stats'],
    queryFn: () => apiClient.get('/swipe/stats'),
  });

  // 获取排行榜
  const { data: leaderboard } = useQuery<{ entries: LeaderboardEntry[]; currentUserEntry?: LeaderboardEntry }>({
    queryKey: ['swipe-leaderboard'],
    queryFn: () => apiClient.get('/swipe/leaderboard'),
    enabled: activeTab === 'leaderboard',
  });

  // 提交滑动
  const swipeMutation = useMutation({
    mutationFn: (data: { caseId: string; prediction: string }) =>
      apiClient.post<SwipeResult>('/swipe', data),
    onSuccess: (data) => {
      setResult(data);
      setShowResult(true);
      refetchStats();

      if (data.isCorrect) {
        toast.success(t('correct'), {
          description: `+${data.pointsEarned} ${t('points')} 🔥 ${data.currentStreak} ${t('streak')}`,
        });
      } else {
        toast.error(t('incorrect'));
      }

      if (data.badgeUpgraded) {
        toast.success(t('badgeUpgraded'), {
          description: `${t('newBadge')}: ${BADGE_CONFIG[data.currentBadge]?.label}`,
        });
      }
    },
    onError: (error: any) => {
      toast.error(error.message || t('failed'));
    },
  });

  const currentCase = cases?.[currentIndex];

  const handleSwipe = useCallback(
    (prediction: 'admit' | 'reject' | 'waitlist') => {
      if (!currentCase || swipeMutation.isPending) return;

      swipeMutation.mutate({
        caseId: currentCase.id,
        prediction,
      });
    },
    [currentCase, swipeMutation]
  );

  const handleDragEnd = useCallback(
    (_: any, info: PanInfo) => {
      if (Math.abs(info.offset.x) > SWIPE_THRESHOLD) {
        const prediction = info.offset.x > 0 ? 'admit' : 'reject';
        handleSwipe(prediction);
      }
    },
    [handleSwipe]
  );

  const handleNextCard = () => {
    setShowResult(false);
    setResult(null);
    x.set(0);

    if (currentIndex < (cases?.length || 0) - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // 重新获取案例
      setCurrentIndex(0);
      refetchCases();
    }
  };

  const renderCard = (caseData: SwipeCase, index: number) => {
    const isTop = index === currentIndex;
    const BadgeIcon = caseData.isVerified ? CheckCircle2 : null;

    return (
      <motion.div
        key={caseData.id}
        className={cn(
          'absolute w-full',
          !isTop && 'pointer-events-none'
        )}
        style={{
          zIndex: cases!.length - index,
          x: isTop ? x : 0,
          rotate: isTop ? rotate : 0,
          scale: 1 - (index - currentIndex) * 0.05,
          opacity: index > currentIndex + 2 ? 0 : 1,
        }}
        drag={isTop && !showResult ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        onDragEnd={isTop ? handleDragEnd : undefined}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1 - (index - currentIndex) * 0.05, opacity: 1 }}
        exit={{ x: 300, opacity: 0, rotate: 20 }}
        transition={{ type: 'spring', damping: 20 }}
      >
        <Card className="overflow-hidden bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 shadow-2xl">
          {/* 顶部装饰条 */}
          <div className="h-2 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500" />

          {/* 滑动提示 */}
          {isTop && !showResult && (
            <>
              <motion.div
                className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center z-10 rounded-xl"
                style={{ opacity: admitOpacity }}
              >
                <div className="bg-emerald-500 text-white px-6 py-3 rounded-full font-bold text-xl flex items-center gap-2 shadow-lg">
                  <ThumbsUp className="h-6 w-6" />
                  {t('admit')}
                </div>
              </motion.div>
              <motion.div
                className="absolute inset-0 bg-red-500/20 flex items-center justify-center z-10 rounded-xl"
                style={{ opacity: rejectOpacity }}
              >
                <div className="bg-red-500 text-white px-6 py-3 rounded-full font-bold text-xl flex items-center gap-2 shadow-lg">
                  <ThumbsDown className="h-6 w-6" />
                  {t('reject')}
                </div>
              </motion.div>
            </>
          )}

          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xl">
                    {caseData.schoolNameZh || caseData.schoolName}
                  </CardTitle>
                  {caseData.isVerified && (
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {t('verified')}
                    </Badge>
                  )}
                </div>
                <CardDescription className="mt-1">
                  {caseData.year} · {caseData.round || 'RD'} · {caseData.major || t('undeclared')}
                </CardDescription>
              </div>
              {caseData.usNewsRank && (
                <Badge variant="outline" className="text-amber-600 border-amber-300">
                  #{caseData.usNewsRank}
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* 学校信息 */}
            {caseData.acceptanceRate && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm text-muted-foreground">{t('acceptanceRate')}</span>
                <span className="font-semibold">{caseData.acceptanceRate.toFixed(1)}%</span>
              </div>
            )}

            {/* 申请者信息 */}
            <div className="grid grid-cols-2 gap-3">
              {caseData.gpaRange && (
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                  <p className="text-xs text-muted-foreground">GPA</p>
                  <p className="font-semibold text-blue-600 dark:text-blue-400">{caseData.gpaRange}</p>
                </div>
              )}
              {caseData.satRange && (
                <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30">
                  <p className="text-xs text-muted-foreground">SAT</p>
                  <p className="font-semibold text-purple-600 dark:text-purple-400">{caseData.satRange}</p>
                </div>
              )}
              {caseData.actRange && (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                  <p className="text-xs text-muted-foreground">ACT</p>
                  <p className="font-semibold text-emerald-600 dark:text-emerald-400">{caseData.actRange}</p>
                </div>
              )}
              {caseData.toeflRange && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                  <p className="text-xs text-muted-foreground">TOEFL</p>
                  <p className="font-semibold text-amber-600 dark:text-amber-400">{caseData.toeflRange}</p>
                </div>
              )}
            </div>

            {/* 标签 */}
            {caseData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {caseData.tags.slice(0, 4).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  const renderResultOverlay = () => {
    if (!showResult || !result) return null;

    const resultConfig = RESULT_MAP[result.actualResult] || RESULT_MAP.rejected;
    const ResultIcon = resultConfig.icon;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-xl"
      >
        <div className="text-center space-y-4 p-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.1 }}
            className={cn(
              'mx-auto w-20 h-20 rounded-full flex items-center justify-center',
              result.isCorrect ? 'bg-emerald-100 dark:bg-emerald-900' : 'bg-red-100 dark:bg-red-900'
            )}
          >
            {result.isCorrect ? (
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            ) : (
              <XCircle className="h-10 w-10 text-red-500" />
            )}
          </motion.div>

          <div>
            <h3 className="text-xl font-bold">
              {result.isCorrect ? t('youreRight') : t('notQuite')}
            </h3>
            <p className="text-muted-foreground mt-1">
              {t('actualResult')}: <span className={resultConfig.color}>{resultConfig.label}</span>
            </p>
          </div>

          {result.isCorrect && (
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">+{result.pointsEarned}</p>
                <p className="text-xs text-muted-foreground">{t('points')}</p>
              </div>
              {result.currentStreak > 1 && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-500 flex items-center gap-1">
                    <Flame className="h-5 w-5" />
                    {result.currentStreak}
                  </p>
                  <p className="text-xs text-muted-foreground">{t('streak')}</p>
                </div>
              )}
            </div>
          )}

          <Button onClick={handleNextCard} size="lg" className="mt-4">
            {t('nextCase')}
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    );
  };

  const renderStats = () => {
    if (!stats) return null;

    const badgeConfig = BADGE_CONFIG[stats.badge] || BADGE_CONFIG.bronze;
    const BadgeIcon = badgeConfig.icon;

    return (
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('accuracy')}</p>
                <p className="text-3xl font-bold">{stats.accuracy}%</p>
              </div>
              <Target className="h-8 w-8 text-primary/20" />
            </div>
            <Progress value={stats.accuracy} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('totalSwipes')}</p>
                <p className="text-3xl font-bold">{stats.totalSwipes}</p>
                <p className="text-xs text-muted-foreground">
                  {stats.correctCount} {t('correct')}
                </p>
              </div>
              <Zap className="h-8 w-8 text-amber-500/20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('bestStreak')}</p>
                <p className="text-3xl font-bold flex items-center gap-1">
                  <Flame className="h-6 w-6 text-orange-500" />
                  {stats.bestStreak}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{t('current')}</p>
                <p className="text-lg font-semibold text-orange-500">{stats.currentStreak}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(badgeConfig.bgColor)}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('badge')}</p>
                <p className={cn('text-2xl font-bold flex items-center gap-2', badgeConfig.color)}>
                  <BadgeIcon className="h-6 w-6" />
                  {badgeConfig.label}
                </p>
              </div>
              {stats.toNextBadge > 0 && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{t('toNextBadge')}</p>
                  <p className="text-sm font-semibold">{stats.toNextBadge}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderLeaderboard = () => {
    if (!leaderboard) return null;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            {t('leaderboard')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {leaderboard.entries.map((entry) => {
                const badgeConfig = BADGE_CONFIG[entry.badge] || BADGE_CONFIG.bronze;
                const BadgeIcon = badgeConfig.icon;

                return (
                  <div
                    key={entry.userId}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg transition-colors',
                      entry.isCurrentUser
                        ? 'bg-primary/10 border border-primary/20'
                        : 'hover:bg-muted/50'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm',
                        entry.rank <= 3 ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white' : 'bg-muted'
                      )}>
                        {entry.rank}
                      </div>
                      <div>
                        <p className="font-medium">{entry.userName}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <BadgeIcon className={cn('h-3 w-3', badgeConfig.color)} />
                          <span>{entry.totalSwipes} {t('swipes')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{entry.accuracy}%</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.correctCount}/{entry.totalSwipes}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {leaderboard.currentUserEntry && !leaderboard.entries.find(e => e.isCurrentUser) && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-sm">
                    {leaderboard.currentUserEntry.rank}
                  </div>
                  <div>
                    <p className="font-medium">{t('you')}</p>
                    <p className="text-xs text-muted-foreground">
                      {leaderboard.currentUserEntry.totalSwipes} {t('swipes')}
                    </p>
                  </div>
                </div>
                <p className="font-bold text-primary">{leaderboard.currentUserEntry.accuracy}%</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500/10 via-background to-purple-500/10 p-6 sm:p-8">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg shadow-violet-500/25">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
              <p className="text-muted-foreground">{t('description')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      {renderStats()}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="play" className="gap-2">
            <Sparkles className="h-4 w-4" />
            {t('play')}
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="gap-2">
            <Trophy className="h-4 w-4" />
            {t('leaderboard')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="play" className="mt-6">
          {casesLoading ? (
            <div className="flex items-center justify-center h-[500px]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : cases && cases.length > 0 ? (
            <div className="relative h-[500px]">
              {/* 卡片堆叠 */}
              <div className="relative h-full">
                <AnimatePresence>
                  {cases.slice(currentIndex, currentIndex + 3).map((c, i) => 
                    renderCard(c, currentIndex + i)
                  )}
                </AnimatePresence>
                {renderResultOverlay()}
              </div>

              {/* 操作按钮 */}
              {!showResult && currentCase && (
                <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-4">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-16 w-16 rounded-full border-2 border-red-300 hover:bg-red-50 hover:border-red-500"
                    onClick={() => handleSwipe('reject')}
                    disabled={swipeMutation.isPending}
                  >
                    <ThumbsDown className="h-6 w-6 text-red-500" />
                  </Button>

                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 w-12 rounded-full border-2 border-amber-300 hover:bg-amber-50 hover:border-amber-500"
                    onClick={() => handleSwipe('waitlist')}
                    disabled={swipeMutation.isPending}
                  >
                    <Clock className="h-5 w-5 text-amber-500" />
                  </Button>

                  <Button
                    size="lg"
                    variant="outline"
                    className="h-16 w-16 rounded-full border-2 border-emerald-300 hover:bg-emerald-50 hover:border-emerald-500"
                    onClick={() => handleSwipe('admit')}
                    disabled={swipeMutation.isPending}
                  >
                    <ThumbsUp className="h-6 w-6 text-emerald-500" />
                  </Button>
                </div>
              )}

              {/* 提示 */}
              <p className="text-center text-sm text-muted-foreground mt-20">
                {t('swipeHint')}
              </p>
            </div>
          ) : (
            <Card className="h-[500px] flex items-center justify-center">
              <div className="text-center space-y-4">
                <GraduationCap className="h-16 w-16 mx-auto text-muted-foreground" />
                <div>
                  <h3 className="font-semibold text-lg">{t('noCases')}</h3>
                  <p className="text-sm text-muted-foreground">{t('noCasesDesc')}</p>
                </div>
                <Button onClick={() => refetchCases()}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {t('refresh')}
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-6">
          {renderLeaderboard()}
        </TabsContent>
      </Tabs>
    </div>
  );
}

