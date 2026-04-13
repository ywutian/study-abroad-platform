'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations, useLocale, useFormatter } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageContainer, PageHeader } from '@/components/layout';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { SchoolJsonLd } from '@/components/seo';
import { apiClient, STALE_TIME } from '@/lib/api';
import { useRouter } from '@/lib/i18n/navigation';
import { useAuthStore } from '@/stores/auth';
import { useSchoolPrediction } from '@/hooks/use-prediction';
import {
  getSchoolEnrollmentCount,
  getSchoolFieldSource,
  getTrustedValue,
} from '@/components/features/schools/school-display-utils';
import { TrustBadge } from '@/components/features/schools/TrustBadge';
import { motion } from 'framer-motion';
import { cn, getSchoolName, formatAcceptanceRate } from '@/lib/utils';
import {
  Target,
  DollarSign,
  Users,
  GraduationCap,
  FileText,
  TrendingUp,
  ArrowLeft,
  Trophy,
  Sparkles,
  BarChart3,
  School,
  ExternalLink,
} from 'lucide-react';

import { AgentType, DATA_SOURCE_LABELS, schoolRoutes } from '@study-abroad/shared';
import type { SchoolDetail, EssayPrompt } from './_components/types';
import { getSourceUrl } from './_components/source-utils';
import { SchoolHeroHeader } from './_components/school-hero-header';
import { SchoolOverviewTab } from './_components/school-overview-tab';
import { SchoolAcademicsTab, SchoolEssaysTab } from './_components/school-academics-tab';
import { SchoolCasesTab } from './_components/school-cases-tab';
import { SchoolBookmarkButton } from './_components/school-bookmark-button';
import { buildSchoolAiContext } from './_components/school-ai-context';
import { openFloatingAgentChat } from '@/components/features/agent-chat/floating-chat-bridge';

