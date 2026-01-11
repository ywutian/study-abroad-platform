'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { apiClient } from '@/lib/api';
import { PageContainer } from '@/components/layout';
import { LoadingState } from '@/components/ui/loading-state';
import { ProfileSelector, SchoolSelector, CreateListDialog } from '@/components/features';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Users,
  Trophy,
  List,
  Star,
  Send,
  GraduationCap,
  Briefcase,
  FileText,
  ThumbsUp,
  Loader2,
  TrendingUp,
  ChevronUp,
  ChevronDown,
  Minus,
  Sparkles,
  Target,
  Plus,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ScoreKey = 'academic' | 'activity' | 'essay' | 'overall';

const TAB_CONFIG = [
  { value: 'review', labelKey: 'hall.tabs.review', icon: Users, color: 'from-violet-500 to-purple-500' },
  { value: 'ranking', labelKey: 'hall.tabs.ranking', icon: Trophy, color: 'from-amber-500 to-yellow-500' },
  { value: 'lists', labelKey: 'hall.tabs.lists', icon: List, color: 'from-blue-500 to-cyan-500' },
];

const getReviewCriteria = (t: any): { key: ScoreKey; label: string; icon: typeof GraduationCap; description: string; color: string }[] => [
  { key: 'academic', label: t('hall.review.academic'), icon: GraduationCap, description: t('hall.review.academicDesc'), color: 'text-blue-500' },
  { key: 'activity', label: t('hall.review.activity'), icon: Briefcase, description: t('hall.review.activityDesc'), color: 'text-emerald-500' },
  { key: 'essay', label: t('hall.review.essay'), icon: FileText, description: t('hall.review.essayDesc'), color: 'text-amber-500' },
  { key: 'overall', label: t('hall.review.overall'), icon: Star, description: t('hall.review.overallDesc'), color: 'text-violet-500' },
];

interface PublicProfile {
  id: string;
  userId: string;
  grade?: string;
  gpa?: number;
  gpaScale?: number;
  targetMajor?: string;
  visibility: string;
  _count?: {
    testScores: number;
    activities: number;
    awards: number;
  };
}

interface School {
  id: string;
  name: string;
  nameZh?: string;
  country: string;
  state?: string;
  usNewsRank?: number;
  acceptanceRate?: number;
}

interface RankingResult {
  schoolId: string;
  schoolName: string;
  totalApplicants: number;
  yourRank: number;
  percentile: number;
  breakdown: {
    gpa: number;
    activities: number;
    awards: number;
    testScores: number;
  };
}

