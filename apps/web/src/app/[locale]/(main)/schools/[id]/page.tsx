'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations, useLocale, useFormatter } from 'next-intl';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageContainer } from '@/components/layout';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { SchoolJsonLd } from '@/components/seo';
import { apiClient, STALE_TIME } from '@/lib/api';
import { ApiError } from '@/lib/api/api-error';
import { useRouter } from '@/lib/i18n/navigation';
import { useAuthStore } from '@/stores/auth';
import { useSchoolPrediction } from '@/hooks/use-prediction';
import { motion } from 'framer-motion';
import { cn, getSchoolName, getSchoolSubName, formatAcceptanceRate } from '@/lib/utils';
import { SchoolLogo } from '@/components/features';
import {
  MapPin,
  Trophy,
  DollarSign,
  Users,
  GraduationCap,
  Calendar,
  FileText,
  TrendingUp,
  ExternalLink,
  ArrowLeft,
  Bookmark,
  Share2,
  Link2,
  Target,
  Sparkles,
  Globe,
  Star,
  CheckCircle,
  Clock,
  BarChart3,
} from 'lucide-react';

interface SchoolDetail {
  id: string;
  name: string;
  nameZh?: string;
  country: string;
  state?: string;
  city?: string;
  website?: string;
  usNewsRank?: number;
  qsRank?: number;
  acceptanceRate?: number;
  tuition?: number;
  avgSalary?: number;
  totalEnrollment?: number;
  satAvg?: number;
  sat25?: number;
  sat75?: number;
  satMath25?: number;
  satMath75?: number;
  satReading25?: number;
  satReading75?: number;
  actAvg?: number;
  act25?: number;
  act75?: number;
  studentCount?: number;
  graduationRate?: number;
  isPrivate?: boolean;
  logoUrl?: string;
  nicheSafetyGrade?: string;
  nicheLifeGrade?: string;
  nicheFoodGrade?: string;
  nicheOverallGrade?: string;
  description?: string;
  descriptionZh?: string;
  metadata?: {
    deadlines?: Record<string, string>;
    applicationType?: string;
    essayCount?: number;
    applicationCycle?: string;
    requirements?: {
      satRange?: string;
      actRange?: string;
      toeflMin?: number;
      ieltsMin?: number;
      applicationFee?: number;
    };
    essayPrompts?: Array<{ id: number; prompt: string; year: number }>;
  };
  cases?: Array<{
    id: string;
    year: number;
    round?: string;
    result: string;
    gpaRange?: string;
    satRange?: string;
    tags?: string[];
  }>;
}

