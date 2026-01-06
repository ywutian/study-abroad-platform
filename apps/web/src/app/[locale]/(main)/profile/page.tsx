'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/layout';
import { LoadingState } from '@/components/ui/loading-state';
import { TestScoreForm, ActivityForm, AwardForm, SchoolSelector } from '@/components/features';
import {
  Download,
  FileText,
  Save,
  User,
  GraduationCap,
  Award,
  Target,
  Shield,
  BookOpen,
  BarChart,
  Plus,
  Pencil,
  Trash2,
  Trophy,
} from 'lucide-react';

const GRADES = [
  { value: 'FRESHMAN', label: 'Freshman (9th)', labelZh: '高一' },
  { value: 'SOPHOMORE', label: 'Sophomore (10th)', labelZh: '高二' },
  { value: 'JUNIOR', label: 'Junior (11th)', labelZh: '高三' },
  { value: 'SENIOR', label: 'Senior (12th)', labelZh: '高四' },
  { value: 'GAP_YEAR', label: 'Gap Year', labelZh: 'Gap Year' },
];

const BUDGET_TIERS = [
  { value: 'LOW', label: '< $30,000/年' },
  { value: 'MEDIUM', label: '$30,000 - $50,000/年' },
  { value: 'HIGH', label: '$50,000 - $70,000/年' },
  { value: 'UNLIMITED', label: '> $70,000/年' },
];

const VISIBILITY_OPTIONS = [
  { value: 'PRIVATE', labelKey: 'profile.visibilityOptions.private', description: '仅自己可见' },
  { value: 'ANONYMOUS', labelKey: 'profile.visibilityOptions.anonymous', description: '匿名展示' },
  { value: 'VERIFIED_ONLY', labelKey: 'profile.visibilityOptions.verifiedOnly', description: '仅认证用户可见' },
];

const TAB_CONFIG = [
  { value: 'basic', label: '基本信息', icon: User },
  { value: 'scores', label: '标化成绩', icon: BarChart },
  { value: 'gpa', label: 'GPA', icon: GraduationCap },
  { value: 'activities', label: '活动', icon: BookOpen },
  { value: 'awards', label: '奖项', icon: Award },
  { value: 'targets', label: '目标院校', icon: Target },
  { value: 'privacy', label: '隐私', icon: Shield },
];

const ACTIVITY_CATEGORY_LABELS: Record<string, string> = {
  ACADEMIC: '学术研究',
  ARTS: '艺术',
  ATHLETICS: '体育',
  COMMUNITY_SERVICE: '社区服务',
  LEADERSHIP: '领导力',
  WORK: '工作/实习',
  RESEARCH: '科研',
  OTHER: '其他',
};

const AWARD_LEVEL_LABELS: Record<string, string> = {
  SCHOOL: '校级',
  REGIONAL: '区域级',
  STATE: '省/州级',
  NATIONAL: '国家级',
  INTERNATIONAL: '国际级',
};

