'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { apiClient } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/layout';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { ProfileSelector, SchoolSelector, CreateListDialog } from '@/components/features';
import { toast } from 'sonner';
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
  Award,
  TrendingUp,
  ChevronUp,
  ChevronDown,
  Minus,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ScoreKey = 'academic' | 'activity' | 'essay' | 'overall';

const REVIEW_CRITERIA: { key: ScoreKey; label: string; icon: typeof GraduationCap; description: string }[] = [
  { key: 'academic', label: '学术背景', icon: GraduationCap, description: '课程难度、GPA、班级排名' },
  { key: 'activity', label: '活动经历', icon: Briefcase, description: '领导力、深度、持续性' },
  { key: 'essay', label: '文书质量', icon: FileText, description: '个人特色、叙事能力' },
  { key: 'overall', label: '综合评价', icon: Star, description: '整体竞争力评估' },
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

  // Fetch public lists
  const { data: publicLists, isLoading: listsLoading } = useQuery({
    queryKey: ['publicLists'],
    queryFn: () => apiClient.get<{ items: any[] }>('/hall/lists'),
  });

  // Submit review mutation
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
      toast.success('评价提交成功，感谢你的贡献！');
      setSelectedProfile(null);
      setReviewScores({ academic: 5, activity: 5, essay: 5, overall: 5, comment: '' });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Fetch ranking for selected schools
  const { data: rankingResults, isLoading: rankingLoading, refetch: fetchRanking } = useQuery({
    queryKey: ['hallRanking', selectedSchools.map(s => s.id)],
    queryFn: () =>
      apiClient.post<{ rankings: RankingResult[] }>('/hall/ranking', {
        schoolIds: selectedSchools.map(s => s.id),
      }),
    enabled: false,
  });

  const handleSubmitReview = () => {
    if (!selectedProfile) {
      toast.error('请先选择一个档案');
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
      toast.error('请至少选择一所学校');
      return;
    }
    fetchRanking();
  };

  const getRankIcon = (percentile: number) => {
    if (percentile <= 25) return <ChevronUp className="h-4 w-4 text-green-500" />;
    if (percentile >= 75) return <ChevronDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-yellow-500" />;
  };

  return (
    <PageContainer>
      <PageHeader
        title={t('hall.title')}
        description="互评档案、查看排名、分享选校清单"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* 桌面端 Tabs */}
        <TabsList className="mb-6 hidden h-auto gap-1 bg-transparent p-0 sm:flex">
          <TabsTrigger
            value="review"
            className="gap-2 rounded-lg border bg-card px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-primary/5"
          >
            <Users className="h-4 w-4" />
            {t('hall.tabs.review')}
          </TabsTrigger>
          <TabsTrigger
            value="ranking"
            className="gap-2 rounded-lg border bg-card px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-primary/5"
          >
            <Trophy className="h-4 w-4" />
            {t('hall.tabs.ranking')}
          </TabsTrigger>
          <TabsTrigger
            value="lists"
            className="gap-2 rounded-lg border bg-card px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-primary/5"
          >
            <List className="h-4 w-4" />
            {t('hall.tabs.lists')}
          </TabsTrigger>
        </TabsList>

        {/* 移动端 Select */}
        <div className="mb-6 sm:hidden">
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="review">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {t('hall.tabs.review')}
                </span>
              </SelectItem>
              <SelectItem value="ranking">
                <span className="flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  {t('hall.tabs.ranking')}
                </span>
              </SelectItem>
              <SelectItem value="lists">
                <span className="flex items-center gap-2">
                  <List className="h-4 w-4" />
                  {t('hall.tabs.lists')}
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Review Tab */}
        <TabsContent value="review" className="animate-fade-in">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Profile Selector Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  选择待评档案
                </CardTitle>
                <CardDescription>浏览并选择其他用户的公开档案进行评估</CardDescription>
              </CardHeader>
              <CardContent>
                <ProfileSelector
                  onSelect={setSelectedProfile}
                  selectedProfileId={selectedProfile?.id}
                />
              </CardContent>
            </Card>

            {/* Review Form Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Star className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>{t('hall.review.title')}</CardTitle>
                    <CardDescription>
                      {selectedProfile
                        ? `评估 ${selectedProfile.targetMajor || '未知专业'} 申请者`
                        : '以招生官视角评估档案'}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {!selectedProfile ? (
                  <EmptyState
                    type="empty"
                    title="请先选择档案"
                    description="从左侧列表选择一个公开档案进行评估"
                  />
                ) : (
                  <>
                    {/* Selected profile summary */}
                    <div className="rounded-lg bg-muted/50 p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
                          <GraduationCap className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium">{selectedProfile.targetMajor || '未指定专业'}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {selectedProfile.gpa && (
                              <span>GPA {Number(selectedProfile.gpa).toFixed(2)}</span>
                            )}
                            {selectedProfile._count?.activities && (
                              <span>• {selectedProfile._count.activities} 活动</span>
                            )}
                            {selectedProfile._count?.awards && (
                              <span>• {selectedProfile._count.awards} 奖项</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Review criteria sliders */}
                    {REVIEW_CRITERIA.map((criteria) => (
                      <div key={criteria.key} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="flex items-center gap-2">
                              <criteria.icon className="h-4 w-4 text-muted-foreground" />
                              {criteria.label}
                            </Label>
                            <p className="text-xs text-muted-foreground">{criteria.description}</p>
                          </div>
                          <Badge variant={reviewScores[criteria.key] >= 7 ? 'default' : 'secondary'}>
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
                      </div>
                    ))}

                    <div className="space-y-2">
                      <Label>{t('hall.review.comment')}</Label>
                      <Textarea
                        placeholder="分享你对这位申请者的建议和评价..."
                        value={reviewScores.comment}
                        onChange={(e) =>
                          setReviewScores((p) => ({ ...p, comment: e.target.value }))
                        }
                        rows={4}
                      />
                    </div>

                    <Button
                      className="w-full"
                      onClick={handleSubmitReview}
                      disabled={submitReviewMutation.isPending}
                    >
                      {submitReviewMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      {t('hall.review.submitReview')}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Ranking Tab */}
        <TabsContent value="ranking" className="animate-fade-in">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* School Selection */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  选择目标院校
                </CardTitle>
                <CardDescription>选择想要查看排名的学校</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setSchoolSelectorOpen(true)}
                >
                  <GraduationCap className="mr-2 h-4 w-4" />
                  {selectedSchools.length > 0
                    ? `已选择 ${selectedSchools.length} 所学校`
                    : '选择学校'}
                </Button>

                {selectedSchools.length > 0 && (
                  <div className="space-y-2">
                    {selectedSchools.slice(0, 5).map((school) => (
                      <div
                        key={school.id}
                        className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm"
                      >
                        <span className="truncate">{school.nameZh || school.name}</span>
                        {school.usNewsRank && (
                          <Badge variant="outline">#{school.usNewsRank}</Badge>
                        )}
                      </div>
                    ))}
                    {selectedSchools.length > 5 && (
                      <p className="text-center text-xs text-muted-foreground">
                        还有 {selectedSchools.length - 5} 所学校...
                      </p>
                    )}
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={handleFetchRanking}
                  disabled={selectedSchools.length === 0 || rankingLoading}
                >
                  {rankingLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <TrendingUp className="mr-2 h-4 w-4" />
                  )}
                  查看排名
                </Button>
              </CardContent>
            </Card>

            {/* Ranking Results */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Trophy className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>{t('hall.ranking.title')}</CardTitle>
                    <CardDescription>查看你在目标院校申请者中的排名</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {rankingLoading ? (
                  <LoadingState variant="card" count={3} />
                ) : rankingResults?.rankings && rankingResults.rankings.length > 0 ? (
                  <div className="space-y-4">
                    {rankingResults.rankings.map((result) => (
                      <div key={result.schoolId} className="rounded-lg border p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{result.schoolName}</h4>
                            <p className="text-sm text-muted-foreground">
                              共 {result.totalApplicants} 位申请者
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {getRankIcon(result.percentile)}
                            <div className="text-right">
                              <p className="text-2xl font-bold text-primary">
                                #{result.yourRank}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Top {result.percentile}%
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                          <div className="rounded bg-muted/50 p-2 text-center">
                            <p className="text-xs text-muted-foreground">GPA</p>
                            <Progress value={result.breakdown.gpa} className="mt-1 h-1" />
                            <p className="mt-1 text-xs font-medium">{result.breakdown.gpa}%</p>
                          </div>
                          <div className="rounded bg-muted/50 p-2 text-center">
                            <p className="text-xs text-muted-foreground">活动</p>
                            <Progress value={result.breakdown.activities} className="mt-1 h-1" />
                            <p className="mt-1 text-xs font-medium">{result.breakdown.activities}%</p>
                          </div>
                          <div className="rounded bg-muted/50 p-2 text-center">
                            <p className="text-xs text-muted-foreground">奖项</p>
                            <Progress value={result.breakdown.awards} className="mt-1 h-1" />
                            <p className="mt-1 text-xs font-medium">{result.breakdown.awards}%</p>
                          </div>
                          <div className="rounded bg-muted/50 p-2 text-center">
                            <p className="text-xs text-muted-foreground">标化</p>
                            <Progress value={result.breakdown.testScores} className="mt-1 h-1" />
                            <p className="mt-1 text-xs font-medium">{result.breakdown.testScores}%</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Trophy className="h-12 w-12" />}
                    title="选择学校查看排名"
                    description="排名基于匿名档案数据计算，帮助你了解竞争情况"
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Lists Tab */}
        <TabsContent value="lists" className="animate-fade-in">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">{t('hall.lists.title')}</h2>
            <Button onClick={() => setCreateListOpen(true)}>
              <List className="mr-2 h-4 w-4" />
              {t('hall.lists.createList')}
            </Button>
          </div>

          {listsLoading ? (
            <LoadingState variant="card" count={4} />
          ) : publicLists?.items && publicLists.items.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {publicLists.items.map((list: any, index: number) => (
                <Card
                  key={list.id}
                  className="cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 animate-initial animate-fade-in-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{list.title}</CardTitle>
                        <CardDescription className="line-clamp-2">
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
                      <span>By {list.user?.email?.split('@')[0] || '匿名'}</span>
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="h-4 w-4" />
                        {list._count?.votes || 0}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              type="no-data"
              title="暂无公开清单"
              description="成为第一个分享选校清单的人！"
              action={{ label: '创建清单', onClick: () => setCreateListOpen(true) }}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* School Selector Dialog */}
      <SchoolSelector
        open={schoolSelectorOpen}
        onOpenChange={setSchoolSelectorOpen}
        selectedSchools={selectedSchools}
        onSelect={setSelectedSchools}
        maxSelection={10}
        title="选择目标院校"
      />

      {/* Create List Dialog */}
      <CreateListDialog
        open={createListOpen}
        onOpenChange={setCreateListOpen}
      />
    </PageContainer>
  );
}