export default function HallPage() {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('review');
  const [selectedProfile, setSelectedProfile] = useState<PublicProfile | null>(null);
  const [selectedSchools, setSelectedSchools] = useState<School[]>([]);
  const [schoolSelectorOpen, setSchoolSelectorOpen] = useState(false);
  const [createListOpen, setCreateListOpen] = useState(false);

  const [reviewScores, setReviewScores] = useState({
    academic: 5,
    activity: 5,
    essay: 5,
    overall: 5,
    comment: '',
  });

  const { data: publicListsResponse, isLoading: listsLoading } = useQuery({
    queryKey: ['publicLists'],
    queryFn: () => apiClient.get<{ success: boolean; data: { items: any[] } }>('/hall/lists'),
  });
  const publicLists = publicListsResponse?.data;

  const submitReviewMutation = useMutation({
    mutationFn: (data: {
      profileUserId: string;
      academicScore: number;
      activityScore: number;
      essayScore: number;
      overallScore: number;
      comment?: string;
    }) => apiClient.post('/hall/reviews', data),
    onSuccess: () => {
      toast.success(t('hall.review.submitSuccess'));
      setSelectedProfile(null);
      setReviewScores({ academic: 5, activity: 5, essay: 5, overall: 5, comment: '' });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const { data: rankingResponse, isLoading: rankingLoading, refetch: fetchRanking } = useQuery({
    queryKey: ['hallRanking', selectedSchools.map(s => s.id)],
    queryFn: () =>
      apiClient.post<{ success: boolean; data: { rankings: RankingResult[] } }>('/hall/ranking', {
        schoolIds: selectedSchools.map(s => s.id),
      }),
    enabled: false,
  });
  const rankingResults = rankingResponse?.data;

  const handleSubmitReview = () => {
    if (!selectedProfile) {
      toast.error(t('hall.review.selectProfileFirst'));
      return;
    }
    submitReviewMutation.mutate({
      profileUserId: selectedProfile.userId,
      academicScore: reviewScores.academic,
      activityScore: reviewScores.activity,
      essayScore: reviewScores.essay,
      overallScore: reviewScores.overall,
      comment: reviewScores.comment || undefined,
    });
  };

  const handleFetchRanking = () => {
    if (selectedSchools.length === 0) {
      toast.error(t('hall.ranking.selectSchoolFirst'));
      return;
    }
    fetchRanking();
  };

  const getRankIcon = (percentile: number) => {
    if (percentile <= 25) return <ChevronUp className="h-4 w-4 text-emerald-500" />;
    if (percentile >= 75) return <ChevronDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-amber-500" />;
  };

  const activeTabConfig = TAB_CONFIG.find(t => t.value === activeTab);

  return (
    <PageContainer maxWidth="7xl">
      {/* 页面头部 */}
      <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500/10 via-background to-purple-500/10 p-6 sm:p-8">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-gradient-to-br from-indigo-500/20 to-violet-500/20 blur-3xl" />
        
        <div className="relative z-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg shadow-violet-500/25">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('hall.title')}</h1>
                  <p className="text-muted-foreground">{t('hall.description')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tab 选择器 */}
          <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
            {TAB_CONFIG.map((tab) => {
              const isActive = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-4 py-2.5 font-medium transition-all whitespace-nowrap',
                    isActive
                      ? 'bg-white/90 dark:bg-white/10 shadow-lg backdrop-blur-sm'
                      : 'bg-white/50 dark:bg-white/5 hover:bg-white/70 dark:hover:bg-white/10'
                  )}
                >
                  <div className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg',
                    isActive 
                      ? `bg-gradient-to-br ${tab.color} text-white` 
                      : 'bg-muted text-muted-foreground'
                  )}>
                    <tab.icon className="h-4 w-4" />
                  </div>
                  <span className={isActive ? '' : 'text-muted-foreground'}>{t(tab.labelKey)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* Review Tab */}
        {activeTab === 'review' && (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid gap-6 lg:grid-cols-2"
          >
            {/* Profile Selector */}
            <Card className="overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-violet-500 to-purple-500" />
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{t('hall.review.selectProfile')}</CardTitle>
                    <CardDescription>{t('hall.review.selectProfileDesc')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ProfileSelector
                  onSelect={setSelectedProfile}
                  selectedProfileId={selectedProfile?.id}
                />
              </CardContent>
            </Card>

            {/* Review Form */}
            <Card className="overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-amber-500 to-yellow-500" />
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                    <Star className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{t('hall.review.title')}</CardTitle>
                    <CardDescription>
                      {selectedProfile
                        ? t('hall.review.evaluating', { major: selectedProfile.targetMajor || t('hall.review.unknownMajor') })
                        : t('hall.review.evaluateHint')}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {!selectedProfile ? (
                  <div className="py-12 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10">
                      <Users className="h-8 w-8 text-amber-500/50" />
                    </div>
                    <p className="font-medium">{t('hall.review.selectFirst')}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{t('hall.review.selectFirstDesc')}</p>
                  </div>
                ) : (
                  <>
                    {/* Selected profile summary */}
                    <div className="rounded-xl bg-gradient-to-r from-violet-500/10 to-transparent p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 text-white shadow-md">
                          <GraduationCap className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="font-semibold">{selectedProfile.targetMajor || t('hall.review.noMajor')}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {selectedProfile.gpa && (
                              <Badge variant="secondary">GPA {Number(selectedProfile.gpa).toFixed(2)}</Badge>
                            )}
                            {selectedProfile._count?.activities && (
                              <Badge variant="outline">{selectedProfile._count.activities} {t('hall.review.activities')}</Badge>
                            )}
                            {selectedProfile._count?.awards && (
                              <Badge variant="outline">{selectedProfile._count.awards} {t('hall.review.awards')}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Review criteria sliders */}
                    {getReviewCriteria(t).map((criteria, index) => (
                      <motion.div
                        key={criteria.key}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg bg-muted', criteria.color)}>
                              <criteria.icon className="h-4 w-4" />
                            </div>
                            <div>
                              <Label className="font-medium">{criteria.label}</Label>
                              <p className="text-xs text-muted-foreground">{criteria.description}</p>
                            </div>
                          </div>
                          <Badge variant={reviewScores[criteria.key] >= 7 ? 'default' : 'secondary'} className="font-mono">
                            {reviewScores[criteria.key]}/10
                          </Badge>
                        </div>
                        <Slider
                          value={[reviewScores[criteria.key]]}
                          onValueChange={([v]) =>
                            setReviewScores((p) => ({ ...p, [criteria.key]: v }))
                          }
                          max={10}
                          step={1}
                          className="cursor-pointer"
                        />
                      </motion.div>
                    ))}

                    <div className="space-y-2">
                      <Label className="font-medium">{t('hall.review.comment')}</Label>
                      <Textarea
                        placeholder={t('hall.review.commentPlaceholder')}
                        value={reviewScores.comment}
                        onChange={(e) =>
                          setReviewScores((p) => ({ ...p, comment: e.target.value }))
                        }
                        rows={4}
                        className="resize-none"
                      />
                    </div>

                    <Button
                      className="w-full h-11 gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:opacity-90"
                      onClick={handleSubmitReview}
                      disabled={submitReviewMutation.isPending}
                    >
                      {submitReviewMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      {t('hall.review.submitReview')}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Ranking Tab */}
        {activeTab === 'ranking' && (
          <motion.div
            key="ranking"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid gap-6 lg:grid-cols-3"
          >
            {/* School Selection */}
            <Card className="overflow-hidden lg:col-span-1">
              <div className="h-1.5 bg-gradient-to-r from-amber-500 to-yellow-500" />
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                    <Target className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{t('hall.ranking.selectSchools')}</CardTitle>
                    <CardDescription>{t('hall.ranking.selectSchoolsDesc')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  variant="outline"
                  className="w-full h-11 gap-2"
                  onClick={() => setSchoolSelectorOpen(true)}
                >
                  <GraduationCap className="h-4 w-4" />
                  {selectedSchools.length > 0
                    ? t('hall.ranking.selectedCount', { count: selectedSchools.length })
                    : t('hall.ranking.selectSchoolsButton')}
                </Button>

                {selectedSchools.length > 0 && (
                  <div className="space-y-2">
                    {selectedSchools.slice(0, 5).map((school, index) => (
                      <motion.div
                        key={school.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-center justify-between rounded-lg bg-gradient-to-r from-amber-500/5 to-transparent px-3 py-2 text-sm"
                      >
                        <span className="truncate">{school.nameZh || school.name}</span>
                        {school.usNewsRank && (
                          <Badge variant="outline" className="shrink-0">#{school.usNewsRank}</Badge>
                        )}
                      </motion.div>
                    ))}
                    {selectedSchools.length > 5 && (
                      <p className="text-center text-xs text-muted-foreground">
                        {t('hall.ranking.moreSchools', { count: selectedSchools.length - 5 })}
                      </p>
                    )}
                  </div>
                )}

                <Button
                  className="w-full h-11 gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:opacity-90"
                  onClick={handleFetchRanking}
                  disabled={selectedSchools.length === 0 || rankingLoading}
                >
                  {rankingLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <TrendingUp className="h-4 w-4" />
                  )}
                  {t('hall.ranking.viewRanking')}
                </Button>
              </CardContent>
            </Card>

            {/* Ranking Results */}
            <Card className="overflow-hidden lg:col-span-2">
              <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500" />
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                    <Trophy className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{t('hall.ranking.title')}</CardTitle>
                    <CardDescription>{t('hall.ranking.resultsDesc')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {rankingLoading ? (
                  <LoadingState variant="card" count={3} />
                ) : rankingResults?.rankings && rankingResults.rankings.length > 0 ? (
                  <div className="space-y-4">
                    {rankingResults.rankings.map((result, index) => (
                      <motion.div
                        key={result.schoolId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="rounded-xl border p-4 hover:shadow-md transition-all"
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold">{result.schoolName}</h4>
                            <p className="text-sm text-muted-foreground">
                              {t('hall.ranking.totalApplicants', { count: result.totalApplicants })}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            {getRankIcon(result.percentile)}
                            <div className="text-right">
                              <p className="text-2xl font-bold text-primary">#{result.yourRank}</p>
                              <Badge variant="secondary" className="text-xs">Top {result.percentile}%</Badge>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { label: 'GPA', value: result.breakdown.gpa, color: 'bg-blue-500' },
                            { label: t('hall.ranking.factorActivities'), value: result.breakdown.activities, color: 'bg-emerald-500' },
                            { label: t('hall.ranking.factorAwards'), value: result.breakdown.awards, color: 'bg-amber-500' },
                            { label: t('hall.ranking.factorScores'), value: result.breakdown.testScores, color: 'bg-violet-500' },
                          ].map((item) => (
                            <div key={item.label} className="rounded-lg bg-muted/50 p-3 text-center">
                              <p className="text-xs text-muted-foreground mb-2">{item.label}</p>
                              <Progress value={item.value} className={cn('h-1.5', `[&>[role=progressbar]]:${item.color}`)} />
                              <p className="mt-1 text-sm font-semibold">{item.value}%</p>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10">
                      <Trophy className="h-8 w-8 text-emerald-500/50" />
                    </div>
                    <p className="font-medium">{t('hall.ranking.emptyTitle')}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{t('hall.ranking.emptyDesc')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Lists Tab */}
        {activeTab === 'lists' && (
          <motion.div
            key="lists"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold">{t('hall.lists.title')}</h2>
              <Button onClick={() => setCreateListOpen(true)} className="gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:opacity-90">
                <Plus className="h-4 w-4" />
                {t('hall.lists.createList')}
              </Button>
            </div>

            {listsLoading ? (
              <LoadingState variant="card" count={4} />
            ) : publicLists?.items && publicLists.items.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {publicLists.items.map((list: any, index: number) => (
                  <motion.div
                    key={list.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="group cursor-pointer overflow-hidden hover:shadow-lg transition-all">
                      <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg group-hover:text-primary transition-colors">{list.title}</CardTitle>
                            <CardDescription className="line-clamp-2 mt-1">
                              {list.description}
                            </CardDescription>
                          </div>
                          {list.category && (
                            <Badge variant="secondary">{list.category}</Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>By {list.user?.email?.split('@')[0] || t('common.anonymous')}</span>
                          <span className="flex items-center gap-1">
                            <ThumbsUp className="h-4 w-4" />
                            {list._count?.votes || 0}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-16 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10">
                    <List className="h-8 w-8 text-blue-500/50" />
                  </div>
                  <p className="font-medium">{t('hall.lists.emptyTitle')}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t('hall.lists.emptyDesc')}</p>
                  <Button onClick={() => setCreateListOpen(true)} className="mt-6 gap-2" variant="outline">
                    <Plus className="h-4 w-4" />
                    {t('hall.lists.createList')}
                  </Button>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <SchoolSelector
        open={schoolSelectorOpen}
        onOpenChange={setSchoolSelectorOpen}
        selectedSchools={selectedSchools}
        onSelect={setSelectedSchools}
        maxSelection={10}
        title={t('hall.ranking.selectSchools')}
      />

      <CreateListDialog
        open={createListOpen}
        onOpenChange={setCreateListOpen}
      />
    </PageContainer>
  );
}