export default function ProfilePage() {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('basic');

  // Form dialogs state
  const [scoreFormOpen, setScoreFormOpen] = useState(false);
  const [activityFormOpen, setActivityFormOpen] = useState(false);
  const [awardFormOpen, setAwardFormOpen] = useState(false);
  const [schoolSelectorOpen, setSchoolSelectorOpen] = useState(false);
  const [editingScore, setEditingScore] = useState<any>(null);
  const [editingActivity, setEditingActivity] = useState<any>(null);
  const [editingAward, setEditingAward] = useState<any>(null);
  const [targetSchools, setTargetSchools] = useState<any[]>([]);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiClient.get<any>('/profiles/me'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiClient.put('/profiles/me', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success(t('common.success'));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteScoreMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/profiles/me/test-scores/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('成绩已删除');
    },
  });

  const deleteActivityMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/profiles/me/activities/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('活动已删除');
    },
  });

  const deleteAwardMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/profiles/me/awards/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('奖项已删除');
    },
  });

  const [formData, setFormData] = useState({
    grade: '',
    currentSchool: '',
    gpa: '',
    gpaScale: '4.0',
    targetMajor: '',
    budgetTier: '',
    visibility: 'PRIVATE',
  });

  useEffect(() => {
    if (profile) {
      setFormData((prev) => ({
        ...prev,
        grade: profile.grade || '',
        currentSchool: profile.currentSchool || '',
        gpa: profile.gpa?.toString() || '',
        gpaScale: profile.gpaScale?.toString() || '4.0',
        targetMajor: profile.targetMajor || '',
        budgetTier: profile.budgetTier || '',
        visibility: profile.visibility || 'PRIVATE',
      }));
    }
  }, [profile]);

  const handleSave = () => {
    updateMutation.mutate({
      ...formData,
      gpa: formData.gpa ? parseFloat(formData.gpa) : null,
      gpaScale: parseFloat(formData.gpaScale),
    });
  };

  const handleEditScore = (score: any) => {
    setEditingScore(score);
    setScoreFormOpen(true);
  };

  const handleEditActivity = (activity: any) => {
    setEditingActivity(activity);
    setActivityFormOpen(true);
  };

  const handleEditAward = (award: any) => {
    setEditingAward(award);
    setAwardFormOpen(true);
  };

  if (isLoading) {
    return (
      <PageContainer maxWidth="4xl">
        <LoadingState variant="profile" />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="4xl">
      <PageHeader title={t('profile.title')} description="管理你的留学申请档案">
        <Button variant="outline" size="sm">
          <FileText className="mr-2 h-4 w-4" />
          {t('profile.exportResume')}
        </Button>
        <Button variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          {t('profile.exportData')}
        </Button>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* 桌面端 Tabs */}
        <TabsList className="mb-6 hidden h-auto flex-wrap gap-1 bg-transparent p-0 md:flex">
          {TAB_CONFIG.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="gap-2 rounded-lg border bg-card px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-primary/5"
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* 移动端 Select */}
        <div className="mb-6 md:hidden">
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TAB_CONFIG.map((tab) => (
                <SelectItem key={tab.value} value={tab.value}>
                  <span className="flex items-center gap-2">
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 基本信息 */}
        <TabsContent value="basic" className="animate-fade-in">
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.basicInfo')}</CardTitle>
              <CardDescription>填写你的基本信息</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t('profile.fields.grade')}</Label>
                  <Select value={formData.grade} onValueChange={(v) => setFormData((p) => ({ ...p, grade: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择年级" />
                    </SelectTrigger>
                    <SelectContent>
                      {GRADES.map((g) => (
                        <SelectItem key={g.value} value={g.value}>
                          {g.labelZh}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('profile.fields.currentSchool')}</Label>
                  <Input
                    value={formData.currentSchool}
                    onChange={(e) => setFormData((p) => ({ ...p, currentSchool: e.target.value }))}
                    placeholder="你目前就读的学校"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('profile.fields.targetMajor')}</Label>
                <Input
                  value={formData.targetMajor}
                  onChange={(e) => setFormData((p) => ({ ...p, targetMajor: e.target.value }))}
                  placeholder="例如：计算机科学、经济学"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('profile.fields.budget')}</Label>
                <Select value={formData.budgetTier} onValueChange={(v) => setFormData((p) => ({ ...p, budgetTier: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择预算范围" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUDGET_TIERS.map((b) => (
                      <SelectItem key={b.value} value={b.value}>
                        {b.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 标化成绩 */}
        <TabsContent value="scores" className="animate-fade-in">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t('profile.testScores')}</CardTitle>
                <CardDescription>添加你的标准化考试成绩</CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setEditingScore(null);
                  setScoreFormOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                添加成绩
              </Button>
            </CardHeader>
            <CardContent>
              {profile?.testScores?.length > 0 ? (
                <div className="space-y-3">
                  {profile.testScores.map((score: any) => (
                    <div
                      key={score.id}
                      className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <BarChart className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{score.type}</p>
                          <p className="text-2xl font-bold text-primary">{score.score}</p>
                          {score.subScores && (
                            <p className="text-xs text-muted-foreground">
                              {Object.entries(score.subScores)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(' | ')}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEditScore(score)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => deleteScoreMutation.mutate(score.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <BarChart className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p>暂无成绩记录</p>
                  <p className="text-sm">点击"添加成绩"开始录入</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* GPA */}
        <TabsContent value="gpa" className="animate-fade-in">
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.gpa')}</CardTitle>
              <CardDescription>输入你的 GPA 信息</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>GPA</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="5"
                    value={formData.gpa}
                    onChange={(e) => setFormData((p) => ({ ...p, gpa: e.target.value }))}
                    placeholder="例如：3.85"
                  />
                </div>
                <div className="space-y-2">
                  <Label>GPA 满分</Label>
                  <Select value={formData.gpaScale} onValueChange={(v) => setFormData((p) => ({ ...p, gpaScale: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4.0">4.0 制</SelectItem>
                      <SelectItem value="5.0">5.0 制（加权）</SelectItem>
                      <SelectItem value="100">百分制</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 活动 */}
        <TabsContent value="activities" className="animate-fade-in">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t('profile.activities')}</CardTitle>
                <CardDescription>添加你的课外活动经历</CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setEditingActivity(null);
                  setActivityFormOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                添加活动
              </Button>
            </CardHeader>
            <CardContent>
              {profile?.activities?.length > 0 ? (
                <div className="space-y-3">
                  {profile.activities.map((activity: any) => (
                    <div
                      key={activity.id}
                      className="flex items-start justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                          <BookOpen className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{activity.name}</p>
                            <Badge variant="secondary" className="text-xs">
                              {ACTIVITY_CATEGORY_LABELS[activity.category] || activity.category}
                            </Badge>
                            {activity.isOngoing && (
                              <Badge variant="outline" className="text-xs text-green-600">
                                进行中
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{activity.role}</p>
                          {activity.description && (
                            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                              {activity.description}
                            </p>
                          )}
                          {(activity.hoursPerWeek || activity.weeksPerYear) && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {activity.hoursPerWeek && `${activity.hoursPerWeek}小时/周`}
                              {activity.hoursPerWeek && activity.weeksPerYear && ' · '}
                              {activity.weeksPerYear && `${activity.weeksPerYear}周/年`}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEditActivity(activity)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => deleteActivityMutation.mutate(activity.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <BookOpen className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p>暂无活动记录</p>
                  <p className="text-sm">点击"添加活动"开始录入</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 奖项 */}
        <TabsContent value="awards" className="animate-fade-in">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t('profile.awards')}</CardTitle>
                <CardDescription>添加你的荣誉和奖项</CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setEditingAward(null);
                  setAwardFormOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                添加奖项
              </Button>
            </CardHeader>
            <CardContent>
              {profile?.awards?.length > 0 ? (
                <div className="space-y-3">
                  {profile.awards.map((award: any) => (
                    <div
                      key={award.id}
                      className="flex items-start justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/10">
                          <Trophy className="h-5 w-5 text-yellow-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{award.name}</p>
                            <Badge
                              variant="secondary"
                              className={
                                award.level === 'INTERNATIONAL'
                                  ? 'bg-purple-500/10 text-purple-600'
                                  : award.level === 'NATIONAL'
                                    ? 'bg-red-500/10 text-red-600'
                                    : ''
                              }
                            >
                              {AWARD_LEVEL_LABELS[award.level] || award.level}
                            </Badge>
                          </div>
                          {award.year && <p className="text-sm text-muted-foreground">{award.year}年</p>}
                          {award.description && (
                            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{award.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEditAward(award)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => deleteAwardMutation.mutate(award.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <Trophy className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p>暂无奖项记录</p>
                  <p className="text-sm">点击"添加奖项"开始录入</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 目标院校 */}
        <TabsContent value="targets" className="animate-fade-in">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t('profile.targetSchools')}</CardTitle>
                <CardDescription>选择你的目标院校（冲刺/匹配/保底）</CardDescription>
              </div>
              <Button size="sm" onClick={() => setSchoolSelectorOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                添加学校
              </Button>
            </CardHeader>
            <CardContent>
              {targetSchools.length > 0 ? (
                <div className="space-y-3">
                  {targetSchools.map((school: any) => (
                    <div
                      key={school.id}
                      className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                          <GraduationCap className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{school.nameZh || school.name}</p>
                            {school.usNewsRank && (
                              <Badge variant="outline" className="text-xs">
                                #{school.usNewsRank}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{school.name}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => setTargetSchools(targetSchools.filter((s: any) => s.id !== school.id))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <Target className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p>暂无目标院校</p>
                  <p className="text-sm">点击"添加学校"开始选择</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 隐私设置 */}
        <TabsContent value="privacy" className="animate-fade-in">
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.visibility')}</CardTitle>
              <CardDescription>控制谁可以查看你的档案</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup
                value={formData.visibility}
                onValueChange={(v) => setFormData((p) => ({ ...p, visibility: v }))}
                className="space-y-3"
              >
                {VISIBILITY_OPTIONS.map((opt) => (
                  <div
                    key={opt.value}
                    className="flex items-start space-x-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                  >
                    <RadioGroupItem value={opt.value} id={opt.value} className="mt-0.5" />
                    <div className="space-y-1">
                      <Label htmlFor={opt.value} className="cursor-pointer font-medium">
                        {t(opt.labelKey)}
                      </Label>
                      <p className="text-sm text-muted-foreground">{opt.description}</p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline">{t('common.cancel')}</Button>
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {updateMutation.isPending ? t('common.loading') : t('common.save')}
        </Button>
      </div>

      {/* 表单弹窗 */}
      <TestScoreForm
        open={scoreFormOpen}
        onOpenChange={(open) => {
          setScoreFormOpen(open);
          if (!open) setEditingScore(null);
        }}
        editingScore={editingScore}
      />
      <ActivityForm
        open={activityFormOpen}
        onOpenChange={(open) => {
          setActivityFormOpen(open);
          if (!open) setEditingActivity(null);
        }}
        editingActivity={editingActivity}
      />
      <AwardForm
        open={awardFormOpen}
        onOpenChange={(open) => {
          setAwardFormOpen(open);
          if (!open) setEditingAward(null);
        }}
        editingAward={editingAward}
      />
      <SchoolSelector
        open={schoolSelectorOpen}
        onOpenChange={setSchoolSelectorOpen}
        selectedSchools={targetSchools}
        onSelect={setTargetSchools}
        maxSelection={15}
        title="选择目标院校"
      />
    </PageContainer>
  );
}