export default function SchoolDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations();
  const tc = useTranslations('common');
  const locale = useLocale();
  const format = useFormatter();
  const schoolId = params.id as string;
  const queryClient = useQueryClient();
  const { accessToken, isInitialized } = useAuthStore();
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(!!navigator?.share);
  }, []);

  const {
    data: school,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['school', schoolId],
    queryFn: () => apiClient.get<SchoolDetail>(`/schools/${schoolId}`),
    staleTime: STALE_TIME.STATIC,
    enabled: !!schoolId,
  });

  // 从新 API 获取文书数据 - moved before early returns to comply with rules of hooks
  interface EssayPrompt {
    id: string;
    type: string;
    prompt: string;
    promptZh?: string;
    wordLimit?: number;
    isRequired: boolean;
    aiTips?: string;
    aiCategory?: string;
  }

  const { data: essayPromptsData } = useQuery({
    queryKey: ['schoolEssayPrompts', schoolId],
    queryFn: () =>
      apiClient
        .get<{ data: EssayPrompt[]; total: number }>('/essay-prompts', {
          params: { schoolId, status: 'VERIFIED', pageSize: '20' },
        })
        .catch(() => ({ data: [], total: 0 })),
    enabled: !!schoolId,
    retry: false,
  });

  // Fetch prediction data for this school (logged-in users only)
  const isLoggedIn = isInitialized && !!accessToken;
  const { data: predictionData } = useSchoolPrediction(schoolId, isLoggedIn);

  // Context actions for inline AI buttons (dispatch to global FloatingChat)
  const aiActions = useMemo(() => {
    if (!school) return [];
    const schoolName = getSchoolName(school, locale);
    return [
      {
        id: 'analyze-chance',
        icon: <Target className="h-3.5 w-3.5" />,
        label: t('school.ai.analyzeChance'),
        message: t('school.ai.analyzeChancePrompt', { schoolName }),
      },
      {
        id: 'improve-profile',
        icon: <TrendingUp className="h-3.5 w-3.5" />,
        label: t('school.ai.improveProfile'),
        message: t('school.ai.improveProfilePrompt', { schoolName }),
      },
      {
        id: 'compare-schools',
        icon: <BarChart3 className="h-3.5 w-3.5" />,
        label: t('school.ai.compareSchools'),
        message: t('school.ai.compareSchoolsPrompt', { schoolName }),
      },
    ];
  }, [school, locale, t]);

  // Fetch user's school list to check bookmark state
  const { data: schoolListData } = useQuery({
    queryKey: ['school-lists'],
    queryFn: () => apiClient.get<any[]>('/school-lists'),
    enabled: isInitialized && !!accessToken,
  });

  const bookmarkItem = schoolListData?.find((item: any) => item.schoolId === schoolId);
  const isBookmarked = !!bookmarkItem;

  const addBookmarkMutation = useMutation({
    mutationFn: ({
      schoolId: sid,
      tier = 'TARGET',
      round,
    }: {
      schoolId: string;
      tier?: string;
      round?: string;
    }) =>
      apiClient.post('/school-lists', {
        schoolId: sid,
        tier,
        ...(round && { round }),
      }),
    onSuccess: () => {
      toast.success(t('school.bookmarkAdded'));
      queryClient.invalidateQueries({ queryKey: ['school-lists'] });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.statusCode === 409) {
        toast.info(t('school.alreadyBookmarked'));
      }
      // Other errors handled by global MutationCache
    },
    meta: { skipGlobalErrorToast: true },
  });

  const removeBookmarkMutation = useMutation({
    mutationFn: (listItemId: string) => apiClient.delete(`/school-lists/${listItemId}`),
    onSuccess: () => {
      toast.success(t('school.bookmarkRemoved'));
      queryClient.invalidateQueries({ queryKey: ['school-lists'] });
    },
  });

  const handleAddToList = (round: string) => {
    if (!accessToken) {
      toast.error(t('school.loginToBookmark'));
      router.push('/login');
      return;
    }
    addBookmarkMutation.mutate({ schoolId, round });
  };

  const handleBookmarkRemove = () => {
    if (bookmarkItem) removeBookmarkMutation.mutate(bookmarkItem.id);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success(t('school.linkCopied'));
    } catch {
      toast.error(t('school.copyFailed'));
    }
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title: getSchoolName(school!, locale),
        url: window.location.href,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') toast.error(t('school.shareFailed'));
    }
  };

  if (isLoading) {
    return (
      <PageContainer>
        <LoadingState variant="card" count={4} />
      </PageContainer>
    );
  }

  if (error || !school) {
    return (
      <PageContainer>
        <EmptyState
          icon={<GraduationCap className="h-12 w-12" />}
          title={t('school.notFound')}
          description={t('school.notFoundDesc')}
          action={{
            label: t('school.backToRanking'),
            onClick: () => router.push('/ranking'),
          }}
        />
      </PageContainer>
    );
  }

  const deadlines = school.metadata?.deadlines || {};
  const requirements = school.metadata?.requirements || {};
  const essayPrompts = essayPromptsData?.data || school.metadata?.essayPrompts || [];

  const getCompetitionLevel = (rate: number | undefined) => {
    if (!rate) return t('school.difficulty.medium');
    if (rate < 10) return t('school.difficulty.veryHigh');
    if (rate < 20) return t('school.difficulty.high');
    if (rate < 40) return t('school.difficulty.moderatelyHigh');
    return t('school.difficulty.medium');
  };

  const getAiSuggestion = (rate: number | undefined) => {
    if (!rate) return t('school.aiSuggestion.default');
    if (rate < 10) return t('school.aiSuggestion.veryLow');
    if (rate < 20) return t('school.aiSuggestion.low');
    return t('school.aiSuggestion.moderate');
  };

  return (
    <PageContainer maxWidth="6xl">
      {school && (
        <SchoolJsonLd
          name={school.name}
          url={school.website}
          description={locale === 'zh' ? school.descriptionZh : school.description}
          address={
            school.city || school.state
              ? {
                  addressLocality: school.city,
                  addressRegion: school.state,
                  addressCountry: school.country || 'US',
                }
              : undefined
          }
        />
      )}
      {/* Back Button */}
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4 gap-2">
        <ArrowLeft className="h-4 w-4" />
        {t('common.back')}
      </Button>

      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mb-8 overflow-hidden rounded-lg bg-primary/5 p-6 sm:p-8"
      >
        {/* Decorative elements */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div className="flex items-start gap-4">
            <SchoolLogo
              logoUrl={school.logoUrl}
              name={getSchoolName(school, locale)}
              size="lg"
              variant="hero"
              rounded="lg"
            />

            <div>
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="text-title">{getSchoolName(school, locale)}</h1>
                {school.usNewsRank && school.usNewsRank <= 20 && (
                  <Badge variant="default" className="gap-1">
                    <Star className="h-3 w-3" />
                    Top {school.usNewsRank}
                  </Badge>
                )}
                {school.usNewsRank && school.usNewsRank > 20 && (
                  <Badge variant="info">#{school.usNewsRank} US News</Badge>
                )}
                {isLoggedIn && predictionData?.current && (
                  <Badge
                    variant="outline"
                    className={cn('gap-1', {
                      'bg-emerald-500/10 text-emerald-600 border-emerald-500/30':
                        predictionData.current.tier === 'safety',
                      'bg-blue-500/10 text-blue-600 border-blue-500/30':
                        predictionData.current.tier === 'match',
                      'bg-rose-500/10 text-rose-600 border-rose-500/30':
                        predictionData.current.tier === 'reach',
                    })}
                  >
                    <Target className="h-3 w-3" />
                    {Math.round(predictionData.current.probability * 100)}%{' '}
                    {predictionData.current.tier === 'safety'
                      ? t('school.prediction.safety')
                      : predictionData.current.tier === 'match'
                        ? t('school.prediction.match')
                        : t('school.prediction.reach')}
                  </Badge>
                )}
              </div>
              {getSchoolSubName(school, locale) && (
                <p className="text-lg text-muted-foreground mb-2">
                  {getSchoolSubName(school, locale)}
                </p>
              )}
              <div className="flex items-center gap-4 text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-rose-500" />
                  {school.city ? `${school.city}, ` : ''}
                  {school.state}, {school.country}
                </span>
                {school.website && (
                  <a
                    href={
                      school.website.startsWith('http')
                        ? school.website
                        : `https://${school.website}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 hover:text-primary transition-colors"
                  >
                    <Globe className="h-4 w-4" />
                    {t('school.website')}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {isBookmarked ? (
              <Button
                variant="secondary"
                size="sm"
                className="gap-2 bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20"
                onClick={handleBookmarkRemove}
                disabled={removeBookmarkMutation.isPending}
              >
                <Bookmark className="h-4 w-4 fill-current" />
                <span className="hidden sm:inline">{t('school.bookmarked')}</span>
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/30"
                    disabled={addBookmarkMutation.isPending}
                  >
                    <Bookmark className="h-4 w-4" />
                    <span className="hidden sm:inline">{t('school.bookmark')}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {(['ED', 'ED2', 'EA', 'REA', 'RD', 'ROLLING'] as const).map((round) => (
                    <DropdownMenuItem
                      key={round}
                      onClick={() => handleAddToList(round)}
                      disabled={addBookmarkMutation.isPending}
                    >
                      {t('findCollege.rounds.' + round)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Share2 className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('school.share')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleCopyLink}>
                  <Link2 className="mr-2 h-4 w-4" />
                  {t('school.copyLink')}
                </DropdownMenuItem>
                {canShare && (
                  <DropdownMenuItem onClick={handleNativeShare}>
                    <Share2 className="mr-2 h-4 w-4" />
                    {t('school.shareNative')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </motion.div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          {
            icon: Target,
            label: t('school.stats.acceptanceRate'),
            value: school.acceptanceRate
              ? formatAcceptanceRate(school.acceptanceRate)
              : tc('notAvailable'),
            color: 'rose',
          },
          {
            icon: DollarSign,
            label: t('school.stats.tuition'),
            value: school.tuition ? format.number(school.tuition, 'currency') : tc('notAvailable'),
            color: 'emerald',
          },
          {
            icon: TrendingUp,
            label: t('school.stats.avgSalary'),
            value: school.avgSalary
              ? format.number(school.avgSalary, 'currency')
              : tc('notAvailable'),
            color: 'blue',
          },
          {
            icon: Users,
            label: t('school.stats.studentCount'),
            value: school.studentCount
              ? format.number(school.studentCount, 'standard')
              : tc('notAvailable'),
            color: 'violet',
          },
        ].map((stat, index) => {
          const StatIcon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="overflow-hidden hover:shadow-md transition-shadow">
                <div
                  className={cn('h-1 bg-gradient-to-r', {
                    'bg-destructive': stat.color === 'rose',
                    'bg-success': stat.color === 'emerald',
                    'bg-primary': stat.color === 'blue' || stat.color === 'violet',
                  })}
                />
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className={cn('flex h-8 w-8 items-center justify-center rounded-lg', {
                        'bg-rose-500/10 text-rose-500': stat.color === 'rose',
                        'bg-emerald-500/10 text-emerald-500': stat.color === 'emerald',
                        'bg-blue-500/10 text-blue-500': stat.color === 'blue',
                        'bg-primary/10 text-primary': stat.color === 'violet',
                      })}
                    >
                      <StatIcon className="h-4 w-4" />
                    </div>
                    <span className="text-sm text-muted-foreground">{stat.label}</span>
                  </div>
                  <div
                    className={cn('text-2xl font-bold', {
                      'text-rose-600': stat.color === 'rose',
                      'text-emerald-600': stat.color === 'emerald',
                      'text-blue-600': stat.color === 'blue',
                      'text-primary': stat.color === 'violet',
                    })}
                  >
                    {stat.value}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* AI Context Actions — visible early in viewport */}
      {isLoggedIn && aiActions.length > 0 && (
        <div className="mb-6 rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{t('school.ai.title')}</span>
            <span className="text-xs text-muted-foreground">{t('school.ai.description')}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {aiActions.map((action) => (
              <Button
                key={action.id}
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs hover:bg-primary/5 hover:border-primary/50 hover:text-primary transition-all"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent('ai-assistant-action', {
                      detail: { message: action.message },
                    })
                  );
                }}
              >
                {action.icon}
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      )}
      {!isLoggedIn && (
        <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">{t('school.ai.loginHint')}</span>
          </div>
          <Button size="sm" variant="default" onClick={() => router.push('/login')}>
            {t('common.login')}
          </Button>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-muted/50 h-11">
          <TabsTrigger
            value="overview"
            className="gap-2 data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-600"
          >
            <GraduationCap className="h-4 w-4" />
            <span className="hidden sm:inline">{t('school.tabs.overview')}</span>
          </TabsTrigger>
          <TabsTrigger
            value="admission"
            className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
          >
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">{t('school.tabs.admission')}</span>
          </TabsTrigger>
          <TabsTrigger
            value="essays"
            className="gap-2 data-[state=active]:bg-rose-500/10 data-[state=active]:text-rose-600"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">{t('school.tabs.essays')}</span>
          </TabsTrigger>
          <TabsTrigger
            value="cases"
            className="gap-2 data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-600"
          >
            <Trophy className="h-4 w-4" />
            <span className="hidden sm:inline">{t('school.tabs.cases')}</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Academic Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  {t('school.academicStats')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t('school.usNewsRank')}</span>
                  <span className="font-semibold">#{school.usNewsRank || tc('notAvailable')}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t('school.satAvg')}</span>
                  <span className="font-semibold">
                    {school.sat25 && school.sat75
                      ? `${school.sat25}-${school.sat75}${school.satAvg ? ` (avg ${school.satAvg})` : ''}`
                      : school.satAvg || requirements.satRange || tc('notAvailable')}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t('school.actAvg')}</span>
                  <span className="font-semibold">
                    {school.act25 && school.act75
                      ? `${school.act25}-${school.act75}${school.actAvg ? ` (avg ${school.actAvg})` : ''}`
                      : school.actAvg || requirements.actRange || tc('notAvailable')}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t('school.graduationRate')}</span>
                  <span className="font-semibold">
                    {school.graduationRate ? `${Number(school.graduationRate).toFixed(0)}%` : 'N/A'}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Application Deadlines */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {t('school.deadlines.title')}
                </CardTitle>
                <CardDescription>
                  {school.metadata?.applicationCycle || '2025-2026'} {t('school.deadlines.cycle')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {deadlines.rea && (
                  <>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive">REA</Badge>
                        <span>{t('school.deadlines.rea')}</span>
                      </div>
                      <span className="font-semibold">{deadlines.rea}</span>
                    </div>
                    <Separator />
                  </>
                )}
                {deadlines.ea && (
                  <>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">EA</Badge>
                        <span>{t('school.deadlines.ea')}</span>
                      </div>
                      <span className="font-semibold">{deadlines.ea}</span>
                    </div>
                    <Separator />
                  </>
                )}
                {deadlines.ed && (
                  <>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Badge>ED</Badge>
                        <span>{t('school.deadlines.ed')}</span>
                      </div>
                      <span className="font-semibold">{deadlines.ed}</span>
                    </div>
                    <Separator />
                  </>
                )}
                {deadlines.ed2 && (
                  <>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">ED II</Badge>
                        <span>{t('school.deadlines.ed2')}</span>
                      </div>
                      <span className="font-semibold">{deadlines.ed2}</span>
                    </div>
                    <Separator />
                  </>
                )}
                {deadlines.rd && (
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">RD</Badge>
                      <span>{t('school.deadlines.rd')}</span>
                    </div>
                    <span className="font-semibold">{deadlines.rd}</span>
                  </div>
                )}
                {Object.keys(deadlines).length === 0 && (
                  <p className="text-muted-foreground text-center py-4">
                    {t('school.deadlines.noData')}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Description */}
          {(school.description || school.descriptionZh) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('school.about')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  {locale === 'zh'
                    ? school.descriptionZh || school.description
                    : school.description || school.descriptionZh}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Admission Tab */}
        <TabsContent value="admission" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('school.requirements.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">
                    {t('school.requirements.applicationType')}
                  </span>
                  <Badge>{school.metadata?.applicationType?.toUpperCase() || 'RD'}</Badge>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">
                    {t('school.requirements.essayCount')}
                  </span>
                  <span className="font-semibold">
                    {school.metadata?.essayCount || tc('notAvailable')}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">
                    {t('school.requirements.applicationFee')}
                  </span>
                  <span className="font-semibold">
                    {requirements.applicationFee ? `$${requirements.applicationFee}` : 'N/A'}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t('school.requirements.toeflMin')}</span>
                  <span className="font-semibold">
                    {requirements.toeflMin || tc('notAvailable')}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t('school.requirements.ieltsMin')}</span>
                  <span className="font-semibold">
                    {requirements.ieltsMin || tc('notAvailable')}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('school.difficultyAnalysis')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted-foreground">
                      {t('school.competitionLevel')}
                    </span>
                    <span className="text-sm font-medium">
                      {getCompetitionLevel(
                        school.acceptanceRate ? Number(school.acceptanceRate) : undefined
                      )}
                    </span>
                  </div>
                  <Progress
                    value={school.acceptanceRate ? 100 - Number(school.acceptanceRate) : 50}
                    className="h-2"
                  />
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    {t('school.aiSuggestion.title')}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {getAiSuggestion(
                      school.acceptanceRate ? Number(school.acceptanceRate) : undefined
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Essays Tab */}
        <TabsContent value="essays" className="space-y-6">
          {/* 文书统计 */}
          {essayPrompts.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="bg-primary/10 border-violet-500/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-primary">{essayPrompts.length}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('school.essays.totalCount')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-success/10 border-emerald-500/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20">
                      <CheckCircle className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-emerald-600">
                        {essayPrompts.filter((e: any) => e.isRequired !== false).length}
                      </p>
                      <p className="text-sm text-muted-foreground">{t('school.essays.required')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-warning/10 border-amber-500/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20">
                      <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-amber-600">
                        {essayPrompts.filter((e: any) => e.isRequired === false).length}
                      </p>
                      <p className="text-sm text-muted-foreground">{t('school.essays.optional')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 文书列表 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {t('school.essays.title')}
              </CardTitle>
              <CardDescription>
                {school.metadata?.applicationCycle || '2025-2026'} {t('school.deadlines.cycle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {essayPrompts.length > 0 ? (
                <div className="space-y-4">
                  {essayPrompts.map((essay: any, index: number) => (
                    <motion.div
                      key={essay.id || index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="group relative overflow-hidden rounded-xl border bg-card p-5 hover:shadow-md transition-all"
                    >
                      {/* 顶部标签 */}
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            'font-medium',
                            essay.type === 'WHY_SCHOOL' &&
                              'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
                            essay.type === 'SUPPLEMENTAL' &&
                              'bg-primary/10 text-primary border-violet-500/20',
                            essay.type === 'SHORT_ANSWER' &&
                              'bg-pink-500/10 text-pink-600 border-pink-500/20',
                            essay.type === 'ACTIVITY' &&
                              'bg-amber-500/10 text-amber-600 border-amber-500/20'
                          )}
                        >
                          {essay.type || 'SUPPLEMENTAL'}
                        </Badge>
                        {essay.isRequired !== false ? (
                          <Badge
                            variant="default"
                            className="bg-red-500/10 text-red-600 border-red-500/20"
                          >
                            {t('school.essays.requiredTag')}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">{t('school.essays.optionalTag')}</Badge>
                        )}
                        {essay.wordLimit && (
                          <Badge variant="outline" className="gap-1">
                            <span className="font-mono">{essay.wordLimit}</span>{' '}
                            {t('school.essays.words')}
                          </Badge>
                        )}
                      </div>

                      {/* 英文原文 */}
                      <p className="text-sm leading-relaxed text-foreground mb-3">{essay.prompt}</p>

                      {/* 中文翻译 */}
                      {essay.promptZh && (
                        <div className="bg-muted/50 rounded-lg p-3 mb-3">
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            📌 {essay.promptZh}
                          </p>
                        </div>
                      )}

                      {/* AI 写作建议 */}
                      {essay.aiTips && (
                        <div className="bg-warning/10 rounded-lg p-3 border border-amber-500/20">
                          <div className="flex items-start gap-2">
                            <Sparkles className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs font-medium text-amber-600 mb-1">
                                {t('school.essays.aiTips')}
                              </p>
                              <p className="text-sm text-amber-700/80">{essay.aiTips}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 分类标签 */}
                      {essay.aiCategory && (
                        <div className="mt-3 flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {t('school.essays.category')}:
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {essay.aiCategory}
                          </Badge>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium">{t('school.essays.noData')}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('school.essays.updateHint')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cases Tab */}
        <TabsContent value="cases" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                {t('school.cases.title')}
              </CardTitle>
              <CardDescription>{t('school.cases.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              {school.cases && school.cases.length > 0 ? (
                <div className="space-y-4">
                  {school.cases.map((case_) => (
                    <div key={case_.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={case_.result === 'ADMITTED' ? 'default' : 'secondary'}>
                            {case_.result === 'ADMITTED'
                              ? t('cases.result.admitted')
                              : case_.result === 'REJECTED'
                                ? t('cases.result.rejected')
                                : case_.result === 'WAITLISTED'
                                  ? t('cases.result.waitlisted')
                                  : case_.result}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {case_.year} {case_.round}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        {case_.gpaRange && <span>GPA: {case_.gpaRange}</span>}
                        {case_.satRange && <span>SAT: {case_.satRange}</span>}
                      </div>
                      {case_.tags && case_.tags.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {case_.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t('school.cases.noData')}</p>
                  <p className="text-sm text-muted-foreground mt-1">{t('school.cases.beFirst')}</p>
                  <Button className="mt-4" onClick={() => router.push('/cases')}>
                    {t('school.cases.submitCase')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
