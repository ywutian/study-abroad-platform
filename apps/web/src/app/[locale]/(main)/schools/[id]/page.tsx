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
import { PageContainer, PageHeader } from '@/components/layout';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { apiClient } from '@/lib/api';
import { useRouter } from '@/lib/i18n/navigation';
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
  CheckCircle,
  Clock,
  Target,
  Sparkles,
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

  const { data: school, isLoading, error } = useQuery({
    queryKey: ['school', schoolId],
    queryFn: () => apiClient.get<SchoolDetail>(`/schools/${schoolId}`),
    enabled: !!schoolId,
  });

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
          title="学校未找到"
          description="该学校不存在或已被删除"
          action={{
            label: '返回排名',
            onClick: () => router.push('/ranking'),
          }}
        />
      </PageContainer>
    );
  }

  const deadlines = school.metadata?.deadlines || {};
  const requirements = school.metadata?.requirements || {};
  const essayPrompts = school.metadata?.essayPrompts || [];

  return (
    <PageContainer>
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回
        </Button>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              {school.usNewsRank && (
                <Badge variant="default" className="text-lg px-3 py-1">
                  #{school.usNewsRank}
                </Badge>
              )}
              <h1 className="text-3xl font-bold">{school.nameZh || school.name}</h1>
            </div>
            {school.nameZh && (
              <p className="text-lg text-muted-foreground mb-2">{school.name}</p>
            )}
            <div className="flex items-center gap-4 text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {school.city ? `${school.city}, ` : ''}{school.state}, {school.country}
              </span>
              {school.website && (
                <a
                  href={school.website.startsWith('http') ? school.website : `https://${school.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-primary"
                >
                  <ExternalLink className="h-4 w-4" />
                  官网
                </a>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Bookmark className="mr-2 h-4 w-4" />
              收藏
            </Button>
            <Button variant="outline" size="sm">
              <Share2 className="mr-2 h-4 w-4" />
              分享
            </Button>
          </div>
        </div>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Target className="h-4 w-4" />
              <span className="text-sm">录取率</span>
            </div>
            <div className="text-2xl font-bold">
              {school.acceptanceRate ? `${Number(school.acceptanceRate).toFixed(1)}%` : 'N/A'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm">年学费</span>
            </div>
            <div className="text-2xl font-bold">
              {school.tuition ? `$${school.tuition.toLocaleString()}` : 'N/A'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">毕业薪资</span>
            </div>
            <div className="text-2xl font-bold">
              {school.avgSalary ? `$${school.avgSalary.toLocaleString()}` : 'N/A'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-sm">学生人数</span>
            </div>
            <div className="text-2xl font-bold">
              {school.studentCount ? school.studentCount.toLocaleString() : 'N/A'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="admission">申请信息</TabsTrigger>
          <TabsTrigger value="essays">文书题目</TabsTrigger>
          <TabsTrigger value="cases">录取案例</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Academic Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  学术数据
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">US News 排名</span>
                  <span className="font-semibold">#{school.usNewsRank || 'N/A'}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">SAT 平均分</span>
                  <span className="font-semibold">{school.satAvg || requirements.satRange || 'N/A'}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">ACT 平均分</span>
                  <span className="font-semibold">{school.actAvg || requirements.actRange || 'N/A'}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">毕业率</span>
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
                  申请截止日期
                </CardTitle>
                <CardDescription>
                  {school.metadata?.applicationCycle || '2025-2026'} 申请季
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {deadlines.rea && (
                  <>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive">REA</Badge>
                        <span>限制性早申请</span>
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
                        <span>早申请</span>
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
                        <span>早决定</span>
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
                        <span>早决定 II</span>
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
                      <span>常规申请</span>
                    </div>
                    <span className="font-semibold">{deadlines.rd}</span>
                  </div>
                )}
                {Object.keys(deadlines).length === 0 && (
                  <p className="text-muted-foreground text-center py-4">暂无截止日期数据</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Description */}
          {(school.descriptionZh || school.description) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">学校简介</CardTitle>
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
                <CardTitle className="text-lg">申请要求</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">申请类型</span>
                  <Badge>{school.metadata?.applicationType?.toUpperCase() || 'RD'}</Badge>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">文书数量</span>
                  <span className="font-semibold">{school.metadata?.essayCount || 'N/A'} 篇</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">申请费</span>
                  <span className="font-semibold">
                    {requirements.applicationFee ? `$${requirements.applicationFee}` : 'N/A'}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">TOEFL 最低分</span>
                  <span className="font-semibold">{requirements.toeflMin || 'N/A'}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">IELTS 最低分</span>
                  <span className="font-semibold">{requirements.ieltsMin || 'N/A'}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">录取难度分析</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted-foreground">录取竞争度</span>
                    <span className="text-sm font-medium">
                      {school.acceptanceRate && Number(school.acceptanceRate) < 10
                        ? '极高'
                        : Number(school.acceptanceRate) < 20
                        ? '很高'
                        : Number(school.acceptanceRate) < 40
                        ? '较高'
                        : '中等'}
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
                    AI 选校建议
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {school.acceptanceRate && Number(school.acceptanceRate) < 10
                      ? '该校录取率极低，建议作为冲刺校申请，同时确保有足够的匹配校和保底校。'
                      : Number(school.acceptanceRate) < 20
                      ? '该校竞争激烈，需要在标化成绩、活动和文书上都有亮点。'
                      : '该校录取率适中，如果你的背景与学校匹配度高，可以作为匹配校。'}
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
                补充文书题目
              </CardTitle>
              <CardDescription>
                {school.metadata?.applicationCycle || '2025-2026'} 申请季
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
                  <p className="text-muted-foreground">暂无文书题目数据</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    文书题目通常在每年 8 月 1 日 Common App 开放后更新
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
                录取案例
              </CardTitle>
              <CardDescription>
                来自平台用户提交的真实录取案例
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
                              ? '录取'
                              : case_.result === 'REJECTED'
                              ? '拒绝'
                              : case_.result === 'WAITLISTED'
                              ? 'Waitlist'
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
                  <p className="text-muted-foreground">暂无录取案例</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    成为第一个分享录取经历的用户
                  </p>
                  <Button className="mt-4" onClick={() => router.push('/cases')}>
                    提交我的案例
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




