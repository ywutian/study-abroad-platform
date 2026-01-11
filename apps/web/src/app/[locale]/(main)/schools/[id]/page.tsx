'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { PageContainer } from '@/components/layout';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { apiClient } from '@/lib/api';
import { useRouter } from '@/lib/i18n/navigation';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
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
  Target,
  Sparkles,
  Globe,
  Star,
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
  actAvg?: number;
  studentCount?: number;
  graduationRate?: number;
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
  const schoolId = params.id as string;

  const { data: response, isLoading, error } = useQuery({
    queryKey: ['school', schoolId],
    queryFn: () => apiClient.get<{ success: boolean; data: SchoolDetail }>(`/schools/${schoolId}`),
    enabled: !!schoolId,
  });

  const school = response?.data;

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
  const essayPrompts = school.metadata?.essayPrompts || [];

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
      {/* Back Button */}
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4 gap-2">
        <ArrowLeft className="h-4 w-4" />
        {t('common.back')}
      </Button>

      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500/10 via-background to-cyan-500/10 p-6 sm:p-8"
      >
        {/* Decorative elements */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-gradient-to-br from-violet-500/20 to-blue-500/20 blur-3xl" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div className="flex items-start gap-4">
            {/* School Icon */}
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/25">
              <span className="text-2xl font-bold">{school.name.charAt(0)}</span>
            </div>
            
            <div>
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold">{school.nameZh || school.name}</h1>
                {school.usNewsRank && school.usNewsRank <= 20 && (
                  <Badge variant="gradient" className="gap-1">
                    <Star className="h-3 w-3" />
                    Top {school.usNewsRank}
                  </Badge>
                )}
                {school.usNewsRank && school.usNewsRank > 20 && (
                  <Badge variant="info">#{school.usNewsRank} US News</Badge>
                )}
              </div>
              {school.nameZh && (
                <p className="text-lg text-muted-foreground mb-2">{school.name}</p>
              )}
              <div className="flex items-center gap-4 text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-rose-500" />
                  {school.city ? `${school.city}, ` : ''}{school.state}, {school.country}
                </span>
                {school.website && (
                  <a
                    href={school.website.startsWith('http') ? school.website : `https://${school.website}`}
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
            <Button variant="outline" size="sm" className="gap-2 hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/30">
              <Bookmark className="h-4 w-4" />
              <span className="hidden sm:inline">{t('school.bookmark')}</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">{t('school.share')}</span>
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Target, label: t('school.stats.acceptanceRate'), value: school.acceptanceRate ? `${Number(school.acceptanceRate).toFixed(1)}%` : 'N/A', color: 'rose' },
          { icon: DollarSign, label: t('school.stats.tuition'), value: school.tuition ? `$${school.tuition.toLocaleString()}` : 'N/A', color: 'emerald' },
          { icon: TrendingUp, label: t('school.stats.avgSalary'), value: school.avgSalary ? `$${school.avgSalary.toLocaleString()}` : 'N/A', color: 'blue' },
          { icon: Users, label: t('school.stats.studentCount'), value: school.studentCount ? school.studentCount.toLocaleString() : 'N/A', color: 'violet' },
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
                <div className={cn('h-1 bg-gradient-to-r', {
                  'from-rose-500 to-pink-500': stat.color === 'rose',
                  'from-emerald-500 to-teal-500': stat.color === 'emerald',
                  'from-blue-500 to-cyan-500': stat.color === 'blue',
                  'from-violet-500 to-purple-500': stat.color === 'violet',
                })} />
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', {
                      'bg-rose-500/10 text-rose-500': stat.color === 'rose',
                      'bg-emerald-500/10 text-emerald-500': stat.color === 'emerald',
                      'bg-blue-500/10 text-blue-500': stat.color === 'blue',
                      'bg-violet-500/10 text-violet-500': stat.color === 'violet',
                    })}>
                      <StatIcon className="h-4 w-4" />
                    </div>
                    <span className="text-sm text-muted-foreground">{stat.label}</span>
                  </div>
                  <div className={cn('text-2xl font-bold', {
                    'text-rose-600': stat.color === 'rose',
                    'text-emerald-600': stat.color === 'emerald',
                    'text-blue-600': stat.color === 'blue',
                    'text-violet-600': stat.color === 'violet',
                  })}>
                    {stat.value}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-muted/50 h-11">
          <TabsTrigger value="overview" className="gap-2 data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-600">
            <GraduationCap className="h-4 w-4" />
            <span className="hidden sm:inline">{t('school.tabs.overview')}</span>
          </TabsTrigger>
          <TabsTrigger value="admission" className="gap-2 data-[state=active]:bg-violet-500/10 data-[state=active]:text-violet-600">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">{t('school.tabs.admission')}</span>
          </TabsTrigger>
          <TabsTrigger value="essays" className="gap-2 data-[state=active]:bg-rose-500/10 data-[state=active]:text-rose-600">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">{t('school.tabs.essays')}</span>
          </TabsTrigger>
          <TabsTrigger value="cases" className="gap-2 data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-600">
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
                  <span className="font-semibold">#{school.usNewsRank || 'N/A'}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t('school.satAvg')}</span>
                  <span className="font-semibold">{school.satAvg || requirements.satRange || 'N/A'}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t('school.actAvg')}</span>
                  <span className="font-semibold">{school.actAvg || requirements.actRange || 'N/A'}</span>
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
                  <p className="text-muted-foreground text-center py-4">{t('school.deadlines.noData')}</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Description */}
          {(school.descriptionZh || school.description) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('school.about')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  {school.descriptionZh || school.description}
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
                  <span className="text-muted-foreground">{t('school.requirements.applicationType')}</span>
                  <Badge>{school.metadata?.applicationType?.toUpperCase() || 'RD'}</Badge>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t('school.requirements.essayCount')}</span>
                  <span className="font-semibold">{school.metadata?.essayCount || 'N/A'}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t('school.requirements.applicationFee')}</span>
                  <span className="font-semibold">
                    {requirements.applicationFee ? `$${requirements.applicationFee}` : 'N/A'}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t('school.requirements.toeflMin')}</span>
                  <span className="font-semibold">{requirements.toeflMin || 'N/A'}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t('school.requirements.ieltsMin')}</span>
                  <span className="font-semibold">{requirements.ieltsMin || 'N/A'}</span>
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
                    <span className="text-sm text-muted-foreground">{t('school.competitionLevel')}</span>
                    <span className="text-sm font-medium">
                      {getCompetitionLevel(school.acceptanceRate ? Number(school.acceptanceRate) : undefined)}
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
                    {getAiSuggestion(school.acceptanceRate ? Number(school.acceptanceRate) : undefined)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Essays Tab */}
        <TabsContent value="essays" className="space-y-6">
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
                  {essayPrompts.map((essay, index) => (
                    <div key={essay.id || index} className="p-4 border rounded-lg">
                      <div className="flex items-start gap-3">
                        <Badge variant="outline" className="mt-1">
                          {index + 1}
                        </Badge>
                        <p className="text-sm leading-relaxed">{essay.prompt}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t('school.essays.noData')}</p>
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
              <CardDescription>
                {t('school.cases.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {school.cases && school.cases.length > 0 ? (
                <div className="space-y-4">
                  {school.cases.map((case_) => (
                    <div key={case_.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={case_.result === 'ADMITTED' ? 'default' : 'secondary'}
                          >
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
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('school.cases.beFirst')}
                  </p>
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