export default function SchoolDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations();
  const tc = useTranslations('common');
  const locale = useLocale();
  const format = useFormatter();
  const schoolId = params.id as string;
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
    queryFn: () => apiClient.get<SchoolDetail>(schoolRoutes.byId(schoolId)),
    staleTime: STALE_TIME.STATIC,
    enabled: !!schoolId,
  });

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

  const isLoggedIn = isInitialized && !!accessToken;
  const { data: predictionData } = useSchoolPrediction(schoolId, isLoggedIn);

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

  const schoolAiContext = useMemo(() => {
    return buildSchoolAiContext({
      school,
      schoolId,
      locale,
      predictionData,
    });
  }, [locale, predictionData, school, schoolId]);

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
            label: t('school.backToSchools'),
            onClick: () => router.push('/schools'),
          }}
        />
      </PageContainer>
    );
  }

  const essayPrompts = essayPromptsData?.data || school.metadata?.essayPrompts || [];

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

      {/* Page Header */}
      <PageHeader title={getSchoolName(school, locale)} icon={School} color="blue" />

      {/* Hero Header */}
      <SchoolHeroHeader
        school={school}
        predictionData={predictionData}
        isLoggedIn={isLoggedIn}
        actions={<SchoolBookmarkButton schoolId={schoolId} canShare={canShare} />}
      />

      {/* Key Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {(() => {
          const enrollmentCount = getSchoolEnrollmentCount(school);
          const trustedAcceptanceRate = getTrustedValue(
            school,
            school.acceptanceRate,
            'acceptanceRate'
          );
          const trustedTuition = getTrustedValue(school, school.tuition, 'tuition');
          const trustedAvgSalary = getTrustedValue(school, school.avgSalary, 'avgSalary');
          const trustedEnrollmentCount = getTrustedValue(
            school,
            enrollmentCount,
            'totalEnrollment',
            'studentCount'
          );
          return [
            {
              icon: Target,
              label: t('school.stats.acceptanceRate'),
              value:
                trustedAcceptanceRate != null
                  ? formatAcceptanceRate(trustedAcceptanceRate)
                  : tc('notAvailable'),
              color: 'rose',
              source: getSchoolFieldSource(school, 'acceptanceRate'),
            },
            {
              icon: DollarSign,
              label: t('school.stats.tuition'),
              value:
                trustedTuition != null
                  ? format.number(trustedTuition, 'currency')
                  : tc('notAvailable'),
              color: 'emerald',
              source: getSchoolFieldSource(school, 'tuition'),
            },
            {
              icon: TrendingUp,
              label: t('school.stats.avgSalary'),
              value:
                trustedAvgSalary != null
                  ? format.number(trustedAvgSalary, 'currency')
                  : tc('notAvailable'),
              color: 'blue',
              source: getSchoolFieldSource(school, 'avgSalary'),
            },
            {
              icon: Users,
              label: t('school.stats.studentCount'),
              value:
                trustedEnrollmentCount != null
                  ? format.number(trustedEnrollmentCount, 'standard')
                  : tc('notAvailable'),
              color: 'violet',
              source: getSchoolFieldSource(school, 'totalEnrollment', 'studentCount'),
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
                          'bg-rose-500/10 text-rose-500 dark:text-rose-400': stat.color === 'rose',
                          'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400':
                            stat.color === 'emerald',
                          'bg-blue-500/10 text-blue-500 dark:text-blue-400': stat.color === 'blue',
                          'bg-primary/10 text-primary': stat.color === 'violet',
                        })}
                      >
                        <StatIcon className="h-4 w-4" />
                      </div>
                      <span className="text-sm text-muted-foreground">{stat.label}</span>
                    </div>
                    <div
                      className={cn('text-2xl font-bold', {
                        'text-rose-600 dark:text-rose-400': stat.color === 'rose',
                        'text-emerald-600 dark:text-emerald-400': stat.color === 'emerald',
                        'text-blue-600 dark:text-blue-400': stat.color === 'blue',
                        'text-primary': stat.color === 'violet',
                      })}
                    >
                      {stat.value}
                    </div>
                    <div className="mt-2">
                      <TrustBadge
                        source={stat.source}
                        sourceUrl={stat.source ? getSourceUrl(stat.source.source, school) : null}
                      />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          });
        })()}
      </div>

      {/* AI Context Actions */}
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
                  openFloatingAgentChat({
                    message: action.message,
                    context: schoolAiContext,
                    agentHint: AgentType.SCHOOL,
                  });
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
            className="gap-2 data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400"
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
            className="gap-2 data-[state=active]:bg-rose-500/10 data-[state=active]:text-rose-600 dark:data-[state=active]:text-rose-400"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">{t('school.tabs.essays')}</span>
          </TabsTrigger>
          <TabsTrigger
            value="cases"
            className="gap-2 data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400"
          >
            <Trophy className="h-4 w-4" />
            <span className="hidden sm:inline">{t('school.tabs.cases')}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <SchoolOverviewTab school={school} />
        </TabsContent>

        <TabsContent value="admission" className="space-y-6">
          <SchoolAcademicsTab school={school} essayPrompts={essayPrompts} />
        </TabsContent>

        <TabsContent value="essays" className="space-y-6">
          <SchoolEssaysTab school={school} essayPrompts={essayPrompts} />
        </TabsContent>

        <TabsContent value="cases" className="space-y-6">
          <SchoolCasesTab school={school} />
        </TabsContent>
      </Tabs>

      {/* Data Sources Footer */}
      {(() => {
        const prov = school.metadata?.provenance as
          | Record<string, { source: string; at: string }>
          | undefined;
        if (!prov || Object.keys(prov).length === 0) return null;
        const lk = locale === 'zh' ? 'zh' : 'en';
        const seen = new Set<string>();
        const uniqueSourceEntries: { source: string; label: string }[] = [];
        for (const p of Object.values(prov)) {
          const label = DATA_SOURCE_LABELS[p.source]?.[lk];
          if (label && !seen.has(p.source)) {
            seen.add(p.source);
            uniqueSourceEntries.push({ source: p.source, label });
          }
        }
        if (uniqueSourceEntries.length === 0) return null;
        return (
          <div className="mt-8 p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground">
            <p className="font-medium mb-1">{t('school.dataSources')}</p>
            <p className="flex flex-wrap gap-x-1 gap-y-1">
              {uniqueSourceEntries.map((entry, i) => {
                const url = getSourceUrl(entry.source, school);
                return (
                  <span key={entry.source} className="inline-flex items-center">
                    {i > 0 && <span className="text-muted-foreground/50 mx-1">·</span>}
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary hover:underline inline-flex items-center gap-0.5"
                      >
                        {entry.label}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    ) : (
                      entry.label
                    )}
                  </span>
                );
              })}
            </p>
            <p className="text-xs mt-1">{t('school.dataDisclaimer')}</p>
          </div>
        );
      })()}
    </PageContainer>
  );
}
